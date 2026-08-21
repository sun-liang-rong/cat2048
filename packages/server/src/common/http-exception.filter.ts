import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    const message = status >= 500
      ? 'Internal server error'
      : typeof raw === 'object' && raw !== null && 'message' in raw
      ? raw.message
      : exception instanceof Error ? exception.message : 'Internal server error';
    const code = status >= 500 ? 'INTERNAL_ERROR' : this.codeForStatus(status);
    response.status(status).json({
      error: {
        code,
        message,
      },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private codeForStatus(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) return 'VALIDATION_ERROR';
    if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHORIZED';
    if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
    if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
    if (status === HttpStatus.TOO_MANY_REQUESTS) return 'RATE_LIMITED';
    return 'REQUEST_ERROR';
  }
}
