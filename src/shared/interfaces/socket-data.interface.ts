// Socket data attached per connection
// ASSUMPTION (V1): 1 socket = 1 active workspace presence.
// presenceWorkspaceId on socket.data only tracks 1 workspace at a time.
export interface SocketData {
  userId?: string;
  workspaceId?: string;
  presenceWorkspaceId?: string;
}
