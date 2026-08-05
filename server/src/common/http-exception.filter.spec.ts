import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('hides internal exception details from 5xx responses', () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ url: '/health' }),
      }),
    };

    new HttpExceptionFilter().catch(new Error('database password leaked'), host as never);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    }));
  });
});
