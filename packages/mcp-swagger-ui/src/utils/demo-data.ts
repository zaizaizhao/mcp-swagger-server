// 演示数据，用于开发和测试
import type { OpenApiInfo, ApiEndpoint, ConvertResult } from '../types'

// 演示用 API 信息
export const demoApiInfo: OpenApiInfo = {
  title: 'Swagger Petstore',
  version: '1.0.6',
  description: 'This is a sample server Petstore server.',
  serverUrl: 'https://petstore.swagger.io/v2',
  totalEndpoints: 20
}

// 演示用端点列表
export const demoEndpoints: ApiEndpoint[] = [
  {
    method: 'GET',
    path: '/pet/findByStatus',
    summary: '根据状态查找宠物',
    description: '多个状态值可以用逗号分隔',
    tags: ['pet'],
    operationId: 'findPetsByStatus',
    deprecated: false
  },
  {
    method: 'POST',
    path: '/pet',
    summary: '添加新宠物到商店',
    description: '添加一个新的宠物到商店',
    tags: ['pet'],
    operationId: 'addPet',
    deprecated: false
  },
  {
    method: 'PUT',
    path: '/pet',
    summary: '更新现有宠物',
    description: '通过完整的宠物数据更新现有宠物',
    tags: ['pet'],
    operationId: 'updatePet',
    deprecated: false
  },
  {
    method: 'DELETE',
    path: '/pet/{petId}',
    summary: '删除宠物',
    description: '删除指定ID的宠物',
    tags: ['pet'],
    operationId: 'deletePet',
    deprecated: false
  },
  {
    method: 'GET',
    path: '/store/inventory',
    summary: '返回宠物库存',
    description: '通过状态返回宠物库存的映射',
    tags: ['store'],
    operationId: 'getInventory',
    deprecated: false
  },
  {
    method: 'POST',
    path: '/store/order',
    summary: '下单购买宠物',
    description: '在宠物商店下单',
    tags: ['store'],
    operationId: 'placeOrder',
    deprecated: false
  },
  {
    method: 'GET',
    path: '/user/{username}',
    summary: '根据用户名获取用户',
    description: '根据用户名获取用户信息',
    tags: ['user'],
    operationId: 'getUserByName',
    deprecated: true
  }
]

// 演示用转换结果
export const demoConvertResult: ConvertResult = {
  mcpConfig: {
    mcpServers: {
      "swagger-petstore": {
        command: "node",
        args: ["dist/index.js", "--transport", "stdio"],
        env: {
          SWAGGER_URL: "https://petstore.swagger.io/v2/swagger.json"
        }
      }
    },
    tools: [
      {
        name: "get_pet_findByStatus",
        description: "根据状态查找宠物",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "array",
              items: {
                type: "string",
                enum: ["available", "pending", "sold"]
              },
              description: "需要过滤的状态值"
            }
          },
          required: ["status"]
        }
      },
      {
        name: "post_pet",
        description: "添加新宠物到商店",
        inputSchema: {
          type: "object",
          properties: {
            body: {
              type: "object",
              properties: {
                id: { type: "integer" },
                category: { type: "object" },
                name: { type: "string" },
                photoUrls: { type: "array" },
                tags: { type: "array" },
                status: { type: "string" }
              },
              required: ["name", "photoUrls"]
            }
          },
          required: ["body"]
        }
      },
      {
        name: "put_pet",
        description: "更新现有宠物",
        inputSchema: {
          type: "object",
          properties: {
            body: {
              type: "object",
              properties: {
                id: { type: "integer" },
                category: { type: "object" },
                name: { type: "string" },
                photoUrls: { type: "array" },
                tags: { type: "array" },
                status: { type: "string" }
              },
              required: ["name", "photoUrls"]
            }
          },
          required: ["body"]
        }
      },
      {
        name: "delete_pet_petId",
        description: "删除宠物",
        inputSchema: {
          type: "object",
          properties: {
            petId: {
              type: "integer",
              description: "要删除的宠物ID"
            }
          },
          required: ["petId"]
        }
      },
      {
        name: "get_store_inventory",
        description: "返回宠物库存",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
  },
  metadata: {
    apiInfo: demoApiInfo,
    stats: {
      totalEndpoints: 20,
      convertedTools: 5,
      skippedEndpoints: 15
    }
  },
  processingTime: 1250
}

// 默认配置
export const defaultConfig = {
  filters: {
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    tags: [],
    includeDeprecated: false
  },
  transport: 'stdio' as const,
  optimization: {
    generateValidation: true,
    includeExamples: false,
    optimizeNames: true
  }
}
