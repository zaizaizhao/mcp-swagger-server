import { dirname, join } from 'path';
import { existsSync, rmSync } from 'fs';
import {
  getDatabaseType,
  resolveSqliteDatabasePath,
  verifySqliteDatabasePath,
} from './db-compat';

describe('db-compat', () => {
  const runtimeDir = join(process.cwd(), 'tmp', 'db-compat-spec');

  afterEach(() => {
    delete process.env.DB_SQLITE_PATH;
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('should default unknown database types to sqlite', () => {
    expect(getDatabaseType(undefined)).toBe('sqlite');
    expect(getDatabaseType('mysql')).toBe('sqlite');
    expect(getDatabaseType('postgres')).toBe('postgres');
  });

  it('should resolve and create sqlite parent directory', () => {
    process.env.DB_SQLITE_PATH = 'tmp/db-compat-spec/test.sqlite';

    const resolvedPath = resolveSqliteDatabasePath();

    expect(resolvedPath.endsWith('tmp\\db-compat-spec\\test.sqlite') || resolvedPath.endsWith('tmp/db-compat-spec/test.sqlite')).toBe(true);
    expect(existsSync(dirname(resolvedPath))).toBe(true);
  });

  it('should verify sqlite path and create the database file when missing', () => {
    process.env.DB_SQLITE_PATH = 'tmp/db-compat-spec/verified.sqlite';

    const verifiedPath = verifySqliteDatabasePath();

    expect(existsSync(verifiedPath)).toBe(true);
  });
});
