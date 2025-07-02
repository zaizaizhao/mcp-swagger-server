/**
 * Schema 注释提取器 - 从 OpenAPI 规范中提取字段注释信息
 */

import type { OpenAPISpec, SchemaObject, ReferenceObject, ResponseObject, MediaTypeObject } from '../types/openapi';
import type { FieldAnnotation, ResponseSchemaAnnotation } from '../transformer/types';

export class SchemaAnnotationExtractor {
  private spec: OpenAPISpec;

  constructor(spec: OpenAPISpec) {
    this.spec = spec;
  }

  /**
   * 从操作的响应中提取注释信息
   */
  extractResponseAnnotations(
    operationId: string,
    method: string,
    path: string,
    responses: Record<string, ResponseObject | ReferenceObject>
  ): ResponseSchemaAnnotation | undefined {
    // 优先处理成功响应 (200, 201 等)
    const successResponse = this.findSuccessResponse(responses);
    if (!successResponse) {
      return undefined;
    }

    // 获取响应的 JSON Schema
    const jsonContent = this.extractJsonContent(successResponse);
    if (!jsonContent?.schema) {
      return undefined;
    }

    // 提取字段注释
    const fieldAnnotations = this.extractFieldAnnotations(jsonContent.schema);
    
    if (Object.keys(fieldAnnotations).length === 0) {
      return undefined;
    }

    return {
      fieldAnnotations,
      modelName: this.getSchemaModelName(jsonContent.schema),
      description: this.isReferenceObject(successResponse) ? undefined : successResponse.description,
      originalSchema: jsonContent.schema
    };
  }

  /**
   * 查找成功响应
   */
  private findSuccessResponse(responses: Record<string, ResponseObject | ReferenceObject>): ResponseObject | undefined {
    // 按优先级查找成功响应
    const successCodes = ['200', '201', '202', '2XX', 'default'];
    
    for (const code of successCodes) {
      const response = responses[code];
      if (response) {
        return this.isReferenceObject(response) 
          ? this.resolveResponseReference(response) 
          : response;
      }
    }
    
    return undefined;
  }

  /**
   * 提取 JSON 内容
   */
  private extractJsonContent(response: ResponseObject): MediaTypeObject | undefined {
    if (!response.content) {
      return undefined;
    }

    // 优先查找 application/json
    const jsonTypes = [
      'application/json',
      'application/json; charset=utf-8',
      'text/json',
      '*/*'
    ];

    for (const contentType of jsonTypes) {
      if (response.content[contentType]) {
        return response.content[contentType];
      }
    }

    return undefined;
  }

  /**
   * 递归提取字段注释
   */
  private extractFieldAnnotations(
    schema: SchemaObject | ReferenceObject,
    prefix: string = ''
  ): Record<string, FieldAnnotation> {
    const annotations: Record<string, FieldAnnotation> = {};

    if (this.isReferenceObject(schema)) {
      // 解析引用
      const resolvedSchema = this.resolveSchemaReference(schema);
      if (resolvedSchema) {
        return this.extractFieldAnnotations(resolvedSchema, prefix);
      }
      return annotations;
    }

    // 处理对象类型
    if (schema.type === 'object' && schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const fieldPath = prefix ? `${prefix}.${propName}` : propName;
        
        if (this.isReferenceObject(propSchema)) {
          const resolvedProp = this.resolveSchemaReference(propSchema);
          if (resolvedProp) {
            // 为引用类型创建注释
            annotations[fieldPath] = this.createFieldAnnotation(propName, resolvedProp, schema.required?.includes(propName));
            
            // 递归处理引用的属性
            Object.assign(annotations, this.extractFieldAnnotations(resolvedProp, fieldPath));
          }
        } else {
          // 创建字段注释
          annotations[fieldPath] = this.createFieldAnnotation(propName, propSchema, schema.required?.includes(propName));
          
          // 递归处理嵌套对象
          if (propSchema.type === 'object' || propSchema.properties) {
            Object.assign(annotations, this.extractFieldAnnotations(propSchema, fieldPath));
          }
          
          // 处理数组类型
          if (propSchema.type === 'array' && propSchema.items) {
            Object.assign(annotations, this.extractFieldAnnotations(propSchema.items, `${fieldPath}[]`));
          }
        }
      }
    }

    // 处理数组类型
    if (schema.type === 'array' && schema.items) {
      Object.assign(annotations, this.extractFieldAnnotations(schema.items, `${prefix}[]`));
    }

    // 处理 allOf, oneOf, anyOf
    if (schema.allOf) {
      for (const subSchema of schema.allOf) {
        Object.assign(annotations, this.extractFieldAnnotations(subSchema, prefix));
      }
    }

    if (schema.oneOf) {
      for (const subSchema of schema.oneOf) {
        Object.assign(annotations, this.extractFieldAnnotations(subSchema, prefix));
      }
    }

    if (schema.anyOf) {
      for (const subSchema of schema.anyOf) {
        Object.assign(annotations, this.extractFieldAnnotations(subSchema, prefix));
      }
    }

    return annotations;
  }

  /**
   * 创建字段注释
   */
  private createFieldAnnotation(
    fieldName: string, 
    schema: SchemaObject, 
    required: boolean = false
  ): FieldAnnotation {
    const annotation: FieldAnnotation = {
      fieldName,
      type: schema.type || 'unknown',
      required,
    };

    // 添加描述（支持中文注释）
    if (schema.description) {
      annotation.description = schema.description;
    }

    // 添加示例值
    if (schema.example !== undefined) {
      annotation.example = schema.example;
    }

    // 处理枚举值
    if (schema.enum && Array.isArray(schema.enum)) {
      annotation.enum = schema.enum.map(value => ({
        value,
        description: this.getEnumDescription(fieldName, value, schema)
      }));
    }

    return annotation;
  }

  /**
   * 获取枚举值描述
   */
  private getEnumDescription(fieldName: string, value: any, schema: SchemaObject): string | undefined {
    const schemaAny = schema as any;
    
    // 尝试从 x-enum-descriptions 扩展中获取描述
    if (schemaAny['x-enum-descriptions'] && Array.isArray(schemaAny['x-enum-descriptions'])) {
      const index = schema.enum?.indexOf(value);
      if (index !== undefined && index >= 0 && index < schemaAny['x-enum-descriptions'].length) {
        return schemaAny['x-enum-descriptions'][index];
      }
    }

    // 尝试从 x-enumNames 扩展中获取描述
    if (schemaAny['x-enumNames'] && Array.isArray(schemaAny['x-enumNames'])) {
      const index = schema.enum?.indexOf(value);
      if (index !== undefined && index >= 0 && index < schemaAny['x-enumNames'].length) {
        return schemaAny['x-enumNames'][index];
      }
    }

    return undefined;
  }

  /**
   * 获取 Schema 模型名称
   */
  private getSchemaModelName(schema: SchemaObject | ReferenceObject): string | undefined {
    if (this.isReferenceObject(schema)) {
      // 从引用路径中提取模型名称
      const refParts = schema.$ref.split('/');
      return refParts[refParts.length - 1];
    }

    // 尝试从 title 或 x-model-name 中获取
    if (!this.isReferenceObject(schema)) {
      const schemaAny = schema as any;
      return schema.title || schemaAny['x-model-name'];
    }

    return undefined;
  }

  /**
   * 解析 Schema 引用
   */
  private resolveSchemaReference(ref: ReferenceObject): SchemaObject | undefined {
    if (!ref.$ref.startsWith('#/components/schemas/')) {
      return undefined;
    }

    const schemaName = ref.$ref.replace('#/components/schemas/', '');
    const schema = this.spec.components?.schemas?.[schemaName];
    
    return schema && !this.isReferenceObject(schema) ? schema : undefined;
  }

  /**
   * 解析 Response 引用
   */
  private resolveResponseReference(ref: ReferenceObject): ResponseObject | undefined {
    if (!ref.$ref.startsWith('#/components/responses/')) {
      return undefined;
    }

    const responseName = ref.$ref.replace('#/components/responses/', '');
    const response = this.spec.components?.responses?.[responseName];
    
    return response && !this.isReferenceObject(response) ? response : undefined;
  }

  /**
   * 检查是否为引用对象
   */
  private isReferenceObject(obj: any): obj is ReferenceObject {
    return obj && typeof obj === 'object' && '$ref' in obj;
  }
}
