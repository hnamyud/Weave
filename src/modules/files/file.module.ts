import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { R2StorageService } from './r2-storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [FileController],
  providers: [FileService, R2StorageService],
  exports: [FileService],
})
export class FileModule {}
