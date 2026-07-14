'use client';
import { HashRouter } from 'react-router-dom';
import App from './App';
// Next.js 客户端挂载点：沿用 HashRouter 客户端路由（#/case/NN），SPA 逻辑不变、截图 URL 不变。
export default function NextApp() {
  return (<HashRouter><App /></HashRouter>);
}
