import { forwardRef, Module } from '@nestjs/common';

import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';

import { CompaniesModule } from '../companies/companies.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    forwardRef(() => CompaniesModule),
    forwardRef(() => WebsocketModule),
    forwardRef(() => TelegramModule),
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
