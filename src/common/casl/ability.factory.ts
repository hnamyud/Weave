import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { Action } from '../../shared/enums/action.enum';
import { UserInterface } from 'src/shared/interfaces/users.interface';
import { ConversationRole } from '../../shared/enums/conversation-role.enum';
import { WorkspaceRole } from '../../shared/enums/workspace-role.enum';

export type AppSubjects =
  | 'Workspace'
  | 'WorkspaceMember'
  | 'WorkspaceInvite'
  | 'Conversation'
  | 'ConversationMember'
  | 'all';

export type AppAbility = MongoAbility<[Action, AppSubjects]>;

type RequestPolicyContext = {
  workspaceMember?: {
    role?: WorkspaceRole;
  } | null;
  conversationMember?: {
    role?: ConversationRole;
  } | null;
};

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: UserInterface, request?: RequestPolicyContext) {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    const workspaceRole = request?.workspaceMember?.role;
    const conversationRole = request?.conversationMember?.role;
    const isWorkspaceOwner = workspaceRole === WorkspaceRole.Owner;
    const isWorkspaceAdmin = workspaceRole === WorkspaceRole.Admin;
    const isWorkspaceMember = workspaceRole === WorkspaceRole.Member;
    const isWorkspaceGuest = workspaceRole === WorkspaceRole.Guest;
    const isConversationAdmin = conversationRole === ConversationRole.Admin;
    const isConversationMember = conversationRole === ConversationRole.Member || isConversationAdmin;
    const canManageWorkspaceScopedResources = isWorkspaceOwner || isWorkspaceAdmin;

    if (workspaceRole) {
      can(Action.Read, 'Workspace');
      can(Action.Read, 'WorkspaceMember');
    }

    if (isWorkspaceOwner) {
      can(Action.Manage, 'WorkspaceInvite');
      can(Action.Kick, 'WorkspaceMember');
      can(Action.Add, 'Conversation');
      can(Action.Kick, 'Conversation');
      can(Action.Leave, 'Conversation');
      can(Action.Join, 'Conversation');
      can(Action.Update, 'Workspace');
      can(Action.Delete, 'Workspace');
      can(Action.Create, 'Workspace');
      can(Action.Manage, 'Conversation');
    }

    if (isWorkspaceAdmin) {
      can(Action.Read, 'WorkspaceInvite');
      can(Action.Manage, 'WorkspaceInvite');
      can(Action.Kick, 'WorkspaceMember');
      can(Action.Add, 'Conversation');
      can(Action.Kick, 'Conversation');
      can(Action.Leave, 'Conversation');
      can(Action.Join, 'Conversation');
      can(Action.Update, 'Workspace');
      can(Action.Create, 'Workspace');
      can(Action.Manage, 'Conversation');
    }

    if (isWorkspaceMember) {
      can(Action.Read, 'WorkspaceInvite');
      can(Action.Create, 'Workspace');
      can(Action.Join, 'Conversation');
    }

    if (isWorkspaceGuest) {
      can(Action.Read, 'Workspace');
    }

    if (isConversationMember || canManageWorkspaceScopedResources) {
      can(Action.Read, 'Conversation');
      can(Action.Read, 'ConversationMember');
      can(Action.Leave, 'Conversation');
    }

    if (isConversationAdmin || canManageWorkspaceScopedResources) {
      can(Action.Update, 'Conversation');
      can(Action.Archive, 'Conversation');
      can(Action.Delete, 'Conversation');
      can(Action.Add, 'Conversation');
      can(Action.Kick, 'Conversation');
    }

    return build();
  }
}
