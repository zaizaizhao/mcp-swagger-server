import { accessSync, closeSync, constants, mkdirSync, openSync } from 'fs';
import { dirname, isAbsolute, resolve } from 'path';
import { ConfigService } from '@nestjs/config';
import { ColumnOptions } from 'typeorm';

export type SupportedDatabaseType = 'sqlite' | 'postgres';

export function getDatabaseType(value?: string): SupportedDatabaseType {
  return value === 'postgres' ? 'postgres' : 'sqlite';
}

export function isSqliteDatabase(type?: string): boolean {
  return getDatabaseType(type) === 'sqlite';
}

export function getJsonColumnOptions(
  type?: string,
  options: ColumnOptions = {},
): ColumnOptions {
  return {
    type: isSqliteDatabase(type) ? 'simple-json' : 'jsonb',
    ...options,
  };
}

export function getEnumColumnOptions<T extends Record<string, string>>(
  dbType: string | undefined,
  enumObject: T,
  options: ColumnOptions = {},
): ColumnOptions {
  return {
    type: isSqliteDatabase(dbType) ? 'simple-enum' : 'enum',
    enum: enumObject,
    ...options,
  };
}

export function getIpColumnOptions(
  type?: string,
  options: ColumnOptions = {},
): ColumnOptions {
  return {
    type: isSqliteDatabase(type) ? 'varchar' : 'inet',
    ...(isSqliteDatabase(type) ? { length: 45 } : {}),
    ...options,
  };
}

export function getUuidColumnOptions(
  type?: string,
  options: ColumnOptions = {},
): ColumnOptions {
  return {
    type: isSqliteDatabase(type) ? 'varchar' : 'uuid',
    ...(isSqliteDatabase(type) ? { length: 36 } : {}),
    ...options,
  };
}

export function getTimestampTzColumnOptions(
  type?: string,
  options: ColumnOptions = {},
): ColumnOptions {
  return {
    type: isSqliteDatabase(type) ? 'datetime' : 'timestamp with time zone',
    ...options,
  };
}

export function getTimestampColumnOptions(
  type?: string,
  options: ColumnOptions = {},
): ColumnOptions {
  return {
    type: isSqliteDatabase(type) ? 'datetime' : 'timestamp',
    ...options,
  };
}

export function resolveSqliteDatabasePath(configService?: ConfigService): string {
  const configuredPath =
    configService?.get<string>('DB_SQLITE_PATH') ??
    process.env.DB_SQLITE_PATH ??
    'data/mcp-swagger.db';

  const packageRoot = resolve(__dirname, '..', '..');
  const workspaceRoot = resolve(packageRoot, '..', '..');
  const absolutePath = isAbsolute(configuredPath)
    ? configuredPath
    : resolve(workspaceRoot, configuredPath);

  mkdirSync(dirname(absolutePath), { recursive: true });
  return absolutePath;
}

export function verifySqliteDatabasePath(configService?: ConfigService): string {
  const absolutePath = resolveSqliteDatabasePath(configService);
  const directoryPath = dirname(absolutePath);

  accessSync(directoryPath, constants.R_OK | constants.W_OK);

  const handle = openSync(absolutePath, 'a');
  closeSync(handle);

  return absolutePath;
}
