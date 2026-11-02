import source from './room-data.json' with { type: 'json' };
import { analyzeLayout, validDimensions } from './layout.ts';
import type { Furniture } from './layout.ts';

export type Snapshot = { label: string; items: Furniture[] };
export type Slots = { A: Snapshot | null; B: Snapshot | null };

const empty = (): Slots => ({ A: null, B: null });
const existing = source.existingFurniture;

function parseSlot(value: unknown): Snapshot | null {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as Partial<Snapshot>;
  if (typeof snapshot.label !== 'string' || !Array.isArray(snapshot.items) || snapshot.items.length !== 4) return null;
  const items = snapshot.items as Furniture[];
  if (!items.every((item) => item && typeof item.id === 'string'
    && typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 30
    && validDimensions(item.width, item.depth)
    && Number.isFinite(item.x) && Number.isFinite(item.y)
    && (item.rotation === 0 || item.rotation === 90))) return null;
  if (new Set(items.map((item) => item.id)).size !== 4
    || !existing.every((item) => items.some((saved) => saved.id === item.id
      && saved.name === item.name && saved.width === item.width && saved.depth === item.depth))
    || items.find((item) => item.id === 'candidate')?.name !== snapshot.label
    || analyzeLayout(source.room, source.openings, items).length) return null;
  return { label: snapshot.label, items };
}

export function parseSlots(raw: string | null): Slots {
  if (!raw) return empty();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return empty();
    const slots = value as Record<'A' | 'B', unknown>;
    return { A: parseSlot(slots.A), B: parseSlot(slots.B) };
  } catch {
    return empty();
  }
}
