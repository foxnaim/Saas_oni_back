import { Module } from '@nestjs/common';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [AdminSettingsModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
