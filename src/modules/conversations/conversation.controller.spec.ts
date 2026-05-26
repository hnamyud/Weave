jest.mock('prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}), { virtual: true });

jest.mock('uuid', () => ({
  v7: () => 'conversation-id',
}));

jest.mock('src/shared/enums/conversation-role.enum', () => ({
  ConversationRole: {
    Admin: 'ADMIN',
    Member: 'MEMBER',
  },
}), { virtual: true });

jest.mock('src/shared/enums/conversation-type.enum', () => ({
  ConversationType: {
    Channel: 'CHANNEL',
    Dm: 'DM',
    GroupDm: 'GROUP_DM',
  },
}), { virtual: true });

import { Action } from '../../shared/enums/action.enum';
import { CHECK_POLICIES_KEY } from '../../common/decorators/policy.decorator';
import { ConversationController } from './conversation.controller';

describe('ConversationController metadata', () => {
  const service = {
    createConversation: jest.fn(),
    getConversationById: jest.fn(),
    updateConversation: jest.fn(),
    archiveConversation: jest.fn(),
    unarchiveConversation: jest.fn(),
    softDeleteConversation: jest.fn(),
  };

  it('uses workspace-based create policy for POST conversation', () => {
    const metadata = Reflect.getMetadata(CHECK_POLICIES_KEY, ConversationController.prototype.createConversation);

    expect(metadata).toHaveLength(1);
    expect(metadata[0].message).toBeDefined();
    expect(metadata[0].action).toBe(Action.Create);
  });

  it('uses archive policy for archive and unarchive routes', () => {
    const archiveMetadata = Reflect.getMetadata(CHECK_POLICIES_KEY, ConversationController.prototype.archiveConversation);
    const unarchiveMetadata = Reflect.getMetadata(CHECK_POLICIES_KEY, ConversationController.prototype.unarchiveConversation);

    expect(archiveMetadata[0].action).toBe(Action.Archive);
    expect(unarchiveMetadata[0].action).toBe(Action.Archive);
  });

  it('passes create dto and authenticated user id to the service', async () => {
    const controller = new ConversationController(service as any);
    await controller.createConversation({ workspaceId: 'workspace-id', type: 'CHANNEL' } as any, { id: 'user-id' } as any);

    expect(service.createConversation).toHaveBeenCalledWith(
      { workspaceId: 'workspace-id', type: 'CHANNEL' },
      'user-id',
    );
  });
});
