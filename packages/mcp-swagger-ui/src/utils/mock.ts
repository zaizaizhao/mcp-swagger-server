/**
 * 演示数据和模拟解析器功能
 * 当无法使用实际解析器时的备用方案
 */

import type { OpenApiInfo, ApiEndpoint, ConvertResult } from '@/types'

// 模拟的 API 信息
export const mockApiInfo: OpenApiInfo = {
  title: 'Petstore API',
  version: '1.0.0',
  description: 'A sample API that uses a petstore as an example',
  serverUrl: 'https://petstore.swagger.io/v2',
  totalEndpoints: 8
}

// 模拟的端点数据
export const mockEndpoints: ApiEndpoint[] = [
  {
    method: 'GET',
    path: '/pet/findByStatus',
    summary: 'Finds Pets by status',
    description: 'Multiple status values can be provided with comma separated strings',
    tags: ['pet'],
    operationId: 'findPetsByStatus'
  },
  {
    method: 'GET',
    path: '/pet/{petId}',
    summary: 'Find pet by ID',
    description: 'Returns a single pet',
    tags: ['pet'],
    operationId: 'getPetById'
  },
  {
    method: 'POST',
    path: '/pet',
    summary: 'Add a new pet to the store',
    tags: ['pet'],
    operationId: 'addPet'
  },
  {
    method: 'PUT',
    path: '/pet',
    summary: 'Update an existing pet',
    tags: ['pet'],
    operationId: 'updatePet'
  },
  {
    method: 'DELETE',
    path: '/pet/{petId}',
    summary: 'Deletes a pet',
    tags: ['pet'],
    operationId: 'deletePet'
  },
  {
    method: 'GET',
    path: '/store/inventory',
    summary: 'Returns pet inventories by status',
    tags: ['store'],
    operationId: 'getInventory'
  },
  {
    method: 'POST',
    path: '/store/order',
    summary: 'Place an order for a pet',
    tags: ['store'],
    operationId: 'placeOrder'
  },
  {
    method: 'GET',
    path: '/user/{username}',
    summary: 'Get user by user name',
    tags: ['user'],
    operationId: 'getUserByName'
  }
]

// 模拟的转换结果
export const mockConvertResult: ConvertResult = {
  mcpConfig: {
    mcpServers: {
      'petstore-api': {
        command: 'node',
        args: ['dist/index.js'],
        env: {
          API_BASE_URL: 'https://petstore.swagger.io/v2'
        }
      }
    },
    tools: [
      {
        name: 'get_pet_findByStatus',
        description: 'Finds Pets by status',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'array',
              items: { type: 'string', enum: ['available', 'pending', 'sold'] }
            }
          },
          required: ['status']
        }
      },
      {
        name: 'get_pet_by_id',
        description: 'Find pet by ID',
        inputSchema: {
          type: 'object',
          properties: {
            petId: { type: 'integer', format: 'int64' }
          },
          required: ['petId']
        }
      }
    ]
  },
  metadata: {
    apiInfo: mockApiInfo,
    stats: {
      totalEndpoints: 8,
      convertedTools: 8,
      skippedEndpoints: 0
    }
  },
  processingTime: 1500
}

/**
 * 模拟延迟函数
 */
export const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 检查是否应该使用模拟模式
 * 注意：这个函数主要用于向后兼容，新代码应使用 canUseRealParser()
 */
export function shouldUseMockMode(): boolean {
  // 检查是否强制使用模拟模式
  return import.meta.env.VITE_FORCE_MOCK_MODE === 'true'
}
