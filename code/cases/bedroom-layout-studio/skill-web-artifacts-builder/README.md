# 卧室家具试摆：web-artifacts-builder 最终页面

直接用浏览器打开 [bundle.html](bundle.html)，即可离线拖动、旋转家具，比较两种摆法并导出 PNG；不需要安装依赖。它是 2026-10-29 在隔离工程中运行原始 Skill 初始化及打包脚本制作的最终交付页面。固定模拟房间数据和几何判断来自人工编写的案例规则，不属于 Skill 自动生成的户型测量或布局算法。

工程保留初始化脚本生成的 React、TypeScript、shadcn/ui 组件及锁文件，新增交互主要在 `src/App.tsx`、`src/RoomMap.tsx`、`src/slots.ts`、`src/studio.css`；原 Skill 的文件在仓库 `skills/external/anthropics/web-artifacts-builder/`，没有改写其脚本。实际输入、运行日志、截图、下载的 PNG 和浏览器验收结果在 [运行证据](../../../../assets/skill-bedroom-layout/skill-run/README.md)。此工程未附带 `node_modules` 或可重新生成的 `dist`。

## 从源码构建

需要 Node.js 24、pnpm 11；安装依赖会访问软件源，可能执行包管理器允许的安装步骤，先审查依赖和脚本。已保存可直接打开的成品，不需要为了试用而运行这些命令。

```bash
pnpm install --frozen-lockfile
pnpm exec tsc -b
node --test tests/slots.test.mjs
bash ../../../../skills/external/anthropics/web-artifacts-builder/scripts/bundle-artifact.sh
```

本轮原脚本在隔离工程中运行时因源不可达改用镜像；pnpm 11 第一次在严格依赖构建策略下中断打包，后以 `PNPM_CONFIG_STRICT_DEP_BUILDS=false` 继续，但**没有批准**执行提示的四个第三方原生构建脚本。复跑时应按本机 pnpm 的提示检查配置，不要为了重建页面直接全局放开依赖构建。浮动依赖这次实际装到 React 19、TypeScript 7，工程的 `tsconfig.app.json` 为此排除了两个未使用但类型不兼容的上游 UI 组件；不保证未来重新安装浮动版本仍得到相同结果。
