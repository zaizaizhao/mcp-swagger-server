import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const createContext = (request: any = {}) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  it('should allow public routes immediately', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(true),
    } as unknown as Reflector;
    const authService = { checkPermission: jest.fn() } as any;
    const guard = new PermissionsGuard(reflector, authService);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(authService.checkPermission).not.toHaveBeenCalled();
  });

  it('should allow routes without permission requirements', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(undefined),
    } as unknown as Reflector;
    const authService = { checkPermission: jest.fn() } as any;
    const guard = new PermissionsGuard(reflector, authService);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(authService.checkPermission).not.toHaveBeenCalled();
  });

  it('should reject when required permissions are missing', async () => {
    const auditLog = jest.fn();
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(['server:write']),
    } as unknown as Reflector;
    const authService = {
      checkPermission: jest.fn().mockResolvedValue(false),
      auditService: { log: auditLog },
    } as any;
    const guard = new PermissionsGuard(reflector, authService);
    const request = {
      user: { id: 'user-1', hasRole: () => false },
      headers: {},
      connection: { remoteAddress: '127.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' },
      path: '/api/v1/servers',
      method: 'POST',
      get: jest.fn().mockReturnValue('jest'),
    };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(authService.checkPermission).toHaveBeenCalledWith('user-1', 'server:write');
    expect(auditLog).toHaveBeenCalled();
  });
});
