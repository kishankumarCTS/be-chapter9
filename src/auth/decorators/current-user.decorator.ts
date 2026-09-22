import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  roles: UserRoles[];
  hashedRefreshToken?: string | null;
}

export enum UserRoles {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface AuthenticatedRequest extends Request {
  user: User;
}

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data ? request.user?.[data] : request.user;
  },
);
