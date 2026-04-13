const validateMock = jest.fn();

jest.mock('mcp-swagger-parser', () => ({
  validate: (...args: any[]) => validateMock(...args),
}));

import { ValidatorService } from './validator.service';

describe('ValidatorService', () => {
  let service: ValidatorService;

  beforeEach(() => {
    service = new ValidatorService();
    validateMock.mockReset();
  });

  it('should sanitize local metadata fields before calling shared validation', async () => {
    validateMock.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [
        {
          message: 'Schema validation used compatibility mode: 3.0.4 -> 3.0.3',
        },
      ],
    });

    const result = await service.validateSpecification({
      openapi: '3.0.4',
      info: {
        title: 'Swagger Petstore',
        version: '1.0.7',
      },
      paths: {
        '/pets': {
          get: {
            operationId: 'listPets',
            responses: {
              '200': {
                description: 'Successful response',
              },
            },
          },
        },
      },
      metadata: {
        importedFrom: 'ui',
      },
      tools: [],
      endpoints: [],
      parsedAt: '2026-04-14T00:00:00.000Z',
      parseId: 'parse_test',
      _metadata: {
        source: 'test',
      },
    });

    expect(validateMock).toHaveBeenCalledWith(
      {
        openapi: '3.0.4',
        info: {
          title: 'Swagger Petstore',
          version: '1.0.7',
        },
        paths: {
          '/pets': {
            get: {
              operationId: 'listPets',
              responses: {
                '200': {
                  description: 'Successful response',
                },
              },
            },
          },
        },
      },
      {
        strictMode: false,
        resolveReferences: true,
        validateSchema: true,
      },
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      'Schema validation used compatibility mode: 3.0.4 -> 3.0.3',
    ]);
  });

  it('should reject empty OpenAPI content', async () => {
    const result = await service.validateSpecification('   ');

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('OpenAPI content cannot be empty');
    expect(validateMock).not.toHaveBeenCalled();
  });
});
