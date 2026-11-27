import { useState, useSyncExternalStore } from 'react';
import { readLocal, writeLocal } from './model';

export const panes = ['left', 'center', 'right'] as const;
export type Pane = (typeof panes)[number];
export const tabNames = {
  question: 'Question',
  editor: 'Editor',
  preview: 'Preview',
  tests: 'Tests',
  output: 'Output',
  assistant: 'AI Assistant',
} as const;
export type View = keyof typeof tabNames;
export const views = Object.keys(tabNames) as View[];
type Groups = Record<Pane, View[]>;
export type Widths = Record<Pane, number>;
interface Layout {
  groups: Groups;
  widths: Widths;
}
export interface Destination {
  pane: Pane;
  anchor?: View;
  after?: boolean;
}

const storageKey = 'acis-workbench-layout-v1';
const defaults: Layout = {
  groups: {
    left: ['question'],
    center: ['editor', 'preview', 'tests', 'output'],
    right: ['assistant'],
  },
  widths: { left: 0.22, center: 0.55, right: 0.23 },
};
function loadLayout(): Layout {
  const saved = readLocal<Layout | null>(storageKey, null);
  if (
    !saved ||
    !panes.every(
      (p) =>
        Array.isArray(saved.groups?.[p]) &&
        Number.isFinite(saved.widths?.[p]) &&
        saved.widths[p] > 0 &&
        saved.widths[p] <= 1,
    )
  )
    return defaults;
  const tabs = panes.flatMap((p) => saved.groups[p]);
  return tabs.length === views.length && views.every((v) => tabs.includes(v)) ? saved : defaults;
}
function owner(groups: Groups, tab: View): Pane {
  return panes.find((p) => groups[p].includes(tab))!;
}
function initialSelection(groups: Groups): Record<Pane, View | undefined> {
  return {
    left: groups.left[0],
    center: groups.center[0],
    right: groups.right[0],
    [owner(groups, 'editor')]: 'editor',
  };
}
const compactQuery = window.matchMedia('(width < 720px)');
function subscribeCompact(change: () => void) {
  compactQuery.addEventListener('change', change);
  return () => compactQuery.removeEventListener('change', change);
}

export const gutter = 6;
export const minimumWidth = 200;

// Allocate smaller panes their minimum first, then share the remaining pixels by weight.
export function panePixels(shown: Pane[], weights: Widths, width: number): Widths {
  const sizes = { left: 0, center: 0, right: 0 };
  let space = Math.max(0, width - (shown.length - 1) * gutter);
  const minimum = Math.min(minimumWidth, space / shown.length);
  let flexible = [...shown];
  while (flexible.length) {
    const total = flexible.reduce((sum, p) => sum + weights[p], 0);
    const smallest = flexible.find((p) => (space * weights[p]) / total < minimum);
    if (!smallest) {
      for (const p of flexible) sizes[p] = (space * weights[p]) / total;
      break;
    }
    sizes[smallest] = minimum;
    space -= minimum;
    flexible = flexible.filter((p) => p !== smallest);
  }
  return sizes;
}

export function useWorkbenchLayout() {
  const [layout, setLayout] = useState(loadLayout);
  const [selected, setSelected] = useState(() => initialSelection(layout.groups));
  const [hidden, setHidden] = useState<View[]>([]);
  const [maximized, maximize] = useState<Pane | null>(null);
  const [phoneView, setPhoneView] = useState<View>('editor');
  const compact = useSyncExternalStore(subscribeCompact, () => compactQuery.matches);
  const { groups, widths } = layout;
  const paneOf = (v: View) => owner(groups, v);
  function active(p: Pane) {
    const tabs = groups[p].filter((v) => !hidden.includes(v));
    const current = selected[p];
    return current && tabs.includes(current) ? current : tabs[0];
  }
  const shown = compact
    ? [paneOf(phoneView)]
    : panes.filter((p) => active(p) && (!maximized || maximized === p));
  function visible(tab: View) {
    return compact ? phoneView === tab : shown.includes(paneOf(tab)) && active(paneOf(tab)) === tab;
  }
  function save(next: Layout) {
    setLayout(next);
    writeLocal(storageKey, next);
  }
  function reveal(tab: View) {
    setPhoneView(tab);
    if (compact) return;
    const pane = paneOf(tab);
    setHidden((previous) => previous.filter((v) => v !== tab));
    setSelected((previous) => ({ ...previous, [pane]: tab }));
    if (maximized && maximized !== pane) maximize(null);
  }
  function toggle(tab: 'question' | 'assistant') {
    if (!visible(tab)) return reveal(tab);
    setPhoneView('editor');
    if (!compact) {
      setHidden((previous) => [...previous, tab]);
      if (maximized === paneOf(tab)) maximize(null);
    }
  }
  function move(tab: View, { pane, anchor, after }: Destination) {
    if (anchor === tab) return;
    const from = paneOf(tab);
    const next = { ...groups, [from]: groups[from].filter((v) => v !== tab) };
    const destination = [...next[pane]];
    const index = anchor ? destination.indexOf(anchor) + Number(!!after) : destination.length;
    destination.splice(index, 0, tab);
    next[pane] = destination;
    setHidden((previous) => previous.filter((v) => v !== tab));
    setSelected((previous) => ({ ...previous, [pane]: tab }));
    if (from !== pane) maximize(null);
    save({ groups: next, widths });
  }
  function reset() {
    save(defaults);
    setHidden([]);
    setSelected(initialSelection(defaults.groups));
    maximize(null);
    setPhoneView('editor');
  }
  return {
    groups,
    widths,
    hidden,
    maximized,
    compact,
    phoneView,
    shown,
    paneOf,
    active,
    visible,
    reveal,
    toggle,
    move,
    maximize,
    reset,
    resize: (next: Widths) => save({ groups, widths: next }),
  };
}
export type WorkbenchLayout = ReturnType<typeof useWorkbenchLayout>;
