import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

export type ErrorResponseBody = {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
};

type PrismaErrorMapping = {
  statusCode: number;
  message: string;
  error: string;
};

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientValidationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const body = PrismaExceptionFilter.toResponseBody(exception, request.url);

    response.status(body.statusCode).json(body);
  }

  static isPrismaException(exception: unknown) {
    return (
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientRustPanicError ||
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientValidationError
    );
  }

  static toResponseBody(exception: unknown, path: string): ErrorResponseBody {
    const mapping = this.mapException(exception);

    return {
      statusCode: mapping.statusCode,
      message: mapping.message,
      error: mapping.error,
      path,
      timestamp: new Date().toISOString(),
    };
  }

  private static mapException(exception: unknown): PrismaErrorMapping {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapKnownRequestError(exception.code);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid database query',
        error: 'Bad Request',
      };
    }

    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database service unavailable',
        error: 'Service Unavailable',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database operation failed',
      error: 'Internal Server Error',
    };
  }

  private static mapKnownRequestError(code: string): PrismaErrorMapping {
    switch (code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Unique constraint violation',
          error: 'Conflict',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'Not Found',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Foreign key constraint violation',
          error: 'Bad Request',
        };
      case 'P2014':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid relation change',
          error: 'Bad Request',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database operation failed',
          error: 'Internal Server Error',
        };
    }
  }
}
