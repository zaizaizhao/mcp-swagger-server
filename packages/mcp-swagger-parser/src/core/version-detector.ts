/**
 * Version detection utilities for OpenAPI specifications
 */

/**
 * Supported OpenAPI/Swagger versions
 */
export type ApiSpecVersion = 'swagger2' | 'openapi3' | 'unknown';

/**
 * Version detection result
 */
export interface VersionDetectionResult {
  version: ApiSpecVersion;
  detectedVersion: string;
  isSwagger2: boolean;
  isOpenAPI3: boolean;
  isSupported: boolean;
}

/**
 * Version detector for OpenAPI/Swagger specifications
 */
export class VersionDetector {
  /**
   * Detect the version of an OpenAPI/Swagger specification
   */
  static detect(spec: any): ApiSpecVersion {
    if (!spec || typeof spec !== 'object') {
      return 'unknown';
    }

    // Check for Swagger 2.0
    if (spec.swagger && typeof spec.swagger === 'string' && spec.swagger.startsWith('2.')) {
      return 'swagger2';
    }

    // Check for OpenAPI 3.x
    if (spec.openapi && typeof spec.openapi === 'string' && spec.openapi.startsWith('3.')) {
      return 'openapi3';
    }

    return 'unknown';
  }

  /**
   * Detect version with detailed information
   */
  static detectDetailed(spec: any): VersionDetectionResult {
    const version = this.detect(spec);
    let detectedVersion = 'unknown';

    if (version === 'swagger2' && spec.swagger) {
      detectedVersion = spec.swagger;
    } else if (version === 'openapi3' && spec.openapi) {
      detectedVersion = spec.openapi;
    }

    return {
      version,
      detectedVersion,
      isSwagger2: version === 'swagger2',
      isOpenAPI3: version === 'openapi3',
      isSupported: version !== 'unknown'
    };
  }

  /**
   * Check if a specification is Swagger 2.0
   */
  static isSwagger2(spec: any): boolean {
    return this.detect(spec) === 'swagger2';
  }

  /**
   * Check if a specification is OpenAPI 3.x
   */
  static isOpenAPI3(spec: any): boolean {
    return this.detect(spec) === 'openapi3';
  }

  /**
   * Check if a specification is supported
   */
  static isSupported(spec: any): boolean {
    const version = this.detect(spec);
    return version === 'swagger2' || version === 'openapi3';
  }

  /**
   * Get the version string from a specification
   */
  static getVersionString(spec: any): string {
    const version = this.detect(spec);
    
    if (version === 'swagger2' && spec.swagger) {
      return spec.swagger;
    }
    
    if (version === 'openapi3' && spec.openapi) {
      return spec.openapi;
    }
    
    return 'unknown';
  }
}
