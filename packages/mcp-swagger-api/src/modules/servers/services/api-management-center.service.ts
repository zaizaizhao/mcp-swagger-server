import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { MCPServerEntity } from '../../../database/entities/mcp-server.entity';
import {
  ApiCenterQueryDto,
  ChangeEndpointStateDto,
  EndpointLifecycleStatus,
  EndpointSourceType,
  PublishReadinessDto,
  ProbeEndpointDto,
  RegisterManualEndpointDto,
  UpdateApiManagementProfileDto,
} from '../dto/api-management.dto';
import {
  EndpointProbeLogEntity,
  EndpointProbeStatus,
} from '../entities/endpoint-probe-log.entity';
import { ServerManagerService } from './server-manager.service';
import { ManagedTransportType } from '../dto/server.dto';
import { DocumentsService } from '../../documents/services/documents.service';

type ApiManagementProfile = {
  sourceType: EndpointSourceType;
  sourceRef?: string;
  businessDomain?: string;
  riskLevel?: string;
  lifecycleStatus: EndpointLifecycleStatus;
  publishEnabled: boolean;
  probeUrl?: string;
  lastProbeStatus?: EndpointProbeStatus;
  lastProbeAt?: string;
  lastProbeError?: string;
  lastProbeHttpStatus?: number;
};

type ProbeResult = {
  status: EndpointProbeStatus;
  httpStatus?: number;
  responseTimeMs: number;
  errorMessage?: string;
  probeUrl: string;
};

type EndpointSummary = {
  method?: string;
  path?: string;
};

type EndpointDescriptor = {
  method: string;
  path: string;
};

@Injectable()
export class ApiManagementCenterService {
  private readonly logger = new Logger(ApiManagementCenterService.name);

  constructor(
    @InjectRepository(MCPServerEntity)
    private readonly serverRepository: Repository<MCPServerEntity>,
    @InjectRepository(EndpointProbeLogEntity)
    private readonly probeLogRepository: Repository<EndpointProbeLogEntity>,
    private readonly httpService: HttpService,
    private readonly serverManager: ServerManagerService,
    private readonly documentsService: DocumentsService,
  ) {}

  async getOverview(query: ApiCenterQueryDto) {
    const servers = await this.serverRepository.find();
    const filtered = servers.filter((server) => {
      const profile = this.getProfile(server);
      if (query.lifecycleStatus && profile.lifecycleStatus !== query.lifecycleStatus) {
        return false;
      }
      if (query.sourceType && profile.sourceType !== query.sourceType) {
        return false;
      }
      if (query.businessDomain && profile.businessDomain !== query.businessDomain) {
        return false;
      }
      return true;
    });

    return {
      total: filtered.length,
      data: filtered.map((server) => {
        const profile = this.getProfile(server);
        const endpoint = this.extractPrimaryEndpoint(server.openApiData);
        const endpoints = this.extractEndpoints(server.openApiData);
        return {
          id: server.id,
          name: server.name,
          version: server.version,
          profile,
          endpoint,
          endpoints,
          toolsCount: server.toolsCount || 0,
          healthy: server.healthy,
          updatedAt: server.updatedAt,
        };
      }),
    };
  }

  async updateProfile(serverId: string, dto: UpdateApiManagementProfileDto) {
    const server = await this.requireServer(serverId);
    const current = this.getProfile(server);
    const merged: ApiManagementProfile = {
      ...current,
      ...dto,
    };
    this.saveProfile(server, merged);
    await this.serverRepository.save(server);

    return {
      id: server.id,
      name: server.name,
      profile: merged,
    };
  }

  async probeEndpoint(serverId: string, dto: ProbeEndpointDto = {}) {
    const server = await this.requireServer(serverId);
    const profile = this.getProfile(server);
    const probeUrl = await this.resolveProbeUrl(server, profile, dto.path);

    let result: ProbeResult;
    if (!probeUrl) {
      result = {
        status: EndpointProbeStatus.UNKNOWN,
        responseTimeMs: 0,
        errorMessage: 'No probe URL can be resolved from profile or OpenAPI servers[0].url',
        probeUrl: '',
      };
    } else {
      result = await this.runProbe(probeUrl);
    }

    const nextProfile: ApiManagementProfile = {
      ...profile,
      lastProbeStatus: result.status,
      lastProbeAt: new Date().toISOString(),
      lastProbeError: result.errorMessage,
      lastProbeHttpStatus: result.httpStatus,
    };

    if (result.status === EndpointProbeStatus.HEALTHY) {
      switch (nextProfile.lifecycleStatus) {
        case EndpointLifecycleStatus.DRAFT:
        case EndpointLifecycleStatus.VERIFIED:
        case EndpointLifecycleStatus.DEGRADED:
          nextProfile.lifecycleStatus = EndpointLifecycleStatus.VERIFIED;
          nextProfile.publishEnabled = true;
          break;
        case EndpointLifecycleStatus.PUBLISHED:
          nextProfile.publishEnabled = true;
          break;
        case EndpointLifecycleStatus.OFFLINE:
        case EndpointLifecycleStatus.RETIRED:
        default:
          break;
      }
    }

    this.saveProfile(server, nextProfile);

    if (
      nextProfile.lifecycleStatus === EndpointLifecycleStatus.PUBLISHED &&
      result.status === EndpointProbeStatus.UNHEALTHY
    ) {
      nextProfile.lifecycleStatus = EndpointLifecycleStatus.DEGRADED;
      this.saveProfile(server, nextProfile);
    }

    await this.serverRepository.save(server);
    await this.probeLogRepository.save(
      this.probeLogRepository.create({
        serverId: server.id,
        probeUrl: result.probeUrl,
        status: result.status,
        httpStatus: result.httpStatus,
        responseTimeMs: result.responseTimeMs,
        errorMessage: result.errorMessage,
      }),
    );

    return {
      serverId: server.id,
      name: server.name,
      profile: nextProfile,
      probe: result,
    };
  }

  async getPublishReadiness(serverId: string): Promise<PublishReadinessDto> {
    const server = await this.requireServer(serverId);
    const profile = this.getProfile(server);
    const reasons: string[] = [];

    if (
      profile.lifecycleStatus !== EndpointLifecycleStatus.VERIFIED &&
      profile.lifecycleStatus !== EndpointLifecycleStatus.PUBLISHED &&
      profile.lifecycleStatus !== EndpointLifecycleStatus.OFFLINE
    ) {
      reasons.push(
        `lifecycleStatus is ${profile.lifecycleStatus}, expected verified, published, or offline`,
      );
    }
    if (
      !profile.publishEnabled &&
      profile.lifecycleStatus !== EndpointLifecycleStatus.OFFLINE
    ) {
      reasons.push('publishEnabled=false');
    }
    if (profile.lastProbeStatus !== EndpointProbeStatus.HEALTHY) {
      reasons.push(`lastProbeStatus is ${profile.lastProbeStatus || 'unknown'}, expected healthy`);
    }
    if (!server.openApiData) {
      reasons.push('OpenAPI data is missing');
    }

    return {
      serverId,
      ready: reasons.length === 0,
      reasons,
    };
  }

  async changeEndpointState(serverId: string, dto: ChangeEndpointStateDto) {
    const server = await this.requireServer(serverId);
    const profile = this.getProfile(server);

    if (dto.action === 'publish') {
      const readiness = await this.getPublishReadiness(serverId);
      if (!readiness.ready) {
        throw new BadRequestException(
          `Publish blocked: ${readiness.reasons.join('; ')}`,
        );
      }
      profile.lifecycleStatus = EndpointLifecycleStatus.PUBLISHED;
      profile.publishEnabled = true;
      profile.lastProbeError = undefined;
      this.saveProfile(server, profile);
      await this.serverRepository.save(server);
      return {
        serverId,
        action: dto.action,
        profile,
      };
    }

    profile.lifecycleStatus = EndpointLifecycleStatus.OFFLINE;
    profile.publishEnabled = false;
    if (dto.reason) {
      profile.lastProbeError = dto.reason;
    }
    this.saveProfile(server, profile);
    await this.serverRepository.save(server);
    return {
      serverId,
      action: dto.action,
      profile,
    };
  }

  async registerManualEndpoint(dto: RegisterManualEndpointDto) {
    const method = dto.method.toLowerCase();
    const summary = dto.description || `${dto.method.toUpperCase()} ${dto.path}`;
    const openApiData = {
      openapi: '3.0.3',
      info: {
        title: dto.name,
        version: '1.0.0',
        description: dto.description || 'Manual endpoint registration',
      },
      servers: [{ url: dto.baseUrl }],
      paths: {
        [dto.path]: {
          [method]: {
            summary,
            responses: {
              '200': {
                description: 'OK',
              },
            },
          },
        },
      },
    };

    const created = await this.serverManager.createServer({
      name: dto.name,
      description: dto.description || 'Manual endpoint registration',
      transport: ManagedTransportType.STREAMABLE,
      openApiData,
    });

    const server = await this.requireServer(created.id);
    const profile = this.getProfile(server);
    profile.sourceType = EndpointSourceType.MANUAL;
    profile.sourceRef = dto.baseUrl;
    profile.businessDomain = dto.businessDomain;
    profile.riskLevel = dto.riskLevel;
    profile.lifecycleStatus = EndpointLifecycleStatus.DRAFT;
    profile.publishEnabled = false;
    profile.probeUrl = this.buildProbeUrl(dto.baseUrl, dto.path);
    this.saveProfile(server, profile);
    await this.serverRepository.save(server);

    return {
      serverId: server.id,
      name: server.name,
      profile,
    };
  }

  async getProbeHistory(serverId: string, limit = 20) {
    await this.requireServer(serverId);
    return this.probeLogRepository.find({
      where: { serverId },
      order: { checkedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async probePublishedEndpoints() {
    const servers = await this.serverRepository.find();
    const candidates = servers.filter((server) => {
      const profile = this.getProfile(server);
      return (
        profile.publishEnabled &&
        (profile.lifecycleStatus === EndpointLifecycleStatus.PUBLISHED ||
          profile.lifecycleStatus === EndpointLifecycleStatus.DEGRADED)
      );
    });

    for (const server of candidates) {
      try {
        await this.probeEndpoint(server.id);
      } catch (error) {
        this.logger.warn(`Probe task failed for ${server.name}: ${(error as Error).message}`);
      }
    }
  }

  private async runProbe(probeUrl: string): Promise<ProbeResult> {
    const startedAt = Date.now();
    try {
      const head = await firstValueFrom(
        this.httpService.head(probeUrl, {
          timeout: 8000,
          validateStatus: () => true,
        }),
      );
      const responseTimeMs = Date.now() - startedAt;
      const healthy = this.isReachableProbeStatus(head.status);
      if (!healthy && this.shouldFallbackToGet(head.status)) {
        return this.runGetProbe(probeUrl, startedAt);
      }
      return {
        status: healthy ? EndpointProbeStatus.HEALTHY : EndpointProbeStatus.UNHEALTHY,
        httpStatus: head.status,
        responseTimeMs,
        errorMessage: healthy ? undefined : `HTTP ${head.status}`,
        probeUrl,
      };
    } catch (headError) {
      return this.runGetProbe(probeUrl, startedAt, headError);
    }
  }

  private async runGetProbe(
    probeUrl: string,
    startedAt: number,
    headError?: unknown,
  ): Promise<ProbeResult> {
    try {
      const getResp = await firstValueFrom(
        this.httpService.get(probeUrl, {
          timeout: 8000,
          validateStatus: () => true,
        }),
      );
      const responseTimeMs = Date.now() - startedAt;
      const healthy = this.isReachableProbeStatus(getResp.status);
      return {
        status: healthy ? EndpointProbeStatus.HEALTHY : EndpointProbeStatus.UNHEALTHY,
        httpStatus: getResp.status,
        responseTimeMs,
        errorMessage: healthy ? undefined : `HTTP ${getResp.status}`,
        probeUrl,
      };
    } catch (getError) {
      const axiosErr = getError as AxiosError;
      return {
        status: EndpointProbeStatus.UNHEALTHY,
        responseTimeMs: Date.now() - startedAt,
        probeUrl,
        errorMessage:
          axiosErr.message ||
          (headError as Error).message ||
          'Unknown probe error',
      };
    }
  }

  private shouldFallbackToGet(status?: number): boolean {
    return status === 404 || status === 405 || status === 501;
  }

  private isReachableProbeStatus(status?: number): boolean {
    if (!status) {
      return false;
    }

    if (status >= 200 && status < 400) {
      return true;
    }

    // For lightweight probing, some 4xx responses still prove the route exists and the
    // upstream service is online; they usually indicate missing auth or required inputs.
    return [400, 401, 403, 405, 409, 415, 422, 429].includes(status);
  }

  private async resolveProbeUrl(
    server: MCPServerEntity,
    profile: ApiManagementProfile,
    endpointPath?: string,
  ): Promise<string | undefined> {
    if (profile.probeUrl) {
      return endpointPath ? this.joinUrl(profile.probeUrl, endpointPath) : profile.probeUrl;
    }

    const servers = server.openApiData?.servers;
    const firstServerUrl = Array.isArray(servers) && servers[0]?.url
      ? String(servers[0].url)
      : undefined;
    if (!firstServerUrl) {
      return undefined;
    }

    if (this.isAbsoluteHttpUrl(firstServerUrl)) {
      return endpointPath ? this.joinUrl(firstServerUrl, endpointPath) : firstServerUrl;
    }

    const sourceRef = await this.resolveImportedSourceRef(server, profile);
    if (sourceRef && this.isAbsoluteHttpUrl(sourceRef)) {
      try {
        const resolvedBaseUrl = new URL(firstServerUrl, sourceRef).toString();
        return endpointPath ? this.joinUrl(resolvedBaseUrl, endpointPath) : resolvedBaseUrl;
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  private async resolveImportedSourceRef(
    server: MCPServerEntity,
    profile: ApiManagementProfile,
  ): Promise<string | undefined> {
    if (profile.sourceRef && this.isAbsoluteHttpUrl(profile.sourceRef)) {
      return profile.sourceRef;
    }

    const raw = (server.config || {}) as Record<string, any>;
    const openApiDocumentId = raw.openApiDocumentId;
    if (!openApiDocumentId) {
      return profile.sourceRef;
    }

    try {
      const document = await this.documentsService.findOne(null, openApiDocumentId);
      const metadata = (document?.metadata || {}) as Record<string, any>;
      const originalUrl = metadata.originalUrl;
      if (this.isAbsoluteHttpUrl(originalUrl)) {
        return String(originalUrl);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to resolve original document URL for imported endpoint ${server.id}: ${(error as Error).message}`,
      );
    }

    return profile.sourceRef;
  }

  private isAbsoluteHttpUrl(value?: string): boolean {
    if (!value) {
      return false;
    }
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private joinUrl(baseUrl: string, endpointPath: string): string {
    const normalizedBaseUrl = String(baseUrl || '').replace(/\/+$/, '');
    const normalizedPath = String(endpointPath || '').startsWith('/')
      ? String(endpointPath || '')
      : `/${String(endpointPath || '')}`;
    return `${normalizedBaseUrl}${normalizedPath}`;
  }

  private extractPrimaryEndpoint(openApiData: any): EndpointSummary {
    const paths = openApiData?.paths;
    if (!paths || typeof paths !== 'object') {
      return {};
    }

    const firstPath = Object.keys(paths)[0];
    if (!firstPath) {
      return {};
    }

    const operations = paths[firstPath];
    if (!operations || typeof operations !== 'object') {
      return { path: firstPath };
    }

    const firstMethod = Object.keys(operations)[0];
    return {
      method: firstMethod ? firstMethod.toUpperCase() : undefined,
      path: firstPath,
    };
  }

  private extractEndpoints(openApiData: any): EndpointDescriptor[] {
    const paths = openApiData?.paths;
    if (!paths || typeof paths !== 'object') {
      return [];
    }

    const endpoints: EndpointDescriptor[] = [];
    for (const [path, operations] of Object.entries(paths)) {
      if (!operations || typeof operations !== 'object') {
        continue;
      }
      for (const method of Object.keys(operations)) {
        endpoints.push({
          method: method.toUpperCase(),
          path,
        });
      }
    }

    return endpoints;
  }

  private buildProbeUrl(baseUrl: string, path: string): string {
    const normalizedBaseUrl = String(baseUrl || '').replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBaseUrl}${normalizedPath}`;
  }

  private getProfile(server: MCPServerEntity): ApiManagementProfile {
    const raw = (server.config || {}) as Record<string, any>;
    const profileRaw = (raw.management || {}) as Partial<ApiManagementProfile>;
    return {
      sourceType: profileRaw.sourceType || EndpointSourceType.IMPORTED,
      sourceRef: profileRaw.sourceRef,
      businessDomain: profileRaw.businessDomain,
      riskLevel: profileRaw.riskLevel,
      lifecycleStatus: profileRaw.lifecycleStatus || EndpointLifecycleStatus.DRAFT,
      publishEnabled: profileRaw.publishEnabled ?? false,
      probeUrl: profileRaw.probeUrl,
      lastProbeStatus: profileRaw.lastProbeStatus,
      lastProbeAt: profileRaw.lastProbeAt,
      lastProbeError: profileRaw.lastProbeError,
      lastProbeHttpStatus: profileRaw.lastProbeHttpStatus,
    };
  }

  private saveProfile(server: MCPServerEntity, profile: ApiManagementProfile) {
    const raw = (server.config || {}) as Record<string, any>;
    server.config = {
      ...raw,
      management: profile,
    };
  }

  private async requireServer(serverId: string): Promise<MCPServerEntity> {
    const server = await this.serverRepository.findOne({ where: { id: serverId } });
    if (!server) {
      throw new NotFoundException(`Server with ID '${serverId}' not found`);
    }
    return server;
  }
}
