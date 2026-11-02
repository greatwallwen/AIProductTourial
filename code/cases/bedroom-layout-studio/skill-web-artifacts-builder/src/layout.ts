export type Room = { width: number; depth: number };

export type Furniture = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation?: number;
  movable?: boolean;
};

export type Opening = {
  id: string;
  type: string;
  wall: string;
  start: number;
  width: number;
  hinge?: string;
  swing?: string;
};

export type Issue = { kind: 'outside' | 'overlap' | 'door'; ids: string[] };

export function boundsOf(item: Furniture) {
  const rotated = ((item.rotation ?? 0) % 180 + 180) % 180 === 90;
  return {
    x: item.x,
    y: item.y,
    width: rotated ? item.depth : item.width,
    depth: rotated ? item.width : item.depth,
  };
}

export function overlaps(first: Furniture, second: Furniture): boolean {
  const left = boundsOf(first);
  const right = boundsOf(second);
  return left.x < right.x + right.width
    && right.x < left.x + left.width
    && left.y < right.y + right.depth
    && right.y < left.y + left.depth;
}

export function validDimensions(width: number, depth: number): boolean {
  return Number.isInteger(width) && Number.isInteger(depth)
    && width >= 20 && depth >= 20 && width <= 300 && depth <= 300;
}

export function doorBlocked(item: Furniture, room: Room, door: Opening): boolean {
  if (door.type !== 'door' || door.wall !== 'south' || door.swing !== 'inward') return false;
  const rect = boundsOf(item);
  const hingeX = door.hinge === 'right' ? door.start + door.width : door.start;
  const intersectsQuadrant = door.hinge === 'right'
    ? rect.x < hingeX && rect.x + rect.width > hingeX - door.width
    : rect.x + rect.width > hingeX && rect.x < hingeX + door.width;
  if (!intersectsQuadrant || rect.y >= room.depth || rect.y + rect.depth <= room.depth - door.width) return false;
  const distanceX = door.hinge === 'right'
    ? Math.max(hingeX - rect.x - rect.width, 0)
    : Math.max(rect.x - hingeX, 0);
  const distanceY = Math.max(room.depth - rect.y - rect.depth, 0);
  return distanceX ** 2 + distanceY ** 2 <= door.width ** 2;
}

export function analyzeLayout(room: Room, openings: Opening[], furniture: Furniture[]): Issue[] {
  const issues: Issue[] = [];
  for (const [index, item] of furniture.entries()) {
    const bounds = boundsOf(item);
    if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > room.width || bounds.y + bounds.depth > room.depth) {
      issues.push({ kind: 'outside', ids: [item.id] });
    }
    for (const opening of openings) {
      if (doorBlocked(item, room, opening)) issues.push({ kind: 'door', ids: [item.id] });
    }
    for (const other of furniture.slice(index + 1)) {
      if (overlaps(item, other)) issues.push({ kind: 'overlap', ids: [item.id, other.id] });
    }
  }
  return issues;
}
