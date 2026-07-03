import { buildApp } from './app.ts';
import { config } from './config.ts';

const app = await buildApp({ logger: true });

// 出站消息定时投递：每分钟扫一次到期消息（notify 模块的"定时重试"落地处）
const dispatcher = setInterval(() => {
  app.notify.dispatchDue().catch((err) => app.log.error(err, '出站投递失败'));
}, 60_000);
dispatcher.unref(); // 不阻止进程退出
app.addHook('onClose', async () => clearInterval(dispatcher));

await app.listen({ port: config.port, host: '0.0.0.0' });
