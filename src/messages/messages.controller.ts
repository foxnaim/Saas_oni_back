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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';

// ---------------------------------------------------------------------------
// Auth guard stubs — replace with your project's real guards/decorators once
// the Auth and Users modules are scaffolded.
// ---------------------------------------------------------------------------

import { AuthGuard } from '@nestjs/passport';

/** Lightweight role checker — replace with a proper RolesGuard as needed. */
function hasRole(req: { user?: { role?: string } }, ...roles: string[]): boolean {
  return roles.includes(req.user?.role ?? '');
}

@ApiTags('Messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // -------------------------------------------------------------------------
  // GET /messages  — list with pagination & filters
  // -------------------------------------------------------------------------

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List messages (admins see all, companies see their own)',
  })
  @ApiResponse({ status: 200, description: 'Paginated message list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Query() query: GetMessagesDto,
    @Request() req: { user: { role: string; companyCode?: string } },
  ) {
    const isAdmin = hasRole(req, 'admin', 'super_admin');

    if (!isAdmin) {
      // Company users can only see their own messages
      if (!req.user.companyCode) {
        throw new ForbiddenException('No company associated with this account.');
      }
      query.companyCode = req.user.companyCode;
    }

    return this.messagesService.findAll(query);
  }

  // -------------------------------------------------------------------------
  // GET /messages/:id
  // -------------------------------------------------------------------------

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single message by ID' })
  @ApiParam({ name: 'id', example: 'FB-2024-000001' })
  @ApiResponse({ status: 200, description: 'Message found' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: { role: string; companyCode?: string } },
  ) {
    const message = await this.messagesService.findById(id);

    const isAdmin = hasRole(req, 'admin', 'super_admin');
    if (!isAdmin && message.companyCode !== req.user.companyCode) {
      throw new ForbiddenException('You do not have access to this message.');
    }

    return message;
  }

  // -------------------------------------------------------------------------
  // POST /messages  — public submission with antispam throttle
  // -------------------------------------------------------------------------

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 submissions per minute per IP
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit an anonymous message (public endpoint)',
    description:
      'Rate-limited to 5 requests per minute per IP to prevent spam. No authentication required.',
  })
  @ApiResponse({ status: 201, description: 'Message created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Trial expired or message limit reached' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 429, description: 'Too many requests (antispam)' })
  async create(@Body() dto: CreateMessageDto) {
    return this.messagesService.create(dto);
  }

  // -------------------------------------------------------------------------
  // PUT /messages/:id/status  — company owner or admin
  // -------------------------------------------------------------------------

  @Put(':id/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update message status (company owner or admin)' })
  @ApiParam({ name: 'id', example: 'FB-2024-000001' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
    @Request() req: { user: { role: string; companyCode?: string } },
  ) {
    const isAdmin = hasRole(req, 'admin', 'super_admin');

    if (!isAdmin) {
      const message = await this.messagesService.findById(id);
      if (message.companyCode !== req.user.companyCode) {
        throw new ForbiddenException('You do not have permission to update this message.');
      }
    }

    return this.messagesService.updateStatus(id, dto);
  }

  // -------------------------------------------------------------------------
  // POST /messages/:id/moderate  — admin only
  // -------------------------------------------------------------------------

  @Post(':id/moderate')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Moderate a message — approve or reject (admin only)' })
  @ApiParam({ name: 'id', example: 'FB-2024-000001' })
  @ApiResponse({ status: 200, description: 'Moderation action applied' })
  @ApiResponse({ status: 400, description: 'Invalid action' })
  @ApiResponse({ status: 403, description: 'Forbidden — admins only' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async moderate(
    @Param('id') id: string,
    @Body('action') action: 'approve' | 'reject',
    @Request() req: { user: { role: string } },
  ) {
    if (!hasRole(req, 'admin', 'super_admin')) {
      throw new ForbiddenException('Only administrators can moderate messages.');
    }

    if (!['approve', 'reject'].includes(action)) {
      throw new ForbiddenException('action must be "approve" or "reject".');
    }

    return this.messagesService.moderate(id, action);
  }

  // -------------------------------------------------------------------------
  // DELETE /messages/:id  — admin only
  // -------------------------------------------------------------------------

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message (admin only)' })
  @ApiParam({ name: 'id', example: 'FB-2024-000001' })
  @ApiResponse({ status: 204, description: 'Message deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden — admins only' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async remove(
    @Param('id') id: string,
    @Request() req: { user: { role: string } },
  ) {
    if (!hasRole(req, 'admin', 'super_admin')) {
      throw new ForbiddenException('Only administrators can delete messages.');
    }

    await this.messagesService.delete(id);
  }
}
