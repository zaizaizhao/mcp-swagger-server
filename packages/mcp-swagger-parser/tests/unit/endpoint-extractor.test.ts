import { EndpointExtractor } from '../../src/extractors/endpoint-extractor';
import { OpenAPISpec } from '../../src/types';

describe('EndpointExtractor', () => {
  it('merges path-level parameters into operations', () => {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0'
      },
      paths: {
        '/users/{userId}/posts': {
          parameters: [
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            },
            {
              name: 'locale',
              in: 'query',
              schema: { type: 'string' }
            }
          ],
          get: {
            operationId: 'listUserPosts',
            parameters: [
              {
                name: 'locale',
                in: 'query',
                description: 'Operation-specific locale',
                schema: { type: 'string' }
              },
              {
                name: 'limit',
                in: 'query',
                schema: { type: 'integer' }
              }
            ],
            responses: {
              '200': {
                description: 'OK'
              }
            }
          }
        }
      }
    };

    const endpoints = EndpointExtractor.extractEndpoints(spec);

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]?.parameters).toEqual([
      {
        name: 'userId',
        in: 'path',
        required: true,
        schema: { type: 'string' }
      },
      {
        name: 'locale',
        in: 'query',
        description: 'Operation-specific locale',
        schema: { type: 'string' }
      },
      {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer' }
      }
    ]);
  });
});
