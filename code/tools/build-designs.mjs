#!/usr/bin/env node
/** 由 design/themes.json（单一来源）生成每套 DESIGN.md（voltagent 格式，人读；令牌供 React 主题化）。DRY：色板只定义一次。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..', '..');
const { themes } = JSON.parse(readFileSync(join(ROOT, 'design', 'themes.json'), 'utf8'));
for (const th of themes) {
  const t = th.t;
  const md = `# DESIGN · ${th.name}（${th.id}）

> 一套**独立**的深色大屏设计系统。与其它 design/*.md 色板/布局/气质各不相同。适用大屏范式：**${th.paradigm}**；SaaS 原型：${th.saasTypes.join('、')}。

## 视觉主题与气质
${th.mood}。整体像可交付的前端大屏截图：深色渐变底 + 玻璃拟态卡片 + 细边框 + 柔和发光 + HUD 网格 + 精密图表线条；中文短标签、真实业务数字、信息密度高、异常高亮。

## 色板与语义（hex）
- 背景：\`${t.bg}\` → \`${t.bg2}\`（近黑渐变）｜网格线 \`${t.grid}\`
- 面板/卡片：\`${t.panel}\`（次级 \`${t.panelSoft}\`）｜边框 \`${t.border}\`
- 文字：主 \`${t.ink}\`／次 \`${t.ink2}\`／弱 \`${t.muted}\`
- 数据高光：主 \`${t.accent}\`／辅 \`${t.accent2}\`
- 状态：正常 \`${t.ok}\`／预警 \`${t.warn}\`／严重 \`${t.bad}\`
- 发光：\`${t.glow}\`

## 字体层级
系统中文无衬线（PingFang SC / Microsoft YaHei）；大数字 tabular-nums；标题 650、KPI 700、标签 500；短标签避免英文乱码。

## 组件
卡片：玻璃拟态（半透明面板 + 1px 边框 + 顶部微高光）；徽章：状态色底 + 深色字；表格：细分隔线、悬停高亮、状态徽章；图表：${th.paradigm} 主图 + HUD 网格 + 发光描边。

## 布局与密度
顶部总览指标（KPI 大数字 + 趋势）→ 中部主图（${th.paradigm}）→ 底部明细表（排行/告警/时间戳）。16:9、驾驶舱高密度。

## 深度
背景网格（HUD）+ 卡片轻投影 + 数据高光发光；层次靠明度与发光，不靠重阴影。

## 响应
桌面优先（1440 基准）；网格 auto-fill；宽表 overflow-x 自滚，页面不横向滚动。
`;
  writeFileSync(join(ROOT, 'design', `${th.id}.md`), md);
}
console.log('生成 design/*.md：', themes.map(t => t.id).join(', '));
