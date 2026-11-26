import { Button } from '@/components/ui/button';
import { useEffect, useId, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Markdown from 'react-markdown';
import {
  CircleCheck,
  CircleX,
  Clock3,
  LoaderCircle,
  X,
} from '@keyline-icons/react/duotone';
import { elapsedLabel, gradeLabel } from './model';
import type { Grade } from './model';

export function Mark() {
  return <img src="/mark-small.png" className="brand-mark" alt="" />;
}
export function IconButton({
  label,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <Button variant="ghost" size="icon"
      type="button"
      className={'icon-button ' + className}
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
    </Button>
  );
}
export function TextMarkdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <Markdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
export function Spinner() {
  return <LoaderCircle className="spin" size={16} aria-hidden="true" />;
}
export function Timer({
  deadline,
  duration,
  now,
}: {
  deadline: number | null;
  duration: number;
  now: number;
}) {
  const { mins, secs, remaining } = elapsedLabel(deadline, duration, now);
  return (
    <span
      className={'timer ' + (deadline && remaining <= 300 ? 'timer-low' : '')}
      title="Remaining interview time"
    >
      <Clock3 size={14} />
      <span>
        {mins} min <span className="timer-sec">{secs} sec</span>
      </span>
    </span>
  );
}
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={'dialog ' + (wide ? 'dialog-wide' : '')}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </header>
      {children}
    </dialog>
  );
}
export function TestResults({
  grade,
  running = false,
}: {
  grade: Grade | null;
  running?: boolean;
}) {
  if (!grade)
    return (
      <div className="blank">
        <div className="blank-icon">{running ? <Spinner /> : <CircleCheck size={22} />}</div>
        <h3>{running ? 'Running tests' : 'No test results yet'}</h3>
        <p>
          {running
            ? 'The test runner is executing the current workspace.'
            : 'Run Tests to see assertions from your repository.'}
        </p>
      </div>
    );
  const passed =
    !grade.integrity?.length && grade.cases.length > 0 && grade.cases.every((test) => test.passed);
  return (
    <div className="test-results">
      <div className="section-title">
        <h3>
          Tests <span className={'count ' + (passed ? 'good' : 'bad')}>{gradeLabel(grade)}</span>
        </h3>
        {grade.stale && <span className="status-chip">Source changed</span>}
      </div>
      {grade.integrity?.length ? (
        <div className="notice danger">
          Protected files changed. Restore these files to receive a grade.
          <ul>
            {grade.integrity.map((path) => (
              <li key={path}>
                <code>{path}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {grade.cases.map((test, i) => (
        <details
          className={'test-case ' + (test.passed ? 'passed' : 'failed')}
          key={i}
          open={!test.passed && i === 0}
        >
          <summary>
            {test.passed ? (
              <CircleCheck size={16} className="good" />
            ) : (
              <CircleX size={16} className="bad" />
            )}
            <span>{test.name}</span>
          </summary>
          <pre>{test.detail || (test.passed ? 'Passed' : 'Failed')}</pre>
        </details>
      ))}
      {grade.output && (
        <details className="output">
          <summary>Test output</summary>
          <pre>{grade.output}</pre>
        </details>
      )}
    </div>
  );
}
