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

    try {
        // 1. 获取待处理资源
        const resources = await fetchNeededResources();

        if (resources.length === 0) {
            console.log('✨ 没有需要处理的资源，任务完成');
            return;
        }

        console.log(`\n📋 开始处理 ${resources.length} 个资源...\n`);

        // 2. 初始化浏览器
        await initBrowser();

        // 3. 循环处理每个资源
        for (let i = 0; i < resources.length; i++) {
            const resource = resources[i];
            console.log(`\n[${i + 1}/${resources.length}] 处理: ${resource.url}`);
            console.log('-'.repeat(50));

            const result = await processResource(resource.id, resource.url);

            // 4. 回填结果到数据库
            try {
                if (result.success && result.screenshotUrl) {
                    await updateResourceScreenshot(resource.id, {
                        screenshotUrl: result.screenshotUrl,
                        screenshotUpdatedAt: new Date().toISOString(),
                    });
                    successCount++;
                } else {
                    await updateResourceScreenshot(resource.id, {
                        screenshotError: result.error || '未知错误',
                    });
                    failCount++;
                }
            } catch (updateError) {
                console.error(`❌ 回填失败: ${resource.id}`, updateError);
                failCount++;
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

// 运行主函数
main().catch(console.error);
