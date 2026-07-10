#!/usr/bin/env node
import readline from 'node:readline';

let initialized = false;
const tools = [{ name: 'course_sum', title: 'Course Sum', description: 'Add two bounded integers.', inputSchema: { type: 'object', properties: { a: { type: 'integer' }, b: { type: 'integer' } }, required: ['a', 'b'] } }];
const resources = [{ uri: 'course://schema/activity', name: 'Learning activity schema', mimeType: 'application/json' }];
const prompts = [{ name: 'review_loop', title: 'Review a loop trace', description: 'Structure a three-role loop review.' }];

function send(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function result(id, value) {
  send({ jsonrpc: '2.0', id, result: value });
}

function error(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', (line) => {
  let message;
  try { message = JSON.parse(line); } catch { error(null, -32700, 'parse error'); return; }
  if (message.method === 'initialize') {
    initialized = true;
    result(message.id, {
      protocolVersion: '2025-11-25',
      capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false }, prompts: { listChanged: false }, logging: {} },
      serverInfo: { name: 'course-mcp-lab', version: '1.0.0' }
    });
    return;
  }
  if (message.method === 'notifications/initialized') return;
  if (!initialized) { error(message.id, -32002, 'server is not initialized'); return; }
  if (message.method === 'tools/list') { result(message.id, { tools }); return; }
  if (message.method === 'resources/list') { result(message.id, { resources }); return; }
  if (message.method === 'prompts/list') { result(message.id, { prompts }); return; }
  if (message.method === 'resources/read' && message.params?.uri === resources[0].uri) {
    result(message.id, { contents: [{ uri: resources[0].uri, mimeType: 'application/json', text: JSON.stringify({ schema: 'learning-activity/v1' }) }] });
    return;
  }
  if (message.method === 'prompts/get' && message.params?.name === prompts[0].name) {
    result(message.id, { description: prompts[0].description, messages: [{ role: 'user', content: { type: 'text', text: 'Review goal, evidence, stop rule, and residual risk.' } }] });
    return;
  }
  if (message.method === 'tools/call') {
    if (message.params?.name !== tools[0].name) { error(message.id, -32601, 'tool was not discovered or allowed'); return; }
    const { a, b } = message.params.arguments ?? {};
    if (![a, b].every(Number.isInteger) || Math.abs(a) > 1000 || Math.abs(b) > 1000) { error(message.id, -32602, 'invalid bounded integer arguments'); return; }
    result(message.id, { content: [{ type: 'text', text: String(a + b) }], isError: false });
    return;
  }
  error(message.id, -32601, 'method not found');
});
