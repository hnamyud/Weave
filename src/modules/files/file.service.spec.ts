import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

jest.mock('uuid', () => ({
  v7: () => 'file-object-id',
}));

import { FileService } from './file.service';
import { R2StorageService } from './r2-storage.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('FileService', () => {
  const prisma = {
    fileObject: {
      findUnique: jest.fn<(args: any) => Promise<any>>(),
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      create: jest.fn<(args: any) => Promise<any>>(),
    },
  };

  const storage = {
    createPresignedUpload:
      jest.fn<(storageKey: string, fileType: string) => Promise<any>>(),
    headObject:
      jest.fn<(storageKey: string) => Promise<{ ContentLength?: number }>>(),
  };

  const configService = {
    get: jest.fn<(key: string) => string | undefined>(),
  };

  let service: FileService;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockImplementation((key) => {
      const values: Record<string, string> = {
        MAX_UPLOAD_SIZE_MB: '15',
        SIGNED_URL_EXPIRES_SEC: '300',
        MAX_FILES_PER_MESSAGE: '5',
      };

      return values[key];
    });
    service = new FileService(
      prisma as unknown as PrismaService,
      storage as unknown as R2StorageService,
      configService as unknown as ConfigService,
    );
  });

  it('rejects invalid sha-256 metadata', async () => {
    await expect(
      service.checkFile({
        fileHash: 'not-a-hash',
        fileName: 'report.pdf',
        fileSize: 123,
        fileType: 'application/pdf',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects files above the configured size limit', async () => {
    await expect(
      service.checkFile({
        fileHash: 'a'.repeat(64),
        fileName: 'report.pdf',
        fileSize: 16 * 1024 * 1024,
        fileType: 'application/pdf',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects disallowed mime types', async () => {
    await expect(
      service.checkFile({
        fileHash: 'a'.repeat(64),
        fileName: 'script.sh',
        fileSize: 1024,
        fileType: 'application/x-sh',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns a deduplicated file hit when the file object exists', async () => {
    prisma.fileObject.findUnique.mockResolvedValue({
      id: 'file-object-id',
      storageKey: 'files/sha256/aa/hash',
      fileHash: 'a'.repeat(64),
      fileName: 'existing.pdf',
      fileType: 'application/pdf',
      fileSize: 123,
    });

    const result = await service.checkFile({
      fileHash: 'a'.repeat(64),
      fileName: 'report.pdf',
      fileSize: 123,
      fileType: 'application/pdf',
    });

    expect(prisma.fileObject.findUnique).toHaveBeenCalledWith({
      where: {
        fileHash_fileSize: {
          fileHash: 'a'.repeat(64),
          fileSize: 123,
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
    expect(result).toEqual({
      exists: true,
      file: {
        id: 'file-object-id',
        storageKey: 'files/sha256/aa/hash',
        fileHash: 'a'.repeat(64),
        fileName: 'existing.pdf',
        fileType: 'application/pdf',
        fileSize: 123,
      },
    });
  });

  it('creates a presigned upload for a new file with a deterministic storage key', async () => {
    prisma.fileObject.findUnique.mockResolvedValue(null);
    storage.createPresignedUpload.mockResolvedValue({
      uploadUrl: 'https://upload.test/presigned',
      expiresIn: 300,
      headers: {
        'Content-Type': 'application/pdf',
      },
    });

    const result = await service.createPresignedUpload({
      fileHash: 'a'.repeat(64),
      fileName: 'report.pdf',
      fileSize: 123,
      fileType: 'application/pdf',
    });

    expect(storage.createPresignedUpload).toHaveBeenCalledWith(
      'files/sha256/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'application/pdf',
    );
    expect(result).toEqual({
      exists: false,
      storageKey:
        'files/sha256/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      uploadUrl: 'https://upload.test/presigned',
      expiresIn: 300,
      headers: {
        'Content-Type': 'application/pdf',
      },
    });
  });

  it('does not create a presigned upload when the file object already exists', async () => {
    prisma.fileObject.findUnique.mockResolvedValue({
      id: 'file-object-id',
      storageKey: 'files/sha256/aa/hash',
      fileHash: 'a'.repeat(64),
      fileName: 'existing.pdf',
      fileType: 'application/pdf',
      fileSize: 123,
    });

    const result = await service.createPresignedUpload({
      fileHash: 'a'.repeat(64),
      fileName: 'report.pdf',
      fileSize: 123,
      fileType: 'application/pdf',
    });

    expect(storage.createPresignedUpload).not.toHaveBeenCalled();
    expect(result.exists).toBe(true);
  });

  it('verifies a newly uploaded object before creating a file object', async () => {
    prisma.fileObject.findUnique.mockResolvedValue(null);
    storage.headObject.mockResolvedValue({ ContentLength: 123 });
    prisma.fileObject.create.mockResolvedValue({
      id: 'new-file-object-id',
      storageKey:
        'files/sha256/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      fileHash: 'a'.repeat(64),
      fileName: 'report.pdf',
      fileType: 'application/pdf',
      fileSize: 123,
      uploaderId: 'user-id',
    });

    const result = await service.ensureFileObject(
      {
        metadata: {
          fileHash: 'a'.repeat(64),
          fileName: 'report.pdf',
          fileSize: 123,
          fileType: 'application/pdf',
          storageKey:
            'files/sha256/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
        uploaderId: 'user-id',
      },
      prisma as unknown as PrismaService,
    );

    expect(storage.headObject).toHaveBeenCalledWith(
      'files/sha256/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(prisma.fileObject.create).toHaveBeenCalled();
    expect(result.id).toBe('new-file-object-id');
  });

  it('maps missing uploaded objects to not found', async () => {
    prisma.fileObject.findUnique.mockResolvedValue(null);
    storage.headObject.mockRejectedValue(new Error('missing'));

    await expect(
      service.ensureFileObject(
        {
          metadata: {
            fileHash: 'a'.repeat(64),
            fileName: 'report.pdf',
            fileSize: 123,
            fileType: 'application/pdf',
            storageKey:
              'files/sha256/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
          uploaderId: 'user-id',
        },
        prisma as unknown as PrismaService,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects uploaded objects whose size does not match metadata', async () => {
    prisma.fileObject.findUnique.mockResolvedValue(null);
    storage.headObject.mockResolvedValue({ ContentLength: 999 });

    await expect(
      service.ensureFileObject(
        {
          metadata: {
            fileHash: 'a'.repeat(64),
            fileName: 'report.pdf',
            fileSize: 123,
            fileType: 'application/pdf',
            storageKey:
              'files/sha256/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
          uploaderId: 'user-id',
        },
        prisma as unknown as PrismaService,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.fileObject.create).not.toHaveBeenCalled();
  });
});
