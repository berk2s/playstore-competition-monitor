import fs from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from './config.ts';
import { logger } from './logger.ts';

export interface StoredImage {
  key: string;
  url: string;
}

export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<StoredImage>;
}

export class LocalDriver implements StorageDriver {
  private readonly root: string;
  private readonly publicBaseUrl: string;
  constructor(root: string, publicBaseUrl: string = config.PUBLIC_ASSET_BASE_URL) {
    this.root = path.resolve(root);
    this.publicBaseUrl = publicBaseUrl;
  }
  async put(key: string, body: Buffer): Promise<StoredImage> {
    const abs = path.join(this.root, key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, body);
    const url = `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    return { key, url };
  }
}

export class S3Driver implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  constructor(bucket: string, region: string, publicBaseUrl: string = config.PUBLIC_ASSET_BASE_URL) {
    this.bucket = bucket;
    this.client = new S3Client({ region });
    this.publicBaseUrl = publicBaseUrl;
  }
  async put(key: string, body: Buffer, contentType: string): Promise<StoredImage> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    const url = `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    return { key, url };
  }
}

export function makeStorage(): StorageDriver {
  if (config.STORAGE_DRIVER === 's3') {
    if (!config.S3_BUCKET) throw new Error('S3_BUCKET required when STORAGE_DRIVER=s3');
    logger.info({ bucket: config.S3_BUCKET, region: config.S3_REGION }, 'storage: s3');
    return new S3Driver(config.S3_BUCKET, config.S3_REGION);
  }
  logger.info({ dir: config.LOCAL_STORAGE_DIR }, 'storage: local');
  return new LocalDriver(config.LOCAL_STORAGE_DIR);
}
