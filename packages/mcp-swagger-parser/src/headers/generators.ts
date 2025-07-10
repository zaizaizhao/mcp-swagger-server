/**
 * 预定义的动态头生成器
 */
export const predefinedGenerators = {
  /**
   * 生成唯一请求ID
   */
  generateRequestId: () => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * 生成时间戳
   */
  generateTimestamp: () => {
    return new Date().toISOString();
  },

  /**
   * 生成Unix时间戳
   */
  generateUnixTimestamp: () => {
    return Math.floor(Date.now() / 1000).toString();
  },

  /**
   * 生成UUID v4
   */
  generateUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

/**
 * 获取预定义生成器
 */
export function getPredefinedGenerator(name: string): (() => string) | undefined {
  return predefinedGenerators[name as keyof typeof predefinedGenerators];
}
