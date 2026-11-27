import { useLayoutEffect, useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import { Columns3 } from '@keyline-icons/react/duotone';
import { focusTab, PaneHeader, paneNames } from './PaneHeader';
import { gutter, minimumWidth, panePixels, panes, tabNames, views } from './workbench-layout';
import type { Destination, Pane, View, Widths, WorkbenchLayout } from './workbench-layout';

interface Split {
  left: Pane;
  right: Pane;
  startX: number;
  sizes: Widths;
  shown: Pane[];
  weights: Widths;
}
function resized(split: Split, distance: number): Widths {
  const { left, right, sizes, shown, weights } = split;
  const delta = Math.max(
    minimumWidth - sizes[left],
    Math.min(sizes[right] - minimumWidth, distance),
  );
  const next = { ...weights };
  const weight = shown.reduce((sum, p) => sum + weights[p], 0);
  const total = shown.reduce((sum, p) => sum + sizes[p], 0);
  for (const p of shown) {
    const change = p === left ? delta : p === right ? -delta : 0;
    next[p] = ((sizes[p] + change) / total) * weight;
  }
  return next;
}

export function WorkbenchPanes({
  workspace,
  content,
  score,
}: {
  workspace: WorkbenchLayout;
  content: Record<View, ReactNode>;
  score: string;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() => document.documentElement.clientWidth);
  const [drag, setDrag] = useState<View | null>(null);
  const [target, setTarget] = useState<Destination | null>(null);
  const split = useRef<Split | null>(null);
  const [draft, setDraft] = useState<Widths | null>(null);
  const { shown, compact, widths } = workspace;
  const weights = draft ?? widths;
  const sizes = panePixels(shown, weights, width);
  const totalWeight = shown.reduce((sum, pane) => sum + weights[pane], 0);
  const tracks = shown.map(
    (pane) => 'minmax(' + minimumWidth + 'px, ' + (100 * weights[pane]) / totalWeight + 'fr)',
  );
  useLayoutEffect(() => {
    const node = grid.current!;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function endDrag() {
    setDrag(null);
    setTarget(null);
  }
  function endResize() {
    split.current = null;
    setDraft(null);
  }
  useLayoutEffect(() => {
    endDrag();
    endResize();
  }, [compact]);
  function destination(event: DragEvent): Destination | null {
    const element = event.target as HTMLElement;
    const pane = element.closest<HTMLElement>('[data-pane]')?.dataset.pane as Pane | undefined;
    if (!pane) return null;
    const tab = element.closest<HTMLElement>('[data-view]');
    if (!tab) return { pane };
    const rect = tab.getBoundingClientRect();
    return {
      pane,
      anchor: tab.dataset.view as View,
      after: event.clientX >= rect.left + rect.width / 2,
    };
  }
  return (
    <div
      ref={grid}
      className="panes"
      aria-label="Interview panes"
      style={{
        gridTemplateColumns: compact ? 'minmax(0, 1fr)' : tracks.join(' ' + gutter + 'px '),
      }}
      data-dragging={drag ? true : undefined}
      data-resizing={draft ? true : undefined}
      onDragEnd={endDrag}
      onDragLeave={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          setTarget(null);
      }}
      onDragOver={(event) => {
        if (!drag) return;
        const next = destination(event);
        if (!next) {
          setTarget(null);
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (
          next.pane !== target?.pane ||
          next.anchor !== target?.anchor ||
          next.after !== target?.after
        )
          setTarget(next);
      }}
      onDrop={(event) => {
        if (!drag) return;
        event.preventDefault();
        const next = destination(event);
        if (next) {
          workspace.move(drag, next);
          focusTab(drag, compact);
        }
        endDrag();
      }}
    >
      {shown.map((p, i) => (
        <PaneHeader
          key={p}
          pane={p}
          column={i * 2 + 1}
          workspace={workspace}
          score={score}
          target={target}
          onDrag={setDrag}
        />
      ))}
      {/* Stable siblings keep iframe browsing contexts and drafts alive across layout changes. */}
      {views.map((tab) => {
        const pane = workspace.paneOf(tab);
        return (
          <section
            key={tab}
            id={'view-' + tab}
            role="tabpanel"
            aria-label={tabNames[tab]}
            aria-labelledby={!compact && workspace.visible(tab) ? 'tab-' + tab : undefined}
            tabIndex={tab === 'question' || tab === 'output' ? 0 : undefined}
            className={'work-panel ' + tab + '-view'}
            data-pane={pane}
            data-drop={target?.pane === pane || undefined}
            hidden={!workspace.visible(tab)}
            style={{ gridColumn: Math.max(1, shown.indexOf(pane) * 2 + 1) }}
          >
            {content[tab]}
          </section>
        );
      })}
      {shown.slice(0, -1).map((left, index) => {
        const right = shown[index + 1];
        return (
          <div
            key={left + right}
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label={'Resize ' + left + ' and ' + right + ' panes'}
            aria-controls={'view-' + workspace.active(left)}
            aria-valuemin={minimumWidth}
            aria-valuemax={Math.round(sizes[left] + sizes[right] - minimumWidth)}
            aria-valuenow={Math.round(sizes[left])}
            aria-valuetext={Math.round(sizes[left]) + ' pixels'}
            className="pane-divider"
            style={{ gridColumn: index * 2 + 2 }}
            onPointerDown={(event) => {
              if (event.button !== 0 || !event.isPrimary) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              split.current = { left, right, sizes, weights: widths, shown, startX: event.clientX };
              setDraft(widths);
            }}
            onPointerMove={(event) => {
              if (split.current)
                setDraft(resized(split.current, event.clientX - split.current.startX));
            }}
            onPointerUp={(event) => {
              if (split.current)
                workspace.resize(resized(split.current, event.clientX - split.current.startX));
              endResize();
            }}
            onLostPointerCapture={endResize}
            onPointerCancel={endResize}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                endResize();
                return;
              }
              const distances: Record<string, number> = {
                ArrowLeft: -24,
                ArrowRight: 24,
                Home: -width,
                End: width,
              };
              if (!(event.key in distances)) return;
              event.preventDefault();
              workspace.resize(
                resized(
                  { left, right, sizes, weights: widths, shown, startX: 0 },
                  distances[event.key],
                ),
              );
            }}
          >
            <span className="divider-grip" aria-hidden="true" />
          </div>
        );
      })}
      {drag &&
        !compact &&
        panes
          .filter((p) => !shown.includes(p))
          .map((p) => (
            <div
              key={'drop-' + p}
              className={'empty-pane-target drop-' + p}
              data-pane={p}
              data-drop={p === target?.pane || undefined}
            >
              <Columns3 size={20} />
              <span>{paneNames[p]}</span>
            </div>
          ))}
    </div>
  );
}
