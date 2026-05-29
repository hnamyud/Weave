import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ErrorResponseBody,
  PrismaExceptionFilter,
} from './prisma-exception.filter';

type HttpExceptionResponse = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const body = this.toResponseBody(exception, request.url);

    response.status(body.statusCode).json(body);
  }

  private toResponseBody(exception: unknown, path: string): ErrorResponseBody {
    if (PrismaExceptionFilter.isPrismaException(exception)) {
      return PrismaExceptionFilter.toResponseBody(exception, path);
    }

    if (exception instanceof HttpException) {
      return this.mapHttpException(exception, path);
    }

    this.logUnknownException(exception);

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
      path,
      timestamp: new Date().toISOString(),
    };
  }

  private mapHttpException(
    exception: HttpException,
    path: string,
  ): ErrorResponseBody {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        statusCode,
        message: response,
        error: this.getErrorName(statusCode),
        path,
        timestamp: new Date().toISOString(),
      };
    }

    const exceptionResponse = response as HttpExceptionResponse;

    return {
      statusCode,
      message: exceptionResponse.message ?? exception.message,
      error: exceptionResponse.error ?? this.getErrorName(statusCode),
      path,
      timestamp: new Date().toISOString(),
    };
  }

  private getErrorName(statusCode: number) {
    return HttpStatus[statusCode] ?? 'Error';
  }

  private logUnknownException(exception: unknown) {
    if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      return;
    }

    this.logger.error('Unknown exception', JSON.stringify(exception));
  }
}
