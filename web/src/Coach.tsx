import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  History,
  MessageSquarePlus,
  Paperclip,
  SlidersHorizontal,
  MessageSquare,
} from '@keyline-icons/react/duotone';
import { api, attemptPath, errorMessage } from './model';
import type { Attempt, CoachSettings, Provider } from './model';
import { Dialog, IconButton, Spinner, TextMarkdown } from './ui';

export function Settings({
  providers,
  settings,
  onChange,
  onClose,
}: {
  providers: Provider[];
  settings: CoachSettings;
  onChange: (s: CoachSettings) => void;
  onClose: () => void;
}) {
  const provider = providers.find((p) => p.id === settings.provider);
  return (
    <Dialog title="Assistant settings" onClose={onClose}>
      <div className="dialog-body">
        <p className="lead">Choose the connection used for coaching in this workspace.</p>
        <div className="form-label">
          <label htmlFor="assistant-provider">Provider</label>
          <NativeSelect
            id="assistant-provider"
            value={settings.provider}
            onChange={(e) =>
              onChange({ ...settings, provider: e.target.value as CoachSettings['provider'] })
            }
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.available ? '' : ' (unavailable)'}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="form-label">
          Model override
          <Input
            value={settings.models[settings.provider] || ''}
            placeholder={provider?.model || 'Provider default'}
            maxLength={100}
            spellCheck={false}
            onChange={(e) =>
              onChange({
                ...settings,
                models: { ...settings.models, [settings.provider]: e.target.value },
              })
            }
          />
        </label>
        <div className={'notice ' + (provider?.available ? '' : 'warn')}>
          <span className={'status-dot ' + (provider?.available ? '' : 'off')} />
          <span>
            {provider?.available ? 'Connection configured.' : 'Connection unavailable.'}{' '}
            {settings.provider === 'codex'
              ? 'Uses your local Codex CLI sign-in.'
              : settings.provider === 'openai'
                ? 'Reads OPENAI_API_KEY from the host.'
                : 'Reads GEMINI_API_KEY from the host.'}
          </span>
        </div>
      </div>
      <footer>
        <Button className="primary" onClick={onClose}>
          Done
        </Button>
      </footer>
    </Dialog>
  );
}
export function Coach({
  attempt,
  providers,
  settings,
  onSettings,
  refresh,
}: {
  attempt: Attempt;
  providers: Provider[];
  settings: CoachSettings;
  onSettings: () => void;
  refresh: () => void;
}) {
  const [id, setId] = useState<string | null>(() => attempt.chats.at(-1)?.id ?? null);
  const [history, setHistory] = useState(false),
    [context, setContext] = useState(false),
    [allFiles, setAllFiles] = useState<string[]>([]),
    [fileSearch, setFileSearch] = useState('');
  const [files, setFiles] = useState<string[]>([]),
    [includeTests, setIncludeTests] = useState(false),
    [draft, setDraft] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [pending, setPending] = useState(''),
    [lastAnswer, setLastAnswer] = useState<{ id: string; question: string; answer: string } | null>(
      null,
    );
  const scroll = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const current = attempt.chats.find((c) => c.id === id);
  const provider = providers.find((p) => p.id === settings.provider);
  const messages = [...(current?.messages || [])];
  if (lastAnswer?.id === id && messages.at(-1)?.content !== lastAnswer?.answer && lastAnswer) {
    messages.push(
      { role: 'user', content: lastAnswer.question },
      { role: 'assistant', content: lastAnswer.answer },
    );
  }
  if (pending && messages.at(-1)?.content !== pending)
    messages.push({ role: 'user', content: pending });
  useEffect(() => {
    const area = scroll.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [id, messages.length, busy]);
  async function attach() {
    setContext(true);
    setError('');
    setFileSearch('');
    try {
      const data = await api<{ files: string[] }>(attemptPath(attempt.id) + '/files');
      setAllFiles(data.files);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function send() {
    const question = draft.trim();
    if (!question || busy || !provider?.available) return;
    setBusy(true);
    setPending(question);
    setDraft('');
    setError('');
    try {
      const response = await api<{ chatId: string; content: string }>(
        attemptPath(attempt.id) + '/chat',
        'POST',
        {
          chatId: id || undefined,
          provider: settings.provider,
          model: settings.models[settings.provider] || undefined,
          message: question,
          files,
          includeTests,
        },
      );
      setId(response.chatId);
      setLastAnswer({ id: response.chatId, question, answer: response.content });
      refresh();
    } catch (e) {
      setDraft(question);
      setError(errorMessage(e));
    } finally {
      setPending('');
      setBusy(false);
    }
  }
  return (
    <>
      <div className="conversation" ref={scroll}>
        {messages.length === 0 ? (
          <div className="coach-intro">
            <div className="coach-star">
              <MessageSquare size={26} />
            </div>
            <h2>Where are you stuck?</h2>
            <p>Talk through the evidence with your coach while you work on a fix.</p>
            {!draft &&
              ['Help me reproduce the issue', 'Help me interpret a failing test'].map(
                (question) => (
                  <button
                    key={question}
                    className="coach-prompt"
                    onClick={() => {
                      setDraft(question);
                      composer.current?.focus();
                    }}
                  >
                    {question} <ArrowUp size={13} />
                  </button>
                ),
              )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <article key={i} className={'chat-message ' + msg.role}>
              <strong>{msg.role === 'user' ? 'You' : 'AI Assistant'}</strong>
              <TextMarkdown text={msg.content} />
            </article>
          ))
        )}
        {busy && (
          <p className="thinking">
            <Spinner />
            Thinking…
          </p>
        )}
      </div>
      {error && (
        <div className="coach-error" role="alert">
          {error}
        </div>
      )}
      <div className="composer-wrap">
        {!provider?.available && (
          <button className="unavailable" onClick={onSettings}>
            <span className="status-dot off" />
            Set up an assistant connection <SlidersHorizontal size={13} />
          </button>
        )}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <button type="button" className="attach" onClick={() => void attach()}>
            <Paperclip size={12} />
            {files.length || includeTests
              ? 'Context (' + (files.length + (includeTests ? 1 : 0)) + ')'
              : 'Add Context'}
          </button>
          <Textarea
            ref={composer}
            aria-label="Message the AI assistant"
            placeholder="Ask about your code…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            maxLength={6000}
          />
          <div className="compose-actions">
            <button className="provider-button" type="button" onClick={onSettings}>
              {provider?.label || 'Provider'} <ChevronDown size={12} />
            </button>
            <div className="chat-tools">
              <IconButton
                label="New chat"
                disabled={busy}
                onClick={() => {
                  setId(null);
                  setLastAnswer(null);
                  setDraft('');
                  setFiles([]);
                  setIncludeTests(false);
                  setError('');
                }}
              >
                <MessageSquarePlus />
              </IconButton>
              <IconButton label="Chat history" onClick={() => setHistory(true)}>
                <History />
              </IconButton>
            </div>
            <button
              className="send"
              type="submit"
              title="Send message"
              aria-label="Send message"
              disabled={!draft.trim() || busy || !provider?.available}
            >
              {busy ? <Spinner /> : <ArrowUp size={15} />}
            </button>
          </div>
        </form>
      </div>
      {history && (
        <Dialog title="Chat history" onClose={() => setHistory(false)}>
          <div className="dialog-body">
            {attempt.chats.length ? (
              attempt.chats.map((chat, i) => (
                <button
                  className="chat-choice"
                  key={chat.id}
                  disabled={busy}
                  onClick={() => {
                    setId(chat.id);
                    setHistory(false);
                    setLastAnswer(null);
                    setError('');
                  }}
                >
                  <Clock3 size={15} />
                  <span>{chat.messages[0]?.content || 'Conversation ' + (i + 1)}</span>
                  {chat.id === id && <Check size={14} />}
                </button>
              ))
            ) : (
              <p>No conversations yet.</p>
            )}
          </div>
        </Dialog>
      )}
      {context && (
        <Dialog title="Add context" onClose={() => setContext(false)}>
          <div className="dialog-body">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={includeTests}
                onChange={(e) => setIncludeTests(e.target.checked)}
              />
              Include the latest test output
            </label>
            <label className="form-label">
              Workspace files (up to four)
              <Input
                placeholder="Filter by path"
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
              />
            </label>
            <div className="file-list">
              {allFiles
                .filter((path) => path.toLowerCase().includes(fileSearch.toLowerCase()))
                .map((path) => (
                  <label className="checkbox" key={path}>
                    <input
                      type="checkbox"
                      checked={files.includes(path)}
                      disabled={files.length >= 4 && !files.includes(path)}
                      onChange={(e) =>
                        setFiles((prev) =>
                          e.target.checked ? [...prev, path] : prev.filter((f) => f !== path),
                        )
                      }
                    />
                    <FileText size={13} />
                    <span>{path}</span>
                  </label>
                ))}
            </div>
          </div>
          <footer>
            <Button className="primary" onClick={() => setContext(false)}>
              Done
            </Button>
          </footer>
        </Dialog>
      )}
    </>
  );
}
