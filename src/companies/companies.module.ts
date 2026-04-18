import { Module } from '@nestjs/common';

import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { PayPalService } from './paypal.service';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, PayPalService],
  exports: [CompaniesService, PayPalService],
})
export class CompaniesModule {}
