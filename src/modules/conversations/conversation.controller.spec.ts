jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

jest.mock('uuid', () => ({
  v7: () => 'conversation-id',
}));

jest.mock(
  'src/shared/enums/conversation-role.enum',
  () => ({
    ConversationRole: {
      Admin: 'ADMIN',
      Member: 'MEMBER',
    },
  }),
  { virtual: true },
);

jest.mock(
  'src/shared/enums/conversation-type.enum',
  () => ({
    ConversationType: {
      Channel: 'CHANNEL',
      Dm: 'DM',
      GroupDm: 'GROUP_DM',
    },
  }),
  { virtual: true },
);

import { Action } from '../../shared/enums/action.enum';
import { CHECK_POLICIES_KEY } from '../../common/decorators/policy.decorator';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';

type AuthenticatedUser = {
  id: string;
  email: string;
};

function getPolicyMetadata(
  methodName: keyof ConversationController,
): unknown[] {
  return (Reflect.getMetadata(
    CHECK_POLICIES_KEY,
    ConversationController.prototype[methodName],
  ) ?? []) as unknown[];
}

describe('ConversationController metadata', () => {
  const service = {
    createConversation: jest.fn(),
    getConversationById: jest.fn(),
    updateConversation: jest.fn(),
    archiveConversation: jest.fn(),
    unarchiveConversation: jest.fn(),
    softDeleteConversation: jest.fn(),
    addMemberToPrivateChannel: jest.fn(),
    removeMemberFromPrivateChannel: jest.fn(),
  };

  it('uses workspace-based create policy for POST conversation', () => {
    const metadata = getPolicyMetadata('createConversation') as Array<{
      action: Action;
      message?: string;
    }>;

    expect(metadata).toHaveLength(1);
    expect(metadata[0].message).toBeDefined();
    expect(metadata[0].action).toBe(Action.Create);
  });

  it('uses archive policy for archive and unarchive routes', () => {
    const archiveMetadata = getPolicyMetadata('archiveConversation') as Array<{
      action: Action;
    }>;
    const unarchiveMetadata = getPolicyMetadata(
      'unarchiveConversation',
    ) as Array<{
      action: Action;
    }>;

    expect(archiveMetadata[0].action).toBe(Action.Archive);
    expect(unarchiveMetadata[0].action).toBe(Action.Archive);
  });

  it('uses add and kick policies for private channel member routes', () => {
    const addMetadata = getPolicyMetadata(
      'addMemberToPrivateChannel',
    ) as Array<{ action: Action }>;
    const removeMetadata = getPolicyMetadata(
      'removeMemberFromPrivateChannel',
    ) as Array<{ action: Action }>;

    expect(addMetadata[0].action).toBe(Action.Add);
    expect(removeMetadata[0].action).toBe(Action.Kick);
  });

  it('passes create dto and authenticated user id to the service', async () => {
    const controller = new ConversationController(
      service as unknown as ConversationService,
    );
    const dto: CreateConversationDto = {
      workspaceId: 'workspace-id',
      type: 'CHANNEL',
    };
    const user: AuthenticatedUser = {
      id: 'user-id',
      email: 'user@example.com',
    };

    await controller.createConversation(dto, user);

    expect(service.createConversation).toHaveBeenCalledWith(dto, 'user-id');
  });

  it('passes private channel add member input to the service', async () => {
    const controller = new ConversationController(
      service as unknown as ConversationService,
    );

    await controller.addMemberToPrivateChannel('conversation-id', {
      userId: 'target-user-id',
    });

    expect(service.addMemberToPrivateChannel).toHaveBeenCalledWith(
      'conversation-id',
      'target-user-id',
    );
  });

  it('passes private channel remove member input to the service', async () => {
    const controller = new ConversationController(
      service as unknown as ConversationService,
    );

    await controller.removeMemberFromPrivateChannel(
      'conversation-id',
      'target-user-id',
    );

    expect(service.removeMemberFromPrivateChannel).toHaveBeenCalledWith(
      'conversation-id',
      'target-user-id',
    );
  });
});
