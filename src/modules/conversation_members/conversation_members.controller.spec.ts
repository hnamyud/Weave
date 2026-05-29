jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

jest.mock('./conversation_members.service', () => ({
  ConversationMembersService: class ConversationMembersService {},
}));

import { ConversationMembersController } from './conversation_members.controller';

describe('ConversationMembersController', () => {
  let controller: ConversationMembersController;
  const conversationMembersService = {
    getConversationMembers: jest.fn(),
  };

  beforeEach(() => {
    controller = new ConversationMembersController(
      conversationMembersService as any,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
