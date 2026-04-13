import { ConfigService } from '@nestjs/config';
import { SystemLogService } from './system-log.service';

describe('SystemLogService', () => {
  const createService = () => {
    const systemLogRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 5 }),
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
    };
    const serverRepository = {};
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          SYSTEM_LOG_RETENTION_DAYS: 14,
        };
        return values[key] ?? fallback;
      }),
    };

    const service = new SystemLogService(
      systemLogRepository as any,
      serverRepository as any,
      configService as unknown as ConfigService,
    );

    return { service, systemLogRepository };
  };

  it('should cleanup expired logs based on configured retention days', async () => {
    const { service, systemLogRepository } = createService();

    await service.cleanupExpiredLogs();

    expect(systemLogRepository.delete).toHaveBeenCalledWith({
      createdAt: expect.anything(),
    });
  });

  it('should create system log entries with default level', async () => {
    const { service, systemLogRepository } = createService();
    systemLogRepository.save.mockImplementation(async (value) => value);

    const result = await service.createLog({
      serverId: 'server-1',
      eventType: 'system_startup' as any,
      description: 'started',
    });

    expect(result.level).toBe('info');
    expect(systemLogRepository.save).toHaveBeenCalled();
  });
});
