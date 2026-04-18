import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { StatsParamDto } from './dto/stats-query.dto';

// ── Guard & decorator imports ─────────────────────────────────────────────────
// These are expected to be provided by AuthModule / shared guards.
// Adjust import paths when the actual auth module is created.
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Stats')
@ApiBearerAuth()
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  // ── Platform-wide stats (admin only) ────────────────────────────────────────

  @Get('platform')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get platform-wide statistics (admin only)' })
  @ApiResponse({ status: 200, description: 'Platform statistics' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getPlatformStats() {
    const data = await this.statsService.getPlatformStats();
    return { success: true, data };
  }

  // ── Company stats (basic – available to any authenticated company/admin) ─────
  // URL: /stats/company/:id  (matches frontend `/stats/company/${companyId}`)

  @Get('company/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.company, UserRole.admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get company message statistics by status' })
  @ApiParam({ name: 'id', description: 'Company ObjectId' })
  @ApiResponse({ status: 200, description: 'Company stats' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async getCompanyStats(@Param() params: StatsParamDto, @Request() req: any) {
    this.assertCompanyAccess(req, params.id);
    const data = await this.statsService.getCompanyStats(params.id);
    return { success: true, data };
  }

  // ── Message distribution (plan-gated) ────────────────────────────────────────
  // URL: /stats/distribution/:id

  @Get('distribution/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.company, UserRole.admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get message type distribution for a company' })
  @ApiParam({ name: 'id', description: 'Company ObjectId' })
  @ApiResponse({ status: 200, description: 'Message distribution' })
  async getMessageDistribution(@Param() params: StatsParamDto, @Request() req: any) {
    this.assertCompanyAccess(req, params.id);
    const data = await this.statsService.getMessageDistribution(params.id);
    return { success: true, data };
  }

  // ── Growth metrics (plan-gated) ──────────────────────────────────────────────
  // URL: /stats/growth/:id

  @Get('growth/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.company, UserRole.admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get growth metrics and composite rating for a company' })
  @ApiParam({ name: 'id', description: 'Company ObjectId' })
  @ApiResponse({ status: 200, description: 'Growth metrics' })
  async getGrowthMetrics(@Param() params: StatsParamDto, @Request() req: any) {
    this.assertCompanyAccess(req, params.id);
    const data = await this.statsService.getGrowthMetrics(params.id);
    return { success: true, data };
  }

  // ── Achievements ─────────────────────────────────────────────────────────────
  // URL: /stats/achievements/:id

  @Get('achievements/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.company, UserRole.admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get all achievements with progress for a company' })
  @ApiParam({ name: 'id', description: 'Company ObjectId' })
  @ApiResponse({ status: 200, description: 'Achievement progress list' })
  async getAchievements(@Param() params: StatsParamDto, @Request() req: any) {
    this.assertCompanyAccess(req, params.id);
    const data = await this.statsService.getAchievements(params.id);
    return { success: true, data };
  }

  // ── Grouped achievements ─────────────────────────────────────────────────────
  // URL: /stats/achievements/:id/grouped

  @Get('achievements/:id/grouped')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.company, UserRole.admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Get achievements grouped by category for a company' })
  @ApiParam({ name: 'id', description: 'Company ObjectId' })
  @ApiResponse({ status: 200, description: 'Grouped achievement progress' })
  async getGroupedAchievements(@Param() params: StatsParamDto, @Request() req: any) {
    this.assertCompanyAccess(req, params.id);
    const data = await this.statsService.getGroupedAchievements(params.id);
    return { success: true, data };
  }

  // ── Helper: ensure a company user can only query their own stats ──────────────

  private assertCompanyAccess(req: any, targetCompanyId: string): void {
    const user = req.user as {
      role: string;
      companyId?: string;
      sub?: string;
    } | undefined;

    if (!user) throw new ForbiddenException();

    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    if (isAdmin) return; // admins can query any company

    // Company users may only access their own stats
    const ownCompanyId = user.companyId?.toString();
    if (!ownCompanyId || ownCompanyId !== targetCompanyId) {
      throw new ForbiddenException('You can only access your own company statistics');
    }
  }
}
