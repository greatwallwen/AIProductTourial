'use client';
import dynamic from 'next/dynamic';
// 客户端专属挂载（HashRouter 依赖 window）——静态导出下页面壳预渲染、客户端 hydrate 后挂载 SPA。
const NextApp = dynamic(() => import('../src/NextApp'), { ssr: false });
export default function Page() {
  return <NextApp />;
}
