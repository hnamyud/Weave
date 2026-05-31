export interface SocketConversation {
  id: string;
  workspaceId: string;
  name: string | null;
  type: string;
  isArchived: boolean;
  isDeleted: boolean;
}
