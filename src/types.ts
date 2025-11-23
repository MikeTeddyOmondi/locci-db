/**
 * Type definitions for @locci/db
 */

export interface ServerConfig {
  port: number;
  host: string;
  dataDir?: string;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  auth: AuthConfig;
  security?: SecurityConfig;
}

export interface AuthConfig {
  username: string;
  password?: string;
  passwordHash?: string;
}

export interface SecurityConfig {
  allowedHosts?: string[];
  maxConnections?: number;
}

export interface ConnectionInfo {
  clientAddress?: string;
  username: string;
  timestamp: Date;
  authenticated: boolean;
}
