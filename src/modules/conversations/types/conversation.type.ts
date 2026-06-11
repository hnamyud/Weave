import { Prisma, ConversationRole } from '@prisma/client';

export const conversationSelect = {
  id: true,
  name: true,
  type: true,
  isPrivate: true,
  createdAt: true,
  _count: {
    select: {
      members: {
        where: {
          leftAt: null, // Chỉ đếm những thành viên chưa rời conversation
        },
      },
    },
  },
} satisfies Prisma.ConversationSelect;

export type ConversationWithCount = Prisma.ConversationGetPayload<{
  select: typeof conversationSelect;
}>;

export type ConversationResponse = {
  id: string;
  name: string | null;
  type: ConversationWithCount['type'];
  isPrivate: boolean;
  createdAt: Date;
  memberCount: number;
};

// ─── Minimal select cho list (không có _count — không chạy subquery đếm) ────

export const conversationListSelect = {
  id: true,
  name: true,
  type: true,
  isPrivate: true,
} satisfies Prisma.ConversationSelect;

export type ConversationListItemFromDb = Prisma.ConversationGetPayload<{
  select: typeof conversationListSelect;
}>;

export type ConversationListItem = {
  id: string;
  name: string | null;
  type: ConversationListItemFromDb['type'];
  isPrivate: boolean;
  myRole: ConversationRole;
  lastReadAt: Date | null;
};
