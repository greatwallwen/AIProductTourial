import { buildApp } from './app.ts';
import { config } from './config.ts';

const app = await buildApp({ logger: true });
await app.listen({ port: config.port, host: '0.0.0.0' });
