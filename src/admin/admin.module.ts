import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    UsersModule,
    EmailModule,
  ],
  providers:   [AdminService],
  controllers: [AdminController],
  exports:     [AdminService],
})
export class AdminModule {}
