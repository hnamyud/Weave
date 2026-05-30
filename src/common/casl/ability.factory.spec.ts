import { Action } from '../../shared/enums/action.enum';
import { ConversationRole } from '../../shared/enums/conversation-role.enum';
import { WorkspaceRole } from '../../shared/enums/workspace-role.enum';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { CaslAbilityFactory } from './ability.factory';

describe('CaslAbilityFactory', () => {
  const factory = new CaslAbilityFactory();
  const user: UserInterface = { id: 'user-id', email: 'user@example.com' };

  it('allows authenticated users to read, update, and delete their user subject', () => {
    const ability = factory.createForUser(user);

    expect(ability.can(Action.Read, 'User')).toBe(true);
    expect(ability.can(Action.Update, 'User')).toBe(true);
    expect(ability.can(Action.Delete, 'User')).toBe(true);
  });

  it('allows workspace owner to update and delete workspace', () => {
    const ability = factory.createForUser(user, {
      workspaceMember: {
        role: WorkspaceRole.Owner,
      },
    });

    expect(ability.can(Action.Update, 'Workspace')).toBe(true);
    expect(ability.can(Action.Delete, 'Workspace')).toBe(true);
  });

  it('allows workspace admin to update but not delete workspace', () => {
    const ability = factory.createForUser(user, {
      workspaceMember: {
        role: WorkspaceRole.Admin,
      },
    });

    expect(ability.can(Action.Update, 'Workspace')).toBe(true);
    expect(ability.can(Action.Delete, 'Workspace')).toBe(false);
  });

  it('allows member to create conversation but denies invite management', () => {
    const ability = factory.createForUser(user, {
      workspaceMember: {
        role: WorkspaceRole.Member,
      },
    });

    expect(ability.can(Action.Create, 'Workspace')).toBe(true);
    expect(ability.can(Action.Join, 'Conversation')).toBe(true);
    expect(ability.can(Action.Manage, 'WorkspaceInvite')).toBe(false);
    expect(ability.can(Action.Add, 'Conversation')).toBe(false);
  });

  it('allows guest to read workspace but denies conversation creation', () => {
    const ability = factory.createForUser(user, {
      workspaceMember: {
        role: WorkspaceRole.Guest,
      },
    });

    expect(ability.can(Action.Read, 'Workspace')).toBe(true);
    expect(ability.can(Action.Create, 'Workspace')).toBe(false);
    expect(ability.can(Action.Join, 'Conversation')).toBe(false);
  });

  it('allows conversation admin to update and archive conversation', () => {
    const ability = factory.createForUser(user, {
      conversationMember: {
        role: ConversationRole.Admin,
      },
    });

    expect(ability.can(Action.Update, 'Conversation')).toBe(true);
    expect(ability.can(Action.Archive, 'Conversation')).toBe(true);
    expect(ability.can(Action.Add, 'Conversation')).toBe(true);
    expect(ability.can(Action.Kick, 'Conversation')).toBe(true);
  });

  it('denies conversation member from deleting conversation', () => {
    const ability = factory.createForUser(user, {
      conversationMember: {
        role: ConversationRole.Member,
      },
    });

    expect(ability.can(Action.Delete, 'Conversation')).toBe(false);
    expect(ability.can(Action.Leave, 'Conversation')).toBe(true);
    expect(ability.can(Action.Kick, 'Conversation')).toBe(false);
  });

  it('allows workspace admin to override conversation admin requirement', () => {
    const ability = factory.createForUser(user, {
      workspaceMember: {
        role: WorkspaceRole.Admin,
      },
      conversationMember: {
        role: ConversationRole.Member,
      },
    });

    expect(ability.can(Action.Archive, 'Conversation')).toBe(true);
  });
});
