import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ Missing DATABASE_URL in .env");
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  ssl: "require",
  connect_timeout: 15,
});

async function migrate() {
  console.log("🔄 Running migration: 001_initial_schema.sql\n");
  const migrationPath1 = resolve(__dirname, "..", "supabase", "migrations", "001_initial_schema.sql");
  const migrationSql1 = readFileSync(migrationPath1, "utf-8");

  console.log("🔄 Running migration: 002_real_pipeline_schema.sql\n");
  const migrationPath2 = resolve(__dirname, "..", "supabase", "migrations", "002_real_pipeline_schema.sql");
  const migrationSql2 = readFileSync(migrationPath2, "utf-8");

  console.log("🔄 Running migration: 003_slide_types_and_themes.sql\n");
  const migrationPath3 = resolve(__dirname, "..", "supabase", "migrations", "003_slide_types_and_themes.sql");
  const migrationSql3 = readFileSync(migrationPath3, "utf-8");

  console.log("🔄 Running migration: 004_auth_and_user_data_schema.sql\n");
  const migrationPath4 = resolve(__dirname, "..", "supabase", "migrations", "004_auth_and_user_data_schema.sql");
  const migrationSql4 = readFileSync(migrationPath4, "utf-8");

  console.log("🔄 Running migration: 006_storage_rls_policies.sql\n");
  const migrationPath6 = resolve(__dirname, "..", "supabase", "migrations", "006_storage_rls_policies.sql");
  const migrationSql6 = readFileSync(migrationPath6, "utf-8");

  console.log("🔄 Running migration: 007_fix_payments_columns.sql\n");
  const migrationPath7 = resolve(__dirname, "..", "supabase", "migrations", "007_fix_payments_columns.sql");
  const migrationSql7 = readFileSync(migrationPath7, "utf-8");

  try {
    await sql.unsafe(migrationSql1);
    await sql.unsafe(migrationSql2);
    await sql.unsafe(migrationSql3);
    await sql.unsafe(migrationSql4);
    await sql.unsafe(migrationSql6);
    await sql.unsafe(migrationSql7);
    console.log("✅ All migrations applied successfully!\n");

    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('meetings', 'payments', 'speakers', 'action_items', 'slides', 'profiles', 'wallets', 'presentation_versions')
      ORDER BY table_name;
    `;

    console.log("📋 Tables verified:");
    for (const t of tables) {
      console.log(`   ✓ ${t.table_name}`);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Migration failed:", msg);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
