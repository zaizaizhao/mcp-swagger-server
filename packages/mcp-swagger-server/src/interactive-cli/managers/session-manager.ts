import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SessionConfig, SessionStats } from '../types';

/**
 * 会话管理器
 * 负责管理交互式 CLI 的会话配置
 */
export class SessionManager {
  private sessionsFile: string;
  private sessions: Map<string, SessionConfig> = new Map();
  private initialized = false;

  constructor(configDir: string = '.mcp-swagger') {
    this.sessionsFile = join(process.cwd(), configDir, 'sessions.json');
  }

  /**
   * 初始化会话管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadSessions();
      this.initialized = true;
    } catch (error) {
      // 如果文件不存在，创建空的会话存储
      this.sessions = new Map();
      await this.saveSessions();
      this.initialized = true;
    }
  }

  /**
   * 从文件加载会话
   */
  private async loadSessions(): Promise<void> {
    try {
      const data = await fs.readFile(this.sessionsFile, 'utf-8');
      const sessionsArray: SessionConfig[] = JSON.parse(data);
      
      this.sessions = new Map();
      sessionsArray.forEach(session => {
        this.sessions.set(session.id, session);
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // 文件不存在，使用空的 Map
      this.sessions = new Map();
    }
  }

  /**
   * 保存会话到文件
   */
  private async saveSessions(): Promise<void> {
    const sessionsArray = Array.from(this.sessions.values());
    
    // 确保目录存在
    const dir = join(this.sessionsFile, '..');
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(
      this.sessionsFile,
      JSON.stringify(sessionsArray, null, 2),
      'utf-8'
    );
  }

  /**
   * 保存新会话
   */
  async saveSession(config: Omit<SessionConfig, 'id' | 'createdAt' | 'lastUsed'>): Promise<SessionConfig> {
    await this.initialize();

    const session: SessionConfig = {
      ...config,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    this.sessions.set(session.id, session);
    await this.saveSessions();
    
    return session;
  }

  /**
   * 获取单个会话
   */
  async getSession(id: string): Promise<SessionConfig | undefined> {
    await this.initialize();
    return this.sessions.get(id);
  }

  /**
   * 获取所有会话
   */
  async getAllSessions(): Promise<SessionConfig[]> {
    await this.initialize();
    return Array.from(this.sessions.values())
      .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
  }

  /**
   * 更新会话
   */
  async updateSession(id: string, config: SessionConfig): Promise<void> {
    await this.initialize();
    
    if (!this.sessions.has(id)) {
      throw new Error(`Session with id ${id} not found`);
    }

    const updatedConfig = {
      ...config,
      id,
      lastUsed: new Date().toISOString()
    };

    this.sessions.set(id, updatedConfig);
    await this.saveSessions();
  }

  /**
   * 删除会话
   */
  async deleteSession(id: string): Promise<boolean> {
    await this.initialize();
    
    const deleted = this.sessions.delete(id);
    if (deleted) {
      await this.saveSessions();
    }
    
    return deleted;
  }

  /**
   * 根据名称查找会话
   */
  async findSessionByName(name: string): Promise<SessionConfig | undefined> {
    await this.initialize();
    
    for (const session of this.sessions.values()) {
      if (session.name === name) {
        return session;
      }
    }
    
    return undefined;
  }

  /**
   * 获取最近使用的会话
   */
  async getRecentSessions(limit: number = 5): Promise<SessionConfig[]> {
    const allSessions = await this.getAllSessions();
    return allSessions.slice(0, limit);
  }

  /**
   * 检查会话名称是否存在
   */
  async sessionNameExists(name: string, excludeId?: string): Promise<boolean> {
    await this.initialize();
    
    for (const session of this.sessions.values()) {
      if (session.name === name && session.id !== excludeId) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 导入会话配置
   */
  async importSessions(sessions: SessionConfig[]): Promise<number> {
    await this.initialize();
    
    let importedCount = 0;
    
    for (const session of sessions) {
      // 检查是否已存在相同名称的会话
      const exists = await this.sessionNameExists(session.name);
      
      if (!exists) {
        const newSession = {
          ...session,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        };
        
        this.sessions.set(newSession.id, newSession);
        importedCount++;
      }
    }
    
    if (importedCount > 0) {
      await this.saveSessions();
    }
    
    return importedCount;
  }

  /**
   * 导出会话配置
   */
  async exportSessions(): Promise<SessionConfig[]> {
    return await this.getAllSessions();
  }

  /**
   * 清空所有会话
   */
  async clearAllSessions(): Promise<void> {
    await this.initialize();
    
    this.sessions.clear();
    await this.saveSessions();
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.sessionsFile;
  }

  /**
   * 更新会话最后使用时间
   */
  async updateLastUsed(sessionId: string): Promise<void> {
    await this.initialize();
    
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastUsed = new Date().toISOString();
      this.sessions.set(sessionId, session);
      await this.saveSessions();
    }
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStats(): Promise<SessionStats> {
    const sessions = await this.getAllSessions();
    
    const stats: SessionStats = {
      total: sessions.length,
      byTransport: {},
      recentlyUsed: sessions.slice(0, 5).length
    };
    
    // 按传输协议统计
    sessions.forEach(session => {
      const transport = session.transport;
      stats.byTransport[transport] = (stats.byTransport[transport] || 0) + 1;
    });
    
    return stats;
  }
}