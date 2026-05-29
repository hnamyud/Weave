import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/customize.decorator';
import { CheckFileDto } from './dto/check-file.dto';
import { PresignFileDto } from './dto/presign-file.dto';
import { FileService } from './file.service';

@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('check')
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CheckFileDto })
  @ResponseMessage('Check file successfully!')
  async checkFile(@Body() dto: CheckFileDto) {
    return this.fileService.checkFile(dto);
  }

  @Post('presign')
  @ApiBearerAuth('access-token')
  @ApiBody({ type: PresignFileDto })
  @ResponseMessage('Create upload URL successfully!')
  async createPresignedUpload(@Body() dto: PresignFileDto) {
    return this.fileService.createPresignedUpload(dto);
  }
}
