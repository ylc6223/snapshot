/**
 * Cloudflare R2 上传模块
 * 使用 S3 兼容 API
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// 环境变量
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

// 创建 S3 客户端（R2 兼容）
const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

export interface UploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

/**
 * 上传截图到 R2
 * @param resourceId 资源 ID，用于生成文件名
 * @param imageData 图片二进制数据
 */
export async function uploadToR2(resourceId: string, imageData: Buffer): Promise<UploadResult> {
    const fileName = `screenshots/${resourceId}.jpg`;

    try {
        console.log(`📤 正在上传: ${fileName}`);

        await s3Client.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fileName,
            Body: imageData,
            ContentType: 'image/jpeg',
            CacheControl: 'public, max-age=604800', // 7 天缓存
        }));

        // 构建公共访问 URL
        const publicUrl = `${R2_PUBLIC_URL}/${fileName}`;

        console.log(`✅ 上传成功: ${publicUrl}`);

        return {
            success: true,
            url: publicUrl,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ 上传失败: ${fileName} - ${errorMessage}`);

        return {
            success: false,
            error: errorMessage.slice(0, 500),
        };
    }
}

/**
 * 验证 R2 配置是否完整
 */
export function validateR2Config(): boolean {
    const required = [
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_BUCKET_NAME',
        'R2_PUBLIC_URL',
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error(`❌ 缺少 R2 配置: ${missing.join(', ')}`);
        return false;
    }

    return true;
}
