import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsService } from './services/documents.service';
import { DocumentsController } from './documents.controller';
import { OpenAPIDocument } from '../../database/entities/openapi-document.entity';
import { User } from '../../database/entities/user.entity';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OpenAPIDocument, User]),
    SecurityModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}