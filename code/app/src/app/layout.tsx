import type { Metadata } from "next";
import "@course-ai-product/design-system/tokens.css";
import "driver.js/dist/driver.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 时代产品工程",
  description: "从业务问题到可验证智能系统的案例工作台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
