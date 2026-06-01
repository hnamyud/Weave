import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

const mockUuid = jest.fn<() => string>();

jest.mock('uuid', () => ({
  v7: mockUuid,
}));

import { PrismaService } from '../../../prisma/prisma.service';
import { FileMetadataDto } from '../files/dto/file-metadata.dto';
import { FileService } from '../files/file.service';
import { NotificationType } from '../../shared/enums/notification-type';
import { NotificationService } from '../notifications/notification.service';
import { RealtimeService } from '../realtime/realtime.service';
import { MessageService } from './message.service';

type FileObjectRecord = {
  id: string;
  storageKey: string;
  fileHash: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

describe('MessageService', () => {
  const prisma = {
    conversationMember: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      findMany: jest.fn<(args: any) => Promise<any[]>>(),
    },
    message: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      findMany: jest.fn<(args: any) => Promise<any[]>>(),
      create: jest.fn<(args: any) => Promise<any>>(),
      update: jest.fn<(args: any) => Promise<any>>(),
    },
    attachment: {
      createMany: jest.fn<(args: any) => Promise<any>>(),
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      update: jest.fn<(args: any) => Promise<any>>(),
    },
    mention: {
      createMany: jest.fn<(args: any) => Promise<any>>(),
      deleteMany: jest.fn<(args: any) => Promise<any>>(),
      findMany: jest.fn<(args: any) => Promise<any[]>>(),
    },
    $transaction:
      jest.fn<(callback: (tx: any) => Promise<any>) => Promise<any>>(),
  };

  const fileService = {
    validateMessageAttachments:
      jest.fn<(attachments: FileMetadataDto[]) => void>(),
    getExpectedStorageKey: jest.fn<(hash: string) => string>(),
    ensureFileObject:
      jest.fn<
        (
          args: { metadata: FileMetadataDto; uploaderId: string },
          tx: PrismaService,
        ) => Promise<FileObjectRecord>
      >(),
  };

  const realtimeService = {
    emitMessageCreated: jest.fn<(message: unknown) => void>(),
    emitMessageUpdated: jest.fn<(message: unknown) => void>(),
    emitMessageDeleted:
      jest.fn<(payload: { id: string; conversationId: string }) => void>(),
  };

  const notificationService = {
    createNotification: jest.fn<(input: unknown) => Promise<unknown>>(),
  };

  let service: MessageService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUuid
      .mockReset()
      .mockReturnValueOnce('message-id')
      .mockReturnValueOnce('attachment-id-1')
      .mockReturnValueOnce('attachment-id-2');
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.attachment.createMany.mockResolvedValue({ count: 1 });
    prisma.conversationMember.findMany.mockResolvedValue([]);
    prisma.mention.createMany.mockResolvedValue({ count: 0 });
    prisma.mention.deleteMany.mockResolvedValue({ count: 0 });
    prisma.mention.findMany.mockResolvedValue([]);
    notificationService.createNotification.mockResolvedValue({
      id: 'notification-id',
    });
    prisma.message.create.mockResolvedValue({
      id: 'message-id',
      conversationId: 'conversation-id',
      content: 'hello',
      parentId: null,
      senderId: 'user-id',
      isEdited: false,
      editedAt: null,
      createdAt: new Date('2026-05-29T00:00:00.000Z'),
      updatedAt: new Date('2026-05-29T00:00:00.000Z'),
      sender: {
        id: 'user-id',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: 'https://cdn.test/alice.png',
      },
      _count: {
        replies: 0,
      },
      attachments: [
        {
          id: 'attachment-id-1',
          fileName: 'report.pdf',
          fileObject: {
            storageKey: `files/sha256/aa/${'a'.repeat(64)}`,
            fileHash: 'a'.repeat(64),
            fileType: 'application/pdf',
            fileSize: 123,
          },
        },
      ],
    });
    prisma.message.update.mockResolvedValue({
      id: 'message-id',
      conversationId: 'conversation-id',
      content: 'updated message',
      parentId: null,
      senderId: 'user-id',
      isEdited: true,
      editedAt: new Date('2026-05-29T01:00:00.000Z'),
      createdAt: new Date('2026-05-29T00:00:00.000Z'),
      updatedAt: new Date('2026-05-29T01:00:00.000Z'),
      sender: {
        id: 'user-id',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: 'https://cdn.test/alice.png',
      },
      _count: {
        replies: 0,
      },
      attachments: [],
    });
    fileService.getExpectedStorageKey.mockImplementation(
      (hash) => `files/sha256/${hash.slice(0, 2)}/${hash}`,
    );
    service = new MessageService(
      prisma as unknown as PrismaService,
      fileService as unknown as FileService,
      realtimeService as unknown as RealtimeService,
      notificationService as unknown as NotificationService,
    );
  });

  it('rejects creating a message for a non-member user', async () => {
    prisma.conversationMember.findFirst.mockResolvedValue(null);

    await expect(
      service.createMessage(
        {
          conversationId: 'conversation-id',
          content: 'hello',
        },
        'user-id',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(realtimeService.emitMessageCreated).not.toHaveBeenCalled();
  });

  it('rejects an empty message without attachments', async () => {
    prisma.conversationMember.findFirst.mockResolvedValue({
      role: 'MEMBER',
      conversation: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
        isArchived: false,
      },
      workspaceMember: {
        role: 'MEMBER',
      },
    });

    await expect(
      service.createMessage(
        {
          conversationId: 'conversation-id',
          content: '   ',
          attachments: [],
        },
        'user-id',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(realtimeService.emitMessageCreated).not.toHaveBeenCalled();
  });

  it('rejects attachment keys that do not match the deterministic storage key', async () => {
    prisma.conversationMember.findFirst.mockResolvedValue({
      role: 'MEMBER',
      conversation: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
        isArchived: false,
      },
      workspaceMember: {
        role: 'MEMBER',
      },
    });

    await expect(
      service.createMessage(
        {
          conversationId: 'conversation-id',
          attachments: [
            {
              fileHash: 'a'.repeat(64),
              fileName: 'report.pdf',
              fileSize: 123,
              fileType: 'application/pdf',
              storageKey: 'wrong-key',
            },
          ],
        },
        'user-id',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(realtimeService.emitMessageCreated).not.toHaveBeenCalled();
  });

  it('creates an attachment-only message atomically', async () => {
    prisma.conversationMember.findFirst.mockResolvedValue({
      role: 'MEMBER',
      conversation: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
        isArchived: false,
      },
      workspaceMember: {
        role: 'MEMBER',
      },
    });
    fileService.ensureFileObject.mockResolvedValue({
      id: 'file-object-id',
      storageKey: 'files/sha256/aa/hash',
      fileHash: 'a'.repeat(64),
      fileName: 'report.pdf',
      fileType: 'application/pdf',
      fileSize: 123,
    });
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      conversationId: 'conversation-id',
      parentId: null,
      senderId: 'user-id',
      content: null,
      isEdited: false,
      editedAt: null,
      createdAt: new Date('2026-05-29T00:00:00.000Z'),
      updatedAt: new Date('2026-05-29T00:00:00.000Z'),
      sender: {
        id: 'user-id',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: 'https://cdn.test/alice.png',
      },
      attachments: [
        {
          id: 'attachment-id-1',
          fileName: 'report.pdf',
          fileObject: {
            storageKey: `files/sha256/aa/${'a'.repeat(64)}`,
            fileHash: 'a'.repeat(64),
            fileType: 'application/pdf',
            fileSize: 123,
          },
        },
      ],
      _count: {
        replies: 0,
      },
    });

    await service.createMessage(
      {
        conversationId: 'conversation-id',
        attachments: [
          {
            fileHash: 'a'.repeat(64),
            fileName: 'report.pdf',
            fileSize: 123,
            fileType: 'application/pdf',
            storageKey: `files/sha256/aa/${'a'.repeat(64)}`,
          },
        ],
      },
      'user-id',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: {
        id: 'message-id',
        conversationId: 'conversation-id',
        senderId: 'user-id',
        parentId: undefined,
        content: null,
      },
      include: expect.any(Object),
    });
    expect(prisma.attachment.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: 'attachment-id-1',
          messageId: 'message-id',
          fileObjectId: 'file-object-id',
          uploaderId: 'user-id',
          fileName: 'report.pdf',
        },
      ],
    });
    expect(realtimeService.emitMessageCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'message-id',
        conversationId: 'conversation-id',
      }),
    );
  });

  it('creates mentions in batch and notifies mentioned users after creating a message', async () => {
    mockUuid
      .mockReset()
      .mockReturnValueOnce('message-id')
      .mockReturnValueOnce('mention-id-1')
      .mockReturnValueOnce('mention-id-2');
    prisma.conversationMember.findFirst.mockResolvedValue({
      role: 'MEMBER',
      conversation: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
        isArchived: false,
      },
    });
    prisma.conversationMember.findMany.mockResolvedValue([
      { userId: 'mentioned-user-1' },
      { userId: 'mentioned-user-2' },
    ]);
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      conversationId: 'conversation-id',
      parentId: null,
      senderId: 'user-id',
      content: 'hello @alice @bob',
      isEdited: false,
      editedAt: null,
      createdAt: new Date('2026-05-29T00:00:00.000Z'),
      updatedAt: new Date('2026-05-29T00:00:00.000Z'),
      sender: {
        id: 'user-id',
        username: 'sender',
        displayName: 'Sender',
        avatarUrl: null,
      },
      attachments: [],
      _count: {
        replies: 0,
      },
    });

    await service.createMessage(
      {
        conversationId: 'conversation-id',
        content: 'hello @alice @bob',
        mentionedUserIds: [
          'mentioned-user-1',
          'mentioned-user-1',
          'user-id',
          'mentioned-user-2',
        ],
      },
      'user-id',
    );

    expect(prisma.conversationMember.findMany).toHaveBeenCalledWith({
      where: {
        conversationId: 'conversation-id',
        leftAt: null,
        userId: {
          in: ['mentioned-user-1', 'mentioned-user-2'],
        },
        user: {
          deletedAt: null,
        },
      },
      select: {
        userId: true,
      },
    });
    expect(prisma.mention.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: 'mention-id-1',
          messageId: 'message-id',
          mentionedUserId: 'mentioned-user-1',
        },
        {
          id: 'mention-id-2',
          messageId: 'message-id',
          mentionedUserId: 'mentioned-user-2',
        },
      ],
      skipDuplicates: true,
    });
    expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
    expect(notificationService.createNotification).toHaveBeenCalledWith({
      userId: 'mentioned-user-1',
      actorId: 'user-id',
      workspaceId: 'workspace-id',
      conversationId: 'conversation-id',
      messageId: 'message-id',
      type: NotificationType.Mention,
      payload: {
        text: 'hello @alice @bob',
      },
    });
    expect(realtimeService.emitMessageCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'message-id',
      }),
    );
  });

  it('rejects message creation when a mentioned user is not an active conversation member', async () => {
    prisma.conversationMember.findFirst.mockResolvedValue({
      role: 'MEMBER',
      conversation: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
        isArchived: false,
      },
    });
    prisma.conversationMember.findMany.mockResolvedValue([
      { userId: 'mentioned-user-1' },
    ]);

    await expect(
      service.createMessage(
        {
          conversationId: 'conversation-id',
          content: 'hello @alice @bob',
          mentionedUserIds: ['mentioned-user-1', 'missing-user'],
        },
        'user-id',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(prisma.mention.createMany).not.toHaveBeenCalled();
    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(realtimeService.emitMessageCreated).not.toHaveBeenCalled();
  });

  it('lists top-level messages newest-first with a next cursor', async () => {
    prisma.conversationMember.findFirst.mockResolvedValue({
      role: 'MEMBER',
      conversation: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
        isArchived: false,
      },
      workspaceMember: {
        role: 'MEMBER',
      },
    });
    prisma.message.findMany.mockResolvedValue([
      {
        id: 'message-2',
        conversationId: 'conversation-id',
        parentId: null,
        senderId: 'user-2',
        content: 'second',
        isEdited: false,
        editedAt: null,
        createdAt: new Date('2026-05-29T00:02:00.000Z'),
        updatedAt: new Date('2026-05-29T00:02:00.000Z'),
        sender: {
          id: 'user-2',
          username: 'bob',
          displayName: 'Bob',
          avatarUrl: null,
        },
        attachments: [],
        _count: {
          replies: 1,
        },
      },
      {
        id: 'message-1',
        conversationId: 'conversation-id',
        parentId: null,
        senderId: 'user-1',
        content: 'first',
        isEdited: false,
        editedAt: null,
        createdAt: new Date('2026-05-29T00:01:00.000Z'),
        updatedAt: new Date('2026-05-29T00:01:00.000Z'),
        sender: {
          id: 'user-1',
          username: 'alice',
          displayName: 'Alice',
          avatarUrl: null,
        },
        attachments: [],
        _count: {
          replies: 0,
        },
      },
    ]);

    const result = await service.getConversationMessages(
      'conversation-id',
      'user-id',
      {
        limit: 2,
      },
    );

    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: {
        conversationId: 'conversation-id',
        parentId: null,
        isDeleted: false,
      },
      take: 2,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: expect.any(Object),
    });
    expect(result.result).toHaveLength(2);
    expect(result.result[0]).toMatchObject({
      id: 'message-2',
      replyCount: 1,
    });
    expect(typeof result.nextCursor).toBe('string');
  });

  it('gets a message detail for an active conversation member', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      conversationId: 'conversation-id',
      parentId: null,
      senderId: 'user-id',
      content: 'hello',
      isEdited: false,
      editedAt: null,
      createdAt: new Date('2026-05-29T00:00:00.000Z'),
      updatedAt: new Date('2026-05-29T00:00:00.000Z'),
      sender: {
        id: 'user-id',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
      },
      attachments: [
        {
          id: 'attachment-id-1',
          fileName: 'report.pdf',
          fileObject: {
            storageKey: `files/sha256/aa/${'a'.repeat(64)}`,
            fileHash: 'a'.repeat(64),
            fileType: 'application/pdf',
            fileSize: 123,
          },
        },
      ],
      _count: {
        replies: 2,
      },
      conversation: {
        members: [{ role: 'MEMBER' }],
        workspace: {
          members: [{ role: 'MEMBER' }],
        },
      },
    });

    const result = await service.getMessageById('message-id', 'user-id');

    expect(result).toMatchObject({
      id: 'message-id',
      replyCount: 2,
      sender: {
        id: 'user-id',
      },
    });
  });

  it('updates message content for the sender only', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      senderId: 'user-id',
      isDeleted: false,
      conversationId: 'conversation-id',
      parentId: null,
      conversation: {
        members: [{ role: 'MEMBER' }],
        workspace: {
          members: [{ role: 'MEMBER' }],
        },
      },
    });

    const result = await service.updateMessage(
      'message-id',
      {
        content: '  updated message  ',
      },
      'user-id',
    );

    expect(prisma.message.update).toHaveBeenCalledWith({
      where: {
        id: 'message-id',
      },
      data: {
        content: 'updated message',
        isEdited: true,
        editedAt: expect.any(Date),
      },
      include: expect.any(Object),
    });
    expect(result.content).toBe('updated message');
    expect(realtimeService.emitMessageUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'message-id',
        content: 'updated message',
      }),
    );
  });

  it('syncs edited message mentions and only notifies newly mentioned users', async () => {
    mockUuid.mockReset().mockReturnValueOnce('new-mention-id');
    prisma.message.findFirst
      .mockResolvedValueOnce({
        id: 'message-id',
        senderId: 'user-id',
        isDeleted: false,
        conversationId: 'conversation-id',
        parentId: null,
        conversation: {
          workspaceId: 'workspace-id',
          members: [{ role: 'MEMBER' }],
          workspace: {
            members: [{ role: 'MEMBER' }],
          },
        },
      })
      .mockResolvedValueOnce({
        id: 'message-id',
        conversationId: 'conversation-id',
        content: 'updated @old @new',
        parentId: null,
        senderId: 'user-id',
        isEdited: true,
        editedAt: new Date('2026-05-29T01:00:00.000Z'),
        createdAt: new Date('2026-05-29T00:00:00.000Z'),
        updatedAt: new Date('2026-05-29T01:00:00.000Z'),
        sender: {
          id: 'user-id',
          username: 'alice',
          displayName: 'Alice',
          avatarUrl: null,
        },
        _count: {
          replies: 0,
        },
        attachments: [],
      });
    prisma.conversationMember.findFirst.mockResolvedValue({
      role: 'MEMBER',
      conversation: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
        isArchived: false,
      },
    });
    prisma.conversationMember.findMany.mockResolvedValue([
      { userId: 'old-mentioned-user' },
      { userId: 'new-mentioned-user' },
    ]);
    prisma.mention.findMany.mockResolvedValue([
      { mentionedUserId: 'old-mentioned-user' },
      { mentionedUserId: 'removed-mentioned-user' },
    ]);

    await service.updateMessage(
      'message-id',
      {
        content: 'updated @old @new',
        mentionedUserIds: ['old-mentioned-user', 'new-mentioned-user'],
      },
      'user-id',
    );

    expect(prisma.mention.deleteMany).toHaveBeenCalledWith({
      where: {
        messageId: 'message-id',
        mentionedUserId: {
          in: ['removed-mentioned-user'],
        },
      },
    });
    expect(prisma.mention.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: 'new-mention-id',
          messageId: 'message-id',
          mentionedUserId: 'new-mentioned-user',
        },
      ],
      skipDuplicates: true,
    });
    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    expect(notificationService.createNotification).toHaveBeenCalledWith({
      userId: 'new-mentioned-user',
      actorId: 'user-id',
      workspaceId: 'workspace-id',
      conversationId: 'conversation-id',
      messageId: 'message-id',
      type: NotificationType.Mention,
      payload: {
        text: 'updated @old @new',
      },
    });
  });

  it('rejects updating a message for a non-sender', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      senderId: 'author-id',
      isDeleted: false,
      conversationId: 'conversation-id',
      parentId: null,
      conversation: {
        members: [{ role: 'MEMBER' }],
        workspace: {
          members: [{ role: 'MEMBER' }],
        },
      },
    });

    await expect(
      service.updateMessage(
        'message-id',
        {
          content: 'updated message',
        },
        'other-user-id',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(realtimeService.emitMessageUpdated).not.toHaveBeenCalled();
  });

  it('soft deletes a message for the sender', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      senderId: 'user-id',
      isDeleted: false,
      conversationId: 'conversation-id',
      parentId: null,
      conversation: {
        members: [{ role: 'MEMBER' }],
        workspace: {
          members: [{ role: 'MEMBER' }],
        },
      },
    });
    prisma.message.update.mockResolvedValue({
      id: 'message-id',
      isDeleted: true,
      deletedAt: new Date('2026-05-29T01:00:00.000Z'),
    });

    const result = await service.deleteMessage('message-id', 'user-id');

    expect(prisma.message.update).toHaveBeenCalledWith({
      where: {
        id: 'message-id',
      },
      data: {
        isDeleted: true,
        deletedAt: expect.any(Date),
      },
    });
    expect(result.isDeleted).toBe(true);
    expect(realtimeService.emitMessageDeleted).toHaveBeenCalledWith({
      id: 'message-id',
      conversationId: 'conversation-id',
    });
  });

  it('creates a reply using the parent message conversation', async () => {
    prisma.message.findFirst
      .mockResolvedValueOnce({
        id: 'parent-message-id',
        conversationId: 'conversation-id',
        parentId: null,
        isDeleted: false,
        conversation: {
          id: 'conversation-id',
          isArchived: false,
          members: [{ role: 'MEMBER' }],
          workspace: {
            members: [{ role: 'MEMBER' }],
          },
        },
      })
      .mockResolvedValueOnce({
        id: 'message-id',
        conversationId: 'conversation-id',
        parentId: 'parent-message-id',
        senderId: 'user-id',
        content: 'thread reply',
        isEdited: false,
        editedAt: null,
        createdAt: new Date('2026-05-29T00:04:00.000Z'),
        updatedAt: new Date('2026-05-29T00:04:00.000Z'),
        sender: {
          id: 'user-id',
          username: 'alice',
          displayName: 'Alice',
          avatarUrl: null,
        },
        attachments: [],
        _count: {
          replies: 0,
        },
      });
    prisma.conversationMember.findFirst.mockResolvedValue({
      role: 'MEMBER',
      conversation: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
        isArchived: false,
      },
      workspaceMember: {
        role: 'MEMBER',
      },
    });

    await service.createReply(
      'parent-message-id',
      {
        content: 'thread reply',
        attachments: [],
      },
      'user-id',
    );

    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: 'conversation-id',
          parentId: 'parent-message-id',
        }),
      }),
    );
  });

  it('creates mentions for replies using the parent conversation', async () => {
    mockUuid
      .mockReset()
      .mockReturnValueOnce('message-id')
      .mockReturnValueOnce('mention-id-1');
    prisma.message.findFirst
      .mockResolvedValueOnce({
        id: 'parent-message-id',
        conversationId: 'conversation-id',
        parentId: null,
        isDeleted: false,
        conversation: {
          id: 'conversation-id',
          isArchived: false,
          members: [{ role: 'MEMBER' }],
          workspace: {
            members: [{ role: 'MEMBER' }],
          },
        },
      })
      .mockResolvedValueOnce({
        id: 'message-id',
        conversationId: 'conversation-id',
        parentId: 'parent-message-id',
        senderId: 'user-id',
        content: 'reply @alice',
        isEdited: false,
        editedAt: null,
        createdAt: new Date('2026-05-29T00:04:00.000Z'),
        updatedAt: new Date('2026-05-29T00:04:00.000Z'),
        sender: {
          id: 'user-id',
          username: 'alice',
          displayName: 'Alice',
          avatarUrl: null,
        },
        attachments: [],
        _count: {
          replies: 0,
        },
      });
    prisma.conversationMember.findFirst.mockResolvedValue({
      role: 'MEMBER',
      conversation: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
        isArchived: false,
      },
    });
    prisma.conversationMember.findMany.mockResolvedValue([
      { userId: 'mentioned-user-1' },
    ]);

    await service.createReply(
      'parent-message-id',
      {
        content: 'reply @alice',
        mentionedUserIds: ['mentioned-user-1'],
      },
      'user-id',
    );

    expect(prisma.mention.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: 'mention-id-1',
          messageId: 'message-id',
          mentionedUserId: 'mentioned-user-1',
        },
      ],
      skipDuplicates: true,
    });
    expect(notificationService.createNotification).toHaveBeenCalledWith({
      userId: 'mentioned-user-1',
      actorId: 'user-id',
      workspaceId: 'workspace-id',
      conversationId: 'conversation-id',
      messageId: 'message-id',
      type: NotificationType.Mention,
      payload: {
        text: 'reply @alice',
      },
    });
  });

  it('rejects nested replies', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'reply-id',
      conversationId: 'conversation-id',
      parentId: 'root-message-id',
      isDeleted: false,
      conversation: {
        id: 'conversation-id',
        isArchived: false,
        members: [{ role: 'MEMBER' }],
        workspace: {
          members: [{ role: 'MEMBER' }],
        },
      },
    });

    await expect(
      service.createReply(
        'reply-id',
        {
          content: 'nested reply',
          attachments: [],
        },
        'user-id',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(realtimeService.emitMessageCreated).not.toHaveBeenCalled();
  });

  it('lists replies newest-first and excludes deleted rows', async () => {
    prisma.message.findFirst.mockResolvedValueOnce({
      id: 'parent-message-id',
      conversationId: 'conversation-id',
      parentId: null,
      isDeleted: false,
      conversation: {
        id: 'conversation-id',
        isArchived: false,
        members: [{ role: 'MEMBER' }],
        workspace: {
          members: [{ role: 'MEMBER' }],
        },
      },
    });
    prisma.message.findMany.mockResolvedValue([
      {
        id: 'reply-2',
        conversationId: 'conversation-id',
        parentId: 'parent-message-id',
        senderId: 'user-2',
        content: 'reply',
        isEdited: false,
        editedAt: null,
        createdAt: new Date('2026-05-29T00:03:00.000Z'),
        updatedAt: new Date('2026-05-29T00:03:00.000Z'),
        sender: {
          id: 'user-2',
          username: 'bob',
          displayName: 'Bob',
          avatarUrl: null,
        },
        attachments: [],
        _count: {
          replies: 0,
        },
      },
    ]);

    const result = await service.getReplies('parent-message-id', 'user-id', {
      limit: 1,
    });

    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: {
        parentId: 'parent-message-id',
        isDeleted: false,
      },
      take: 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: expect.any(Object),
    });
    expect(result.result[0].id).toBe('reply-2');
  });

  it('soft deletes attachments for uploaders, message senders, and admins', async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: 'attachment-id',
      uploaderId: 'uploader-id',
      message: {
        senderId: 'sender-id',
        conversation: {
          members: [
            {
              role: 'MEMBER',
            },
          ],
          workspace: {
            members: [
              {
                role: 'MEMBER',
              },
            ],
          },
        },
      },
    });
    prisma.attachment.update.mockResolvedValue({
      id: 'attachment-id',
      isDeleted: true,
    });

    const result = await service.deleteAttachment(
      'attachment-id',
      'uploader-id',
    );

    expect(prisma.attachment.update).toHaveBeenCalledWith({
      where: {
        id: 'attachment-id',
      },
      data: {
        isDeleted: true,
        deletedAt: expect.any(Date),
      },
    });
    expect(result).toEqual({
      id: 'attachment-id',
      isDeleted: true,
    });
  });

  it('rejects attachment deletion for unauthorized members', async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: 'attachment-id',
      uploaderId: 'uploader-id',
      message: {
        senderId: 'sender-id',
        conversation: {
          members: [
            {
              role: 'MEMBER',
            },
          ],
          workspace: {
            members: [
              {
                role: 'MEMBER',
              },
            ],
          },
        },
      },
    });

    await expect(
      service.deleteAttachment('attachment-id', 'other-user-id'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not emit message deletion when delete permission is denied', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      senderId: 'author-id',
      isDeleted: false,
      conversationId: 'conversation-id',
      parentId: null,
      conversation: {
        members: [{ role: 'MEMBER' }],
        workspace: {
          members: [{ role: 'MEMBER' }],
        },
      },
    });

    await expect(
      service.deleteMessage('message-id', 'other-user-id'),
    ).rejects.toThrow(ForbiddenException);

    expect(realtimeService.emitMessageDeleted).not.toHaveBeenCalled();
  });
});
