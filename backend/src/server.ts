// SlideNode AI Backend Server - Updated
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import fs from "fs";
import path from "path";
import "./lib/supabase.js"; // validate Supabase env vars on startup

// Simple Rate Limiter Memory Store
const rateLimitStore = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_MAX = 200;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

const rateLimiter = async (c: any, next: any) => {
  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now - record.lastReset > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, lastReset: now });
  } else {
    if (record.count >= RATE_LIMIT_MAX) {
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }
    record.count++;
  }
  await next();
};

import { randomUUID } from "crypto";

const requestIdMiddleware = async (c: any, next: any) => {
  const reqId = c.req.header("X-Request-ID") || randomUUID();
  c.set("requestId", reqId);
  c.res.headers.set("X-Request-ID", reqId);
  await next();
};
import meetingsRoutes from "./routes/meetings.js";
import presentationsRoutes from "./routes/presentations.js";
import authRoutes from "./routes/auth.js";

const app = new Hono();

// ---------------------------------------------------------------------------
// CORS – allow localhost origins for local frontend development
// ---------------------------------------------------------------------------
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "*"],
    exposeHeaders: ["*"],
  })
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("*", requestIdMiddleware);
app.use("*", rateLimiter);
app.route("/api/auth", authRoutes);
app.route("/api/meetings", meetingsRoutes);
app.route("/api/presentation", presentationsRoutes);

// Spec Exact Endpoint Aliases
app.post("/api/generate-presentation", (c) => presentationsRoutes.fetch(c.req.raw));
app.post("/api/regenerate-slides", (c) => presentationsRoutes.fetch(c.req.raw));
app.post("/api/update-presentation", (c) => presentationsRoutes.fetch(c.req.raw));
app.post("/api/modify", (c) => presentationsRoutes.fetch(c.req.raw));

// Static Image Asset Endpoint for Cached Slide Photography
app.get("/api/images/:filename", async (c) => {
  const filename = c.req.param("filename");
  const filePath = path.resolve(process.cwd(), "uploads", "image_cache", filename);
  if (fs.existsSync(filePath)) {
    const fileBuf = fs.readFileSync(filePath);
    return c.body(Uint8Array.from(fileBuf), 200, {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400"
    });
  }
  return c.json({ error: "Image not found" }, 404);
});

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------
app.get("/health", (c) => {
  return c.json({ status: "ok" }, 200);
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.onError((err, c) => {
  console.error(`[Error] ${err.message}`);
  return c.json({ error: "Internal Server Error" }, 500);
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const port = Number(process.env.PORT) || 3000;

console.log(`🚀 SlideNode API running at http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
