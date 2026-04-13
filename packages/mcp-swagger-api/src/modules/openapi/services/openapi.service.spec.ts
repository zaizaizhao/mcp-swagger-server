import { BadRequestException } from '@nestjs/common';
import { OpenAPIService } from './openapi.service';

describe('OpenAPIService', () => {
  const createService = () => {
    const parserService = {
      parseFromUrl: jest.fn(),
      parseFromFile: jest.fn(),
      parseFromString: jest.fn(),
      parseSpecification: jest.fn(),
      generateMCPTools: jest.fn(),
      normalizeSpecification: jest.fn(),
    };
    const validatorService = {
      validateSpecification: jest.fn(),
    };

    const service = new OpenAPIService(
      {} as any,
      {} as any,
      parserService as any,
      validatorService as any,
      {} as any,
    );

    return { service, parserService, validatorService };
  };

  it('should parse content source through parser service and build response', async () => {
    const { service, parserService } = createService();

    parserService.parseFromString.mockResolvedValue({
      spec: {
        openapi: '3.0.0',
        info: { title: 'Demo API', version: '2.0.0' },
        paths: { '/users': {} },
      },
    });
    parserService.parseSpecification.mockResolvedValue({
      openapi: '3.0.0',
      info: { title: 'Demo API', version: '2.0.0' },
      paths: { '/users': {} },
      endpoints: [{ path: '/users', method: 'get' }],
      servers: [{ url: 'https://api.example.com' }],
      components: {},
    });
    parserService.generateMCPTools.mockResolvedValue([
      { name: 'getUsers', description: 'Get users', inputSchema: {}, metadata: {} },
    ]);

    const result = await service.parseOpenAPI({
      source: {
        type: 'content',
        content: '{"openapi":"3.0.0"}',
      },
      options: {},
    } as any);

    expect(parserService.parseFromString).toHaveBeenCalled();
    expect(parserService.parseSpecification).toHaveBeenCalled();
    expect(parserService.generateMCPTools).toHaveBeenCalled();
    expect(result.info.title).toBe('Demo API');
    expect(result.endpoints).toHaveLength(1);
    expect(result.tools).toHaveLength(1);
    expect(result.parseId).toMatch(/^parse_/);
  });

  it('should validate URL source using parsed spec', async () => {
    const { service, parserService, validatorService } = createService();

    parserService.parseFromUrl.mockResolvedValue({
      spec: { openapi: '3.0.0', info: { title: 'URL API', version: '1.0.0' } },
    });
    validatorService.validateSpecification.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: ['warning'],
    });

    const result = await service.validateOpenAPI({
      source: {
        type: 'url',
        content: 'https://api.example.com/openapi.json',
      },
      options: {},
    } as any);

    expect(parserService.parseFromUrl).toHaveBeenCalledWith(
      'https://api.example.com/openapi.json',
    );
    expect(validatorService.validateSpecification).toHaveBeenCalledWith({
      openapi: '3.0.0',
      info: { title: 'URL API', version: '1.0.0' },
    });
    expect(result.valid).toBe(true);
  });

  it('should validate content source using raw content instead of parsed spec', async () => {
    const { service, parserService, validatorService } = createService();

    validatorService.validateSpecification.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
    });

    const rawContent =
      '{"openapi":"3.0.0","info":{"title":"Petstore","version":"1.0.0"},"paths":{},"metadata":{"x":1}}';

    const result = await service.validateOpenAPI({
      source: {
        type: 'content',
        content: rawContent,
      },
      options: {},
    } as any);

    expect(parserService.parseFromString).not.toHaveBeenCalled();
    expect(validatorService.validateSpecification).toHaveBeenCalledWith(
      rawContent,
    );
    expect(result.valid).toBe(true);
  });

  it('should reject empty content during validation', async () => {
    const { service } = createService();

    await expect(
      service.validateOpenAPI({
        source: {
          type: 'content',
          content: '   ',
        },
        options: {},
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
