import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SupportService, SupportInfo } from './support.service';

@ApiTags('Support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get public support contact information' })
  @ApiOkResponse({
    description: 'Returns the WhatsApp support number configured by an admin.',
    schema: {
      type: 'object',
      properties: {
        whatsapp: { type: 'string', nullable: true, example: '+1 800 555 0100' },
      },
    },
  })
  async getSupportInfo(): Promise<SupportInfo> {
    return this.supportService.getSupportInfo();
  }
}
