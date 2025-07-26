import { MCPServerEntity } from '../../../database/entities/mcp-server.entity';
import { ServerResponseDto, PaginatedResponseDto } from '../dto/server.dto';

/**
 * 服务器实体到响应DTO的映射工具类
 */
export class ServerMapper {
  /**
   * 将服务器实体转换为响应DTO
   */
  static toResponseDto(entity: MCPServerEntity): ServerResponseDto {
    const dto = new ServerResponseDto();
    
    dto.id = entity.id;
    dto.name = entity.name;
    dto.version = entity.version;
    dto.description = entity.description;
    dto.port = entity.port;
    dto.transport = entity.transport;
    dto.status = entity.status;
    dto.healthy = entity.healthy;
    dto.endpoint = entity.endpoint;
    dto.toolCount = entity.toolsCount || 0;
    dto.autoStart = entity.autoStart;
    dto.tags = entity.tags || [];
    dto.errorMessage = entity.errorMessage;
    dto.lastHealthCheck = entity.lastHealthCheck;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    
    return dto;
  }

  /**
   * 将服务器实体数组转换为响应DTO数组
   */
  static toResponseDtoArray(entities: MCPServerEntity[]): ServerResponseDto[] {
    return entities.map(entity => this.toResponseDto(entity));
  }

  /**
   * 创建分页响应DTO
   */
  static toPaginatedResponseDto(
    entities: MCPServerEntity[],
    total: number,
    page: number,
    limit: number
  ): PaginatedResponseDto<ServerResponseDto> {
    const data = this.toResponseDtoArray(entities);
    const totalPages = Math.ceil(total / limit);
    
    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}