import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { PlansService, PlanWithStats } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdateFreeSettingsDto } from './dto/update-free-settings.dto';
import { SubscriptionPlan, FreePlanSettings, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  // -------------------------------------------------------------------------
  // GET /plans — public (no auth required)
  // -------------------------------------------------------------------------
  @Get()
  @ApiOperation({ summary: 'List all subscription plans (public)' })
  @ApiResponse({ status: 200, description: 'Array of plans with company/expiry stats' })
  findAll(): Promise<PlanWithStats[]> {
    return this.plansService.findAll();
  }

  // -------------------------------------------------------------------------
  // POST /plans — admin or super_admin only
  // -------------------------------------------------------------------------
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.super_admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new subscription plan (admin)' })
  @ApiResponse({ status: 201, description: 'The created plan' })
  create(@Body() dto: CreatePlanDto): Promise<SubscriptionPlan> {
    return this.plansService.create(dto);
  }

  // -------------------------------------------------------------------------
  // GET /plans/free-settings — admin or super_admin
  // -------------------------------------------------------------------------
  @Get('free-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.super_admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get free-plan settings (admin)' })
  @ApiResponse({ status: 200, description: 'Current free-plan settings singleton' })
  getFreePlanSettings(): Promise<FreePlanSettings> {
    return this.plansService.getFreePlanSettings();
  }

  // -------------------------------------------------------------------------
  // PUT /plans/free-settings — super_admin only
  // -------------------------------------------------------------------------
  @Put('free-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.super_admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update free-plan settings (super_admin only)' })
  @ApiResponse({ status: 200, description: 'Updated free-plan settings' })
  updateFreePlanSettings(
    @Body() dto: UpdateFreeSettingsDto,
  ): Promise<FreePlanSettings> {
    return this.plansService.updateFreePlanSettings(dto);
  }
}
