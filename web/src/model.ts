export type Status = 'preparing' | 'ready' | 'active' | 'finalizing' | 'review' | 'error';
export type ProviderId = 'codex' | 'openai' | 'gemini';
export interface Problem {
  id: string;
  title: string;
  description: string;
  runtime: string;
  durationMinutes: number;
}
export interface Provider {
  id: ProviderId;
  label: string;
  available: boolean;
  model: string;
}
export interface PastAttempt {
  id: string;
  problemId: string;
  title: string;
  status: Status;
  seed: string | number;
  deadline: number | null;
  createdAt: string | number;
}
export interface Chat {
  id: string;
  messages: { role: string; content: string }[];
}
export interface TestCase {
  name: string;
  passed: boolean;
  detail: string;
}
export interface Grade {
  cases: TestCase[];
  output: string;
  stale: boolean;
  integrity?: string[];
}
export interface PreviewPort {
  port: number;
  label: string;
  url: string;
}
export function gradeLabel(grade: Grade | null) {
  if (grade?.integrity?.length) return 'Zero credit';
  if (!grade?.cases.length) return 'Unscored';
  return grade.cases.filter((test) => test.passed).length + '/' + grade.cases.length;
}
export interface Attempt extends PastAttempt {
  description: string;
  runtime: string;
  durationMinutes: number;
  prompt: string;
  images: string[];
  logs: string[];
  editorUrl: string | null;
  previews: PreviewPort[];
  appStatus: 'stopped' | 'starting' | 'running' | 'error';
  testStatus: 'idle' | 'running' | 'done' | 'error';
  grade: Grade | null;
  error?: string;
  completionReason?: string;
  elapsedSeconds?: number;
  review?: { diff: string; debrief: string };
  chats: Chat[];
}
export interface Catalog {
  problems: Problem[];
  attempts: PastAttempt[];
  providers: Provider[];
}
export interface CoachSettings {
  provider: ProviderId;
  models: Partial<Record<ProviderId, string>>;
}
export interface Route {
  id: string | null;
  dashboard: boolean;
}
export function readRoute(): Route {
  const url = new URL(location.href);
  return { id: url.searchParams.get('attempt'), dashboard: url.hash === '#dashboard' };
}
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing can refuse persistence. */
  }
}
function initTab(): Promise<string> {
  const nav = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  let prior: string | null = null;
  try {
    if (nav?.type === 'reload' || nav?.type === 'back_forward')
      prior = sessionStorage.getItem('acis-tab-id');
  } catch {
    /* Per-document identity still works. */
  }
  const remember = (id: string) => {
    try {
      sessionStorage.setItem('acis-tab-id', id);
    } catch {
      /* Storage is optional. */
    }
    return id;
  };
  const candidate = prior || crypto.randomUUID();
  if (!navigator.locks) return Promise.resolve(remember(candidate));
  return new Promise((resolve) => {
    const hold = new Promise<void>((release) =>
      window.addEventListener('pagehide', () => release(), { once: true }),
    );
    void navigator.locks
      .request('acis-tab-' + candidate, { ifAvailable: true }, async (lock) => {
        if (lock) {
          resolve(remember(candidate));
          await hold;
        } else {
          const fresh = crypto.randomUUID();
          await navigator.locks.request('acis-tab-' + fresh, async () => {
            resolve(remember(fresh));
            await hold;
          });
        }
      })
      .catch(() => resolve(remember(crypto.randomUUID())));
  });
}
const tabId = initTab();
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = 'GET',
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = { 'X-ACIS-Tab': await tabId, Accept: 'application/json' };
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch('/api/' + path, {
    method,
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
    signal,
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new HttpError(response.status, result.error || result.message || response.statusText);
  return result as T;
}
export const attemptPath = (id: string) => 'attempts/' + encodeURIComponent(id);
export function runtimeName(value: string) {
  return (
    ({ django: 'Django', python: 'Python', node: 'Node.js' } as Record<string, string>)[value] ||
    value
  );
}
export function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}
export function elapsedLabel(deadline: number | null, duration: number, now = Date.now()) {
  const remaining =
    deadline === null ? duration * 60 : Math.max(0, Math.ceil((deadline - now) / 1000));
  return {
    mins: Math.floor(remaining / 60),
    secs: String(remaining % 60).padStart(2, '0'),
    remaining,
  };
}
export function statusLabel(status: Status) {
  return {
    preparing: 'Preparing',
    ready: 'Ready',
    active: 'In progress',
    finalizing: 'Submitting',
    review: 'Completed',
    error: 'Needs attention',
  }[status];
}
export function dateLabel(value: string | number) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? ''
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}
