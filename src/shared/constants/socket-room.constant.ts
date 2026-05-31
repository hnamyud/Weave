// ─── Room naming conventions ──────────────────────────────────────────────────
// workspace:{workspaceId}        — all members of a workspace
// conversation:{conversationId}  — all members of a conversation
// user:{userId}                  — private channel per user (notifications)

export const ROOMS = {
  workspace: (id: string) => `workspace:${id}`,
  conversation: (id: string) => `conversation:${id}`,
  user: (id: string) => `user:${id}`,
} as const;
