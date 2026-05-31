import { SocketUser } from './socket-user.interface';

export interface SocketReaction {
  messageId: string;
  userId: string;
  emoji: string;
  user: SocketUser;
}
