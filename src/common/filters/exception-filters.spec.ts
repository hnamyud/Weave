import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { GlobalExceptionFilter } from './global-exception.filter';
import { PrismaExceptionFilter } from './prisma-exception.filter';

const anyString = expect.any(String) as unknown as string;
const leakedMessageMatcher = expect.stringContaining(
  'database password leaked',
) as unknown as string;

function createHost(path = '/api/v1/test') {
  const json = jest.fn<(body: unknown) => void>();
  const status = jest.fn<(statusCode: number) => { json: typeof json }>(() => ({
    json,
  }));
  const response = { status };
  const request = { url: path };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost;

  return { host, status, json };
}

function prismaKnownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Raw database error', {
    code,
    clientVersion: 'test',
  });
}

describe('GlobalExceptionFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps HttpException to the standard error response shape', () => {
    const filter = new GlobalExceptionFilter();
    const { host, status, json } = createHost('/api/v1/messages');

    filter.catch(new BadRequestException('Invalid request'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid request',
      error: 'Bad Request',
      path: '/api/v1/messages',
      timestamp: anyString,
    });
  });

  it('preserves class-validator style message arrays', () => {
    const filter = new GlobalExceptionFilter();
    const { host, json } = createHost();

    filter.catch(
      new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: ['email must be an email'],
        error: 'Bad Request',
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: ['email must be an email'],
        error: 'Bad Request',
      }),
    );
  });

  it('maps unknown errors to 500 without leaking the raw message', () => {
    const filter = new GlobalExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new Error('database password leaked'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'Internal Server Error',
      }),
    );
    expect(json).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: leakedMessageMatcher,
      }),
    );
  });
});

describe('PrismaExceptionFilter', () => {
  it.each([
    ['P2002', HttpStatus.CONFLICT, 'Unique constraint violation'],
    ['P2025', HttpStatus.NOT_FOUND, 'Record not found'],
    ['P2003', HttpStatus.BAD_REQUEST, 'Foreign key constraint violation'],
  ] satisfies Array<[string, number, string]>)(
    'maps %s to the expected response',
    (code, statusCode, message) => {
      const filter = new PrismaExceptionFilter();
      const { host, status, json } = createHost('/api/v1/users');

      filter.catch(prismaKnownError(code), host);

      expect(status).toHaveBeenCalledWith(statusCode);
      expect(json).toHaveBeenCalledWith({
        statusCode,
        message,
        error: anyString,
        path: '/api/v1/users',
        timestamp: anyString,
      });
    },
  );

  it('maps Prisma validation errors to 400', () => {
    const filter = new PrismaExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(
      new Prisma.PrismaClientValidationError('Invalid Prisma query', {
        clientVersion: 'test',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid database query',
        error: 'Bad Request',
      }),
    );
  });

  it('includes request path and ISO timestamp in Prisma responses', () => {
    const filter = new PrismaExceptionFilter();
    const { host, json } = createHost('/api/v1/workspaces');

    filter.catch(prismaKnownError('P2002'), host);

    const payload = json.mock.calls[0]?.[0] as
      | {
          path: string;
          timestamp: string;
        }
      | undefined;

    expect(payload).toBeDefined();
    expect(payload?.path).toBe('/api/v1/workspaces');
    expect(new Date(payload?.timestamp ?? '').toISOString()).toBe(
      payload?.timestamp,
    );
  });
});
