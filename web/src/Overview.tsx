import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Code,
  GitBranch,
  ListFilter,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
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
import { dateLabel, gradeLabel, runtimeName, statusLabel } from './model';
import type { Attempt, Catalog } from './model';
import { Spinner, TestResults, TextMarkdown } from './ui';

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
      <span>{topic}</span>
      <Icon aria-hidden="true" />
    </span>
  );
}

export function Library({
  catalog,
  creating,
  onCreate,
  onOpen,
}: {
  catalog: Catalog;
  creating: boolean;
  onCreate: (id: string, seed?: string) => void;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [runtime, setRuntime] = useState('');
  const [replaying, setReplaying] = useState(false);
  const [seed, setSeed] = useState('');
  const [allAttempts, setAllAttempts] = useState(false);
  const invalidSeed = replaying && !!seed.trim() && !/^[a-zA-Z0-9._-]+$/.test(seed.trim());
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
            <button className="resume-attempt" onClick={() => onOpen(activeAttempt.id)}>
              Resume {activeAttempt.title} <ArrowRight size={15} />
            </button>
          )}
        </div>
      </header>
      <section className="catalog-panel" aria-labelledby="exercises">
        <div className="section-title">
          <h2 id="exercises">
            Exercises <span className="item-count">{filtered.length}</span>
          </h2>
          <button
            className="link-button"
            aria-expanded={replaying}
            onClick={() => setReplaying(!replaying)}
          >
            Replay by seed
          </button>
        </div>
        {replaying && (
          <div className="seed-options">
            <label>
              Replay seed{' '}
              <Input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                maxLength={64}
                placeholder="e.g. 42"
                aria-invalid={invalidSeed}
                aria-describedby="seed-help"
              />
            </label>
            <small id="seed-help">
              {invalidSeed
                ? 'Use letters, numbers, dots, hyphens, or underscores.'
                : 'Used for the next exercise you open.'}
            </small>
          </div>
        )}
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
        <div className="catalog-list">
          {filtered.map((p) => (
            <button
              className={'exercise-tile problem-' + p.id}
              key={p.id}
              disabled={creating || invalidSeed}
              onClick={() => onCreate(p.id, replaying ? seed.trim() || undefined : undefined)}
            >
              <ExerciseCover id={p.id} />
              <span className="exercise-copy">
                <strong>{p.title}</strong>
                <span>{p.description}</span>
                <small>
                  {runtimeName(p.runtime)} <i>·</i> {p.durationMinutes} min
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
      <aside className="recent-panel" aria-labelledby="recent-attempts">
        <div className="section-title">
          <h2 id="recent-attempts">Recent attempts</h2>
        </div>
        {attempts.length ? (
          <div className="attempt-list">
            {attempts.map((a) => (
              <button key={a.id} className="attempt-entry" onClick={() => onOpen(a.id)}>
                <strong>{a.title}</strong>
                <span className="attempt-detail">
                  {stackNames.get(a.problemId) || a.problemId}
                  {' · '}
                  <span className={'history-status-' + a.status}>{statusLabel(a.status)}</span>
                </span>
                <small>
                  {dateLabel(a.createdAt)} · Seed {a.seed}
                </small>
              </button>
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

export function Dashboard({
  attempt,
  providerSummary,
  busy,
  onBegin,
  onSolve,
  onRetry,
  onSettings,
}: {
  attempt: Attempt;
  providerSummary: string;
  busy: boolean;
  onBegin: () => void;
  onSolve: () => void;
  onRetry: () => void;
  onSettings: () => void;
}) {
  const active = attempt.status === 'active',
    ready = attempt.status === 'ready',
    failed = attempt.status === 'error';
  return (
    <main className="page dashboard">
      <header className="attempt-intro">
        <div className="metadata">
          <Code size={16} />
          {runtimeName(attempt.runtime)} <i>·</i>
          <Clock3 size={15} />
          {attempt.durationMinutes} min
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
          <h2>
            {active
              ? 'Interview in progress'
              : failed
                ? 'Workspace setup failed'
                : 'Before you begin'}
          </h2>
          <p>
            {active
              ? 'Your timer is running. Pick up where you left off.'
              : failed
                ? attempt.error || attempt.logs.at(-1)
                : attempt.status === 'finalizing'
                  ? 'Your saved work is being graded.'
                  : 'Your timer starts when you select Begin. You can leave and return to this attempt from the library.'}
          </p>
          <Button
            className="primary launch-button"
            disabled={busy || (!ready && !active && !failed)}
            onClick={active ? onSolve : failed ? onRetry : onBegin}
          >
            {active
              ? 'Resume interview'
              : failed
                ? 'Retry setup'
                : ready
                  ? 'Begin'
                  : attempt.status === 'finalizing'
                    ? 'Submitting'
                    : 'Preparing workspace'}
            {ready || active ? <ArrowRight size={16} /> : !failed && <Spinner />}
          </Button>
          <div className="launch-coach">
            <h3>
              <Sparkles size={17} /> AI coach
            </h3>
            <p>{providerSummary}</p>
            <button className="link-button" onClick={onSettings}>
              Assistant settings <SlidersHorizontal size={13} />
            </button>
          </div>
          <small className="launch-seed">
            Replay seed <code>{attempt.seed}</code>
          </small>
          {failed && (
            <span role="alert" className="notice danger">
              <CircleAlert size={16} /> Check the preparation log.
            </span>
          )}
        </aside>
      </div>
      {!active && !ready && (
        <section className="setup-log">
          <h2>{attempt.status === 'finalizing' ? 'Submission log' : 'Preparation log'}</h2>
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
  const [tab, setTab] = useState<'results' | 'diff' | 'chat'>('results');
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
          <p>
            {runtimeName(attempt.runtime)} · Seed {attempt.seed} · {dateLabel(attempt.createdAt)}
          </p>
        </div>
        <Button variant="outline" className="secondary" onClick={onReplay} disabled={busy}>
          <GitBranch size={16} />
          Replay this seed
        </Button>
      </div>
      <div className="review-summary">
        <div className="row-icon">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h2>Interview complete</h2>
          <p>
            {attempt.completionReason === 'expired'
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
        <strong className="review-score">{gradeLabel(attempt.grade)}</strong>
      </div>
      <nav className="inline-tabs" aria-label="Attempt review">
        <button className={tab === 'results' ? 'selected' : ''} onClick={() => setTab('results')}>
          <Check size={15} />
          Results
        </button>
        <button className={tab === 'diff' ? 'selected' : ''} onClick={() => setTab('diff')}>
          <GitBranch size={15} />
          Code changes
        </button>
        <button className={tab === 'chat' ? 'selected' : ''} onClick={() => setTab('chat')}>
          <Sparkles size={15} />
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
          <h2>Submitted changes</h2>
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
