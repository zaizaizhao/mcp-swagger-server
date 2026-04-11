import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('should allow public routes without invoking JWT validation', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const authService = {} as any;
    const guard = new JwtAuthGuard(reflector, authService);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    const canActivateSpy = jest.spyOn(
      Object.getPrototypeOf(JwtAuthGuard.prototype),
      'canActivate',
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalled();
    expect(canActivateSpy).not.toHaveBeenCalled();

    canActivateSpy.mockRestore();
  });
});
