import { INFO, isCross, targetAttrOf, unsupportedReason, type Axis, type Role } from './attributes';
import type { Diagnostic, LayoutItem, LayoutRule, ResolveInput, ResolveResult } from './types';

/**
 * Works out where every item of one container goes from its layout rules.
 *
 * Not a general constraint solver. Each axis is solved item by item, in dependency order (an item is
 * placed after the items it points at), by one fixed procedure:
 *
 *  1. Equalities fix the position and, when two of them agree on an axis (or one is a size), the size.
 *     An item with no equality keeps its natural (hug) size and its saved position.
 *  2. Size limits: `≥` and `≤` clamp the size; when they contradict each other the minimum wins, like
 *     CSS `min-width` over `max-width`.
 *  3. Edge limits: an item that is free to move is shifted to satisfy them (and shrunk only if it
 *     cannot fit); one anchored by an equality gives way in its size instead (centred: symmetrically).
 *  4. Whatever a rule still asks for that cannot hold is reported as a diagnostic, never silently dropped.
 *
 * Rules that point at nothing, at each other in a loop, or that have a shape the resolver does not
 * handle are ignored and reported. Pure: no DOM, no storage.
 */

interface Span {
  start: number;
  size: number;
}

const EPS = 0.01;

const roleValue = (s: Span, role: Role): number =>
  role === 'start'
    ? s.start
    : role === 'end'
      ? s.start + s.size
      : role === 'center'
        ? s.start + s.size / 2
        : s.size;

/** Drops the rules that cannot be used, saying why. */
function screen(rules: LayoutRule[], ids: Set<string>, diagnostics: Diagnostic[]): LayoutRule[] {
  const seen = new Set<string>();
  const out: LayoutRule[] = [];
  const reject = (kind: Diagnostic['kind'], r: LayoutRule, message: string) =>
    diagnostics.push({ kind, rules: [r.id], message });
  for (const r of rules) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    if (!ids.has(r.item)) {
      reject('missing-target', r, `Rule ${r.id} belongs to an item that is not on this block.`);
      continue;
    }
    if (r.target && r.target !== 'parent' && !ids.has(r.target)) {
      reject('missing-target', r, `Rule ${r.id} points at an item that is no longer here.`);
      continue;
    }
    const why = unsupportedReason(r);
    if (why) reject('unsupported', r, `Rule ${r.id}: ${r.attr} ${why}.`);
    else out.push(r);
  }
  return out;
}

/**
 * `width = k × height` on an item whose width is already fixed by its edges means its height follows
 * the width. Xcode solves that as one equation; here it is turned round so it can be read in order.
 */
function turnAspectRules(rules: LayoutRule[]): LayoutRule[] {
  const fixedByEdges = (item: string, axis: Axis) =>
    rules.filter(
      (r) =>
        r.item === item && r.relation === 'eq' && INFO[r.attr].axis === axis && INFO[r.attr].role !== 'size',
    ).length >= 2;
  return rules.map((r) => {
    const m = r.multiplier ?? 1;
    if (r.relation !== 'eq' || r.target !== r.item || !isCross(r) || m === 0) return r;
    if (!fixedByEdges(r.item, INFO[r.attr].axis)) return r;
    return { ...r, attr: targetAttrOf(r), targetAttr: r.attr, multiplier: 1 / m, constant: -r.constant / m };
  });
}

/** Items in an order where each comes after the items its rules point at. Rules that loop are dropped. */
function orderItems(
  items: LayoutItem[],
  rules: LayoutRule[],
  diagnostics: Diagnostic[],
): { order: string[]; rules: LayoutRule[] } {
  const depsOf = (rs: LayoutRule[]) => {
    const deps = new Map<string, Set<string>>(items.map((i) => [i.id, new Set<string>()]));
    for (const r of rs)
      if (r.target && r.target !== 'parent' && r.target !== r.item) deps.get(r.item)!.add(r.target);
    return deps;
  };
  const run = (rs: LayoutRule[]) => {
    const deps = depsOf(rs);
    const order: string[] = [];
    const done = new Set<string>();
    for (;;) {
      const ready = items.filter((i) => !done.has(i.id) && [...deps.get(i.id)!].every((d) => done.has(d)));
      if (!ready.length) break;
      for (const i of ready) {
        order.push(i.id);
        done.add(i.id);
      }
    }
    return { order, stuck: new Set(items.filter((i) => !done.has(i.id)).map((i) => i.id)) };
  };
  let { order, stuck } = run(rules);
  if (!stuck.size) return { order, rules };
  const loop = rules.filter(
    (r) => stuck.has(r.item) && r.target && stuck.has(r.target) && r.target !== r.item,
  );
  diagnostics.push({
    kind: 'cycle',
    rules: loop.map((r) => r.id),
    message: `These rules depend on each other in a loop: ${loop.map((r) => r.id).join(', ')}.`,
  });
  const kept = rules.filter((r) => !loop.includes(r));
  ({ order, stuck } = run(kept));
  return { order, rules: kept };
}

interface Entry {
  r: LayoutRule;
  v: number;
}
type Bucket = Record<Role, Entry[]>;
const bucket = (): Bucket => ({ start: [], end: [], size: [], center: [] });
const max = (es: Entry[]) => (es.length ? Math.max(...es.map((e) => e.v)) : undefined);
const min = (es: Entry[]) => (es.length ? Math.min(...es.map((e) => e.v)) : undefined);
const ids = (...lists: Entry[][]) => lists.flat().map((e) => e.r.id);

/** One item on one axis. */
function solveAxis(
  itemId: string,
  natural: number,
  origin: number,
  rules: LayoutRule[],
  bound: (r: LayoutRule) => number | undefined,
  diagnostics: Diagnostic[],
): Span {
  const eq = bucket();
  const ge = bucket();
  const le = bucket();
  for (const r of rules) {
    const v = bound(r);
    if (v === undefined) continue;
    (r.relation === 'eq' ? eq : r.relation === 'gte' ? ge : le)[INFO[r.attr].role].push({ r, v });
  }
  const conflict = (rs: string[], message: string) =>
    diagnostics.push({ kind: 'conflict', rules: [...new Set(rs)], message });

  // 1. Equalities.
  const [eS, eE, eC, eW] = [eq.start[0], eq.end[0], eq.center[0], eq.size[0]];
  const sizeFixed = !!eW || [eS, eE, eC].filter(Boolean).length >= 2;
  let s: number;
  let w: number;
  if (eW) {
    w = eW.v;
    s = eS ? eS.v : eE ? eE.v - w : eC ? eC.v - w / 2 : origin;
  } else if (eS && eE) {
    s = eS.v;
    w = eE.v - eS.v;
  } else if (eS && eC) {
    s = eS.v;
    w = 2 * (eC.v - eS.v);
  } else if (eE && eC) {
    w = 2 * (eE.v - eC.v);
    s = eE.v - w;
  } else {
    w = natural;
    s = eS ? eS.v : eE ? eE.v - w : eC ? eC.v - w / 2 : origin;
  }
  const anchor: 'start' | 'end' | 'center' | 'free' = eS ? 'start' : eE ? 'end' : eC ? 'center' : 'free';
  if (w < 0) {
    conflict(ids(eq.start, eq.end, eq.center, eq.size), `Rules on ${itemId} leave it with no room.`);
    w = 0;
  }
  const allEq = [...eq.start, ...eq.end, ...eq.center, ...eq.size];
  if (allEq.some((e) => Math.abs(roleValue({ start: s, size: w }, INFO[e.r.attr].role) - e.v) > EPS)) {
    conflict(ids(allEq), `Rules on ${itemId} disagree: ${ids(allEq).join(', ')}.`);
  }

  // 2. Size limits.
  const minW = max(ge.size);
  let maxW = min(le.size);
  let sizeFlagged = false;
  if (minW !== undefined && maxW !== undefined && minW > maxW + EPS) {
    conflict(
      ids(ge.size, le.size),
      `Rules on ${itemId}: the size cannot be both at least ${minW} and at most ${maxW}.`,
    );
    maxW = minW;
    sizeFlagged = true;
  }
  const floor = minW ?? 0;
  const resize = (nw: number) => {
    const e = s + w;
    const c = s + w / 2;
    w = nw;
    if (anchor === 'end') s = e - w;
    else if (anchor === 'center') s = c - w / 2;
  };
  if (!sizeFixed) {
    if (minW !== undefined && w < minW) resize(minW);
    if (maxW !== undefined && w > maxW) resize(Math.max(maxW, floor));
  }

  // 3. Edge limits.
  const sMin = max(ge.start) ?? -Infinity;
  const sMax = min(le.start) ?? Infinity;
  const eMin = max(ge.end) ?? -Infinity;
  const eMax = min(le.end) ?? Infinity;
  const capW = (nw: number) => (maxW === undefined ? nw : Math.min(nw, Math.max(maxW, floor)));
  if (anchor === 'free') {
    if (!sizeFixed && Number.isFinite(eMax - sMin) && w > eMax - sMin) w = Math.max(floor, eMax - sMin);
    s = Math.min(Math.max(s, sMin, eMin - w), sMax, eMax - w);
    s = Math.max(s, sMin);
  } else if (!sizeFixed) {
    if (anchor === 'start') {
      if (Number.isFinite(eMax)) w = Math.max(floor, Math.min(w, eMax - s));
      if (Number.isFinite(eMin)) w = capW(Math.max(w, eMin - s));
    } else if (anchor === 'end') {
      const e0 = s + w;
      if (Number.isFinite(sMin)) w = Math.max(floor, Math.min(w, e0 - sMin));
      if (Number.isFinite(sMax)) w = capW(Math.max(w, e0 - sMax));
      s = e0 - w;
    } else {
      const c = s + w / 2;
      let half = w / 2;
      half = Math.min(half, c - sMin, eMax - c);
      half = Math.max(half, c - sMax, eMin - c);
      w = Math.max(floor, 2 * half);
      s = c - w / 2;
    }
  }

  // 4. Anything still not holding.
  const e = s + w;
  const broken: Entry[] = [
    ...ge.start.filter((x) => s < x.v - EPS),
    ...le.start.filter((x) => s > x.v + EPS),
    ...ge.end.filter((x) => e < x.v - EPS),
    ...le.end.filter((x) => e > x.v + EPS),
    ...(sizeFlagged
      ? []
      : [...ge.size.filter((x) => w < x.v - EPS), ...le.size.filter((x) => w > x.v + EPS)]),
  ];
  if (broken.length)
    conflict(ids(broken, allEq), `Rules on ${itemId} cannot all hold: ${ids(broken).join(', ')}.`);
  return { start: s, size: w };
}

export function resolveLayout({ parent, items, rules }: ResolveInput): ResolveResult {
  const diagnostics: Diagnostic[] = [];
  const known = new Set(items.map((i) => i.id));
  const placed = turnAspectRules(screen(rules, known, diagnostics));

  // An axis that reads the other axis's size must come after it.
  const xFromY = placed.filter((r) => isCross(r) && INFO[r.attr].axis === 'x');
  const yFromX = placed.filter((r) => isCross(r) && INFO[r.attr].axis === 'y');
  let usable = placed;
  if (xFromY.length && yFromX.length) {
    diagnostics.push({
      kind: 'cycle',
      rules: yFromX.map((r) => r.id),
      message: 'Width and height are each set from the other.',
    });
    usable = placed.filter((r) => !yFromX.includes(r));
  }
  const axes: Axis[] = xFromY.length ? ['y', 'x'] : ['x', 'y'];

  const { order, rules: kept } = orderItems(items, usable, diagnostics);
  const byId = new Map(items.map((i) => [i.id, i]));
  const spans: Record<Axis, Record<string, Span>> = { x: {}, y: {} };
  const parentSpan: Record<Axis, Span> = {
    x: { start: 0, size: parent.width },
    y: { start: 0, size: parent.height },
  };
  const spanOf = (ref: string, axis: Axis): Span | undefined =>
    ref === 'parent' ? parentSpan[axis] : spans[axis][ref];

  const bound = (r: LayoutRule): number | undefined => {
    if (!r.target) return r.constant;
    const t = INFO[targetAttrOf(r)];
    const span = spanOf(r.target, t.axis);
    return span ? (r.multiplier ?? 1) * roleValue(span, t.role) + r.constant : undefined;
  };

  for (const axis of axes) {
    for (const id of order) {
      const item = byId.get(id)!;
      const mine = kept.filter((r) => r.item === id && INFO[r.attr].axis === axis);
      spans[axis][id] = solveAxis(
        id,
        axis === 'x' ? item.width : item.height,
        (axis === 'x' ? item.x : item.y) ?? 0,
        mine,
        bound,
        diagnostics,
      );
    }
  }

  const boxes: ResolveResult['boxes'] = {};
  for (const item of items) {
    const x = spans.x[item.id];
    const y = spans.y[item.id];
    if (x && y) boxes[item.id] = { x: x.start, y: y.start, width: x.size, height: y.size };
  }
  return { boxes, diagnostics };
}
