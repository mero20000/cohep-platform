import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const path = request.url;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, any>;
        message = responseObj.message || exception.message;
        error = responseObj.error || 'Error';
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = this.handlePrismaError(exception);
      statusCode = prismaError.statusCode;
      message = prismaError.message;
      error = prismaError.error;
    } else if (exception instanceof Error) {
      // Never leak internal details (DB plumbing, file paths, dependency
      // messages) to clients. The full stack is still logged server-side.
      message = 'Internal server error';
      error = 'Internal Server Error';
    }

    const errorResponse = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path,
    };

    this.logger.error(
      `${request.method} ${path} ${statusCode}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(statusCode).json(errorResponse);
  }

  private handlePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): { statusCode: number; message: string; error: string } {
    switch (exception.code) {
      case 'P2002': {
        const target = (exception.meta?.target as string[]) || [];
        const fields = target.length > 0 ? target.join(', ') : 'field';
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `A record with the same ${fields} already exists`,
          error: 'Conflict',
        };
      }
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'Not Found',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Foreign key constraint failed',
          error: 'Bad Request',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Database error: ${exception.code}`,
          error: 'Internal Server Error',
        };
    }
  }
}
