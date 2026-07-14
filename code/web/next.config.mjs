/** @type {import('next').NextConfig} */
// 静态导出：Next.js 产出纯静态 out/，由 node:sqlite 后端托管（与旧 Vite dist 同模型，/api 仍走后端）。
const nextConfig = {
  output: 'export',
  distDir: 'out',
  images: { unoptimized: true },
  reactStrictMode: true,
};
export default nextConfig;
