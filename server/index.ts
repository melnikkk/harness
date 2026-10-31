import './env';
import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { DBOS } from '@dbos-inc/dbos-sdk';
import { type ClientMessage } from '@shared/events';
import { subscribe, history } from '../harness/bus';
import { runAgentWorkflow } from '../harness/runtime';
import { ensureSchema, clearEventLog } from '../harness/db';
import { runSupervisorWorkflow } from '../harness/supervisor';

const PORT = Number(process.env.PORT ?? 8787);

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

  app.post('/api/clear', async (_req, res) => {
    await clearEventLog();

    res.json({ ok: true });
  });

  app.post('/api/approve/:workflowId', async (req, res) => {
    const approved = Boolean(req.body?.approved);

    await DBOS.send(req.params.workflowId, { approved }, 'approval');

    res.json({ ok: true });
  });

  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  subscribe((event) => {
    const data = JSON.stringify(event);

    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(data);
      }
    }
  });

  wss.on('connection', async (socket: WebSocket) => {
    socket.on('message', async (raw) => {
      let clientMessage: ClientMessage;
      try {
        clientMessage = JSON.parse(raw.toString());
      } catch {
        return; // ignore anything that isn't valid JSON
      }

      if (clientMessage.type === 'submit_task') {
        const workflow =
          clientMessage.mode === 'supervised' ? runSupervisorWorkflow : runAgentWorkflow;

        await DBOS.startWorkflow(workflow)({ input: clientMessage.input });
      }
    });

    for (const event of await history()) {
      socket.send(JSON.stringify(event));
    }
  });

  server.listen(PORT, () => {
    console.log(`harness server listening on http://localhost:${PORT}  (ws: /ws)`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
