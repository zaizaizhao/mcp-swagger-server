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
  const serverManager = {
    updateServer: jest.fn(),
    deleteServer: jest.fn(),
  };

  const apiManagementCenter = {
    getOverview: jest.fn(),
    probeEndpoint: jest.fn(),
    getPublishReadiness: jest.fn(),
    registerManualEndpoint: jest.fn(),
    changeEndpointState: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const builder = Test.createTestingModule({
      controllers: [ServersController],
      providers: [
        { provide: ServerManagerService, useValue: serverManager },
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

  it('returns API center overview', async () => {
    apiManagementCenter.getOverview.mockResolvedValue({
      total: 1,
      data: [{ id: 'server-1', name: 'health-endpoint' }],
    });

    await expect(controller.getApiCenterOverview({ sourceType: 'manual' } as any)).resolves.toEqual({
      total: 1,
      data: [{ id: 'server-1', name: 'health-endpoint' }],
    });
  });

  it('registers a manual endpoint', async () => {
    apiManagementCenter.registerManualEndpoint.mockResolvedValue({
      serverId: 'server-1',
      name: 'health-endpoint',
    });

    await expect(
      controller.registerManualEndpoint({
        name: 'health-endpoint',
        baseUrl: 'http://localhost:3001',
        method: 'GET',
        path: '/health',
      } as any),
    ).resolves.toEqual({
      serverId: 'server-1',
      name: 'health-endpoint',
    });
  });

  it('returns probe result for an endpoint', async () => {
    apiManagementCenter.probeEndpoint.mockResolvedValue({
      serverId: 'server-1',
      probe: { status: 'healthy' },
    });

    await expect(controller.probeEndpoint('server-1', { path: '/health' } as any)).resolves.toEqual({
      serverId: 'server-1',
      probe: { status: 'healthy' },
    });
    expect(apiManagementCenter.probeEndpoint).toHaveBeenCalledWith('server-1', { path: '/health' });
  });

  it('returns publish readiness', async () => {
    apiManagementCenter.getPublishReadiness.mockResolvedValue({
      serverId: 'server-1',
      ready: true,
      reasons: [],
    });

    await expect(controller.getPublishReadiness('server-1')).resolves.toEqual({
      serverId: 'server-1',
      ready: true,
      reasons: [],
    });
  });

  it('updates a manual endpoint through the existing server update flow', async () => {
    serverManager.updateServer.mockResolvedValue({
      id: 'server-1',
      name: 'health-endpoint',
      description: 'updated',
    });

    await expect(
      controller.updateServer('server-1', {
        name: 'health-endpoint',
        description: 'updated',
        openApiData: {
          openapi: '3.0.3',
        },
        config: {
          management: {
            sourceType: 'manual',
          },
        },
      } as any),
    ).resolves.toEqual({
      id: 'server-1',
      name: 'health-endpoint',
      description: 'updated',
    });
  });

  it('deletes a manual endpoint through the server delete flow', async () => {
    serverManager.deleteServer.mockResolvedValue(undefined);

    await expect(controller.deleteServer('server-1')).resolves.toEqual({
      success: true,
      message: 'Server deleted successfully',
    });
  });
});
