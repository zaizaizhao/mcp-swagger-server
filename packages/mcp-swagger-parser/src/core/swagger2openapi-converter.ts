/**
 * Swagger 2.0 to OpenAPI 3.0 converter
 */

import { 
  Swagger2OpenAPIConversionError, 
  UnsupportedVersionError 
} from '../errors/index';
import * as swagger2openapi from 'swagger2openapi';

/**
 * Conversion options for Swagger 2.0 to OpenAPI 3.0
 */
export interface ConversionOptions {
  /** Fix up small errors in the source definition */
  patch?: boolean;
  /** Do not throw on non-patchable errors, add warning extensions */
  warnOnly?: boolean;
  /** Resolve internal references also */
  resolveInternal?: boolean;
  /** Override default target version of 3.0.0 */
  targetVersion?: string;
  /** Preserve $ref siblings */
  preserveRefs?: boolean;
  /** Property name to use for warning extensions */
  warnProperty?: string;
  /** URL of original spec, creates x-origin entry */
  url?: string;
  /** Enable debug mode, adds specification-extensions */
  debug?: boolean;
}

/**
 * Conversion result
 */
export interface ConversionResult {
  /** The converted OpenAPI 3.0 specification */
  openapi: any; // Use any to handle swagger2openapi's return type
  /** Warnings generated during conversion */
  warnings?: string[];
  /** Number of patches applied */
  patches?: number;
  /** Conversion duration in milliseconds */
  duration?: number;
  /** Original specification version */
  originalVersion?: string;
  /** Target specification version */
  targetVersion?: string;
}

/**
 * Swagger 2.0 to OpenAPI 3.0 converter options
 */
export interface Swagger2OpenAPIOptions {
  patch?: boolean;
  warnOnly?: boolean;
  resolveInternal?: boolean;
  targetVersion?: string;
  warnProperty?: string;
  url?: string;
  debug?: boolean;
  refSiblings?: 'remove' | 'preserve' | 'allOf';
  direct?: boolean;
  patches?: number;
  warnings?: string[];
}

/**
 * Swagger 2.0 to OpenAPI 3.0 converter
 */
export class Swagger2OpenAPIConverter {
  private options: Swagger2OpenAPIOptions;

  constructor(options: ConversionOptions = {}) {
    this.options = {
      patch: options.patch ?? true,
      warnOnly: options.warnOnly ?? false,
      resolveInternal: options.resolveInternal ?? false,
      targetVersion: options.targetVersion ?? '3.0.0',
      warnProperty: options.warnProperty ?? 'x-s2o-warning',
      url: options.url,
      debug: options.debug ?? false,
      // Additional swagger2openapi options
      refSiblings: options.preserveRefs ? 'preserve' : 'remove',
      direct: false, // We want the full options object back
    };
  }

  /**
   * Convert a Swagger 2.0 specification to OpenAPI 3.0
   */
  async convert(swagger2Spec: any): Promise<ConversionResult> {
    const startTime = Date.now();
    
    try {
      // Validate input
      if (!swagger2Spec || typeof swagger2Spec !== 'object') {
        throw new Error('Invalid specification: must be a valid object');
      }

      // Check if it's actually a Swagger 2.0 spec
      if (!swagger2Spec.swagger || !swagger2Spec.swagger.startsWith('2.')) {
        throw new UnsupportedVersionError(
          swagger2Spec.swagger || swagger2Spec.openapi || 'unknown'
        );
      }

      // Create a copy of the spec to avoid modifying the original
      const specCopy = JSON.parse(JSON.stringify(swagger2Spec));
      
      // Perform conversion
      const result = await swagger2openapi.convertObj(specCopy, this.options);
      
      const duration = Date.now() - startTime;

      return {
        openapi: result.openapi,
        warnings: result.warnings || [],
        patches: result.patches || 0,
        duration,
        originalVersion: swagger2Spec.swagger,
        targetVersion: this.options.targetVersion
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      if (error instanceof UnsupportedVersionError) {
        throw error;
      }
      
      throw new Swagger2OpenAPIConversionError(
        `Failed to convert Swagger 2.0 to OpenAPI 3.0: ${error.message}`,
        error,
        {
          ...this.options,
          duration,
          originalVersion: swagger2Spec?.swagger
        }
      );
    }
  }

  /**
   * Convert from object with additional validation
   */
  async convertWithValidation(swagger2Spec: any): Promise<ConversionResult> {
    // Pre-conversion validation
    if (!swagger2Spec) {
      throw new Error('Specification is required');
    }

    if (typeof swagger2Spec !== 'object') {
      throw new Error('Specification must be an object');
    }

    if (!swagger2Spec.swagger) {
      throw new Error('Missing required "swagger" property');
    }

    if (!swagger2Spec.swagger.startsWith('2.')) {
      throw new UnsupportedVersionError(swagger2Spec.swagger);
    }

    if (!swagger2Spec.info) {
      throw new Error('Missing required "info" property');
    }

    if (!swagger2Spec.paths) {
      throw new Error('Missing required "paths" property');
    }

    return this.convert(swagger2Spec);
  }

  /**
   * Update conversion options
   */
  updateOptions(options: Partial<ConversionOptions>): void {
    this.options = {
      ...this.options,
      ...options,
      refSiblings: options.preserveRefs ? 'preserve' : this.options.refSiblings
    };
  }

  /**
   * Get current conversion options
   */
  getOptions(): Swagger2OpenAPIOptions {
    return { ...this.options };
  }
}
