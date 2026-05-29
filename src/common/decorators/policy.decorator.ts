import { SetMetadata } from '@nestjs/common';
import { AppAbility, AppSubjects } from '../casl/ability.factory';
import { Action } from '../../shared/enums/action.enum';

export type PolicyRequest = {
  workspaceMember?: unknown;
  conversationMember?: unknown;
  workspace?: unknown;
  conversation?: unknown;
  workspaceId?: string;
  user?: unknown;
  params?: Record<string, string>;
  body?: Record<string, unknown>;
};

export interface IPolicyHandler {
  action?: Action;
  message?: string;
  handle(ability: AppAbility, request: PolicyRequest): boolean;
}

export type PolicyHandlerCallback = (
  ability: AppAbility,
  request: PolicyRequest,
) => boolean;
export type PolicyHandler = IPolicyHandler | PolicyHandlerCallback;

export const CHECK_POLICIES_KEY = 'check_policy';
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);

function createPolicyHandler(
  action: Action,
  subject: AppSubjects,
  message: string,
): IPolicyHandler {
  return {
    action,
    message,
    handle(ability: AppAbility) {
      return ability.can(action, subject);
    },
  };
}

export function RequireWorkspacePermission(action: Action) {
  const subject =
    action === Action.Kick
      ? 'WorkspaceMember'
      : action === Action.Manage
        ? 'WorkspaceInvite'
        : 'Workspace';

  return CheckPolicies(
    createPolicyHandler(
      action,
      subject,
      'You do not have permission to perform this action in workspace',
    ),
  );
}

export function RequireConversationPermission(action: Action) {
  return CheckPolicies(
    createPolicyHandler(
      action,
      'Conversation',
      'You do not have permission to perform this action in conversation',
    ),
  );
}

export function RequireUserPermission(action: Action) {
  return CheckPolicies(
    createPolicyHandler(
      action,
      'User',
      'You do not have permission to perform this action for user',
    ),
  );
}
