import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Attaches required roles metadata to a route handler or controller.
 * Consumed by RolesGuard to enforce role-based access control.
 *
 * @example
 * @Roles(UserRole.SUPER_ADMIN)
 * @Get('admins')
 * getAdmins() { ... }
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
