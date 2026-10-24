/**
 * Layout rules: the Xcode Auto Layout constraint model, cut down to what a Content Block needs.
 *
 * One rule is one linear relation, read the same way Xcode stores it:
 *
 *   item.attr  <relation>  multiplier × target.targetAttr + constant
 *
 * Only three relations exist (`=`, `≥`, `≤`); Apple's Auto Layout has no strict `<` or `>`.
 * A size rule may have no target (`width = 42`, `width ≥ 120`).
 *
 * Phase 1 spike: pure data and maths, no UI and no storage. See `resolve.ts`.
 */

export type Attribute =
  'leading' | 'trailing' | 'top' | 'bottom' | 'width' | 'height' | 'centerX' | 'centerY';
export type Relation = 'eq' | 'gte' | 'lte';

/** The parent box, or the id (`instance_key`) of another item in the same container. */
export type TargetRef = 'parent' | string;

export interface LayoutRule {
  id: string;
  /** The item being placed: the first item in Xcode terms. */
  item: string;
  attr: Attribute;
  relation: Relation;
  /** The second item. Missing means a plain number (sizes only). */
  target?: TargetRef;
  /** Missing means the same attribute as `attr`. */
  targetAttr?: Attribute;
  constant: number;
  /** Missing means 1. */
  multiplier?: number;
}

/** What the resolver is told about an item: its natural (hug) size and where it was saved. */
export interface LayoutItem {
  id: string;
  /** Content size, used when no rule fixes the size. */
  width: number;
  height: number;
  /** Where it sits when no rule fixes the position (the saved placement). Missing: 0. */
  x?: number;
  y?: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DiagnosticKind =
  /** Two rules cannot both hold (e.g. width exactly 300 and at least 500). */
  | 'conflict'
  /** The rule points at an item that is not there; it is ignored. */
  | 'missing-target'
  /** Items depend on each other in a loop; the rules that close it are ignored. */
  | 'cycle'
  /** A rule shape the resolver does not handle; it is ignored. */
  | 'unsupported';

export interface Diagnostic {
  kind: DiagnosticKind;
  /** The rules involved, so the UI can point at them. */
  rules: string[];
  message: string;
}

export interface ResolveInput {
  parent: { width: number; height: number };
  items: LayoutItem[];
  rules: LayoutRule[];
}

export interface ResolveResult {
  boxes: Record<string, Box>;
  diagnostics: Diagnostic[];
}
