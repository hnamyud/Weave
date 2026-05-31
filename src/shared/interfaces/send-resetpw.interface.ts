export interface SendResetPasswordJobData {
  email: string;
  subject: string;
  otp: string;
}

export interface SendWorkspaceInviteJobData {
  email: string;
  subject: string;
  inviteUrl: string;
  workspaceName: string;
  inviterName: string;
}

export interface SendMentionNotificationJobData {
  email: string;
  subject: string;
  actorName: string;
  workspaceName: string;
  conversationName: string;
  messagePreview: string;
  messageUrl?: string;
}

export type MailJobData =
  | SendResetPasswordJobData
  | SendWorkspaceInviteJobData
  | SendMentionNotificationJobData;
