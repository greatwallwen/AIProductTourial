import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '会自检的 AI 工程 · 实操手册 · 工作台',
  description: '一套操作模型，三个角色镜头 · Next.js + shadcn/ui',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
