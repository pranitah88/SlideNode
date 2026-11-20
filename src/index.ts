import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

import uploadRouter from './routes/upload.route.js';
import processingRouter from './routes/processing.route.js';
import downloadRouter from './routes/download.route.js';
import meetingRouter from './routes/meeting.route.js';
import dashboardRouter from './routes/dashboard.route.js';
import transcriptRouter from './routes/transcript.route.js';
import pricingRouter from './routes/pricing.route.js';




// Initialize Hono App
const app = new Hono();

// Global Middlewares
app.use('*', logger());
app.use('*', cors());

// Health Check Route
app.get('/', (c) => {
  return c.json({
    service: 'Voice to Slide Deck Node Backend',
    status: 'Operational',
    version: '1.0.0',
    protocol: 'x402 enabled (payment checks deferred for upload stage)',
  });
});

/**
 * API Routes
 */
app.route('/api/upload', uploadRouter);
app.route('/api/processing', processingRouter);
app.route('/api/download', downloadRouter);
app.route('/api/meeting', meetingRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/transcript', transcriptRouter);
app.route('/api/pricing', pricingRouter);




// Global Error Handler
app.onError((err, c) => {
  console.error('Unhandled Server Exception:', err);

  return c.json(
    {
      success: false,
      error: err.message || 'Internal Server Error',
    },
    500
  );
});

// Server Port
const port = Number(process.env.PORT) || 3001;

console.log(
  `🚀 Voice to Slide Deck Node backend initialized on http://localhost:${port}`
);

// Start Server
serve({
  fetch: app.fetch,
  port,
});

export default app;