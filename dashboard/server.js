import express from 'express';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readDotEnv(filePath) {
  try {
    return Object.fromEntries(
      fs.readFileSync(filePath, 'utf8')
        .split('\n')
        .filter(l => l.includes('='))
        .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
    );
  } catch { return {}; }
}

const env = readDotEnv(path.join(__dirname, '../mcp-server/.env'));
const NEO4J_USER = env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = env.NEO4J_PASSWORD || '';
const GATEWAY_LOG = path.join(process.env.HOME, '.hermes/logs/gateway.log');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const clients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  clients.add(res);
  req.on('close', () => clients.delete(res));
  doHealthChecks();
  doNeo4jStats();
});

function checkTCP(port, timeout = 1500) {
  return new Promise(resolve => {
    const s = new net.Socket();
    let done = false;
    const finish = ok => { if (!done) { done = true; s.destroy(); resolve(ok); } };
    s.setTimeout(timeout);
    s.on('connect', () => finish(true));
    s.on('timeout', () => finish(false));
    s.on('error', () => finish(false));
    s.connect(port, '127.0.0.1');
  });
}

function checkHermes() {
  return new Promise(resolve => {
    execFile('pgrep', ['-f', 'hermes'], (_err, stdout) => {
      resolve(stdout.trim().length > 0 ? 'online' : 'offline');
    });
  });
}

async function doHealthChecks() {
  const [gateway, mcp, n8n, neo4j] = await Promise.all([
    checkHermes(),
    checkTCP(3000).then(ok => ok ? 'online' : 'offline'),
    checkTCP(5678).then(ok => ok ? 'online' : 'offline'),
    checkTCP(7474).then(ok => ok ? 'online' : 'offline'),
  ]);
  broadcast('health', { gateway, mcp, n8n, neo4j });
}

async function doNeo4jStats() {
  const auth = Buffer.from(`${NEO4J_USER}:${NEO4J_PASSWORD}`).toString('base64');
  const query = async statement => {
    const r = await fetch('http://localhost:7474/db/neo4j/tx/commit', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ statements: [{ statement }] }),
      signal: AbortSignal.timeout(3000),
    });
    const d = await r.json();
    return d.results?.[0]?.data?.[0]?.row?.[0] ?? 0;
  };

  try {
    const [plants, chunks, relations] = await Promise.all([
      query('MATCH (p:Plant) RETURN count(p)'),
      query('MATCH (c:Chunk) RETURN count(c)'),
      query('MATCH ()-[r]->() RETURN count(r)'),
    ]);
    broadcast('stats', { plants, chunks, relations });
  } catch { /* Neo4j offline */ }
}

let logPosition = 0;
try { logPosition = fs.statSync(GATEWAY_LOG).size; } catch { /* log not yet created */ }

function tailLog() {
  let stat;
  try { stat = fs.statSync(GATEWAY_LOG); } catch { return; }

  if (stat.size < logPosition) logPosition = 0;
  if (stat.size === logPosition) return;

  const buf = Buffer.alloc(stat.size - logPosition);
  const fd = fs.openSync(GATEWAY_LOG, 'r');
  fs.readSync(fd, buf, 0, buf.length, logPosition);
  fs.closeSync(fd);
  logPosition = stat.size;

  for (const line of buf.toString('utf8').split('\n').filter(Boolean)) {
    const inbound = line.match(/inbound message:.*?user=(\S+).*?msg='(.+)'/);
    if (inbound) {
      broadcast('log', {
        type: 'inbound',
        user: inbound[1],
        msg: inbound[2],
        time: new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      continue;
    }
    const response = line.match(/response ready:.*?time=(\S+)\s+api_calls=(\d+)/);
    if (response) {
      broadcast('log', {
        type: 'response',
        time_taken: response[1],
        api_calls: parseInt(response[2]),
        time: new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    }
  }
}

setInterval(doHealthChecks, 5000);
setInterval(doNeo4jStats, 30000);
setInterval(tailLog, 1000);

app.listen(3001, () => console.log('Dashboard: http://localhost:3001'));
