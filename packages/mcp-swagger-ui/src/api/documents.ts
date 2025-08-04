import axios from "axios";
import type { AxiosResponse } from "axios";

// 分页响应接口
export interface PaginatedResponse<T> {
  documents: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 文档接口类型定义
export interface Document {
  id: string;
  name: string;
  description?: string;
  content: string;
  status: "draft" | "published" | "archived" | "valid" | "invalid" | "pending";
  version: string;
  tags?: string[];
  metadata?: {
    originalUrl?: string;
    importSource?: "file" | "url" | "manual";
    fileSize?: number;
    lastValidated?: Date;
    validationErrors?: string[];
    [key: string]: any;
  };
  userId: string;
  createdAt: string;
  updatedAt: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  endpointCount?: number;
}

export interface CreateDocumentDto {
  name: string;
  description?: string;
  content: string;
  status?: "draft" | "published" | "archived" | "valid" | "invalid" | "pending";
  version?: string;
  tags?: string[];
  metadata?: {
    originalUrl?: string;
    importSource?: "file" | "url" | "manual";
    fileSize?: number;
    lastValidated?: Date;
    validationErrors?: string[];
    [key: string]: any;
  };
}

export interface UpdateDocumentDto {
  name?: string;
  description?: string;
  content?: string;
  status?: "draft" | "published" | "archived" | "valid" | "invalid" | "pending";
  version?: string;
  tags?: string[];
  metadata?: {
    originalUrl?: string;
    importSource?: "file" | "url" | "manual";
    fileSize?: number;
    lastValidated?: Date;
    validationErrors?: string[];
    [key: string]: any;
  };
}

// API基础配置
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器 - 添加JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("auth_token") ||
      sessionStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 响应拦截器 - 处理错误
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token过期或无效，清除本地存储的token
      localStorage.removeItem("auth_token");
      sessionStorage.removeItem("auth_token");
      // 可以在这里触发登录页面跳转
      console.warn("Authentication failed, please login again");
    }
    return Promise.reject(error);
  },
);

// 文档管理API
export const documentsApi = {
  // 获取用户文档列表
  async getDocuments(): Promise<Document[]> {
    try {
      const response: AxiosResponse<PaginatedResponse<Document>> =
        await apiClient.get("/documents");
      // 从分页响应中提取documents数组
      return response.data.documents || [];
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      throw error;
    }
  },

  // 获取单个文档
  async getDocument(id: string): Promise<Document> {
    try {
      const response: AxiosResponse<Document> = await apiClient.get(
        `/documents/${id}`,
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch document ${id}:`, error);
      throw error;
    }
  },

  // 创建文档
  async createDocument(data: CreateDocumentDto): Promise<Document> {
    try {
      const response: AxiosResponse<Document> = await apiClient.post(
        "/documents",
        data,
      );
      return response.data;
    } catch (error) {
      console.error("Failed to create document:", error);
      throw error;
    }
  },

  // 更新文档
  async updateDocument(id: string, data: UpdateDocumentDto): Promise<Document> {
    try {
      const response: AxiosResponse<Document> = await apiClient.patch(
        `/documents/${id}`,
        data,
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to update document ${id}:`, error);
      throw error;
    }
  },

  // 删除文档
  async deleteDocument(id: string): Promise<void> {
    try {
      await apiClient.delete(`/documents/${id}`);
    } catch (error) {
      console.error(`Failed to delete document ${id}:`, error);
      throw error;
    }
  },

  // 检查用户认证状态
  async checkAuth(): Promise<boolean> {
    try {
      const token =
        localStorage.getItem("auth_token") ||
        sessionStorage.getItem("auth_token");
      if (!token) {
        console.log("No auth token found");
        return false;
      }

      // 尝试调用一个需要认证的接口来验证token有效性
      const response = await apiClient.get("/documents");
      console.log(
        "Auth check successful, documents loaded:",
        response.data?.length || 0,
      );
      return true;
    } catch (error: any) {
      console.error(
        "Auth check failed:",
        error.response?.status,
        error.message,
      );
      // 如果是401错误，说明token无效
      if (error.response?.status === 401) {
        localStorage.removeItem("auth_token");
        sessionStorage.removeItem("auth_token");
      }
      return false;
    }
  },
};

export default documentsApi;
