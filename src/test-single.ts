/**
 * 单个 URL 截图测试脚本
 * 用于本地调试，不需要 API 配置
 * 
 * 用法: npm run test:single -- https://example.com
 */

import { initBrowser, closeBrowser, takeScreenshot } from './screenshot.js';
import { writeFileSync } from 'fs';

async function main() {
    const url = process.argv[2];

    if (!url) {
        console.error('用法: npm run test:single -- <URL>');
        console.error('示例: npm run test:single -- https://example.com');
        process.exit(1);
    }

    console.log('='.repeat(60));
    console.log('🧪 单个 URL 截图测试');
    console.log(`📎 URL: ${url}`);
    console.log('='.repeat(60));

    try {
        await initBrowser();

        const result = await takeScreenshot(url);

        if (result.success && result.data) {
            const outputPath = 'test-screenshot.jpg';
            writeFileSync(outputPath, result.data);
            console.log(`\n✅ 截图已保存: ${outputPath}`);
            console.log(`📦 文件大小: ${result.data.length} bytes`);
        } else {
            console.error(`\n❌ 截图失败: ${result.error}`);
            process.exit(1);
        }
    } finally {
        await closeBrowser();
    }
}

main().catch(console.error);
