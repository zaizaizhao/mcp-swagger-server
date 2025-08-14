// MCP API service for server communication
import axios, { type AxiosInstance } from "axios";
import type {
  ApiResponse,
  MCPServer,
  MCPTool,
  InputSource,
  ConvertConfig,
} from "@/types";

class MCPApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: "/api/v1",
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async getServers(): Promise<ApiResponse<MCPServer[]>> {
    try {
      const response = await this.api.get("/servers");
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getServerTools(serverId: string): Promise<ApiResponse<MCPTool[]>> {
    try {
      const response = await this.api.get(`/servers/${serverId}/tools`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async executeServerTool(
    serverId: string,
    toolId: string,
    parameters: any,
  ): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.post(
        `/servers/${serverId}/tools/${toolId}/execute`,
        {
          parameters,
        },
      );
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async validateOpenApi(source: any): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.post("/validate", source);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async parseOpenApi(source: any): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.post("/parse", source);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async createServer(config: any): Promise<ApiResponse<MCPServer>> {
    try {
      const response = await this.api.post("/servers", config);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getTools(): Promise<ApiResponse<MCPTool[]>> {
    try {
      const response = await this.api.get("/tools");
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const mcpApiService = new MCPApiService();
