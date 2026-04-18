import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';

import { CompaniesService, PaginationOptions, CompanyFilters } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import {
  DeleteCompanyDto,
  LinkTelegramDto,
  UpdateCompanyDto,
  UpdatePasswordDto,
  UpdatePlanDto,
  UpdateStatusDto,
  VerifyPaymentDto,
} from './dto/update-company.dto';
import { CompanyStatus, UserRole } from '@prisma/client';

// ─── Guards & Decorators ─────────────────────────────────────────────────────
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

/** Shape of the Express request after JwtAuthGuard attaches the user. */
interface AuthRequest {
  user: AuthenticatedUser & { companyId?: string };
}

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // ─── GET / ─────────────────────────────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.super_admin)
  @ApiOperation({ summary: 'List all companies (admin only, paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: CompanyStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of companies' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: CompanyStatus,
    @Query('search') search?: string,
  ) {
    const pagination: PaginationOptions = { page, limit };
    const filters: CompanyFilters = {};

    if (status) filters.status = status;
    if (search) filters.search = search;

    return this.companiesService.findAll(pagination, filters);
  }

  // ─── GET /public ───────────────────────────────────────────────────────────

  @Get('public')
  @ApiOperation({ summary: 'List public (non-blocked) companies for SEO' })
  @ApiResponse({ status: 200, description: 'Array of public company stubs' })
  async findPublic() {
    return this.companiesService.findPublicCompanies();
  }

  // ─── GET /code/:code ───────────────────────────────────────────────────────

  @Get('code/:code')
  @ApiOperation({ summary: 'Find company by 8-char code (public)' })
  @ApiResponse({ status: 200, description: 'Company document' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async findByCode(@Param('code') code: string) {
    return this.companiesService.findByCode(code);
  }

  // ─── GET /:id ──────────────────────────────────────────────────────────────

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get company by ID (authenticated)' })
  @ApiResponse({ status: 200, description: 'Company document' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async findById(@Param('id') id: string) {
    return this.companiesService.findById(id);
  }

  // ─── POST / ────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.super_admin)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new company (admin only)' })
  @ApiResponse({ status: 201, description: 'Company created' })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate email' })
  async create(@Body() dto: CreateCompanyDto) {
    // Hash the plain-text password before persisting
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.companiesService.create({ ...dto, password: hashedPassword });
  }

  // ─── PUT /:id ──────────────────────────────────────────────────────────────

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.company, UserRole.admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Update company details (owner or admin)' })
  @ApiResponse({ status: 200, description: 'Updated company' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @Request() req: AuthRequest,
  ) {
    // Non-admin company users can only update their own company
    if (
      req.user.role === UserRole.company &&
      req.user.companyId !== id
    ) {
      throw new ForbiddenException('You can only update your own company');
    }

    return this.companiesService.update(id, dto);
  }

  // ─── PUT /:id/status ───────────────────────────────────────────────────────

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Update company status (admin only)' })
  @ApiResponse({ status: 200, description: 'Updated company' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.companiesService.updateStatus(id, dto.status);
  }

  // ─── PUT /:id/plan ─────────────────────────────────────────────────────────

  @Put(':id/plan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.super_admin)
  @ApiOperation({ summary: 'Assign subscription plan to company (admin only)' })
  @ApiResponse({ status: 200, description: 'Updated company' })
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.companiesService.updatePlan(id, dto.planId, dto.planEndDate);
  }

  // ─── PUT /:id/password ─────────────────────────────────────────────────────

  @Put(':id/password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.super_admin)
  @ApiOperation({ summary: 'Force-reset company password (super_admin only)' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  async updatePassword(
    @Param('id') id: string,
    @Body() dto: UpdatePasswordDto,
  ) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.companiesService.updatePassword(id, hashedPassword);
    return { message: 'Password updated successfully' };
  }

  // ─── POST /:id/verify-payment ──────────────────────────────────────────────

  @Post(':id/verify-payment')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify PayPal payment and upgrade plan' })
  @ApiResponse({ status: 200, description: 'Verification result' })
  async verifyPayment(
    @Param('id') id: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.companiesService.verifyPaymentAndUpgrade(id, dto.orderId);
  }

  // ─── POST /:id/expire-trial ────────────────────────────────────────────────

  @Post(':id/expire-trial')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.super_admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually expire a company trial (super_admin only)' })
  @ApiResponse({ status: 200, description: 'Trial expired, company blocked' })
  async expireTrial(@Param('id') id: string) {
    return this.companiesService.expireTrial(id);
  }

  // ─── POST /:id/link-telegram ───────────────────────────────────────────────

  @Post(':id/link-telegram')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.company, UserRole.admin, UserRole.super_admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link company to a Telegram chat (owner)' })
  @ApiResponse({ status: 200, description: 'Company linked to Telegram chat' })
  async linkTelegram(
    @Param('id') id: string,
    @Body() dto: LinkTelegramDto,
    @Request() req: AuthRequest,
  ) {
    // Only the owning company user or admins can link telegram
    if (
      req.user.role === UserRole.company &&
      req.user.companyId !== id
    ) {
      throw new ForbiddenException('You can only link Telegram to your own company');
    }

    return this.companiesService.linkTelegram(id, dto.telegramChatId);
  }

  // ─── DELETE /:id ───────────────────────────────────────────────────────────

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.company, UserRole.admin, UserRole.super_admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete company (admin, or owner with password confirmation)' })
  @ApiResponse({ status: 204, description: 'Company deleted' })
  @ApiResponse({ status: 401, description: 'Wrong password' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async delete(
    @Param('id') id: string,
    @Body() dto: DeleteCompanyDto,
    @Request() req: AuthRequest,
  ) {
    const isAdmin =
      req.user.role === UserRole.admin ||
      req.user.role === UserRole.super_admin;

    if (!isAdmin) {
      // Owner must confirm with password
      if (req.user.companyId !== id) {
        throw new ForbiddenException('You can only delete your own company');
      }

      if (!dto.password) {
        throw new UnauthorizedException(
          'Password confirmation is required to delete a company',
        );
      }

      const company = await this.companiesService.findById(id);
      const passwordMatch = await bcrypt.compare(dto.password, company.password);
      if (!passwordMatch) {
        throw new UnauthorizedException('Incorrect password');
      }
    }

    await this.companiesService.delete(id);
  }
}
