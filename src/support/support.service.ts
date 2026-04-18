import { Injectable } from '@nestjs/common';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';

export interface SupportInfo {
  whatsapp: string | null;
}

@Injectable()
export class SupportService {
  constructor(
    private readonly adminSettingsService: AdminSettingsService,
  ) {}

  async getSupportInfo(): Promise<SupportInfo> {
    const settings = await this.adminSettingsService.getFirstSettings();

    return {
      whatsapp: settings?.supportWhatsAppNumber ?? null,
    };
  }
}
