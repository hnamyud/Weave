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
import { ConversationMentionSearchController } from './conversation_mention_search.controller';
import { ConversationMembersService } from './conversation_members.service';

describe('ConversationMembersController', () => {
  let controller: ConversationMembersController;
  let mentionSearchController: ConversationMentionSearchController;
  const conversationMembersService = {
    getConversationMembers: jest.fn(),
    searchMentionCandidates: jest.fn(),
  };

  beforeEach(() => {
    controller = new ConversationMembersController(
      conversationMembersService as unknown as ConversationMembersService,
    );
    mentionSearchController = new ConversationMentionSearchController(
      conversationMembersService as unknown as ConversationMembersService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates mention search to the service', async () => {
    conversationMembersService.searchMentionCandidates.mockResolvedValue([
      {
        id: 'alice-id',
        username: 'alice',
        displayName: 'Alice',
      },
    ]);

    await expect(
      mentionSearchController.searchMentionCandidates(
        'conversation-id',
        'ali',
        { id: 'requester-id', email: 'requester@example.com' },
      ),
    ).resolves.toEqual([
      {
        id: 'alice-id',
        username: 'alice',
        displayName: 'Alice',
      },
    ]);
    expect(
      conversationMembersService.searchMentionCandidates,
    ).toHaveBeenCalledWith('conversation-id', 'requester-id', 'ali');
  });
});
