import { Button } from '@/components/ui/button';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  BadgeCheck,
  CircleAlert,
  CircleQuestion,
  Database,
  Keyboard,
  LibraryBig,
  Lock,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  Signal,
  Sun,
  Unplug,
  X,
} from '@keyline-icons/react/duotone';
import {
  api,
  attemptPath,
  errorMessage,
  HttpError,
  readLocal,
  readRoute,
  writeLocal,
} from './model';
import type { Attempt, Catalog, CoachSettings, PastAttempt, Route } from './model';
import { Dashboard, Library, Review } from './Overview';
import { Settings } from './Coach';
import { Dialog, IconButton, Mark, Spinner, Timer } from './ui';

const Workbench = lazy(() => import('./Workbench'));
type Modal = 'settings' | 'instructions' | 'reset' | 'reset-data' | 'submit' | { stop: PastAttempt } | null;
const studioName = 'AI Coding Interview Studio';
const empty: Catalog = { problems: [], attempts: [], providers: [] };
export default function App() {
  const [route, setRoute] = useState<Route>(readRoute),
    [catalog, setCatalog] = useState<Catalog>(empty),
    [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null),
    [lease, setLease] = useState<'unknown' | 'held' | 'blocked'>('unknown'),
    [pending, setPending] = useState(0);
  const [error, setError] = useState(''),
    [connectionError, setConnectionError] = useState(''),
    [modal, setModal] = useState<Modal>(null),
    [help, setHelp] = useState(false);
  const [theme, setTheme] = useState(() => readLocal<'dark' | 'light'>('acis-theme', 'dark'));
  const [settings, setSettings] = useState(() =>
    readLocal<CoachSettings>('acis-coach', { provider: 'codex', models: {} }),
  );
  const pulse = useRef<() => void>(() => {}),
    menu = useRef<HTMLDivElement>(null),
    currentId = useRef(route.id);
  const busy = pending > 0;
  const navigate = useCallback((id: string | null, dashboard = false) => {
    const url = new URL(location.href);
    if (id) url.searchParams.set('attempt', id);
    else url.searchParams.delete('attempt');
    url.hash = dashboard ? 'dashboard' : '';
    if (url.href !== location.href) history.pushState(null, '', url);
    currentId.current = id;
    setRoute({ id, dashboard });
    setModal(null);
    setHelp(false);
    setError('');
  }, []);
  const loadCatalog = useCallback(async () => {
    try {
      const next = await api<Catalog>('catalog');
      setCatalog(next);
      setLoaded(true);
      if (!currentId.current) setConnectionError('');
    } catch (e) {
      if (!currentId.current) setConnectionError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void loadCatalog();
    const interval = window.setInterval(() => void loadCatalog(), 10000);
    return () => clearInterval(interval);
  }, [loadCatalog, route.id]);
  useEffect(() => {
    const update = () => {
      const next = readRoute();
      currentId.current = next.id;
      setRoute(next);
      setHelp(false);
      setModal(null);
      setError('');
    };
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  useEffect(() => {
    setAttempt(null);
    setLease('unknown');
    setConnectionError('');
    setError('');
    if (!route.id) return;
    const path = attemptPath(route.id),
      controller = new AbortController();
    let timer = 0,
      working = false,
      again = false,
      lastLease = 0;
    async function poll() {
      if (controller.signal.aborted) return;
      if (working) {
        again = true;
        return;
      }
      working = true;
      clearTimeout(timer);
      try {
        const next = await api<Attempt>(path, 'GET', undefined, controller.signal);
        if (controller.signal.aborted) return;
        if (
          (next.status === 'active' || next.status === 'ready') &&
          Date.now() - lastLease >= 3500
        ) {
          try {
            await api(path + '/lease', 'POST', {}, controller.signal);
            if (!controller.signal.aborted) setLease('held');
          } catch (e) {
            if (e instanceof HttpError && e.status === 409) {
              if (!controller.signal.aborted) setLease('blocked');
            } else throw e;
          }
          lastLease = Date.now();
        }
        if (!controller.signal.aborted) {
          setAttempt(next);
          setConnectionError('');
        }
      } catch (e) {
        if (!controller.signal.aborted) setConnectionError(errorMessage(e));
      } finally {
        working = false;
        if (!controller.signal.aborted) {
          const delay = again ? 0 : 1000;
          again = false;
          timer = window.setTimeout(() => void poll(), delay);
        }
      }
    }
    pulse.current = () => {
      void poll();
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      pulse.current = () => {};
    };
  }, [route.id]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeLocal('acis-theme', theme);
  }, [theme]);
  useEffect(() => {
    writeLocal('acis-coach', settings);
  }, [settings]);
  useEffect(() => {
    document.title = attempt?.title ? attempt.title + ' - ' + studioName : studioName;
  }, [attempt?.title]);
  useEffect(() => {
    if (!help) return;
    const close = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) setHelp(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelp(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key);
    };
  }, [help]);
  const refresh = useCallback(() => pulse.current(), []);
  async function create(problemId: string, seed?: string) {
    setPending((n) => n + 1);
    setError('');
    try {
      const response = await api<{ id: string }>('attempts', 'POST', { problemId, seed });
      navigate(response.id);
      void loadCatalog();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending((n) => n - 1);
    }
  }
  async function action(name: string, id = route.id) {
    if (!id) return false;
    setPending((n) => n + 1);
    setError('');
    try {
      await api(attemptPath(id) + '/' + name, 'POST', {});
      if (currentId.current === id) refresh();
      return true;
    } catch (e) {
      if (currentId.current === route.id) {
        setError(errorMessage(e));
        refresh();
      }
      return false;
    } finally {
      setPending((n) => n - 1);
    }
  }
  function show(next: Modal) {
    setHelp(false);
    setError('');
    setModal(next);
  }
  const active = attempt?.status === 'active' && attempt.id === route.id;
  const inEditor = active && !route.dashboard && lease === 'held';
  const isLeasable = attempt?.status === 'active' || attempt?.status === 'ready';
  const currentAttempt = attempt && attempt.id === route.id ? attempt : null;
  const Bar = route.id ? 'header' : 'div';
  const stopTarget = typeof modal === 'object' ? modal?.stop : null;
  async function confirmed() {
    if (!modal) return;
    if (typeof modal === 'object') {
      const ok = await action('stop', modal.stop.id);
      if (ok) setModal((current) => current === modal ? null : current);
      void loadCatalog();
      return;
    }
    if (await action(modal)) {
      setModal(null);
      if (modal === 'submit') navigate(route.id, true);
    }
  }
  return (
    <div className={'app ' + (inEditor ? 'in-workbench' : '')}>
      <Bar className={route.id ? 'topbar' : 'library-tools'}>
        {route.id && (
          <button
            className="brand"
            aria-label={studioName + ' - Practice library'}
            onClick={() => navigate(null)}
          >
            <Mark />
            <span>{studioName}</span>
          </button>
        )}
        {currentAttempt && !inEditor && !currentAttempt.completionReason && currentAttempt.status !== 'review' && (
          <Timer
            deadline={currentAttempt.deadline}
            duration={currentAttempt.durationMinutes}
          />
        )}
        <div className="top-actions" role="group" aria-label="Studio controls">
          {!inEditor && (
            <span
              role="img"
              className={'connection ' + (connectionError ? 'offline' : '')}
              title={connectionError ? 'Reconnecting to local runtime' : 'Connected to local runtime'}
              aria-label={connectionError ? 'Disconnected' : 'Connected'}
            >
              <Signal size={16} />
            </span>
          )}
          <IconButton
            label={'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </IconButton>
          <div className="help-wrap" ref={menu}>
            <IconButton
              label="Help and settings"
              aria-expanded={help}
              onClick={() => setHelp(!help)}
            >
              <CircleQuestion />
            </IconButton>
            {help && (
              <div className="menu help-menu">
                <button onClick={() => show('instructions')}>
                  <BookOpen />
                  Test instructions
                </button>
                <button onClick={() => show('settings')}>
                  <SlidersHorizontal />
                  Assistant settings
                </button>
                {active && (
                  <>
                    <hr />
                    <button onClick={() => show('reset-data')}>
                      <Database />
                      Reset live data
                    </button>
                    <button onClick={() => show('reset')}>
                      <RotateCcw />
                      Reset project
                    </button>
                  </>
                )}
                <hr />
                <button onClick={() => navigate(null)}>
                  <LibraryBig />
                  Practice library
                </button>
              </div>
            )}
          </div>
          {active &&
            (inEditor ? (
              <Button
                className="header-action"
                aria-label="Save & Proceed"
                disabled={busy}
                onClick={() => void action('save').then((ok) => ok && navigate(route.id, true))}
              >
                Save &amp; Proceed
              </Button>
            ) : (
              <Button
                className="header-action"
                aria-label="Submit Test"
                disabled={busy || lease !== 'held'}
                onClick={() => show('submit')}
              >
                Submit Test
              </Button>
            ))}
        </div>
      </Bar>
      {error && !stopTarget && (
        <div className="error-banner" role="alert">
          <CircleAlert size={16} />
          <span>{error}</span>
          <IconButton className="push" label="Dismiss error" onClick={() => setError('')}>
            <X />
          </IconButton>
        </div>
      )}
      {connectionError && (
        <div className="error-banner" role="status">
          <Unplug size={16} />
          <span>{connectionError}</span>
          <button
            className="text-button push"
            onClick={() => (route.id ? refresh() : void loadCatalog())}
          >
            Retry connection
          </button>
          {route.id && (
            <button className="text-button" onClick={() => navigate(null)}>
              Practice library
            </button>
          )}
        </div>
      )}
      {!route.id ? (
        loaded ? (
          <Library
            catalog={catalog}
            creating={busy}
            onCreate={(id) => void create(id)}
            onOpen={(id) => navigate(id)}
            onStop={(target) => show({ stop: target })}
          />
        ) : (
          <div className="loading">
            <Spinner />
            Loading practice library…
          </div>
        )
      ) : !currentAttempt ? (
        <div className="loading">
          <Spinner />
          Opening your workspace…
        </div>
      ) : isLeasable && lease === 'blocked' ? (
        <main className="gate">
          <div className="row-icon">
            <Lock />
          </div>
          <h1>This interview is open in another tab</h1>
          <p>
            Return to the active tab, or close it to continue here. Your interview timer keeps
            running.
          </p>
          <Button variant="outline" className="secondary" onClick={() => navigate(null)}>
            <ArrowLeft size={16} />
            Practice library
          </Button>
        </main>
      ) : currentAttempt.status === 'review' || currentAttempt.status === 'stopped' ? (
        <Review
          attempt={currentAttempt}
          busy={busy}
          onReplay={() => void create(currentAttempt.problemId, String(currentAttempt.seed))}
          onLibrary={() => navigate(null)}
        />
      ) : inEditor ? (
        <Suspense
          fallback={
            <main className="blank" aria-label="Opening the interview">
              <Spinner />
            </main>
          }
        >
          <Workbench
            key={currentAttempt.id}
            attempt={currentAttempt}
            providers={catalog.providers}
            settings={settings}
            action={action}
            busy={busy}
            onSettings={() => show('settings')}
            refresh={refresh}
          />
        </Suspense>
      ) : (
        <Dashboard
          attempt={currentAttempt}
          busy={busy || (isLeasable && lease !== 'held')}
          onBegin={() => void action('begin').then((ok) => ok && navigate(route.id))}
          onRetry={() => void action('retry')}
          onStop={() => show({ stop: currentAttempt })}
          onSolve={() => navigate(route.id)}
          onSettings={() => show('settings')}
        />
      )}
      {modal === 'settings' && (
        <Settings
          providers={catalog.providers}
          settings={settings}
          onChange={setSettings}
          onClose={() => setModal(null)}
        />
      )}
      {stopTarget && (
        <Dialog title="Stop this attempt?" onClose={() => setModal(null)}>
          <div className="dialog-body">
            <p>
              <strong>{stopTarget.title}</strong> (seed {stopTarget.seed}) will close without a
              grade. You can still view your saved changes and conversations afterward.
            </p>
            {error && <p className="notice danger" role="alert">{error}</p>}
          </div>
          <footer>
            <Button variant="outline" className="secondary" disabled={busy} onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button className="danger-button" disabled={busy} onClick={() => void confirmed()}>
              {busy ? <><Spinner /> Stopping…</> : 'Stop attempt'}
            </Button>
          </footer>
        </Dialog>
      )}
      {modal === 'instructions' && (
        <Dialog title="Test instructions" onClose={() => setModal(null)}>
          <div className="dialog-body instructions">
            <h3>
              <BookOpen />
              Your interview
            </h3>
            <p>
              The workbench opens with the question, project README, and AI assistant. Reproduce the
              reported behavior, edit the candidate source, and verify your fix against the real
              tests.
            </p>
            <h3>
              <Keyboard />
              Using the workbench
            </h3>
            <p>
              Use the editor’s Files, Source Control, Run and Debug, and Terminal controls. Run
              opens the project preview. Run Tests shows the actual assertions and output.
            </p>
            <h3>
              <BadgeCheck />
              Timing and submission
            </h3>
            <p>
              Begin starts the server clock. Save &amp; Proceed returns to the interview overview.
              You can reopen the workspace until you submit or time expires. Protected files are
              checked during grading.
            </p>
          </div>
          <footer>
            <Button className="primary" onClick={() => setModal(null)}>
              Got it
            </Button>
          </footer>
        </Dialog>
      )}
      {(modal === 'submit' || modal === 'reset' || modal === 'reset-data') && (
        <Dialog
          title={
            modal === 'submit'
              ? 'Submit this interview?'
              : modal === 'reset'
                ? 'Reset the project?'
                : 'Reset live data?'
          }
          onClose={() => setModal(null)}
        >
          <div className="dialog-body">
            <p>
              {modal === 'submit'
                ? 'Your saved files will be graded and the interview will close. You can review your changes, test results, and coach conversations afterward.'
                : modal === 'reset'
                  ? 'Your current work will be archived. The original faulty starter and its fixtures will be restored. The interview clock will keep running.'
                  : 'The live application database will return to the original fixture data. Your source files and interview time are preserved.'}
            </p>
          </div>
          <footer>
            <Button variant="outline" className="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              className={modal === 'submit' ? 'primary' : 'danger-button'}
              disabled={busy}
              onClick={() => void confirmed()}
            >
              {busy && <Spinner />}
              {modal === 'submit'
                ? 'Confirm submission'
                : modal === 'reset'
                  ? 'Reset project'
                  : 'Reset live data'}
            </Button>
          </footer>
        </Dialog>
      )}
    </div>
  );
}
