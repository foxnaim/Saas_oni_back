import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { AdminSettingsService } from './admin-settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Admin Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin-settings')
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  // ─── GET /admin-settings ──────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: "Retrieve the authenticated admin's settings" })
  @ApiResponse({ status: 200, description: 'Settings returned (defaults created on first access)' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  async getSettings(@CurrentUser() user: AuthenticatedUser) {
    const settings = await this.adminSettingsService.getSettings(user.userId);
    return { settings };
  }

  // ─── PUT /admin-settings ──────────────────────────────────────────────────

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update the authenticated admin's settings" })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    const settings = await this.adminSettingsService.updateSettings(user.userId, dto);
    return { message: 'Settings updated successfully', settings };
  }
}
