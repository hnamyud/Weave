import { SocketUser } from './socket-user.interface';

export interface SocketMember {
  conversationId: string;
  user: SocketUser;
}
