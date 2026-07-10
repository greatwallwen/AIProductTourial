#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const probeDenied = process.argv.includes('--probe-denied');
const child = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))], { stdio: ['pipe', 'pipe', 'pipe'] });
const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
const pending = new Map();
const trace = [];
let nextId = 1;
lines.on('line', (line) => {
  const message = JSON.parse(line);
  trace.push({ direction: 'server-to-client', message });
  const waiter = pending.get(message.id);
  if (waiter) { pending.delete(message.id); waiter(message); }
});

function send(method, params) {
  const id = nextId++;
  const message = { jsonrpc: '2.0', id, method, ...(params ? { params } : {}) };
  trace.push({ direction: 'client-to-server', message });
  child.stdin.write(`${JSON.stringify(message)}\n`);
  return new Promise((resolve) => pending.set(id, resolve));
}

function notify(method) {
  const message = { jsonrpc: '2.0', method };
  trace.push({ direction: 'client-to-server', message });
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

try {
  const initialized = await send('initialize', {
    protocolVersion: '2025-11-25',
    capabilities: { roots: { listChanged: false }, sampling: {}, elicitation: { form: {} } },
    clientInfo: { name: 'course-mcp-client', version: '1.0.0' }
  });
  notify('notifications/initialized');
  const listedTools = await send('tools/list');
  const listedResources = await send('resources/list');
  const listedPrompts = await send('prompts/list');
  const call = await send('tools/call', { name: probeDenied ? 'admin_delete' : 'course_sum', arguments: { a: 7, b: 9 } });
  const denied = Boolean(call.error);
  const body = {
    schema: 'mcp-probe-trace/v1',
    protocolVersion: initialized.result?.protocolVersion,
    clientCapabilities: ['roots', 'sampling', 'elicitation.form'],
    serverCapabilities: Object.keys(initialized.result?.capabilities ?? {}),
    discoveredPrimitives: {
      tools: listedTools.result?.tools?.map((item) => item.name) ?? [],
      resources: listedResources.result?.resources?.map((item) => item.uri) ?? [],
      prompts: listedPrompts.result?.prompts?.map((item) => item.name) ?? []
    },
    probe: probeDenied ? 'undiscovered-tool' : 'allowed-tool',
    denied,
    callResult: call.result ?? call.error,
    trace,
    ok: probeDenied ? denied : call.result?.content?.[0]?.text === '16'
  };
  const traceHash = `sha256:${createHash('sha256').update(JSON.stringify(body)).digest('hex')}`;
  console.log(JSON.stringify({ ...body, traceHash }, null, 2));
  if (!body.ok) process.exitCode = 1;
} finally {
  child.stdin.end();
  child.kill();
}
