/**
 * Next.js API 调用模块
 * 与现有 Cloudflare Worker 使用相同的鉴权方式
 */

const API_BASE_URL = process.env.API_BASE_URL!;
const DATABASE_API_KEY = process.env.DATABASE_API_KEY!;

export interface Resource {
    id: string;
    url: string;
}

export interface NeededResponse {
    success: boolean;
    total: number;
    resources: Resource[];
}

export interface UpdatePayload {
    screenshotUrl?: string;
    screenshotUpdatedAt?: string;
    screenshotError?: string;
}

/**
 * 获取待截图的资源列表
 * 调用: GET /api/admin/resources/screenshot/needed
 */
export async function fetchNeededResources(): Promise<Resource[]> {
    const url = `${API_BASE_URL}/api/admin/resources/screenshot/needed`;

    console.log(`📋 正在获取待截图资源列表...`);

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${DATABASE_API_KEY}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`获取资源列表失败: ${response.status} ${response.statusText}`);
    }

    const data: NeededResponse = await response.json();

    console.log(`✅ 获取到 ${data.total} 个待处理资源`);

    return data.resources;
}

/**
 * 更新资源的截图信息
 * 调用: PATCH /api/admin/resources/screenshot/[id]
 */
export async function updateResourceScreenshot(
    resourceId: string,
    payload: UpdatePayload
): Promise<void> {
    const url = `${API_BASE_URL}/api/admin/resources/screenshot/${resourceId}`;

    console.log(`📝 正在更新资源截图信息: ${resourceId}`);

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${DATABASE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`更新资源失败: ${response.status} - ${errorText}`);
    }

    console.log(`✅ 资源更新成功: ${resourceId}`);
}

/**
 * 验证 API 配置是否完整
 */
export function validateApiConfig(): boolean {
    const required = ['API_BASE_URL', 'DATABASE_API_KEY'];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error(`❌ 缺少 API 配置: ${missing.join(', ')}`);
        return false;
    }

    return true;
}
