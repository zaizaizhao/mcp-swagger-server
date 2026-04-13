import { SecurityExtractor } from '../../src/extractors/security-extractor';

describe('SecurityExtractor', () => {
  it('should extract global and operation-level security usage', () => {
    const spec: any = {
      openapi: '3.0.0',
      security: [{ bearerAuth: [] }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
          apiKeyQuery: { type: 'apiKey', in: 'query', name: 'api_key' },
        },
      },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
          },
          post: {
            operationId: 'createUser',
            security: [],
          },
        },
      },
    };

    const analysis = SecurityExtractor.extractSecurity(spec);
    const stats = SecurityExtractor.getSecurityStats(analysis);
    const validation = SecurityExtractor.validateSecurityConfig(analysis);

    expect(analysis.operationSecurity.getUsers).toEqual([{ bearerAuth: [] }]);
    expect(analysis.unsecuredOperations).toContain('createUser');
    expect(stats.totalSchemes).toBe(2);
    expect(stats.unusedSchemes).toBe(1);
    expect(validation.warnings).toContain('Found 1 unused security scheme(s): apiKeyQuery');
    expect(validation.recommendations).toContain(
      'Avoid using API keys in query parameters; use headers or cookies instead',
    );
  });
});
