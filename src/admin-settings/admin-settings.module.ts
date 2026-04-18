import { Module } from '@nestjs/common';
import { AdminSettingsService } from './admin-settings.service';
import { AdminSettingsController } from './admin-settings.controller';

@Module({
  providers:   [AdminSettingsService],
  controllers: [AdminSettingsController],
  exports:     [AdminSettingsService],
})
export class AdminSettingsModule {}
