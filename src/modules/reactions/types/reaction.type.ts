import type { Prisma } from '@prisma/client';

export const reactionUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export type ReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type ReactionWithUser = Prisma.ReactionGetPayload<{
  include: {
    user: {
      select: typeof reactionUserSelect;
    };
  };
}>;

export type CreateReactionResult =
  | {
      created: true;
      reaction: ReactionWithUser;
    }
  | {
      created: false;
      reaction: {
        message: string;
        reaction: ReactionWithUser;
      };
    };
