import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1753230758567 implements MigrationInterface {
    name = 'InitialMigration1753230758567'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."mcp_servers_transport_enum" AS ENUM('streamable', 'sse', 'stdio', 'websocket')`);
        await queryRunner.query(`CREATE TYPE "public"."mcp_servers_status_enum" AS ENUM('stopped', 'starting', 'running', 'stopping', 'error')`);
        await queryRunner.query(`CREATE TABLE "mcp_servers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "version" character varying(100) NOT NULL DEFAULT '1.0.0', "description" text, "port" integer NOT NULL DEFAULT '3322', "transport" "public"."mcp_servers_transport_enum" NOT NULL DEFAULT 'streamable', "status" "public"."mcp_servers_status_enum" NOT NULL DEFAULT 'stopped', "endpoint" text, "openApiData" jsonb NOT NULL, "tools" jsonb, "toolsCount" integer NOT NULL DEFAULT '0', "config" jsonb, "authConfig" jsonb, "lastHealthCheck" TIMESTAMP, "healthy" boolean NOT NULL DEFAULT true, "errorMessage" text, "metrics" jsonb, "autoStart" boolean NOT NULL DEFAULT true, "tags" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2ee0138f3dd9575eedd37f2405f" UNIQUE ("name"), CONSTRAINT "PK_c781b3dc7cb2a5d19460b71914d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7ed02efd17d98567e515642eb0" ON "mcp_servers" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2ee0138f3dd9575eedd37f2405" ON "mcp_servers" ("name") `);
        await queryRunner.query(`CREATE TYPE "public"."auth_configs_type_enum" AS ENUM('none', 'bearer', 'apikey', 'basic', 'oauth2')`);
        await queryRunner.query(`CREATE TABLE "auth_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "type" "public"."auth_configs_type_enum" NOT NULL DEFAULT 'none', "config" jsonb NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "expiresAt" TIMESTAMP, "lastUsed" TIMESTAMP, "serverId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5178fc2503176ad72a3280442ac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a9f26e310a0af26792c8762d3b" ON "auth_configs" ("serverId", "name") `);
        await queryRunner.query(`CREATE TYPE "public"."test_cases_status_enum" AS ENUM('pending', 'running', 'passed', 'failed', 'skipped')`);
        await queryRunner.query(`CREATE TABLE "test_cases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "toolName" character varying(255) NOT NULL, "input" jsonb NOT NULL, "expectedOutput" jsonb, "actualOutput" jsonb, "status" "public"."test_cases_status_enum" NOT NULL DEFAULT 'pending', "errorMessage" text, "executionTime" integer, "lastRun" TIMESTAMP, "runCount" integer NOT NULL DEFAULT '0', "passCount" integer NOT NULL DEFAULT '0', "failCount" integer NOT NULL DEFAULT '0', "tags" jsonb, "priority" integer NOT NULL DEFAULT '0', "enabled" boolean NOT NULL DEFAULT true, "config" jsonb, "assertions" jsonb, "serverId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_39eb2dc90c54d7a036b015f05c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c31eb69f3d97d4a88032177a75" ON "test_cases" ("tags") `);
        await queryRunner.query(`CREATE INDEX "IDX_8fb80e8097290fb2ba6959efd0" ON "test_cases" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_707ad02a7a8c08e99a1e6cc11c" ON "test_cases" ("serverId", "name") `);
        await queryRunner.query(`CREATE TYPE "public"."log_entries_level_enum" AS ENUM('debug', 'info', 'warn', 'error', 'fatal')`);
        await queryRunner.query(`CREATE TYPE "public"."log_entries_source_enum" AS ENUM('system', 'mcp_server', 'api', 'tool_execution', 'auth', 'database', 'health_check')`);
        await queryRunner.query(`CREATE TABLE "log_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "level" "public"."log_entries_level_enum" NOT NULL DEFAULT 'info', "source" "public"."log_entries_source_enum" NOT NULL DEFAULT 'system', "message" text NOT NULL, "context" jsonb, "metadata" jsonb, "serverId" uuid, "component" character varying(100), "operation" character varying(100), "stackTrace" text, "tags" jsonb, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b226cc4051321f12106771581e0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_51bcf6d9189a9caa2956f7384d" ON "log_entries" ("level", "timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_88410904513ed6cfdd598a777b" ON "log_entries" ("timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_bd0b54acd354a14abe257494e8" ON "log_entries" ("serverId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e01fae4223e72fdd0bba2e6f6a" ON "log_entries" ("source") `);
        await queryRunner.query(`CREATE INDEX "IDX_c1544ddc5ab67b1c768ed74a5c" ON "log_entries" ("level") `);
        await queryRunner.query(`ALTER TABLE "auth_configs" ADD CONSTRAINT "FK_c26de0f660ca6967931440c41e6" FOREIGN KEY ("serverId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "test_cases" ADD CONSTRAINT "FK_7a5e922ef58eca005a6a9e0e052" FOREIGN KEY ("serverId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "log_entries" ADD CONSTRAINT "FK_bd0b54acd354a14abe257494e82" FOREIGN KEY ("serverId") REFERENCES "mcp_servers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "log_entries" DROP CONSTRAINT "FK_bd0b54acd354a14abe257494e82"`);
        await queryRunner.query(`ALTER TABLE "test_cases" DROP CONSTRAINT "FK_7a5e922ef58eca005a6a9e0e052"`);
        await queryRunner.query(`ALTER TABLE "auth_configs" DROP CONSTRAINT "FK_c26de0f660ca6967931440c41e6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c1544ddc5ab67b1c768ed74a5c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e01fae4223e72fdd0bba2e6f6a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bd0b54acd354a14abe257494e8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_88410904513ed6cfdd598a777b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_51bcf6d9189a9caa2956f7384d"`);
        await queryRunner.query(`DROP TABLE "log_entries"`);
        await queryRunner.query(`DROP TYPE "public"."log_entries_source_enum"`);
        await queryRunner.query(`DROP TYPE "public"."log_entries_level_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_707ad02a7a8c08e99a1e6cc11c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8fb80e8097290fb2ba6959efd0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c31eb69f3d97d4a88032177a75"`);
        await queryRunner.query(`DROP TABLE "test_cases"`);
        await queryRunner.query(`DROP TYPE "public"."test_cases_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a9f26e310a0af26792c8762d3b"`);
        await queryRunner.query(`DROP TABLE "auth_configs"`);
        await queryRunner.query(`DROP TYPE "public"."auth_configs_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2ee0138f3dd9575eedd37f2405"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7ed02efd17d98567e515642eb0"`);
        await queryRunner.query(`DROP TABLE "mcp_servers"`);
        await queryRunner.query(`DROP TYPE "public"."mcp_servers_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."mcp_servers_transport_enum"`);
    }

}
