import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CompanyStatus } from '@prisma/client';
import { Request } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

/**
 * CompanyBlockedGuard
 *
 * Must be applied **after** JwtAuthGuard so that `req.user` is already populated.
 *
 * Behaviour:
 *  1. Resolves the authenticated user's company via their `companyId`.
 *  2. If the company's status is `Blocked`, throws a 403 ForbiddenException.
 *  3. Otherwise, allows the request to continue.
 *
 * Users that have no `companyId` (e.g. platform admins) are let through
 * without a company check.
 */
@Injectable()
export class CompanyBlockedGuard implements CanActivate {
  private readonly logger = new Logger(CompanyBlockedGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authUser = request.user as AuthenticatedUser | undefined;

    if (!authUser?.userId) {
      throw new UnauthorizedException('Authentication required');
    }

    // Load the full user document to access companyId
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, companyId: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Users without a companyId (super admins, platform admins) are allowed through
    if (!user.companyId) {
      return true;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
      select: { status: true },
    });

    if (!company) {
      this.logger.warn(`Company ${user.companyId} not found for user ${authUser.userId}`);
      throw new ForbiddenException('Your company account no longer exists');
    }

    if (company.status === CompanyStatus.Blocked) {
      this.logger.warn(
        `Blocked company ${user.companyId} attempted access by user ${authUser.userId}`,
      );
      throw new ForbiddenException(
        'Your company account has been blocked. Please contact support.',
      );
    }

    return true;
  }
}
