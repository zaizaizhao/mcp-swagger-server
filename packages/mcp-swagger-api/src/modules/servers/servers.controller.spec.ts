import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ServersController } from './servers.controller';
import { ServerManagerService } from './services/server-manager.service';
import { SystemLogService } from './services/system-log.service';
import { OpenAPIService } from '../openapi/services/openapi.service';
import { ServerHealthService } from './services/server-health.service';
import { ServerMetricsService } from './services/server-metrics.service';
import { ProcessManagerService } from './services/process-manager.service';
import { ProcessHealthService } from './services/process-health.service';
import { ProcessErrorHandlerService } from './services/process-error-handler.service';
import { ProcessResourceMonitorService } from './services/process-resource-monitor.service';
import { ProcessLogMonitorService } from './services/process-log-monitor.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiManagementCenterService } from './services/api-management-center.service';
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard';
import { PermissionsGuard } from '../security/guards/permissions.guard';

describe('ServersController', () => {
  let controller: ServersController;

  const apiManagementCenter = {
    changeEndpointState: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const builder = Test.createTestingModule({
      controllers: [ServersController],
      providers: [
        { provide: ServerManagerService, useValue: {} },
        { provide: SystemLogService, useValue: {} },
        { provide: OpenAPIService, useValue: {} },
        { provide: ServerHealthService, useValue: {} },
        { provide: ServerMetricsService, useValue: {} },
        { provide: ProcessManagerService, useValue: {} },
        { provide: ProcessHealthService, useValue: {} },
        { provide: ProcessErrorHandlerService, useValue: {} },
        { provide: ProcessResourceMonitorService, useValue: {} },
        { provide: ProcessLogMonitorService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn(), once: jest.fn() } },
        { provide: ApiManagementCenterService, useValue: apiManagementCenter },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) });

    const module: TestingModule = await builder.compile();

    controller = module.get<ServersController>(ServersController);
  });

  it('should block publish when readiness check fails', async () => {
    apiManagementCenter.changeEndpointState.mockRejectedValue(
      new Error('Publish blocked: publishEnabled=false'),
    );

    await expect(
      controller.changeEndpointState('server-1', { action: 'publish' }),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
