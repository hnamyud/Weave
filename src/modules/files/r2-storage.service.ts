import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Config, getUploadConfig } from '../../config/r2.config';

@Injectable()
export class R2StorageService {
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly uploadConfig: ReturnType<typeof getUploadConfig>;

  constructor(private readonly configService: ConfigService) {
    const r2Config = getR2Config(configService);
    this.uploadConfig = getUploadConfig(configService);
    this.bucketName = r2Config.bucketName;
    this.client = new S3Client({
      region: 'auto',
      endpoint: r2Config.endpointUrl,
      forcePathStyle: true,
      credentials: {
        accessKeyId: r2Config.accessKeyId,
        secretAccessKey: r2Config.secretAccessKey,
      },
    });
  }

  async createPresignedUpload(storageKey: string, fileType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.uploadConfig.signedUrlExpiresSec,
    });

    return {
      uploadUrl,
      expiresIn: this.uploadConfig.signedUrlExpiresSec,
      headers: {
        'Content-Type': fileType,
      },
    };
  }

  async headObject(storageKey: string) {
    await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      }),
    );
  }
}
