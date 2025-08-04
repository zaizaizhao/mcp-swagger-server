// Auth module exports
export { default as AuthManager } from "./AuthManager.vue";

// Auth types and interfaces
export interface AuthConfig {
  id: string;
  name: string;
  type: "bearer" | "basic" | "apikey" | "oauth2";
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BearerTokenConfig {
  token: string;
  headerName?: string;
}

export interface BasicAuthConfig {
  username: string;
  password: string;
}

export interface APIKeyConfig {
  key: string;
  location: "header" | "query";
  name: string;
}
