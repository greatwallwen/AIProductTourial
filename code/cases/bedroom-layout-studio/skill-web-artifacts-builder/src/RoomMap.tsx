import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import source from './room-data.json';
import { boundsOf } from './layout.ts';
import type { Furniture } from './layout.ts';

type Props = {
  items: Furniture[];
  selected?: string;
  invalid?: Set<string>;
  compact?: boolean;
  saved?: boolean;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onRotate?: (id: string) => void;
};

type Drag = { id: string; offsetX: number; offsetY: number };
const room = source.room;
const door = source.openings.find((opening) => opening.type === 'door')!;
const windowOpening = source.openings.find((opening) => opening.type === 'window')!;

export function RoomMap({ items, selected, invalid = new Set(), compact = false, saved = false, onSelect, onMove, onRotate }: Props) {
  const drawing = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const active = items.find((item) => item.id === selected);

  function position(event: PointerEvent<SVGElement>) {
    const svg = drawing.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  }

  function start(event: PointerEvent<SVGGElement>, item: Furniture) {
    if (!onMove) return;
    const point = position(event);
    if (!point) return;
    drag.current = { id: item.id, offsetX: point.x - item.x, offsetY: point.y - item.y };
    onSelect?.(item.id);
    drawing.current?.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    const point = position(event);
    if (!current || !point) return;
    onMove?.(current.id, Math.round((point.x - current.offsetX) / 5) * 5, Math.round((point.y - current.offsetY) / 5) * 5);
  }

  function keyMove(event: KeyboardEvent<SVGGElement>, item: Furniture) {
    const distance = event.shiftKey ? 10 : 5;
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-distance, 0], ArrowRight: [distance, 0],
      ArrowUp: [0, -distance], ArrowDown: [0, distance],
    };
    const direction = directions[event.key];
    if (!direction || !onMove) return;
    onMove(item.id, item.x + direction[0], item.y + direction[1]);
    onSelect?.(item.id);
    event.preventDefault();
  }

  const selectedBounds = active && boundsOf(active);
  const rotateX = active && selectedBounds
    ? Math.min(Math.max(active.x + selectedBounds.width / 2 - 36, 0), room.width - 72)
    : 0;
  const rotateY = active && selectedBounds
    ? active.y + selectedBounds.depth + 8 < room.depth - 40
      ? active.y + selectedBounds.depth + 8 : Math.max(active.y - 40, 3)
    : 0;

  return <svg
    ref={drawing}
    className="room-map"
    viewBox="-30 -33 480 403"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    data-saved-map={saved ? 'true' : undefined}
    aria-label={`模拟卧室平面图，${room.width}乘${room.depth}厘米，${items.map((item) => item.name).join('、')}`}
    onPointerMove={move}
    onPointerUp={() => { drag.current = null; }}
    onPointerCancel={() => { drag.current = null; }}
  >
    <rect x="-30" y="-33" width="480" height="403" fill="#f7f8f5" />
    <rect x="0" y="0" width={room.width} height={room.depth} fill="#fffef9" />
    <g stroke="#e4e9df" strokeWidth=".8" pointerEvents="none">
      {Array.from({ length: Math.floor(room.width / 50) }, (_, index) => <path key={`x-${index}`} d={`M${(index + 1) * 50} 0 V${room.depth}`} />)}
      {Array.from({ length: Math.floor(room.depth / 50) }, (_, index) => <path key={`y-${index}`} d={`M0 ${(index + 1) * 50} H${room.width}`} />)}
    </g>
    <path d={`M${door.start} ${room.depth} V${room.depth - door.width} A${door.width} ${door.width} 0 0 1 ${door.start + door.width} ${room.depth} Z`} fill="#eab79866" />
    <path d={`M0 0 H${windowOpening.start} M${windowOpening.start + windowOpening.width} 0 H${room.width} V${room.depth} M${room.width} ${room.depth} H${door.start + door.width} M${door.start} ${room.depth} H0 V0`} fill="none" stroke="#243f3d" strokeWidth="5" />
    <path d={`M${windowOpening.start} 0 H${windowOpening.start + windowOpening.width}`} stroke="#3e9caa" strokeWidth="6" />
    <path d={`M${door.start + door.width} ${room.depth} A${door.width} ${door.width} 0 0 0 ${door.start} ${room.depth - door.width}`} fill="none" stroke="#ba8265" strokeWidth="1.4" strokeDasharray="5 3" />
    <text x="210" y="-16" textAnchor="middle" fontSize="12" fontWeight="700" fill="#375451">420 cm</text>
    <text x="225" y="-4" textAnchor="middle" fontSize="9" fill="#287b8b">窗 130 cm</text>
    <text x="-16" y="165" textAnchor="middle" transform="rotate(-90 -16 165)" fontSize="12" fontWeight="700" fill="#375451">330 cm</text>
    <text x="360" y="350" textAnchor="middle" fontSize="10" fill="#925c42">门 80 cm</text>
    <text x="8" y="350" fontSize="9" fill="#84918b">网格 50 cm</text>
    {items.map((item) => {
      const bounds = boundsOf(item);
      const isSelected = selected === item.id && !compact;
      const isInvalid = invalid.has(item.id);
      const furnitureFill = isInvalid ? '#fae4dd' : item.id === 'candidate' ? '#e9efc3'
        : item.id === 'bed' ? '#cbe0dc' : item.id === 'wardrobe' ? '#dcd1b8' : '#eee0c9';
      const outline = isInvalid ? '#b74f40' : isSelected ? '#277e80' : '#7f998f';
      return <g
        key={item.id}
        tabIndex={onMove ? 0 : undefined}
        role={onMove ? 'button' : undefined}
        aria-label={onMove ? `${item.name}，位置横向${item.x}厘米、纵向${item.y}厘米；方向键移动` : undefined}
        aria-pressed={onMove ? isSelected : undefined}
        onPointerDown={(event) => start(event, item)}
        onFocus={() => onSelect?.(item.id)}
        onKeyDown={(event) => keyMove(event, item)}
        style={{ touchAction: 'none', cursor: onMove ? 'grab' : 'default' }}
      >
        <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.depth} rx="4" fill={furnitureFill} stroke={outline} strokeWidth={isSelected || isInvalid ? 3 : 1.6} />
        {item.id === 'bed' && <g stroke="#87b3ad" strokeWidth="1.4" fill="#f6f8f2" pointerEvents="none" transform={item.rotation === 90 ? `translate(${item.x + item.depth} ${item.y}) rotate(90)` : `translate(${item.x} ${item.y})`}>
          <rect x="12" y="13" width="55" height="28" rx="4" />
          <rect x="82" y="13" width="55" height="28" rx="4" />
          <path d={`M6 53 H${item.width - 6}`} />
        </g>}
        <text x={bounds.x + bounds.width / 2} y={bounds.y + bounds.depth / 2} dominantBaseline="middle" textAnchor="middle" fontSize={bounds.width < 60 ? 8 : compact ? 9 : 11} fontWeight="700" fill="#2c4444" pointerEvents="none">{item.name}</text>
        {bounds.depth >= 42 && <text x={bounds.x + bounds.width / 2} y={bounds.y + bounds.depth / 2 + 16} textAnchor="middle" fontSize="8" fill="#55645c" pointerEvents="none">{item.width} × {item.depth}</text>}
      </g>;
    })}
    {active && !compact && <g
      role="button"
      tabIndex={0}
      aria-label={`旋转${active.name} 90°`}
      transform={`translate(${rotateX} ${rotateY})`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => onRotate?.(active.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onRotate?.(active.id);
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <rect width="72" height="38" rx="6" fill="#255b58" stroke="#fff" strokeWidth="2" />
      <text x="36" y="19" dominantBaseline="middle" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" pointerEvents="none">↻ 90°</text>
    </g>}
  </svg>;
}
