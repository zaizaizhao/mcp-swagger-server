import { ParserService } from './parser.service';

describe('ParserService', () => {
  let service: ParserService;

  beforeEach(() => {
    service = new ParserService({} as any);
  });

  it('should normalize swagger 2.0 specs into openapi-compatible structure', async () => {
    const normalized = await service.normalizeSpecification({
      swagger: '2.0',
      host: 'api.example.com',
      basePath: '/v1',
      schemes: ['https'],
      definitions: {
        User: {
          type: 'object',
        },
      },
      paths: {},
    });

    expect(normalized.openapi).toBe('3.0.0');
    expect(normalized.swagger).toBeUndefined();
    expect(normalized.servers).toEqual([{ url: 'https://api.example.com/v1' }]);
    expect(normalized.components.schemas.User).toEqual({ type: 'object' });
    expect(normalized.definitions).toBeUndefined();
  });

  it('should add default info and paths when missing', async () => {
    const normalized = await service.normalizeSpecification({});

    expect(normalized.info).toEqual({
      title: 'Untitled API',
      version: '1.0.0',
    });
    expect(normalized.paths).toEqual({});
  });
});
