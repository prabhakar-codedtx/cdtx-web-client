import type { Attribute, LayoutRule, Relation } from './types';

export type Axis = 'x' | 'y';
/** What part of a box an attribute is: its start edge, its end edge, its size, or its middle. */
export type Role = 'start' | 'end' | 'size' | 'center';

export const INFO: Record<Attribute, { axis: Axis; role: Role }> = {
  leading: { axis: 'x', role: 'start' },
  trailing: { axis: 'x', role: 'end' },
  width: { axis: 'x', role: 'size' },
  centerX: { axis: 'x', role: 'center' },
  top: { axis: 'y', role: 'start' },
  bottom: { axis: 'y', role: 'end' },
  height: { axis: 'y', role: 'size' },
  centerY: { axis: 'y', role: 'center' },
};

export const ATTRIBUTES = Object.keys(INFO) as Attribute[];
export const RELATIONS: Relation[] = ['eq', 'gte', 'lte'];

export const targetAttrOf = (r: LayoutRule): Attribute => r.targetAttr ?? r.attr;

/** A size read from the other axis (`width = k × height`). */
export const isCross = (r: LayoutRule) =>
  !!r.target &&
  INFO[r.attr].role === 'size' &&
  INFO[targetAttrOf(r)].role === 'size' &&
  INFO[r.attr].axis !== INFO[targetAttrOf(r)].axis;

/**
 * Why a well-formed rule has a shape that is not supported, or null when it is fine. One place, so the
 * resolver and the validator (here and on the server) agree on what is allowed.
 */
export function unsupportedReason(r: LayoutRule): string | null {
  const mine = INFO[r.attr];
  if (!r.target) return mine.role === 'size' ? null : 'needs something to relate to';
  const theirs = INFO[targetAttrOf(r)];
  const bothSize = mine.role === 'size' && theirs.role === 'size';
  const bothPlace = mine.role !== 'size' && theirs.role !== 'size' && mine.axis === theirs.axis;
  if (!bothSize && !bothPlace) return 'cannot relate to that kind of edge';
  if (r.target === r.item && !isCross(r)) return 'cannot relate to itself that way';
  if (r.relation !== 'eq' && mine.role === 'center') return 'can only be exact';
  return null;
}
