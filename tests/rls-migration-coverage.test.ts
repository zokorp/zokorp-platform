import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

function loadPrismaTableNames() {
  const schema = fs.readFileSync(schemaPath, "utf8");
  const tableNames = new Set<string>();

  for (const match of schema.matchAll(/^model\s+(\w+)\s+\{([\s\S]*?)^\}/gm)) {
    const [, modelName, modelBody] = match;
    const mappedTableName =
      modelBody.match(/^\s*@@map\("([^"]+)"\)/m)?.[1] ?? modelName;

    tableNames.add(mappedTableName);
  }

  return tableNames;
}

function loadRlsEnabledTableNames() {
  const tableNames = new Set<string>();
  const migrationSqlPaths = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(migrationsDir, entry.name, "migration.sql"))
    .filter((migrationPath) => fs.existsSync(migrationPath));

  for (const migrationPath of migrationSqlPaths) {
    const migration = fs.readFileSync(migrationPath, "utf8");

    for (const match of migration.matchAll(
      /ALTER TABLE\s+"public"\."([^"]+)"\s+ENABLE ROW LEVEL SECURITY;/gi,
    )) {
      tableNames.add(match[1]);
    }
  }

  return tableNames;
}

function loadAllMigrationSql() {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(migrationsDir, entry.name, "migration.sql"))
    .filter((migrationPath) => fs.existsSync(migrationPath))
    .map((migrationPath) => fs.readFileSync(migrationPath, "utf8"))
    .join("\n");
}

describe("public table RLS hardening migration", () => {
  it("covers every current Prisma table plus _prisma_migrations somewhere in migration history", () => {
    const rlsEnabledTables = loadRlsEnabledTableNames();
    const expectedTables = new Set([...loadPrismaTableNames(), "_prisma_migrations"]);

    for (const tableName of expectedTables) {
      expect(rlsEnabledTables.has(tableName)).toBe(true);
    }
  });

  it("does not force RLS on owner or bypassrls roles", () => {
    const allMigrationSql = loadAllMigrationSql();

    expect(allMigrationSql).not.toMatch(
      /ALTER TABLE\s+"public"\."[^"]+"\s+FORCE\s+ROW\s+LEVEL\s+SECURITY;/i,
    );
  });
});
