import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { EmailService } from '../email/email.service';

@ApiTags('Admin Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.super_admin)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly emailService: EmailService,
  ) {}

  // ─── GET /admin/admins ────────────────────────────────────────────────────

  @Get('admins')
  @ApiOperation({ summary: 'List all admins (paginated)' })
  @ApiQuery({ name: 'page',  required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated list of admin accounts' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findAll(
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page:  number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.findAll(page, limit);
  }

  // ─── POST /admin/admins ───────────────────────────────────────────────────

  @Post('admins')
  @ApiOperation({
    summary: 'Create a new admin account',
    description:
      'Generates a secure temporary password, creates the admin user, ' +
      'and dispatches a credentials email.',
  })
  @ApiResponse({ status: 201, description: 'Admin created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async create(@Body() dto: CreateAdminDto) {
    const { admin, plainPassword } = await this.adminService.create(dto);

    // Fire-and-forget — email failures should not roll back account creation
    this.emailService
      .sendAdminPasswordEmail(admin.email, admin.name ?? 'Admin', plainPassword)
      .catch(() => {
        // EmailService already logs the failure internally
      });

    // Never expose the plain password in the HTTP response
    const { password: _pw, ...safeAdmin } = admin as any;
    return {
      message: 'Admin account created. Credentials have been sent by email.',
      admin:   safeAdmin,
    };
  }

  // ─── PUT /admin/admins/:id ────────────────────────────────────────────────

  @Put('admins/:id')
  @ApiOperation({ summary: 'Update an admin account' })
  @ApiParam({ name: 'id', description: 'Admin user ObjectId' })
  @ApiResponse({ status: 200, description: 'Admin updated successfully' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
  ) {
    const admin = await this.adminService.update(id, dto);
    return { message: 'Admin updated successfully', admin };
  }

  // ─── DELETE /admin/admins/:id ─────────────────────────────────────────────

  @Delete('admins/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete an admin account',
    description:
      'Permanently removes the admin and all user records associated with them.',
  })
  @ApiParam({ name: 'id', description: 'Admin user ObjectId' })
  @ApiResponse({ status: 200, description: 'Admin deleted' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async remove(@Param('id') id: string) {
    const result = await this.adminService.remove(id);
    return {
      message: `Admin deleted. ${result.associatedUsersDeleted} associated user(s) also removed.`,
      ...result,
    };
  }
}
