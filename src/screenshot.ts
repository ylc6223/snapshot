/**
 * Playwright 截图模块
 * 配置与现有 Cloudflare Worker 保持一致
 */

import { chromium, Browser, Page } from 'playwright';

// 截图配置（与现有 Worker 一致）
const CONFIG = {
    VIEWPORT_WIDTH: 1200,
    VIEWPORT_HEIGHT: 800,
    SCREENSHOT_TIMEOUT: 30000,  // 30 秒
    WAIT_AFTER_LOAD: 3000,      // 3 秒渲染等待
    JPEG_QUALITY: 80,
};

export interface ScreenshotResult {
    success: boolean;
    data?: Buffer;
    error?: string;
}

let browser: Browser | null = null;

/**
 * 初始化浏览器实例
 */
export async function initBrowser(): Promise<void> {
    if (browser) return;

    console.log('🚀 正在启动 Playwright 浏览器...');
    browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
        ],
    });
    console.log('✅ 浏览器启动成功');
}

/**
 * 关闭浏览器实例
 */
export async function closeBrowser(): Promise<void> {
    if (browser) {
        await browser.close();
        browser = null;
        console.log('🔒 浏览器已关闭');
    }
}

/**
 * 对单个 URL 进行截图
 */
export async function takeScreenshot(url: string): Promise<ScreenshotResult> {
    if (!browser) {
        await initBrowser();
    }

    let page: Page | null = null;

    try {
        console.log(`📸 正在截图: ${url}`);

        page = await browser!.newPage();

        // 设置视口尺寸
        await page.setViewportSize({
            width: CONFIG.VIEWPORT_WIDTH,
            height: CONFIG.VIEWPORT_HEIGHT,
        });

        // 导航到页面
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: CONFIG.SCREENSHOT_TIMEOUT,
        });

        // 等待页面渲染稳定
        await page.waitForTimeout(CONFIG.WAIT_AFTER_LOAD);

        // 截图
        const screenshot = await page.screenshot({
            type: 'jpeg',
            quality: CONFIG.JPEG_QUALITY,
            fullPage: false,
        });

        console.log(`✅ 截图成功: ${url} (${screenshot.length} bytes)`);

        return {
            success: true,
            data: screenshot,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ 截图失败: ${url} - ${errorMessage}`);

        return {
            success: false,
            error: errorMessage.slice(0, 500), // 截断到 500 字符
        };
    } finally {
        if (page) {
            await page.close();
        }
    }
}
