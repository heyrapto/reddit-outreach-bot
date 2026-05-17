import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { triggers } from './routes/triggers';
import { scheduler } from './routes/scheduler';
import { menu } from './routes/menu';

const app = new Hono();
const internal = new Hono();

internal.route('/triggers', triggers);
internal.route('/scheduler', scheduler);
internal.route('/menu', menu);

app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
