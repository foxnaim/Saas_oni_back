import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Application health check' })
  async check() {
    let dbConnected = false;
    let dbState = 'disconnected';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
      dbState = 'connected';
    } catch {
      dbState = 'error';
    }

    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        state: dbState,
      },
    };
  }
}
