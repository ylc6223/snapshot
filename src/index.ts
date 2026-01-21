/**
 * Screenshot Service 主入口
 * 协调整个截图流程：获取任务 → 截图 → 上传 → 回填
 */

import { initBrowser, closeBrowser, takeScreenshot } from './screenshot.js';
import { uploadToR2, validateR2Config } from './r2.js';
import { fetchNeededResources, updateResourceScreenshot, validateApiConfig } from './api.js';

interface ProcessResult {
    resourceId: string;
    success: boolean;
    screenshotUrl?: string;
    error?: string;
}

/**
 * 处理单个资源的截图流程
 */
async function processResource(resourceId: string, url: string): Promise<ProcessResult> {
    const result: ProcessResult = { resourceId, success: false };

    try {
        // 1. 截图
        const screenshotResult = await takeScreenshot(url);

        if (!screenshotResult.success || !screenshotResult.data) {
            result.error = screenshotResult.error || '截图失败';
            return result;
        }

        // 2. 上传到 R2
        const uploadResult = await uploadToR2(resourceId, screenshotResult.data);

        if (!uploadResult.success || !uploadResult.url) {
            result.error = uploadResult.error || '上传失败';
            return result;
        }

        result.success = true;
        result.screenshotUrl = uploadResult.url;
        return result;
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        return result;
    }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
    console.log('='.repeat(60));
    console.log('📸 Screenshot Service 启动');
    console.log(`🕐 ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    // 验证配置
    if (!validateApiConfig()) {
        process.exit(1);
    }
    if (!validateR2Config()) {
        process.exit(1);
    }

    let successCount = 0;
    let failCount = 0;

    // 获取由 GitHub Actions 传入的指定 ID
    const resourceIdsStr = process.env.RESOURCE_IDS;
    const initialIds = resourceIdsStr ? resourceIdsStr.split(',').filter(id => id.trim()) : undefined;

    try {
        // 1. 初始化浏览器
        await initBrowser();

        if (initialIds && initialIds.length > 0) {
            // --- 精准模式 ---
            console.log(`🎯 进入精准模式，处理指定 ID: ${initialIds.length} 个`);
            const resources = await fetchNeededResources(initialIds);
            if (resources.length > 0) {
                const results = await processBatch(resources);
                successCount += results.success;
                failCount += results.fail;
            } else {
                console.log('⚠️ 未找到指定的资源记录');
            }
        } else {
            // --- 全量/深度模式 ---
            console.log('🌊 进入全量深度模式 (Until-Empty Logic)');
            let loopCount = 0;
            const MAX_LOOPS = 50; // 安全阈值，防止无限循环
            let hasMore = true;

            while (hasMore && loopCount < MAX_LOOPS) {
                loopCount++;
                console.log(`\n🔄 正在请求第 ${loopCount} 批任务...`);

                const resources = await fetchNeededResources();

                if (!resources || resources.length === 0) {
                    console.log('✨ 所有积压任务处理完毕');
                    hasMore = false;
                    break;
                }

                console.log(`📋 本批次开始处理 ${resources.length} 个资源...`);
                const results = await processBatch(resources);
                successCount += results.success;
                failCount += results.fail;

                // 如果本批次处理完已经是最后一批（后端通常有限额），则继续请求
                // 直到后端返回空列表为止
            }

            if (loopCount >= MAX_LOOPS) {
                console.warn(`🛑 达到最大循环次数 (${MAX_LOOPS})，优雅结束。`);
            }
        }
    } catch (error) {
        console.error('❌ 任务执行出错:', error);
        process.exit(1);
    } finally {
        // 5. 关闭浏览器
        await closeBrowser();
    }

    // 6. 输出统计
    console.log('\n' + '='.repeat(60));
    console.log('📊 任务完成统计');
    console.log(`   ✅ 成功: ${successCount}`);
    console.log(`   ❌ 失败: ${failCount}`);
    console.log(`   📝 总计: ${successCount + failCount}`);
    console.log('='.repeat(60));
}

/**
 * 集中处理一批资源
 */
async function processBatch(resources: any[]): Promise<{ success: number; fail: number }> {
    let success = 0;
    let fail = 0;

    for (let i = 0; i < resources.length; i++) {
        const resource = resources[i];
        console.log(`\n[子任务 ${i + 1}/${resources.length}] 处理: ${resource.url}`);
        console.log('-'.repeat(40));

        const result = await processResource(resource.id, resource.url);

        try {
            if (result.success && result.screenshotUrl) {
                await updateResourceScreenshot(resource.id, {
                    screenshotUrl: result.screenshotUrl,
                    screenshotUpdatedAt: new Date().toISOString(),
                });
                success++;
            } else {
                await updateResourceScreenshot(resource.id, {
                    screenshotError: result.error || '未知错误',
                });
                fail++;
            }
        } catch (updateError) {
            console.error(`❌ API 回填失败: ${resource.id}`, updateError);
            fail++;
        }
    }

    return { success, fail };
}

// 运行主函数
main().catch(console.error);
