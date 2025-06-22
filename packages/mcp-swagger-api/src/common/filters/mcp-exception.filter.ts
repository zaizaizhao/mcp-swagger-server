import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

// MCP相关异常类型
export class MCPException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any,
  ) {
    super(message);
    this.name = 'MCPException';
  }
}

export class MCPProtocolException extends MCPException {
  constructor(message: string, details?: any) {
    super(message, 'MCP_PROTOCOL_ERROR', details);
    this.name = 'MCPProtocolException';
  }
}

export class MCPServerException extends MCPException {
  constructor(message: string, details?: any) {
    super(message, 'MCP_SERVER_ERROR', details);
    this.name = 'MCPServerException';
  }
}

export class MCPToolException extends MCPException {
  constructor(message: string, details?: any) {
    super(message, 'MCP_TOOL_ERROR', details);
    this.name = 'MCPToolException';
  }
}

@Catch(MCPException)
export class MCPExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MCPExceptionFilter.name);

  catch(exception: MCPException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const errorResponse = {
      success: false,
      error: {
        type: 'mcp_error',
        code: exception.code,
        message: exception.message,
        details: exception.details,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        sessionId: request.headers['mcp-session-id'],
      },
    };

    // 记录MCP错误日志
    this.logger.error({
      type: 'mcp_exception',
      code: exception.code,
      message: exception.message,
      details: exception.details,
      path: request.url,
      method: request.method,
      sessionId: request.headers['mcp-session-id'],
      userAgent: request.headers['user-agent'],
      stack: exception.stack,
    });

    // MCP异常通常返回400状态码
    response.status(400).json(errorResponse);
  }
}
