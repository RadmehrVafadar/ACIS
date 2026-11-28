import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  CircleStop,
  Clock3,
  Code,
  GitBranch,
  ListFilter,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  MessageSquare,
  X,
} from '@keyline-icons/react/duotone';
import {
  Braces,
  Calculator,
  CalendarClock,
  Feather,
  Layers3,
  NotebookPen,
  TruckFast,
} from '@keyline-icons/react/fill';
import { canStopAttempt, dateLabel, gradeLabel, runtimeName, statusLabel } from './model';
import type { Attempt, Catalog, PastAttempt } from './model';
import { Spinner, TestResults, TextMarkdown } from './ui';
import { LibraryMark } from './LibraryMark';

const covers = {
  'room-booking': { icon: CalendarClock, topic: 'Scheduling' },
  'delivery-retries': { icon: TruckFast, topic: 'Event processing' },
  'invoice-totals': { icon: Calculator, topic: 'Billing' },
  'ticket-pagination': { icon: Layers3, topic: 'API pagination' },
  'blog-django': { icon: Feather, topic: 'Publishing' },
  'blog-node': { icon: NotebookPen, topic: 'Publishing' },
};

function ExerciseCover({ id }: { id: string }) {
  const { icon: Icon, topic } = covers[id as keyof typeof covers] || {
    icon: Braces,
    topic: 'Debugging',
  };
  return (
    <span className="exercise-cover">
      <Icon aria-hidden="true" />
      <span>{topic}</span>
    </span>
  );
}

export function Library({
  catalog,
  creating,
  onCreate,
  onOpen,
  onStop,
}: {
  catalog: Catalog;
  creating: boolean;
  onCreate: (id: string) => void;
  onOpen: (id: string) => void;
  onStop: (attempt: PastAttempt) => void;
}) {
  const [query, setQuery] = useState('');
  const [runtime, setRuntime] = useState('');
  const [allAttempts, setAllAttempts] = useState(false);
  const catalogList = useRef<HTMLDivElement>(null);
  const activeAttempt = catalog.attempts.find((attempt) => attempt.status === 'active');
  const stackNames = new Map(catalog.problems.map((p) => [p.id, runtimeName(p.runtime)]));
  const runtimes = [...new Set(catalog.problems.map((p) => p.runtime))].sort();
  const filtered = catalog.problems.filter(
    (p) =>
      (!runtime || p.runtime === runtime) &&
      (p.title + ' ' + p.description + ' ' + runtimeName(p.runtime))
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const resultIds = filtered.map((p) => p.id).join(' ');
  useLayoutEffect(() => {
    const list = catalogList.current;
    if (!list || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = list.animate(
      [
        { opacity: 0.82, transform: 'translateY(18px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 380, easing: 'ease-out' },
    );
    return () => animation.cancel();
  }, [resultIds]);
  const attempts = allAttempts ? catalog.attempts : catalog.attempts.slice(0, 4);
  return (
    <main className="page library">
      <header className="library-heading">
        <div>
          <h1>
            Practice <span>library</span>
          </h1>
          <p>Investigate a bug, test a fix, and compare notes with your AI coach.</p>
          {activeAttempt && (
            <div className="resume-actions">
              <button
                className="resume-attempt"
                title={activeAttempt.title}
                onClick={() => onOpen(activeAttempt.id)}
              >
                Resume
              </button>
              <Button
                variant="outline"
                className="secondary mobile-stop"
                disabled={creating}
                onClick={() => onStop(activeAttempt)}
              >
                Stop attempt
              </Button>
            </div>
          )}
        </div>
      </header>
      <div className="catalog-panel">
        <LibraryMark />
        <section className="daily-panel" aria-labelledby="daily-heading">
          <h2 id="daily-heading">The Daily</h2>
          <p className="daily-card">Daily practice is coming soon.</p>
        </section>
        <section aria-labelledby="exercises">
          <h2 id="exercises">Exercises</h2>
          <div className="catalog-filters">
            <label className="catalog-search">
              <Search size={16} />
              <Input
                type="search"
                aria-label="Search exercises"
                placeholder="Search exercises"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="runtime-filter">
              <ListFilter size={15} />
              <NativeSelect
                aria-label="Filter by stack"
                value={runtime}
                onChange={(e) => setRuntime(e.target.value)}
              >
                <option value="">All stacks</option>
                {runtimes.map((r) => (
                  <option key={r} value={r}>
                    {runtimeName(r)}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <div className="catalog-list" ref={catalogList}>
            {filtered.map((p, index) => (
              <button
                className={'exercise-tile problem-' + p.id + (index === 0 ? ' exercise-featured' : '')}
                key={p.id}
                disabled={creating}
                onClick={() => onCreate(p.id)}
              >
                <ExerciseCover id={p.id} />
                <span className="exercise-copy">
                  <strong>{p.title}</strong>
                  <span>{p.description}</span>
                  <small>
                    <span>{runtimeName(p.runtime)}</span>
                    <span>{p.durationMinutes} min</span>
                  </small>
                </span>
                <ArrowRight className="exercise-open" size={18} />
              </button>
            ))}
            {!filtered.length && (
              <div className="catalog-empty">
                <p>
                  {catalog.problems.length
                    ? 'No exercises match those filters.'
                    : 'No validated exercises yet.'}
                </p>
                {catalog.problems.length > 0 && (
                  <button
                    className="link-button"
                    onClick={() => {
                      setQuery('');
                      setRuntime('');
                    }}
                  >
                    Clear filters <X size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
      <aside className="recent-panel" aria-labelledby="recent-attempts">
        <div className="section-title">
          <h2 id="recent-attempts">Recent attempts</h2>
        </div>
        {attempts.length ? (
          <div className="attempt-list">
            {attempts.map((a) => (
              <div className="attempt-row" key={a.id}>
                <button
                  className="attempt-entry"
                  title={`Created ${dateLabel(a.createdAt)}\nReplay seed ${a.seed}`}
                  onClick={() => onOpen(a.id)}
                >
                  <strong>{a.title}</strong>
                  <span className="attempt-detail">
                    <span>{stackNames.get(a.problemId) || a.problemId}</span>
                    <span className={'history-status history-status-' + a.status}>
                      {statusLabel(a.status)}
                    </span>
                  </span>
                </button>
                {canStopAttempt(a) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="secondary small"
                    aria-label={'Stop attempt for ' + a.title}
                    disabled={creating}
                    onClick={() => onStop(a)}
                  >
                    Stop
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="history-empty">
            Open an exercise to start your first attempt. You can return here to resume it or review
            your results.
          </p>
        )}
        {catalog.attempts.length > 4 && (
          <button
            className="link-button history-toggle"
            onClick={() => setAllAttempts(!allAttempts)}
          >
            {allAttempts
              ? 'Show recent only'
              : 'View all attempts (' + catalog.attempts.length + ')'}
          </button>
        )}
      </aside>
    </main>
  );
}

function dashboardCopy(attempt: Attempt) {
  switch (attempt.status) {
    case 'active':
      return {
        heading: 'Interview in progress',
        detail: 'Your timer is running. Pick up where you left off.',
        button: 'Resume interview',
      };
    case 'finalizing':
      return {
        heading: 'Submitting interview',
        detail: 'Your saved work is being graded.',
        button: 'Submitting',
      };
    case 'stopping':
      return { heading: 'Stopping attempt', detail: 'Closing the workspace.', button: 'Stopping' };
    case 'error': {
      const cleanup = attempt.completionReason === 'stopped';
      return {
        heading: cleanup ? 'Workspace cleanup failed' : 'Workspace setup failed',
        detail: attempt.error || attempt.logs.at(-1),
        button: cleanup ? 'Retry cleanup' : 'Retry setup',
      };
    }
    default:
      return {
        heading: 'Before you begin',
        detail: 'Your timer starts when you select Begin. You can leave and return to this attempt from the library.',
        button: attempt.status === 'ready' ? 'Begin' : 'Preparing workspace',
      };
  }
}

export function Dashboard({
  attempt,
  busy,
  onBegin,
  onSolve,
  onRetry,
  onStop,
  onSettings,
}: {
  attempt: Attempt;
  busy: boolean;
  onBegin: () => void;
  onSolve: () => void;
  onRetry: () => void;
  onStop: () => void;
  onSettings: () => void;
}) {
  const active = attempt.status === 'active',
    ready = attempt.status === 'ready',
    failed = attempt.status === 'error';
  const { heading, detail, button } = dashboardCopy(attempt);
  const logName = attempt.completionReason === 'stopped'
    ? 'Cleanup log'
    : attempt.status === 'finalizing' ? 'Submission log' : 'Preparation log';
  return (
    <main className="page dashboard">
      <header className="attempt-intro">
        <div className="metadata">
          <span><Code size={16} aria-hidden="true" /> {runtimeName(attempt.runtime)}</span>
          <span><Clock3 size={15} aria-hidden="true" /> {attempt.durationMinutes} min</span>
          <span><GitBranch size={15} aria-hidden="true" /> Seed {attempt.seed}</span>
        </div>
        <h1>{attempt.title}</h1>
        <p>{attempt.description}</p>
      </header>
      <div className="launch-layout">
        <section className="brief-document">
          <h2>
            <BookOpen size={19} /> Exercise brief
          </h2>
          <TextMarkdown text={attempt.prompt.replace(/^# [^\n]+\n+/, '')} />
        </section>
        <aside className="launch-panel">
          <div className={'attempt-state state-' + attempt.status}>
            {statusLabel(attempt.status)}
          </div>
          <h2>{heading}</h2>
          <p>{detail}</p>
          <Button
            className="primary launch-button"
            disabled={busy || (!ready && !active && !failed)}
            onClick={active ? onSolve : failed ? onRetry : onBegin}
          >
            {button}
            {ready || active ? <ArrowRight size={16} /> : !failed && <Spinner />}
          </Button>
          {canStopAttempt(attempt) && (
            <Button variant="outline" className="secondary launch-stop" disabled={busy} onClick={onStop}>
              Stop attempt
            </Button>
          )}
          <button className="link-button launch-settings" onClick={onSettings}>
            <SlidersHorizontal size={14} aria-hidden="true" /> Assistant settings
          </button>
          {failed && (
            <span role="alert" className="notice danger">
              <CircleAlert size={16} /> Check the {logName.toLowerCase()}.
            </span>
          )}
        </aside>
      </div>
      {!active && !ready && (
        <section className="setup-log">
          <h2>{logName}</h2>
          <pre>{attempt.logs.slice(-12).join('\n') || 'Connecting to the local runtime…'}</pre>
        </section>
      )}
    </main>
  );
}

export function Review({
  attempt,
  onReplay,
  onLibrary,
  busy,
}: {
  attempt: Attempt;
  onReplay: () => void;
  onLibrary: () => void;
  busy: boolean;
}) {
  const stopped = attempt.status === 'stopped';
  const [tab, setTab] = useState<'results' | 'diff' | 'chat'>(stopped ? 'diff' : 'results');
  return (
    <main className="page review">
      <div className="page-intro">
        <div>
          <div className="breadcrumb">
            <button onClick={onLibrary}>Practice library</button>
            <ChevronRight size={13} />
            Attempt review
          </div>
          <h1>{attempt.title}</h1>
          <p className="review-metadata">
            <span>{runtimeName(attempt.runtime)}</span>
            <span>Seed {attempt.seed}</span>
            <span>{dateLabel(attempt.createdAt)}</span>
          </p>
        </div>
        <Button variant="outline" className="secondary" onClick={onReplay} disabled={busy}>
          <GitBranch size={16} />
          Replay this seed
        </Button>
      </div>
      <div className="review-summary">
        <div className="row-icon">
          {stopped ? <CircleStop size={24} /> : <ShieldCheck size={24} />}
        </div>
        <div>
          <h2>{stopped ? 'Attempt stopped' : 'Interview complete'}</h2>
          <p>
            {stopped
              ? 'You ended this attempt without a grade.'
              : attempt.completionReason === 'expired'
                ? 'The interview timer expired.'
                : 'Your submission has been saved.'}
            {typeof attempt.elapsedSeconds === 'number' && (
              <span>
                {' '}
                Elapsed time {Math.floor(attempt.elapsedSeconds / 60)} min{' '}
                {Math.floor(attempt.elapsedSeconds % 60)} sec.
              </span>
            )}
          </p>
        </div>
        {!stopped && <strong className="review-score">{gradeLabel(attempt.grade)}</strong>}
      </div>
      <nav className="inline-tabs" aria-label="Attempt review">
        {!stopped && (
          <button className={tab === 'results' ? 'selected' : ''} onClick={() => setTab('results')}>
            <Check size={15} />
            Results
          </button>
        )}
        <button className={tab === 'diff' ? 'selected' : ''} onClick={() => setTab('diff')}>
          <GitBranch size={15} />
          Code changes
        </button>
        <button className={tab === 'chat' ? 'selected' : ''} onClick={() => setTab('chat')}>
          <MessageSquare size={15} />
          Conversations
        </button>
      </nav>
      {tab === 'results' ? (
        <div className="review-columns">
          <section className="panel">
            {attempt.grade ? (
              <TestResults grade={attempt.grade} />
            ) : (
              <p>No test result was recorded for this submission.</p>
            )}
            {attempt.testStatus === 'error' && (
              <p className="notice danger">
                {attempt.error || attempt.logs.at(-1) || 'The grader could not finish.'}
              </p>
            )}
          </section>
          <section className="panel debrief">
            <h2>Instructor debrief</h2>
            <TextMarkdown
              text={attempt.review?.debrief || 'No debrief was supplied for this problem.'}
            />
          </section>
        </div>
      ) : tab === 'diff' ? (
        <section className="panel">
          <h2>{stopped ? 'Saved changes' : 'Submitted changes'}</h2>
          <pre className="diff">{attempt.review?.diff || 'No source changes.'}</pre>
        </section>
      ) : (
        <section className="panel">
          <h2>Assistant conversations</h2>
          {attempt.chats.length ? (
            attempt.chats.map((chat, i) => (
              <details className="output" key={chat.id}>
                <summary>Conversation {i + 1}</summary>
                {chat.messages.map((msg, j) => (
                  <article className="chat-message" key={j}>
                    <strong>{msg.role === 'user' ? 'You' : 'AI coach'}</strong>
                    <TextMarkdown text={msg.content} />
                  </article>
                ))}
              </details>
            ))
          ) : (
            <p className="quiet">No messages were sent during this interview.</p>
          )}
        </section>
      )}
    </main>
  );
}
