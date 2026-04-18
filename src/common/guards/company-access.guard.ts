import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { UserRole } from '@prisma/client';

/**
 * CompanyAccessGuard
 *
 * Ensures that company-role users can only access resources that belong to
 * their own company.  Admin and super-admin users bypass this check entirely.
 *
 * The guard resolves the target company identifier from (in order of priority):
 *  1. `request.params.companyId`
 *  2. `request.body.companyId`
 *  3. `request.query.companyId`
 *
 * If a company user attempts to access a different company's resource a 403
 * Forbidden exception is thrown.
 *
 * @example
 * ```ts
 * @UseGuards(JwtAuthGuard, CompanyAccessGuard)
 * @Get(':companyId/stats')
 * getStats(@Param('companyId') companyId: string) { ... }
 * ```
 */
@Injectable()
export class CompanyAccessGuard implements CanActivate {
  private readonly logger = new Logger(CompanyAccessGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied — authentication required');
    }

    // Admins and super-admins have unrestricted access.
    if (
      user.role === UserRole.admin ||
      user.role === UserRole.super_admin
    ) {
      return true;
    }

    // For company-role users, verify ownership.
    if (user.role === UserRole.company) {
      const targetCompanyId = this.resolveTargetCompanyId(request);

      if (!targetCompanyId) {
        // No companyId in the request — cannot determine ownership; deny.
        this.logger.warn(
          `CompanyAccessGuard: no companyId found in request for user ${user.userId}`,
        );
        throw new ForbiddenException(
          'Access denied — company identifier not found in request',
        );
      }

      // `user.userId` stores the company's own _id when role === COMPANY
      // (set by the JWT strategy).  Compare as strings to avoid ObjectId pitfalls.
      const ownerCompanyId = (user as AuthenticatedUser & { companyId?: string })
        .companyId ?? user.userId;

      if (String(ownerCompanyId) !== String(targetCompanyId)) {
        this.logger.warn(
          `CompanyAccessGuard: user ${user.userId} attempted to access company ${targetCompanyId}`,
        );
        throw new ForbiddenException(
          'Access denied — you can only access your own company data',
        );
      }

      return true;
    }

    // Regular users (role === 'user') are not allowed to access company routes
    // guarded by this class at all.
    throw new ForbiddenException('Access denied — insufficient permissions');
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private resolveTargetCompanyId(
    request: Request & { user: AuthenticatedUser },
  ): string | null {
    return (
      (request.params?.companyId as string | undefined) ??
      (request.body?.companyId as string | undefined) ??
      (request.query?.companyId as string | undefined) ??
      null
    );
  }
}
