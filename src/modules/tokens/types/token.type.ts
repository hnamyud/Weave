import type { UserInterface } from '../../../shared/interfaces/users.interface';

export type TokenPayload = Pick<UserInterface, 'email' | 'id'> & {
  iss: string;
  sub: string;
};

export type RefreshTokenPayload = Pick<UserInterface, 'email' | 'id'>;
