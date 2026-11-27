import * as m from 'motion/react-m';
import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Code,
  Maximize,
  FileText,
  ListChecks,
  Monitor,
  PanelRight,
  Play,
  RotateCw,
  Minimize,
  Square,
  Terminal,
  X,
  SearchPlus,
  SearchMinus,
} from '@keyline-icons/react/duotone';
import type { Attempt, CoachSettings, Provider } from './model';
import { gradeLabel } from './model';
import { Coach } from './Coach';
import { Preview } from './Preview';
import { Dialog, IconButton, Spinner, TestResults, TextMarkdown } from './ui';
type View = 'editor' | 'preview' | 'tests' | 'output';
const viewItems: { id: View; name: string; icon: typeof Code }[] = [
  { id: 'editor', name: 'Editor', icon: Code },
  { id: 'preview', name: 'Preview', icon: Monitor },
  { id: 'tests', name: 'Tests', icon: ListChecks },
  { id: 'output', name: 'Output', icon: Terminal },
];
export function Workbench({
  attempt,
  providers,
  settings,
  action,
  busy,
  onSettings,
  refresh,
}: {
  attempt: Attempt;
  providers: Provider[];
  settings: CoachSettings;
  action: (path: string) => Promise<boolean>;
  busy: boolean;
  onSettings: () => void;
  refresh: () => void;
}) {
  const [question, setQuestion] = useState(() => innerWidth >= 730),
    [assistant, setAssistant] = useState(() => innerWidth >= 800),
    [view, setView] = useState<View>('editor'),
    [runMenu, setRunMenu] = useState(false),
    [max, setMax] = useState(false);
  const [illustration, setIllustration] = useState<string | null>(null),
    [zoom, setZoom] = useState(1);
  const menuRef = useRef<HTMLDivElement>(null);
  const imageLabels = ['Feed and Write action', 'Create post form', 'Expected result in My Posts'];
  useEffect(() => {
    if (!runMenu) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setRunMenu(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRunMenu(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key);
    };
  }, [runMenu]);
  function toggleQuestion() {
    if (max) setMax(false);
    setQuestion((v) => !v);
    if (innerWidth < 730) setAssistant(false);
  }
  function toggleAssistant() {
    if (max) setMax(false);
    setAssistant((v) => !v);
    if (innerWidth < 730) setQuestion(false);
  }
  function run() {
    setRunMenu(false);
    setView('preview');
    void action('run');
  }
  function tests() {
    setView('tests');
    void action('test');
  }
  const grade = attempt.grade;
  const score = grade ? gradeLabel(grade) : '';
  return (
    <main className="workbench">
      <div className="desk">
        <div className="desk-toolbar">
          <div className="tool-group">
            <IconButton
              label="Toggle question"
              aria-pressed={question && !max}
              onClick={toggleQuestion}
            >
              <BookOpen />
            </IconButton>
            <span className="toolbar-label">{attempt.title}</span>
          </div>
          <div className="tool-group actions push">
            <div className="run-controls" ref={menuRef}>
              <button
                className="run-button"
                aria-label="Run"
                onClick={run}
                disabled={busy || attempt.appStatus === 'starting'}
              >
                {attempt.appStatus === 'starting' ? (
                  <Spinner />
                ) : (
                  <Play size={13} fill="currentColor" />
                )}{' '}
                Run
              </button>
              <IconButton
                label="Run options"
                aria-expanded={runMenu}
                onClick={() => setRunMenu(!runMenu)}
              >
                <ChevronDown size={13} />
              </IconButton>
              {runMenu && (
                <div className="menu run-menu">
                  <button onClick={run} disabled={busy}>
                    <RotateCw size={14} />
                    Restart application
                  </button>
                  <button
                    onClick={() => {
                      setView('output');
                      setRunMenu(false);
                    }}
                  >
                    <FileText size={14} />
                    Startup output
                  </button>
                </div>
              )}
            </div>
            {attempt.testStatus === 'running' ? (
              <button className="test-button stop" onClick={() => void action('stop-tests')}>
                <Square size={12} />
                Stop All Tests
              </button>
            ) : (
              <button className="test-button" disabled={busy} onClick={tests}>
                Run Tests
              </button>
            )}
            <span className="divider" />
            <IconButton
              label="Toggle assistant"
              aria-pressed={assistant && !max}
              onClick={toggleAssistant}
            >
              <PanelRight />
            </IconButton>
            <IconButton
              label={max ? 'Restore panes' : 'Maximize center pane'}
              onClick={() => setMax(!max)}
            >
              {max ? <Minimize /> : <Maximize />}
            </IconButton>
          </div>
        </div>
        <div
          className={
            'panes ' +
            (question && !max ? 'has-question ' : '') +
            (assistant && !max ? 'has-coach' : '')
          }
        >
          {question && !max && (
            <aside className="question-pane">
              <div className="pane-title">
                <BookOpen size={14} />
                <strong>Question</strong>
                <IconButton
                  label="Hide question"
                  className="push"
                  onClick={() => setQuestion(false)}
                >
                  <X />
                </IconButton>
              </div>
              <div className="question-body">
                <h1>{attempt.title}</h1>
                <TextMarkdown
                  text={(attempt.prompt || attempt.description).replace(/^#\s+[^\n]+\n+/, '')}
                />
                {attempt.images?.length > 0 && (
                  <div className="illustrations">
                    <h3>Task illustrations</h3>
                    {attempt.images.map((src, i) => (
                      <button
                        key={src}
                        onClick={() => {
                          setIllustration(src);
                          setZoom(1);
                        }}
                      >
                        <img loading="lazy" src={src} alt={imageLabels[i] || 'Task illustration'} />
                        <span>
                          {imageLabels[i] || 'Task illustration'} <SearchPlus size={13} />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          )}
          <section className="center-pane" aria-label="Coding workbench">
            <m.div className="workspace-tabs" layoutScroll>
              {viewItems.map(({ id, name, icon: Icon }) => (
                <button
                  key={id}
                  aria-pressed={view === id}
                  className={view === id ? 'selected' : ''}
                  onClick={() => setView(id)}
                >
                  <Icon size={13} />
                  {name}
                  {id === 'tests' && score && (
                    <small>
                      {score}
                      {grade?.stale ? '*' : ''}
                    </small>
                  )}
                  {view === id && (
                    <m.span
                      aria-hidden="true"
                      className="workspace-tab-indicator"
                      layoutId="workspace-tab-indicator"
                      transition={{ type: 'spring', visualDuration: 0.2, bounce: 0 }}
                    />
                  )}
                </button>
              ))}
            </m.div>
            <div className="views">
              <section className="editor-view" hidden={view !== 'editor'}>
                {attempt.editorUrl ? (
                  <iframe
                    allow="clipboard-read; clipboard-write; fullscreen"
                    title="Code editor"
                    src={attempt.editorUrl}
                  />
                ) : (
                  <div className="blank">
                    <Spinner />
                    <p>Connecting to the code editor…</p>
                  </div>
                )}
              </section>
              <section className="preview-view" hidden={view !== 'preview'}>
                <Preview
                  ports={attempt.previews}
                  status={attempt.appStatus}
                  disabled={busy}
                  onRun={run}
                />
              </section>
              {view === 'tests' && (
                <section className="results-view">
                  <TestResults grade={grade} running={attempt.testStatus === 'running'} />
                  {attempt.testStatus === 'error' && (
                    <div className="notice danger">
                      {attempt.error ||
                        attempt.logs.at(-1) ||
                        'The test runner failed to complete.'}
                    </div>
                  )}
                </section>
              )}
              {view === 'output' && (
                <section className="logs-view">
                  <div className="pane-title">
                    <Terminal size={14} />
                    <strong>Workspace output</strong>
                  </div>
                  <pre>{attempt.logs.join('\n') || 'No output yet.'}</pre>
                </section>
              )}
            </div>
          </section>
          <Coach
            hidden={!assistant || max}
            key={attempt.id}
            attempt={attempt}
            providers={providers}
            settings={settings}
            onSettings={onSettings}
            refresh={refresh}
            onHide={() => setAssistant(false)}
          />
        </div>
      </div>
      {illustration && (
        <Dialog wide title="Task illustration" onClose={() => setIllustration(null)}>
          <div className="image-controls">
            <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
              <SearchMinus />
            </IconButton>
            <span>{Math.round(zoom * 100)}%</span>
            <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
              <SearchPlus />
            </IconButton>
          </div>
          <div className="image-viewer">
            <img
              alt={imageLabels[attempt.images.indexOf(illustration)] || 'Task illustration'}
              src={illustration}
              style={{ width: zoom * 100 + '%' }}
            />
          </div>
        </Dialog>
      )}
    </main>
  );
}
