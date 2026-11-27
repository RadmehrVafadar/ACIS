import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  FileText,
  PanelRight,
  Play,
  RotateCw,
  Square,
  Terminal,
  SearchPlus,
  SearchMinus,
} from '@keyline-icons/react/duotone';
import type { Attempt, CoachSettings, Provider } from './model';
import { gradeLabel } from './model';
import { Coach } from './Coach';
import { Preview } from './Preview';
import { Dialog, IconButton, Spinner, TestResults, TextMarkdown } from './ui';
import { WorkbenchPanes } from './WorkbenchPanes';
import { useWorkbenchLayout } from './workbench-layout';

export default function Workbench({
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
  const workspace = useWorkbenchLayout();
  const [runMenu, setRunMenu] = useState(false);
  const [previewPort, setPreviewPort] = useState<number | null>(null);
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
  function run() {
    setRunMenu(false);
    setPreviewPort(null);
    workspace.reveal('preview');
    void action('run');
  }
  function tests() {
    workspace.reveal('tests');
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
              id="toggle-question"
              label="Toggle question"
              aria-pressed={workspace.visible('question')}
              onClick={() => workspace.toggle('question')}
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
                      workspace.reveal('output');
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
              id="toggle-assistant"
              label="Toggle assistant"
              aria-pressed={workspace.visible('assistant')}
              onClick={() => workspace.toggle('assistant')}
            >
              <PanelRight />
            </IconButton>
          </div>
        </div>
        <WorkbenchPanes
          workspace={workspace}
          score={score + (grade?.stale ? '*' : '')}
          content={{
            question: (
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
            ),
            editor: attempt.editorUrl ? (
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
            ),
            preview: (
              <Preview
                ports={attempt.previews}
                selectedPort={previewPort}
                onSelectPort={setPreviewPort}
                status={attempt.appStatus}
                disabled={busy}
                onRun={run}
              />
            ),
            tests: (
              <>
                <TestResults grade={grade} running={attempt.testStatus === 'running'} />
                {attempt.testStatus === 'error' && (
                  <div className="notice danger">
                    {attempt.error || attempt.logs.at(-1) || 'The test runner failed to complete.'}
                  </div>
                )}
              </>
            ),
            output: (
              <>
                <div className="pane-title">
                  <Terminal size={14} />
                  <strong>Workspace output</strong>
                </div>
                <pre>{attempt.logs.join('\n') || 'No output yet.'}</pre>
              </>
            ),
            assistant: (
              <Coach
                attempt={attempt}
                providers={providers}
                settings={settings}
                onSettings={onSettings}
                refresh={refresh}
              />
            ),
          }}
        />
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
