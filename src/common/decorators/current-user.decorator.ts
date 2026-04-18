import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

/**
 * @CurrentUser()
 *
 * Parameter decorator that extracts the authenticated user object attached to
 * the request by Passport's JwtStrategy (i.e. `req.user`).
 *
 * An optional property key can be passed to pluck a single field:
 *   @CurrentUser('userId')  → string
 *   @CurrentUser('role')    → string
 *   @CurrentUser()          → AuthenticatedUser
 *
 * @example
 * ```ts
 * @Get('me')
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 *
 * @Delete(':id')
 * remove(@CurrentUser('userId') userId: string) { ... }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedUser | string | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
