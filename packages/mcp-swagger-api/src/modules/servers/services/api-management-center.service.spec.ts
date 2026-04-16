import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { ApiManagementCenterService } from './api-management-center.service';
import { MCPServerEntity } from '../../../database/entities/mcp-server.entity';
import { EndpointProbeLogEntity } from '../entities/endpoint-probe-log.entity';
import { EndpointSourceType } from '../dto/api-management.dto';
import { ServerManagerService } from './server-manager.service';
import { DocumentsService } from '../../documents/services/documents.service';

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

  const documentsService = {
    findOne: jest.fn(),
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
        {
          provide: DocumentsService,
          useValue: documentsService,
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

  it('filters overview results by source type for lightweight governance views', async () => {
    serverRepository.find.mockResolvedValue([
      {
        id: 'manual-1',
        name: 'manual-health',
        openApiData: { paths: { '/health': { get: {} } } },
        config: {
          management: {
            sourceType: 'manual',
            sourceRef: 'http://localhost:3001',
          },
        },
      },
      {
        id: 'imported-1',
        name: 'petstore-imported',
        openApiData: {
          paths: { '/pets': { get: {} } },
        },
        config: {
          management: {
            sourceType: 'imported',
            sourceRef: 'petstore.json',
          },
        },
      },
    ]);

    const manualResult = await service.getOverview({ sourceType: EndpointSourceType.MANUAL });
    const importedResult = await service.getOverview({ sourceType: EndpointSourceType.IMPORTED });

    expect(manualResult.total).toBe(1);
    expect(manualResult.data[0].id).toBe('manual-1');
    expect(manualResult.data[0].endpoints).toEqual([{ method: 'GET', path: '/health' }]);
    expect(importedResult.total).toBe(1);
    expect(importedResult.data[0].id).toBe('imported-1');
    expect(importedResult.data[0].endpoints).toEqual([{ method: 'GET', path: '/pets' }]);
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

  it('resolves imported relative server urls against the original document url and endpoint path', async () => {
    serverRepository.findOne.mockResolvedValue({
      id: 'probe-imported-1',
      name: 'petstore-imported',
      openApiData: {
        openapi: '3.0.4',
        servers: [{ url: '/api/v3' }],
        paths: {
          '/pet': {
            get: {},
          },
        },
      },
      config: {
        openApiDocumentId: 'doc-1',
        management: {
          sourceType: 'imported',
          lifecycleStatus: 'draft',
          publishEnabled: false,
        },
      },
    });
    documentsService.findOne.mockResolvedValue({
      id: 'doc-1',
      metadata: {
        originalUrl: 'https://petstore3.swagger.io/api/v3/openapi.json',
      },
    });
    serverRepository.save.mockImplementation(async (value) => value);
    httpService.head.mockReturnValue(of({ status: 405 }));

    const result = await service.probeEndpoint('probe-imported-1', { path: '/pet' });

    expect(documentsService.findOne).toHaveBeenCalledWith(null, 'doc-1');
    expect(httpService.head).toHaveBeenCalledWith(
      'https://petstore3.swagger.io/api/v3/pet',
      expect.objectContaining({
        timeout: 8000,
      }),
    );
    expect(httpService.get).not.toHaveBeenCalled();
    expect(result.probe?.status).toBe('healthy');
    expect(result.probe?.httpStatus).toBe(405);
  });

  it('treats imported endpoint validation errors as reachable when the route exists', async () => {
    serverRepository.findOne.mockResolvedValue({
      id: 'probe-imported-2',
      name: 'petstore-find-by-status',
      openApiData: {
        openapi: '3.0.4',
        servers: [{ url: '/api/v3' }],
        paths: {
          '/pet/findByStatus': {
            get: {},
          },
        },
      },
      config: {
        openApiDocumentId: 'doc-2',
        management: {
          sourceType: 'imported',
          lifecycleStatus: 'draft',
          publishEnabled: false,
        },
      },
    });
    documentsService.findOne.mockResolvedValue({
      id: 'doc-2',
      metadata: {
        originalUrl: 'https://petstore3.swagger.io/api/v3/openapi.json',
      },
    });
    serverRepository.save.mockImplementation(async (value) => value);
    httpService.head.mockReturnValue(of({ status: 400 }));

    const result = await service.probeEndpoint('probe-imported-2', {
      path: '/pet/findByStatus',
    });

    expect(httpService.head).toHaveBeenCalledWith(
      'https://petstore3.swagger.io/api/v3/pet/findByStatus',
      expect.objectContaining({
        timeout: 8000,
      }),
    );
    expect(httpService.get).not.toHaveBeenCalled();
    expect(result.probe?.status).toBe('healthy');
    expect(result.probe?.httpStatus).toBe(400);
    expect(result.profile.lifecycleStatus).toBe('verified');
    expect(result.profile.publishEnabled).toBe(true);
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

  it('does not auto-reactivate an offline endpoint after a healthy probe', async () => {
    serverRepository.findOne.mockResolvedValue({
      id: 'probe-5',
      name: 'offline-endpoint',
      openApiData: { openapi: '3.0.0' },
      config: {
        management: {
          probeUrl: 'http://localhost:3001/health',
          lifecycleStatus: 'offline',
          publishEnabled: false,
        },
      },
    });
    serverRepository.save.mockImplementation(async (value) => value);
    httpService.head.mockReturnValue(of({ status: 200 }));

    const result = await service.probeEndpoint('probe-5');

    expect(result.probe?.status).toBe('healthy');
    expect(result.profile.lifecycleStatus).toBe('offline');
    expect(result.profile.publishEnabled).toBe(false);
  });

  it('supports the manual endpoint lifecycle workflow through readiness and state transitions', async () => {
    const server = {
      id: 'manual-flow-1',
      name: 'health-endpoint',
      openApiData: {
        openapi: '3.0.3',
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
          sourceRef: 'http://localhost:3001',
          probeUrl: 'http://localhost:3001/health',
          lifecycleStatus: 'draft',
          publishEnabled: false,
        },
      },
    };
    serverRepository.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === server.id) {
        return server;
      }
      return null;
    });
    serverRepository.save.mockImplementation(async (value) => {
      Object.assign(server, value);
      return value;
    });
    httpService.head.mockReturnValue(of({ status: 200 }));

    const probeResult = await service.probeEndpoint(server.id);
    const readiness = await service.getPublishReadiness(server.id);
    const publishResult = await service.changeEndpointState(server.id, { action: 'publish' });
    const offlineResult = await service.changeEndpointState(server.id, {
      action: 'offline',
      reason: 'maintenance',
    });

    expect(probeResult.profile.lifecycleStatus).toBe('verified');
    expect(probeResult.profile.publishEnabled).toBe(true);
    expect(readiness.ready).toBe(true);
    expect(publishResult.profile.lifecycleStatus).toBe('published');
    expect(offlineResult.profile.lifecycleStatus).toBe('offline');
    expect(offlineResult.profile.publishEnabled).toBe(false);
    expect(offlineResult.profile.lastProbeError).toBe('maintenance');
  });

  it('allows a healthy offline endpoint to be published again without rebuilding the server', async () => {
    serverRepository.findOne.mockResolvedValue({
      id: 'offline-republish-1',
      name: 'imported-petstore',
      openApiData: {
        openapi: '3.0.4',
        servers: [{ url: '/api/v3' }],
        paths: {
          '/pet': {
            get: {},
          },
        },
      },
      config: {
        management: {
          sourceType: 'imported',
          lifecycleStatus: 'offline',
          publishEnabled: false,
          lastProbeStatus: 'healthy',
          lastProbeHttpStatus: 200,
          lastProbeError: 'maintenance',
        },
      },
    });
    serverRepository.save.mockImplementation(async (value) => value);

    const readiness = await service.getPublishReadiness('offline-republish-1');
    const result = await service.changeEndpointState('offline-republish-1', { action: 'publish' });

    expect(readiness.ready).toBe(true);
    expect(readiness.reasons).toEqual([]);
    expect(result.profile.lifecycleStatus).toBe('published');
    expect(result.profile.publishEnabled).toBe(true);
    expect(result.profile.lastProbeError).toBeUndefined();
  });
});
