import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import source from './room-data.json';
import { analyzeLayout, validDimensions } from './layout.ts';
import type { Furniture, Issue } from './layout.ts';
import { parseSlots } from './slots.ts';
import type { Slots } from './slots.ts';
import { RoomMap } from './RoomMap.tsx';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Input } from './components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import './studio.css';

const original: Furniture[] = source.existingFurniture.map((item) => ({ ...item, rotation: 0 }));
const storageKey = 'bedroom-web-artifacts-builder-v1';

function readSaved(): Slots {
  try { return parseSlots(localStorage.getItem(storageKey)); }
  catch { return { A: null, B: null }; }
}

function describe(issue: Issue, furniture: Furniture[]) {
  const label = (id: string) => furniture.find((item) => item.id === id)?.name ?? id;
  if (issue.kind === 'outside') return `${label(issue.ids[0])}超出房间边界`;
  if (issue.kind === 'door') return `${label(issue.ids[0])}进入房门开启范围`;
  return `${label(issue.ids[0])}与${label(issue.ids[1])}重叠`;
}

async function downloadComparison(slots: Slots) {
  if (!slots.A || !slots.B) return;
  const maps = document.querySelectorAll<SVGSVGElement>('svg[data-saved-map="true"]');
  if (maps.length !== 2) throw new Error('请先保存方案 A 和 B');
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 735;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法创建 PNG 画布');
  context.fillStyle = '#f1f4ef';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#284240';
  context.font = 'bold 31px sans-serif';
  context.fillText('一间卧室，两份试摆记录', 48, 58);
  context.font = '16px sans-serif';
  context.fillText('模拟尺寸 · 只核对平面越界、重叠与房门开启范围', 48, 88);
  for (const [index, map] of Array.from(maps).entries()) {
    const image = new Image();
    const serialized = new XMLSerializer().serializeToString(map);
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('无法生成房间平面图'));
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
    });
    const left = 48 + index * 614;
    context.fillStyle = '#fff';
    context.fillRect(left, 115, 567, 555);
    context.drawImage(image, left + 10, 120, 547, 462);
    context.fillStyle = '#284240';
    context.font = 'bold 21px sans-serif';
    context.fillText(`方案 ${index ? 'B' : 'A'} · ${index ? slots.B.label : slots.A.label}`, left + 20, 630);
  }
  context.fillStyle = '#506b65';
  context.font = '15px sans-serif';
  context.fillText('这不是自动选出的最优布局；购买前请实测尺寸与通道。', 48, 708);
  const link = document.createElement('a');
  link.download = '卧室家具试摆-技能版对比.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export default function App() {
  const [furniture, setFurniture] = useState<Furniture[]>(original);
  const [selectedId, setSelectedId] = useState('');
  const [slots, setSlots] = useState<Slots>(readSaved);
  const [newName, setNewName] = useState('我的家具');
  const [width, setWidth] = useState('110');
  const [depth, setDepth] = useState('55');
  const [message, setMessage] = useState('');
  const [exportError, setExportError] = useState('');
  const chosen = furniture.find((item) => item.id === 'candidate');
  const selected = furniture.find((item) => item.id === selectedId);
  const issues = analyzeLayout(source.room, source.openings, furniture);
  const invalid = new Set(issues.flatMap((issue) => issue.ids));

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(slots)); }
    catch { return; }
  }, [slots]);

  function updatePosition(id: string, x: number, y: number) {
    setFurniture((items) => items.map((item) => item.id === id ? { ...item, x, y } : item));
  }

  function rotate(id: string) {
    setFurniture((items) => items.map((item) => item.id === id ? { ...item, rotation: item.rotation === 90 ? 0 : 90 } : item));
    setSelectedId(id);
  }

  function addItem(name: string, itemWidth: number, itemDepth: number) {
    const candidate: Furniture = {
      id: 'candidate', name, x: 230, y: 105,
      width: itemWidth, depth: itemDepth, rotation: 0,
    };
    setFurniture((items) => [...items.filter((item) => item.id !== 'candidate'), candidate]);
    setSelectedId('candidate');
    setMessage('');
  }

  function addCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const itemWidth = Number(width);
    const itemDepth = Number(depth);
    if (!newName.trim() || !validDimensions(itemWidth, itemDepth)) {
      setMessage('请填写名称，以及 20–300 cm 的整数宽、深。');
      return;
    }
    addItem(newName.trim().slice(0, 20), itemWidth, itemDepth);
  }

  function save(slot: 'A' | 'B') {
    if (!chosen || issues.length) return;
    const items = furniture.map((item) => ({ ...item }));
    setSlots((previous) => ({ ...previous, [slot]: { label: chosen.name, items } }));
  }

  function restore(slot: 'A' | 'B') {
    if (!slots[slot]) return;
    setFurniture(slots[slot].items.map((item) => ({ ...item })));
    setSelectedId('candidate');
  }

  return <div className="studio-page">
    <header className="studio-header">
      <div className="brand-block"><span className="brand-symbol" aria-hidden="true">▦</span><span><strong>卧室试摆</strong><small>同一间房，先试再买</small></span></div>
      <Badge variant="outline" className="studio-badge">模拟数据 · 离线可用</Badge>
    </header>
    <main className="studio-main">
      <div className="lead">
        <div><h1>书桌放在哪里，亲手试一试。</h1><p>选择一张桌子，在平面图上拖动或旋转。出现几何冲突时先调整，再保存两种摆法。</p></div>
        <div className="dimension"><strong>420 × 330</strong><span>房间尺寸 / cm</span></div>
      </div>
      <div className="studio-workspace">
        <Card className="studio-card furniture-panel">
          <CardHeader><CardTitle>加入家具</CardTitle><p className="panel-subtitle">三张书桌选一张，或填自己的尺寸。</p></CardHeader>
          <CardContent className="furniture-body">
            <div className="catalog">
              {source.candidateFurniture.map((item) => <Button
                key={item.id}
                type="button"
                variant="outline"
                className={`candidate-button${chosen?.name === item.name ? ' active' : ''}`}
                onClick={() => addItem(item.name, item.width, item.depth)}
              ><span>{item.name}<small>{item.width} × {item.depth} cm</small></span><span aria-hidden="true">＋</span></Button>)}
            </div>
            <form className="custom-form" onSubmit={addCustom} noValidate>
              <h3>或者，输入一件家具</h3>
              <label htmlFor="new-name">名称</label><Input id="new-name" maxLength={20} value={newName} onChange={(event) => setNewName(event.target.value)} />
              <div className="size-fields">
                <div><label htmlFor="new-width">宽 / cm</label><Input id="new-width" type="number" inputMode="numeric" min="20" max="300" step="1" value={width} onChange={(event) => setWidth(event.target.value)} /></div>
                <div><label htmlFor="new-depth">深 / cm</label><Input id="new-depth" type="number" inputMode="numeric" min="20" max="300" step="1" value={depth} onChange={(event) => setDepth(event.target.value)} /></div>
              </div>
              {message && <p className="form-error" role="alert">{message}</p>}
              <Button type="submit" className="full-width">加入房间</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="studio-card map-panel">
          <CardHeader className="map-heading"><CardTitle>可操作的平面图</CardTitle><span>图上点选 · 旋转 · 拖动</span></CardHeader>
          <CardContent className="map-body">
            <RoomMap items={furniture} selected={selectedId} invalid={invalid} onSelect={setSelectedId} onMove={updatePosition} onRotate={rotate} />
          </CardContent>
          <div className="map-foot"><span>方向键移动 5 cm；按住 Shift 移动 10 cm。窗宽 130 cm，门宽 80 cm。</span><Button type="button" variant="link" onClick={() => { setFurniture(original); setSelectedId(''); }}>恢复原始布局</Button></div>
        </Card>

        <Card className="studio-card review-panel">
          <CardHeader><CardTitle>核对与保存</CardTitle><p className="panel-subtitle">只有当前摆法无几何冲突时才能保存。</p></CardHeader>
          <CardContent className="review-body">
            {selected ? <section className="selected-item"><span>当前选中</span><strong>{selected.name}</strong><p>{selected.width} × {selected.depth} cm · {selected.rotation ? '已旋转 90°' : '原方向'}</p><p>位置：横向 {selected.x} cm，纵向 {selected.y} cm</p>
              <div className="nudge"><Button variant="outline" size="sm" aria-label="向左移动选中家具五厘米" onClick={() => updatePosition(selected.id, selected.x - 5, selected.y)}>←</Button><Button variant="outline" size="sm" aria-label="向右移动选中家具五厘米" onClick={() => updatePosition(selected.id, selected.x + 5, selected.y)}>→</Button><Button variant="outline" size="sm" aria-label="向上移动选中家具五厘米" onClick={() => updatePosition(selected.id, selected.x, selected.y - 5)}>↑</Button><Button variant="outline" size="sm" aria-label="向下移动选中家具五厘米" onClick={() => updatePosition(selected.id, selected.x, selected.y + 5)}>↓</Button></div>
            </section> : <p className="selection-empty">点一下图上的家具，旋转按钮就出现在它旁边。</p>}
            <Alert variant={issues.length ? 'destructive' : 'default'} className="status-alert"><AlertTitle>{issues.length ? `${issues.length} 处需要调整` : chosen ? '当前摆法可保存' : '先选择一张书桌'}</AlertTitle><AlertDescription>{issues.length ? issues.map((issue, index) => <p key={`${issue.kind}-${index}`}>{describe(issue, furniture)}</p>) : chosen ? '已检查越界、家具重叠和门扇开启范围。' : '床、衣柜和床头柜已放在房间里。'}</AlertDescription></Alert>
            <div className="save-buttons"><Button type="button" variant="outline" disabled={!chosen || !!issues.length} onClick={() => save('A')}>保存为方案 A</Button><Button type="button" variant="outline" disabled={!chosen || !!issues.length} onClick={() => save('B')}>保存为方案 B</Button></div>
          </CardContent>
        </Card>
      </div>

      <section className="compare" aria-label="已保存方案对照">
        <div className="compare-heading"><div><h2>两种摆法，并排核对</h2><p>保存的是具体家具和位置。可以恢复继续调整；页面不会替你选出“最好”的方案。</p></div><Button type="button" disabled={!slots.A || !slots.B} onClick={() => { setExportError(''); void downloadComparison(slots).catch((error: unknown) => setExportError(error instanceof Error ? error.message : '无法导出 PNG')); }}>导出两方案 PNG</Button></div>
        {exportError && <p className="form-error" role="alert">{exportError}</p>}
        <div className="snapshot-grid">{(['A', 'B'] as const).map((slot) => <Card className="snapshot" key={slot}><CardHeader><CardTitle>方案 {slot}</CardTitle><Badge variant="outline">{slots[slot]?.label ?? '尚未保存'}</Badge></CardHeader><CardContent>{slots[slot] ? <><RoomMap items={slots[slot].items} compact saved /><Button variant="link" type="button" onClick={() => restore(slot)}>恢复方案 {slot} 继续编辑</Button></> : <p>先在上方试摆，再保存为方案 {slot}。</p>}</CardContent></Card>)}</div>
      </section>
      <footer>课程模拟输入，非真实户型测绘。几何无冲突不等于家具能够搬进门、满足通道、插座或安装要求；购买前请实测。</footer>
    </main>
  </div>;
}
