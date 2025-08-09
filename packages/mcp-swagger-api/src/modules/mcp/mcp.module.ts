import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';
import { MCPService } from './services/mcp.service';

@Module({
  imports: [
    EventEmitterModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [],
  providers: [MCPService],
  exports: [MCPService],
})
export class MCPModule {}
