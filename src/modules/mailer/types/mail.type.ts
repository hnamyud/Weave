export type SendWorkspaceInviteEmailInput = {
  invitedEmail: string;
  inviteUrl: string;
  workspaceName: string;
  inviterName: string;
};

export type SendMentionNotificationEmailInput = {
  email: string;
  actorName: string;
  workspaceName: string;
  conversationName: string;
  messagePreview: string;
  messageUrl?: string;
};
