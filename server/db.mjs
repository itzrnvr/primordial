// ============================================================
// DB - PostgreSQL-backed saves.
//
// Connection priority:
//   1. DATABASE_URL from the environment
//   2. DATABASE_URL from the gitignored .env file
//   3. an embedded Postgres started on demand (port 5434) so the
//      app still works on machines with no server installed
//
// Either way the data is durable: close the tab, reboot, come
// back next week - the colony is still there.
// ============================================================
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function readDotEnv() {
  try {
    const txt = fs.readFileSync(path.join(here, "..", ".env"), "utf8");
    const m = txt.match(/DATABASE_URL\s*=\s*(.+)/);
    if (m) return m[1].trim();
  } catch { /* no .env */ }
  return null;
}

const PRIMARY_URL = process.env.DATABASE_URL || readDotEnv();

const EMBED_DIR = process.env.PRIMORDIAL_PGDATA || path.join(here, "..", ".pgdata");
const EMBED_PORT = Number(process.env.PRIMORDIAL_PGPORT || 5434);
const EMBED_USER = "primordial";
const EMBED_PASS = "primordial";

let pool = null;
let starting = null;

async function ensureSchema(p) {
  await p.query(
    "create table if not exists saves (" +
      "slot text primary key, " +
      "data jsonb not null, " +
      "updated_at timestamptz not null default now())"
  );
}

async function tryConnect(url) {
  const p = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 1500, max: 4 });
  try {
    await p.query("select 1");
    return p;
  } catch {
    await p.end().catch(() => {});
    return null;
  }
}

export async function ensureDb() {
  if (pool) return pool;
  if (starting) return starting;
  starting = (async () => {
    if (PRIMARY_URL) {
      const p = await tryConnect(PRIMARY_URL);
      if (p) {
        console.log("[primordial] using postgres from DATABASE_URL");
        await ensureSchema(p);
        pool = p;
        return pool;
      }
      console.log("[primordial] DATABASE_URL unreachable - falling back to embedded postgres");
    }
    fs.mkdirSync(EMBED_DIR, { recursive: true });
    const ep = new EmbeddedPostgres({
      databaseDir: EMBED_DIR,
      user: EMBED_USER,
      password: EMBED_PASS,
      port: EMBED_PORT,
      persistent: true,
    });
    if (!fs.existsSync(path.join(EMBED_DIR, "PG_VERSION"))) {
      await ep.initialise();
    }
    await ep.start();
    try {
      await ep.createDatabase("primordial");
    } catch { /* exists */ }
    const p = await tryConnect(
      "postgres://" + EMBED_USER + ":" + EMBED_PASS + "@127.0.0.1:" + EMBED_PORT + "/primordial"
    );
    if (!p) throw new Error("embedded postgres started but connection failed");
    console.log("[primordial] using embedded postgres on port " + EMBED_PORT);
    await ensureSchema(p);
    pool = p;
    return pool;
  })();
  starting.catch(() => { starting = null; });
  return starting;
}
