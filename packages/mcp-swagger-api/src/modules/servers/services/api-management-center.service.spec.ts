import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { ApiManagementCenterService } from './api-management-center.service';
import { MCPServerEntity } from '../../../database/entities/mcp-server.entity';
import { EndpointProbeLogEntity } from '../entities/endpoint-probe-log.entity';
import { ServerManagerService } from './server-manager.service';

describe('ApiManagementCenterService', () => {
  let service: ApiManagementCenterService;

  const serverRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };

  const probeLogRepository = {
    create: jest.fn((v) => v),
    save: jest.fn(),
    find: jest.fn(),
  };

  const httpService = {
    head: jest.fn(),
    get: jest.fn(),
  };

  const serverManager = {
    createServer: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiManagementCenterService,
        {
          provide: getRepositoryToken(MCPServerEntity),
          useValue: serverRepository,
        },
        {
          provide: getRepositoryToken(EndpointProbeLogEntity),
          useValue: probeLogRepository,
        },
        {
          provide: HttpService,
          useValue: httpService,
        },
        {
          provide: ServerManagerService,
          useValue: serverManager,
        },
      ],
    }).compile();

    service = module.get<ApiManagementCenterService>(ApiManagementCenterService);
  });

  it('registers a manual endpoint with the concrete probe url', async () => {
    serverManager.createServer.mockResolvedValue({ id: 'manual-1' });
    serverRepository.findOne.mockResolvedValue({
      id: 'manual-1',
      name: 'health-endpoint',
      config: {},
    });
    serverRepository.save.mockImplementation(async (value) => value);

    const result = await service.registerManualEndpoint({
      name: 'health-endpoint',
      baseUrl: 'http://localhost:3001',
      method: 'GET',
      path: '/health',
      description: 'Health check endpoint',
    });

    expect(serverManager.createServer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'health-endpoint',
        openApiData: expect.objectContaining({
          servers: [{ url: 'http://localhost:3001' }],
          paths: expect.objectContaining({
            '/health': expect.any(Object),
          }),
        }),
      }),
    );
    expect(serverRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          management: expect.objectContaining({
            probeUrl: 'http://localhost:3001/health',
            lifecycleStatus: 'draft',
            publishEnabled: false,
          }),
        }),
      }),
    );
    expect(result.profile.probeUrl).toBe('http://localhost:3001/health');
  });

  it('marks a manual endpoint verified after a healthy probe', async () => {
    serverRepository.findOne.mockResolvedValue({
      id: 'probe-1',
      name: 'health-endpoint',
      openApiData: {
        servers: [{ url: 'http://localhost:3001' }],
        paths: {
          '/health': {
            get: {},
          },
        },
      },
      config: {
        management: {
          sourceType: 'manual',
          probeUrl: 'http://localhost:3001/health',
          lifecycleStatus: 'draft',
          publishEnabled: false,
        },
      },
    });
    serverRepository.save.mockImplementation(async (value) => value);
    httpService.head.mockReturnValue(of({ status: 200 }));

    const result = await service.probeEndpoint('probe-1');

    expect(httpService.head).toHaveBeenCalledWith(
      'http://localhost:3001/health',
      expect.objectContaining({
        timeout: 8000,
      }),
    );
    expect(result.profile.lifecycleStatus).toBe('verified');
    expect(result.profile.publishEnabled).toBe(true);
    expect(result.profile.lastProbeStatus).toBe('healthy');
    expect(probeLogRepository.save).toHaveBeenCalled();
  });

  it('returns ready when probe is healthy and openapi data exists', async () => {
    serverRepository.findOne.mockResolvedValue({
      id: 'ready-1',
      name: 'ready-server',
      openApiData: { openapi: '3.0.0' },
      config: {
        management: {
          lifecycleStatus: 'verified',
          publishEnabled: true,
          lastProbeStatus: 'healthy',
        },
      },
    });

    const result = await service.getPublishReadiness('ready-1');

    expect(result.ready).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('publishes when readiness check passes', async () => {
    serverRepository.findOne.mockResolvedValue({
      id: 'publish-1',
      name: 'ready-server',
      openApiData: { openapi: '3.0.0' },
      config: {
        management: {
          lifecycleStatus: 'verified',
          publishEnabled: true,
          lastProbeStatus: 'healthy',
        },
      },
    });
    serverRepository.save.mockImplementation(async (value) => value);

    const result = await service.changeEndpointState('publish-1', { action: 'publish' });

    expect(result.profile.lifecycleStatus).toBe('published');
    expect(result.profile.publishEnabled).toBe(true);
    expect(serverRepository.save).toHaveBeenCalled();
  });

  it('sets publishEnabled false when endpoint goes offline', async () => {
    serverRepository.findOne.mockResolvedValue({
      id: 'offline-1',
      name: 'ready-server',
      config: {
        management: {
          lifecycleStatus: 'published',
          publishEnabled: true,
          lastProbeStatus: 'healthy',
        },
      },
    });
    serverRepository.save.mockImplementation(async (value) => value);

    const result = await service.changeEndpointState('offline-1', {
      action: 'offline',
      reason: 'maintenance',
    });

    expect(result.profile.lifecycleStatus).toBe('offline');
    expect(result.profile.publishEnabled).toBe(false);
    expect(result.profile.lastProbeError).toBe('maintenance');
  });

  it('falls back to GET probe when HEAD is not supported', async () => {
    serverRepository.findOne.mockResolvedValue({
      id: 'probe-2',
      name: 'ready-server',
      openApiData: { openapi: '3.0.0' },
      config: {
        management: {
          probeUrl: 'http://localhost:3001/health',
          lifecycleStatus: 'draft',
          publishEnabled: false,
        },
      },
    });
    serverRepository.save.mockImplementation(async (value) => value);
    httpService.head.mockReturnValue(
      throwError(() => new Error('HEAD not supported')),
    );
    httpService.get.mockReturnValue(of({ status: 200 }));

    const result = await service.probeEndpoint('probe-2');

    expect(httpService.get).toHaveBeenCalledWith(
      'http://localhost:3001/health',
      expect.objectContaining({
        timeout: 8000,
      }),
    );
    expect(result.probe?.status).toBe('healthy');
  });

  it('falls back to GET probe when HEAD returns 404 but GET is healthy', async () => {
    serverRepository.findOne.mockResolvedValue({
      id: 'probe-3',
      name: 'health-endpoint',
      openApiData: { openapi: '3.0.0' },
      config: {
        management: {
          probeUrl: 'http://127.0.0.1:3322/health',
          lifecycleStatus: 'draft',
          publishEnabled: false,
        },
      },
    });
    serverRepository.save.mockImplementation(async (value) => value);
    httpService.head.mockReturnValue(of({ status: 404 }));
    httpService.get.mockReturnValue(of({ status: 200 }));

    const result = await service.probeEndpoint('probe-3');

    expect(httpService.head).toHaveBeenCalledWith(
      'http://127.0.0.1:3322/health',
      expect.objectContaining({
        timeout: 8000,
      }),
    );
    expect(httpService.get).toHaveBeenCalledWith(
      'http://127.0.0.1:3322/health',
      expect.objectContaining({
        timeout: 8000,
      }),
    );
    expect(result.probe?.status).toBe('healthy');
    expect(result.profile.lifecycleStatus).toBe('verified');
  });

  it('keeps GET 404 probes unhealthy', async () => {
    serverRepository.findOne.mockResolvedValue({
      id: 'probe-4',
      name: 'missing-endpoint',
      openApiData: { openapi: '3.0.0' },
      config: {
        management: {
          probeUrl: 'http://localhost:3001/not-found',
          lifecycleStatus: 'draft',
          publishEnabled: false,
        },
      },
    });
    serverRepository.save.mockImplementation(async (value) => value);
    httpService.head.mockReturnValue(of({ status: 404 }));
    httpService.get.mockReturnValue(of({ status: 404 }));

    const result = await service.probeEndpoint('probe-4');

    expect(result.probe?.status).toBe('unhealthy');
    expect(result.probe?.httpStatus).toBe(404);
    expect(result.profile.lifecycleStatus).toBe('draft');
    expect(result.profile.publishEnabled).toBe(false);
  });
});
