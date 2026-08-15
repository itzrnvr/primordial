import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { ensureDb } from "./server/db.mjs";

// Same-origin JSON API for persistent saves, backed by PostgreSQL.
//   GET    /api/state/:slot  -> { data, updatedAt } | 404
//   PUT    /api/state/:slot  (body = the save json)
//   DELETE /api/state/:slot
function stateApi() {
  const handler = async (req, res, next) => {
    const m = req.url && req.url.match(/^\/api\/state\/([a-zA-Z0-9_-]+)/);
    if (!m) return next();
    const slot = m[1];
    try {
      const p = await ensureDb();
      if (req.method === "GET") {
        const r = await p.query("select data, updated_at from saves where slot = $1", [slot]);
        res.setHeader("content-type", "application/json");
        if (!r.rows.length) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "not found" }));
        } else {
          res.end(JSON.stringify({ data: r.rows[0].data, updatedAt: r.rows[0].updated_at }));
        }
        return;
      }
      if (req.method === "PUT") {
        let body = "";
        for await (const chunk of req) body += chunk;
        const parsed = JSON.parse(body);
        await p.query(
          "insert into saves (slot, data) values ($1, $2) " +
          "on conflict (slot) do update set data = excluded.data, updated_at = now()",
          [slot, parsed]
        );
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.method === "DELETE") {
        await p.query("delete from saves where slot = $1", [slot]);
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true }));
        return;
      }
    } catch (e) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }));
      return;
    }
    next();
  };
  return {
    name: "primordial-state-api",
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), stateApi()],
});
