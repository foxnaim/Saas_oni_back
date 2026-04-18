import { SetMetadata } from '@nestjs/common';

/**
 * Key stored in route metadata to mark an endpoint as publicly accessible.
 * The JwtAuthGuard reads this key and skips token validation when it is present.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public()
 *
 * Marks a controller or individual route handler as unauthenticated.
 * When applied, the global JwtAuthGuard will allow the request through
 * without requiring a valid Bearer token.
 *
 * @example
 * ```ts
 * @Public()
 * @Post('login')
 * login(@Body() dto: LoginDto) { ... }
 * ```
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
