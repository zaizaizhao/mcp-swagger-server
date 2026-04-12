import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { ProcessHealthService } from './process-health.service';

describe('ProcessHealthService', () => {
  const createService = () => {
    const healthCheckRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 3 }),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    const serverRepository = {
      findOne: jest.fn(),
    };
    const processManager = {
      getAllProcessInfo: jest.fn().mockReturnValue([]),
      getProcessInfo: jest.fn(),
      getProcessMetrics: jest.fn(),
    };
    const eventEmitter = {
      emit: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          HEALTH_CHECK_INTERVAL: 30000,
          HEALTH_CHECK_TIMEOUT: 5000,
          HEALTH_CHECK_RETENTION_DAYS: 7,
          HEALTH_CHECK_PERSIST_INTERVAL_MS: 60000,
        };
        return values[key] ?? fallback;
      }),
    };
    const httpService = {
      get: jest.fn(),
    };

    const service = new ProcessHealthService(
      healthCheckRepository as any,
      serverRepository as any,
      processManager as any,
      eventEmitter as unknown as EventEmitter2,
      configService as unknown as ConfigService,
      httpService as unknown as HttpService,
    );

    return { service, healthCheckRepository };
  };

  it('should persist unhealthy checks immediately', () => {
    const { service } = createService();

    const shouldPersist = (service as any).shouldPersistHealthCheck('server-1', {
      healthy: false,
      responseTime: 10,
      error: 'boom',
      lastCheck: new Date(),
    });

    expect(shouldPersist).toBe(true);
  });

  it('should throttle healthy checks within the configured interval', () => {
    const { service } = createService();
    const result = {
      healthy: true,
      responseTime: 10,
      lastCheck: new Date(),
    };

    expect((service as any).shouldPersistHealthCheck('server-1', result)).toBe(
      true,
    );
    expect((service as any).shouldPersistHealthCheck('server-1', result)).toBe(
      false,
    );
  });

  it('should skip repository writes when a healthy check is throttled', async () => {
    const { service, healthCheckRepository } = createService();
    const result = {
      healthy: true,
      responseTime: 10,
      lastCheck: new Date(),
    };

    await (service as any).saveHealthCheckResult('server-1', result);
    await (service as any).saveHealthCheckResult('server-1', result);

    expect(healthCheckRepository.save).toHaveBeenCalledTimes(1);
  });
});
