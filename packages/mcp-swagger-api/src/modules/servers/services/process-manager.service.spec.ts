import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { ProcessManagerService } from './process-manager.service';
import { LogLevel } from '../interfaces/process.interface';

describe('ProcessManagerService', () => {
  const createService = () => {
    const processInfoRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const processLogRepository = {
      create: jest.fn((value) => ({ id: 'log-1', ...value })),
      save: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    const eventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          PROCESS_LOG_PERSIST_ENABLED: true,
          PROCESS_LOG_PERSIST_MIN_INTERVAL_MS: 1000,
          PROCESS_LOG_MAX_MESSAGE_LENGTH: 20,
          PROCESS_LOG_RETENTION_DAYS: 7,
        };
        return values[key] ?? fallback;
      }),
    };
    const resourceMonitor = {
      stopMonitoring: jest.fn(),
      startMonitoring: jest.fn(),
      getProcessResourceMetrics: jest.fn(),
      getSystemResourceInfo: jest.fn(),
      getResourceHistory: jest.fn(),
    };
    const logMonitor = {
      stopLogMonitoring: jest.fn(),
      startLogMonitoring: jest.fn(),
      addLogEntry: jest.fn(),
      getLogHistory: jest.fn(),
    };

    const service = new ProcessManagerService(
      processInfoRepository as any,
      processLogRepository as any,
      eventEmitter as unknown as EventEmitter2,
      configService as unknown as ConfigService,
      resourceMonitor as any,
      logMonitor as any,
    );

    return {
      service,
      processLogRepository,
      eventEmitter,
    };
  };

  it('should truncate oversized log messages before persisting', async () => {
    const { service, processLogRepository } = createService();

    await (service as any).logProcess(
      'server-1',
      LogLevel.INFO,
      'abcdefghijklmnopqrstuvwxyz',
    );

    expect(processLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'abcdefghijklmnopqrst... [truncated]',
      }),
    );
  });

  it('should throttle duplicate logs within the configured interval', async () => {
    const { service, processLogRepository, eventEmitter } = createService();

    await (service as any).logProcess('server-1', LogLevel.INFO, 'same-log');
    await (service as any).logProcess('server-1', LogLevel.INFO, 'same-log');

    expect(processLogRepository.save).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'process.logs.updated',
      expect.objectContaining({
        logData: expect.objectContaining({
          metadata: expect.objectContaining({
            throttled: true,
            persisted: false,
          }),
        }),
      }),
    );
  });

  it('should cleanup old process logs and clear throttle cache', async () => {
    const { service, processLogRepository } = createService();
    (service as any).recentPersistedLogs.set('server-1:info:test', Date.now());

    await service.cleanupOldProcessLogs();

    expect(processLogRepository.delete).toHaveBeenCalled();
    expect((service as any).recentPersistedLogs.size).toBe(0);
  });
});
