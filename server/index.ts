import './env';
import express, { type Response, type NextFunction, type Request } from 'express';
import { DBOS } from '@dbos-inc/dbos-sdk';
import type { Entry } from '../harness/types';
import { subscribe } from '../harness/bus';
import { runAgentWorkflow } from '../harness/runtime';
import { ensureSchema, clearEventLog, getEventsAfter } from '../harness/db';
import { runSupervisorWorkflow } from '../harness/supervisor';
import type { HttpError } from './types';

const PORT = Number(process.env.PORT ?? 8787);

const HEARTBEAT_INTERVAL_MS = 20_000;

function writeEntry(res: Response, entry: Entry) {
  res.write(`id: ${entry.seq}\ndata: ${JSON.stringify(entry.data)}\n\n`);
}

async function main() {
  await ensureSchema();

  DBOS.setConfig({
    name: 'harness',
    systemDatabaseUrl: process.env.DBOS_SYSTEM_DATABASE_URL,
  });
  await DBOS.launch();

  const app = express();

  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/events', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const heartbeatInterval = setInterval(() => {
      res.write(': ping\n\n');
    }, HEARTBEAT_INTERVAL_MS);

    const buffer: Array<Entry> = [];
    const numberedLastSentHeader = Number(req.header('Last-Event-ID'));

    let replaying = true;
    let lastSent = Number.isFinite(numberedLastSentHeader) ? numberedLastSentHeader : 0;

    const unsubscribe = subscribe((entry) => {
      if (replaying) {
        buffer.push(entry);
      } else {
        writeEntry(res, entry);
      }
    });

    res.on('close', () => {
      console.log('connection closed');

      clearInterval(heartbeatInterval);

      unsubscribe();
    });

    try {
      const rows = await getEventsAfter(lastSent);

      for (const row of rows) {
        writeEntry(res, row);

        lastSent = row.seq;
      }
    } catch (err) {
      console.error('Error fetching events after', lastSent, err);

      res.end();

      return;
    }

    for (const bufferedEntry of buffer) {
      if (bufferedEntry.seq > lastSent) {
        writeEntry(res, bufferedEntry);

        lastSent = bufferedEntry.seq;
      }
    }

    replaying = false;
  });

  app.post('/api/clear', async (_req, res) => {
    await clearEventLog();

    res.json({ ok: true });
  });

  app.post('/api/approve/:workflowId', async (req, res) => {
    const approved = Boolean(req.body?.approved);

    await DBOS.send(req.params.workflowId, { approved }, 'approval');

    res.json({ ok: true });
  });

  app.post('/api/tasks', async (req, res) => {
    if (!req.body) {
      res.status(400).json({ error: 'Missing request body' });
      return;
    }

    const { input, mode = 'default' } = req.body;

    if (!['supervised', 'default'].includes(mode)) {
      res.status(400).json({ error: 'Invalid mode' });
      return;
    }

    if (typeof input !== 'string' || input.trim() === '') {
      res.status(400).json({ error: 'Input must be a non-empty string' });
      return;
    }

    const workflow = mode === 'supervised' ? runSupervisorWorkflow : runAgentWorkflow;

    try {
      const { workflowID } = await DBOS.startWorkflow(workflow)({ input: input.trim() });

      res.status(202).json({ workflowID });
    } catch (err) {
      console.error('Error starting workflow', err);

      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.use((err: HttpError, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Malformed JSON body' });
      return;
    }

    const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;

    if (status === 500) {
      console.error('Unhandled error', err);
    }

    res.status(status).json({ error: status === 500 ? 'Internal Server Error' : err.message });
  });

  app.listen(PORT, () => {
    console.log(`harness server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
