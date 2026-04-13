jest.mock('@apidevtools/swagger-parser', () => ({
  __esModule: true,
  default: {
    validate: jest.fn().mockResolvedValue(undefined),
  },
}));

import { validate } from '../../src/core/parser';
import SwaggerParser from '@apidevtools/swagger-parser';

describe('Validator OpenAPI version compatibility', () => {
  it('accepts OpenAPI 3.0.4 via schema compatibility mode', async () => {
    const spec = {
      openapi: '3.0.4',
      info: {
        title: 'Petstore',
        version: '1.0.0',
      },
      paths: {
        '/pets': {
          get: {
            responses: {
              '200': {
                description: 'ok',
              },
            },
          },
        },
      },
    };

    const result = await validate(spec as any, {
      strictMode: false,
      validateSchema: true,
      resolveReferences: false,
      allowEmptyPaths: false,
      customValidators: [],
      autoConvert: true,
      autoFix: true,
      swagger2Options: {
        patch: true,
        warnOnly: false,
        resolveInternal: true,
        targetVersion: '3.0.0',
        preserveRefs: true,
        warnProperty: 'x-s2o-warning',
        debug: false,
      },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    const mockedValidate = (SwaggerParser as any).validate as jest.Mock;
    expect(mockedValidate).toHaveBeenCalledTimes(1);
    expect(mockedValidate.mock.calls[0][0].openapi).toBe('3.0.3');
  });
});
