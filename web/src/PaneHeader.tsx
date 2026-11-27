import * as m from 'motion/react-m';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Code,
  Columns3,
  ListChecks,
  Maximize,
  MessageSquare,
  Minimize,
  Monitor,
  PanelLeft,
  PanelRight,
  RotateCcw,
  Terminal,
  X,
} from '@keyline-icons/react/duotone';
import { NativeSelect } from '@/components/ui/native-select';
import { IconButton } from './ui';
import { panes, tabNames, views } from './workbench-layout';
import type { Destination, Pane, View, WorkbenchLayout } from './workbench-layout';

const icons = {
  question: BookOpen,
  editor: Code,
  preview: Monitor,
  tests: ListChecks,
  output: Terminal,
  assistant: MessageSquare,
};
export const paneNames = { left: 'Left pane', center: 'Center pane', right: 'Right pane' };
const paneIcons = { left: PanelLeft, center: Columns3, right: PanelRight };

export function focusTab(tab: View, compact: boolean) {
  requestAnimationFrame(() =>
    document.getElementById(compact ? 'workspace-view' : 'tab-' + tab)?.focus(),
  );
}

function PaneMenu({ pane, tab, workspace }: { pane: Pane; tab: View; workspace: WorkbenchLayout }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { compact, groups, hidden, maximized } = workspace;
  const neighbors = groups[pane].filter((v) => compact || !hidden.includes(v));
  const index = neighbors.indexOf(tab);
  useLayoutEffect(() => {
    if (open) wrap.current?.querySelector<HTMLButtonElement>('[role=menuitem]:enabled')?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function choose(action: () => void, focus = tab) {
    setOpen(false);
    action();
    focusTab(focus, compact);
  }
  function keys(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button:enabled'),
    );
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const targets: Record<string, number> = {
      ArrowDown: (index + 1) % items.length,
      ArrowUp: (index - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      wrap.current?.querySelector('button')?.focus();
    } else if (event.key in targets) {
      event.preventDefault();
      items[targets[event.key]].focus();
    }
  }
  return (
    <div
      className="pane-menu-wrap"
      ref={wrap}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <IconButton
        label={'Move tab in ' + pane + ' pane'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Columns3 />
      </IconButton>
      {open && (
        <div
          className="menu pane-menu"
          role="menu"
          aria-label={'Move ' + tabNames[tab]}
          onKeyDown={keys}
        >
          {panes.map((p) => {
            const Icon = paneIcons[p];
            return (
              <button
                key={p}
                role="menuitem"
                disabled={pane === p}
                onClick={() => choose(() => workspace.move(tab, { pane: p }))}
              >
                <Icon />
                Move to {p} pane
              </button>
            );
          })}
          <hr />
          <button
            role="menuitem"
            disabled={index <= 0}
            onClick={() =>
              choose(() => workspace.move(tab, { pane, anchor: neighbors[index - 1] }))
            }
          >
            <ArrowLeft />
            Move earlier
          </button>
          <button
            role="menuitem"
            disabled={index + 1 >= neighbors.length}
            onClick={() =>
              choose(() => workspace.move(tab, { pane, anchor: neighbors[index + 1], after: true }))
            }
          >
            <ArrowRight />
            Move later
          </button>
          <hr />
          {!compact && (
            <button
              role="menuitem"
              onClick={() => choose(() => workspace.maximize(maximized ? null : pane))}
            >
              {maximized ? <Minimize /> : <Maximize />}
              {maximized ? 'Restore panes' : 'Maximize pane'}
            </button>
          )}
          <button role="menuitem" onClick={() => choose(workspace.reset, 'editor')}>
            <RotateCcw />
            Reset layout
          </button>
        </div>
      )}
    </div>
  );
}

export function PaneHeader({
  pane,
  column,
  workspace,
  score,
  target,
  onDrag,
}: {
  pane: Pane;
  column: number;
  workspace: WorkbenchLayout;
  score: string;
  target: Destination | null;
  onDrag: (tab: View) => void;
}) {
  const { compact, groups, hidden, phoneView, maximized, reveal } = workspace;
  const tab = compact ? phoneView : workspace.active(pane);
  const strip = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = strip.current;
    const selected = bar?.querySelector<HTMLButtonElement>('[aria-selected=true]');
    if (!bar || !selected) return;
    const keepInView = () => {
      const bounds = bar.getBoundingClientRect();
      const button = selected.getBoundingClientRect();
      if (button.left < bounds.left) bar.scrollLeft += button.left - bounds.left;
      else if (button.right > bounds.right) bar.scrollLeft += button.right - bounds.right;
    };
    keepInView();
    const observer = new ResizeObserver(keepInView);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [tab, groups, compact]);
  if (!tab) return null;
  const tabs = groups[pane].filter((v) => !hidden.includes(v));
  function navigate(event: KeyboardEvent<HTMLButtonElement>, view: View) {
    const index = tabs.indexOf(view);
    const positions: Record<string, number> = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(event.key in positions)) return;
    event.preventDefault();
    const next = tabs[positions[event.key]];
    reveal(next);
    document.getElementById('tab-' + next)?.focus();
  }
  const ActiveIcon = icons[tab];
  return (
    <div
      className={'pane-header' + (target?.pane === pane ? ' drop-header' : '')}
      data-pane={pane}
      style={{ gridColumn: column }}
    >
      {compact ? (
        <div className="compact-view">
          <ActiveIcon size={16} aria-hidden="true" />
          <NativeSelect
            id="workspace-view"
            size="sm"
            aria-label="Workspace view"
            value={tab}
            onChange={(event) => reveal(event.target.value as View)}
          >
            {views.map((v) => (
              <option key={v} value={v}>
                {tabNames[v]}
                {v === 'tests' && score ? ' ' + score : ''}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : (
        <m.div
          ref={strip}
          className="workspace-tabs"
          role="tablist"
          aria-label={paneNames[pane]}
          layoutScroll
        >
          {tabs.map((v) => {
            const Icon = icons[v];
            const insertion = target?.pane === pane && target.anchor === v;
            return (
              <button
                key={v}
                id={'tab-' + v}
                role="tab"
                aria-controls={'view-' + v}
                aria-selected={tab === v}
                tabIndex={tab === v ? 0 : -1}
                className={tab === v ? 'selected' : ''}
                data-view={v}
                data-insert={insertion ? (target.after ? 'after' : 'before') : undefined}
                title={'Drag ' + tabNames[v] + ' to move it'}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', tabNames[v]);
                  onDrag(v);
                }}
                onClick={() => reveal(v)}
                onKeyDown={(event) => navigate(event, v)}
              >
                <Icon size={14} />
                {tabNames[v]}
                {v === 'tests' && score && <small>{score}</small>}
                {tab === v && (
                  <m.span
                    aria-hidden="true"
                    className="workspace-tab-indicator"
                    layoutId={'tab-indicator-' + pane}
                    layoutDependency={v}
                    transition={{ type: 'spring', visualDuration: 0.2, bounce: 0 }}
                  />
                )}
              </button>
            );
          })}
          {target?.pane === pane && !target.anchor && <span className="append-marker" />}
        </m.div>
      )}
      <div className="pane-tools">
        {(tab === 'question' || tab === 'assistant') && (
          <IconButton
            label={'Hide ' + tab}
            onClick={() => {
              workspace.toggle(tab);
              document.getElementById('toggle-' + tab)?.focus();
            }}
          >
            <X />
          </IconButton>
        )}
        {maximized === pane && !compact && (
          <IconButton label="Restore panes" onClick={() => workspace.maximize(null)}>
            <Minimize />
          </IconButton>
        )}
        <PaneMenu pane={pane} tab={tab} workspace={workspace} />
      </div>
    </div>
  );
}
