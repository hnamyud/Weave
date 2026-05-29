import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { v7 as uuidv7 } from 'uuid';
import { getUploadConfig } from '../../config/r2.config';
import { CheckFileDto } from './dto/check-file.dto';
import { FileMetadataDto } from './dto/file-metadata.dto';
import { PresignFileDto } from './dto/presign-file.dto';
import { R2StorageService } from './r2-storage.service';

@Injectable()
export class FileService {
  private readonly uploadConfig: ReturnType<typeof getUploadConfig>;
  private readonly allowedMimeTypes = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: R2StorageService,
    private readonly configService: ConfigService,
  ) {
    this.uploadConfig = getUploadConfig(configService);
  }

  async checkFile(dto: CheckFileDto) {
    this.validateMetadata(dto);
    const file = await this.findExistingFile(dto.fileHash, dto.fileSize);

    if (!file) {
      return {
        exists: false,
      };
    }

    return {
      exists: true,
      file,
    };
  }

  async createPresignedUpload(dto: PresignFileDto) {
    this.validateMetadata(dto);
    const file = await this.findExistingFile(dto.fileHash, dto.fileSize);

    if (file) {
      return {
        exists: true,
        file,
      };
    }

    const storageKey = this.getExpectedStorageKey(dto.fileHash);
    const presignedUpload = await this.storageService.createPresignedUpload(
      storageKey,
      dto.fileType,
    );

    return {
      exists: false,
      storageKey,
      ...presignedUpload,
    };
  }

  validateMessageAttachments(attachments: FileMetadataDto[] = []) {
    if (attachments.length > this.uploadConfig.maxFilesPerMessage) {
      throw new BadRequestException(
        `A message can include at most ${this.uploadConfig.maxFilesPerMessage} attachments`,
      );
    }

    attachments.forEach((attachment) => this.validateMetadata(attachment));
  }

  getExpectedStorageKey(fileHash: string) {
    return `files/sha256/${fileHash.slice(0, 2)}/${fileHash}`;
  }

  async ensureFileObject(
    params: {
      metadata: FileMetadataDto;
      uploaderId: string;
    },
    tx: Prisma.TransactionClient | PrismaService | PrismaClient = this.prisma,
  ) {
    this.validateMetadata(params.metadata);

    const expectedStorageKey = this.getExpectedStorageKey(
      params.metadata.fileHash,
    );
    if (params.metadata.storageKey !== expectedStorageKey) {
      throw new BadRequestException(
        'storageKey does not match the expected file hash key',
      );
    }

    const existingFile = await this.findExistingFile(
      params.metadata.fileHash,
      params.metadata.fileSize,
      tx,
    );

    if (existingFile) {
      return existingFile;
    }

    try {
      await this.storageService.headObject(expectedStorageKey);
    } catch {
      throw new NotFoundException(
        'Uploaded file object was not found in storage',
      );
    }

    return tx.fileObject.create({
      data: {
        id: uuidv7(),
        storageKey: expectedStorageKey,
        fileHash: params.metadata.fileHash,
        fileName: params.metadata.fileName,
        fileType: params.metadata.fileType,
        fileSize: params.metadata.fileSize,
        uploaderId: params.uploaderId,
      },
      select: {
        id: true,
        storageKey: true,
        fileHash: true,
        fileName: true,
        fileType: true,
        fileSize: true,
      },
    });
  }

  private validateMetadata(dto: FileMetadataDto) {
    if (!/^[a-f0-9]{64}$/.test(dto.fileHash)) {
      throw new BadRequestException(
        'fileHash must be a lowercase SHA-256 hex string',
      );
    }

    if (!Number.isInteger(dto.fileSize) || dto.fileSize < 1) {
      throw new BadRequestException('fileSize must be a positive integer');
    }

    if (dto.fileSize > this.uploadConfig.maxFileSizeBytes) {
      throw new BadRequestException(
        'File exceeds the configured upload size limit',
      );
    }

    if (!this.allowedMimeTypes.has(dto.fileType)) {
      throw new BadRequestException('fileType is not allowed');
    }
  }

  private async findExistingFile(
    fileHash: string,
    fileSize: number,
    client: Prisma.TransactionClient | PrismaService | PrismaClient = this
      .prisma,
  ) {
    return client.fileObject.findUnique({
      where: {
        fileHash_fileSize: {
          fileHash,
          fileSize,
        },
      },
      select: {
        id: true,
        storageKey: true,
        fileHash: true,
        fileName: true,
        fileType: true,
        fileSize: true,
      },
    });
  }
}
