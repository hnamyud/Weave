import { Prisma } from '@prisma/client';

export const baseMessageInclude = {
  sender: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  attachments: {
    where: {
      isDeleted: false,
    },
    include: {
      fileObject: {
        select: {
          storageKey: true,
          fileHash: true,
          fileType: true,
          fileSize: true,
        },
      },
    },
  },
  _count: {
    select: {
      replies: {
        where: {
          isDeleted: false,
        },
      },
    },
  },
} satisfies Prisma.MessageInclude;

export function buildMessageWithPermissionInclude(userId: string) {
  return {
    ...baseMessageInclude,
    parent: {
      select: {
        id: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
    },
    conversation: {
      select: {
        workspaceId: true,
        members: {
          where: {
            userId,
            leftAt: null,
          },
          select: {
            role: true,
          },
        },
        workspace: {
          select: {
            members: {
              where: {
                userId,
                leftAt: null,
              },
              select: {
                role: true,
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.MessageInclude;
}

export const conversationMembershipSelect = {
  role: true,
  conversation: {
    select: {
      id: true,
      workspaceId: true,
      isArchived: true,
    },
  },
} satisfies Prisma.ConversationMemberSelect;

export function buildAttachmentPermissionSelect(userId: string) {
  return {
    id: true,
    uploaderId: true,
    message: {
      select: {
        senderId: true,
        conversation: {
          select: {
            members: {
              where: {
                userId,
                leftAt: null,
              },
              select: {
                role: true,
              },
            },
            workspace: {
              select: {
                members: {
                  where: {
                    userId,
                    leftAt: null,
                  },
                  select: {
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.AttachmentSelect;
}
