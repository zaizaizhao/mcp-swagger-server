import EventEmitter from 'events';
import { MCPTool, ValidationResult, ToolManagerEvent, ToolManagerStats, IToolManager, ValidationError, ValidationWarning } from '../types/core';

export class ToolManager extends EventEmitter implements IToolManager {
  private tools = new Map<string, MCPTool>();
  private toolsByTag = new Map<string, Set<string>>();
  private executionStats = new Map<string, {
    count: number;
    totalTime: number;
    errorCount: number;
    lastExecuted: Date;
  }>();
  private disposed = false;

  async registerTool(tool: MCPTool): Promise<void> {
    if (this.disposed) {
      throw new Error('ToolManager has been disposed');
    }

    // 验证工具
    const validation = this.validateTool(tool);
    if (!validation.valid) {
      const error = new Error(`Invalid tool: ${validation.errors.map(e => e.message).join(', ')}`);
      this.emit('toolError', { 
        type: 'toolError', 
        tool, 
        timestamp: new Date(), 
        metadata: { validation, error: error.message } 
      });
      throw error;
    }

    // 检查重复ID
    if (this.tools.has(tool.id)) {
      console.warn(`⚠️ Tool ${tool.id} already exists, replacing...`);
      await this.unregisterTool(tool.id);
    }

    // 注册工具
    this.tools.set(tool.id, tool);

    // 更新标签索引
    const tags = tool.metadata?.tags || ['uncategorized'];
    for (const tag of tags) {
      if (!this.toolsByTag.has(tag)) {
        this.toolsByTag.set(tag, new Set());
      }
      this.toolsByTag.get(tag)!.add(tool.id);
    }

    // 初始化执行统计
    this.executionStats.set(tool.id, {
      count: 0,
      totalTime: 0,
      errorCount: 0,
      lastExecuted: new Date()
    });

    // 触发事件
    const event: ToolManagerEvent = {
      type: 'toolRegistered',
      tool,
      timestamp: new Date()
    };
    this.emit('toolRegistered', event);

    console.log(`✅ Tool registered: ${tool.id} (${tool.name})`);
  }

  async registerTools(tools: MCPTool[]): Promise<void> {
    const results = await Promise.allSettled(
      tools.map(tool => this.registerTool(tool))
    );

    const errors = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason);

    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} tools failed to register`);
      errors.forEach(error => console.warn(`  - ${error.message}`));
    }

    const successCount = results.filter(result => result.status === 'fulfilled').length;
    console.log(`📦 Successfully registered ${successCount}/${tools.length} tools`);
  }

  async unregisterTool(toolId: string): Promise<void> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      console.warn(`⚠️ Tool ${toolId} not found for unregistration`);
      return;
    }

    // 从主索引移除
    this.tools.delete(toolId);

    // 从标签索引移除
    const tags = tool.metadata?.tags || ['uncategorized'];
    for (const tag of tags) {
      const tagSet = this.toolsByTag.get(tag);
      if (tagSet) {
        tagSet.delete(toolId);
        if (tagSet.size === 0) {
          this.toolsByTag.delete(tag);
        }
      }
    }

    // 清理执行统计
    this.executionStats.delete(toolId);

    // 触发事件
    const event: ToolManagerEvent = {
      type: 'toolUnregistered',
      tool,
      timestamp: new Date()
    };
    this.emit('toolUnregistered', event);

    console.log(`🗑️ Tool unregistered: ${toolId}`);
  }

  async unregisterTools(toolIds: string[]): Promise<void> {
    await Promise.all(toolIds.map(id => this.unregisterTool(id)));
  }

  getTool(toolId: string): MCPTool | undefined {
    return this.tools.get(toolId);
  }

  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  getToolsByTag(tag: string): MCPTool[] {
    const toolIds = this.toolsByTag.get(tag);
    if (!toolIds) return [];

    return Array.from(toolIds)
      .map(id => this.tools.get(id))
      .filter((tool): tool is MCPTool => tool !== undefined);
  }

  validateTool(tool: MCPTool): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 必需字段验证
    if (!tool.id || typeof tool.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'Tool ID is required and must be a string',
        code: 'INVALID_ID'
      });
    }

    if (!tool.name || typeof tool.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Tool name is required and must be a string',
        code: 'INVALID_NAME'
      });
    }

    if (!tool.description || typeof tool.description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Tool description is required and must be a string',
        code: 'INVALID_DESCRIPTION'
      });
    }

    if (!tool.handler || typeof tool.handler !== 'function') {
      errors.push({
        field: 'handler',
        message: 'Tool handler is required and must be a function',
        code: 'INVALID_HANDLER'
      });
    }

    // 格式验证
    if (tool.id && !/^[a-zA-Z0-9_-]+$/.test(tool.id)) {
      warnings.push({
        field: 'id',
        message: 'Tool ID should only contain alphanumeric characters, underscores, and hyphens',
        code: 'ID_FORMAT'
      });
    }

    // 废弃工具警告
    if (tool.metadata?.deprecated) {
      warnings.push({
        field: 'metadata.deprecated',
        message: 'Tool is marked as deprecated',
        code: 'DEPRECATED'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // 记录工具执行
  async recordExecution(toolId: string, executionTime: number, success: boolean, error?: string): Promise<void> {
    const stats = this.executionStats.get(toolId);
    if (stats) {
      stats.count++;
      stats.totalTime += executionTime;
      stats.lastExecuted = new Date();
      
      if (!success) {
        stats.errorCount++;
      }

      const tool = this.tools.get(toolId);
      if (tool) {
        const event: ToolManagerEvent = {
          type: 'toolExecuted',
          tool,
          timestamp: new Date(),
          metadata: {
            executionTime,
            success,
            error
          }
        };
        this.emit('toolExecuted', event);
      }
    }
  }

  getStats(): ToolManagerStats {
    const totalExecutions = Array.from(this.executionStats.values())
      .reduce((sum, stats) => sum + stats.count, 0);
    
    const successfulExecutions = Array.from(this.executionStats.values())
      .reduce((sum, stats) => sum + (stats.count - stats.errorCount), 0);
    
    const failedExecutions = Array.from(this.executionStats.values())
      .reduce((sum, stats) => sum + stats.errorCount, 0);
    
    const totalTime = Array.from(this.executionStats.values())
      .reduce((sum, stats) => sum + stats.totalTime, 0);

    return {
      totalTools: this.tools.size,
      tagCount: this.toolsByTag.size,
      toolsByTag: Object.fromEntries(
        Array.from(this.toolsByTag.entries()).map(([tag, toolIds]) => [tag, toolIds.size])
      ),
      executionStats: {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        averageExecutionTime: totalExecutions > 0 ? totalTime / totalExecutions : 0
      }
    };
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;

    this.disposed = true;
    this.tools.clear();
    this.toolsByTag.clear();
    this.executionStats.clear();
    this.removeAllListeners();

    console.log('🔄 ToolManager disposed');
  }
}
