import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Globe, Monitor, RefreshCw } from 'lucide-react';
import type { PreviewPort } from './model';
import { IconButton, Spinner } from './ui';

const presets: Record<string, [number, number]> = {
  Mobile: [375, 812],
  Tablet: [768, 1024],
  'Desktop HD': [1280, 720],
  'Desktop Full HD': [1920, 1080],
};
function validUrl(value: string, base: string) {
  try {
    const url = new URL(value, new URL(base, location.href));
    return ['http:', 'https:'].includes(url.protocol) &&
      url.origin === new URL(base, location.href).origin
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function PortFrame({ port }: { port: PreviewPort }) {
  const root = new URL(port.url, location.href).href;
  const [url, setUrl] = useState(root),
    [input, setInput] = useState(root),
    [trail, setTrail] = useState([root]),
    [index, setIndex] = useState(0),
    [reload, setReload] = useState(0),
    [error, setError] = useState('');
  const [preset, setPreset] = useState('Fit'),
    [dims, setDims] = useState<[number, number]>([1280, 720]),
    [scale, setScale] = useState(1);
  const stage = useRef<HTMLDivElement>(null),
    frame = useRef<HTMLIFrameElement>(null),
    reported = useRef(root);
  useEffect(() => {
    function onLocation(e: MessageEvent) {
      if (
        e.source !== frame.current?.contentWindow ||
        e.origin !== new URL(root).origin ||
        e.data?.type !== 'acis-preview-location' ||
        typeof e.data.url !== 'string'
      )
        return;
      const next = validUrl(e.data.url, root);
      if (!next || next === reported.current) return;
      reported.current = next;
      setInput(next);
      const history = [...trail.slice(0, index + 1), next];
      setTrail(history);
      setIndex(history.length - 1);
    }
    window.addEventListener('message', onLocation);
    return () => window.removeEventListener('message', onLocation);
  }, [root, index, trail]);
  useEffect(() => {
    const container = stage.current;
    if (!container || preset === 'Fit') return;
    const measure = () =>
      setScale(
        Math.max(
          0.05,
          Math.min(
            1,
            (container.clientWidth - 16) / dims[0],
            (container.clientHeight - 16) / dims[1],
          ),
        ),
      );
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(container);
    return () => obs.disconnect();
  }, [dims, preset]);
  function display(next: string) {
    reported.current = next;
    setUrl(next);
    setInput(next);
    setError('');
    setReload((count) => count + 1);
  }
  function navigate() {
    const next = validUrl(input, root);
    if (!next) {
      setError('Enter a path or URL on this preview port.');
      return;
    }
    if (trail[index] !== next) {
      const history = [...trail.slice(0, index + 1), next];
      setTrail(history);
      setIndex(history.length - 1);
    }
    display(next);
  }
  function move(delta: number) {
    const target = index + delta;
    if (target < 0 || target >= trail.length) return;
    setIndex(target);
    display(trail[target]);
  }
  const fit = preset === 'Fit';
  return (
    <>
      <form
        className="address-bar"
        onSubmit={(e) => {
          e.preventDefault();
          navigate();
        }}
      >
        <IconButton label="Preview back" onClick={() => move(-1)} disabled={index <= 0}>
          <ArrowLeft />
        </IconButton>
        <IconButton
          label="Preview forward"
          onClick={() => move(1)}
          disabled={index + 1 >= trail.length}
        >
          <ArrowRight />
        </IconButton>
        <IconButton label="Reload preview" onClick={() => display(reported.current)}>
          <RefreshCw />
        </IconButton>
        <label>
          <Globe size={13} />
          <input
            aria-label="Preview URL"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <a
          className="icon-button"
          href={reported.current}
          target="_blank"
          rel="noreferrer"
          title="Open preview in a new tab"
          aria-label="Open preview in a new tab"
        >
          <ExternalLink size={15} />
        </a>
      </form>
      <div className="device-bar">
        <Monitor size={14} />
        <select
          aria-label="Preview device"
          value={preset}
          onChange={(e) => {
            const next = e.target.value;
            setPreset(next);
            if (presets[next]) setDims(presets[next]);
          }}
        >
          <option>Fit</option>
          <option>Custom</option>
          {Object.keys(presets).map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        {!fit && (
          <>
            <input
              aria-label="Preview width"
              type="number"
              min={160}
              max={4096}
              value={dims[0]}
              onChange={(e) => {
                setPreset('Custom');
                setDims([Math.min(4096, Math.max(1, Number(e.target.value))), dims[1]]);
              }}
            />
            <span>×</span>
            <input
              aria-label="Preview height"
              type="number"
              min={160}
              max={4096}
              value={dims[1]}
              onChange={(e) => {
                setPreset('Custom');
                setDims([dims[0], Math.min(4096, Math.max(1, Number(e.target.value)))]);
              }}
            />
            <small>{Math.round(scale * 100)}%</small>
          </>
        )}
      </div>
      {error && (
        <p className="coach-error" role="alert">
          {error}
        </p>
      )}
      <div className={'preview-stage ' + (fit ? 'fit' : 'scaled')} ref={stage}>
        <div
          className="device-frame"
          style={fit ? undefined : { width: dims[0] * scale, height: dims[1] * scale }}
        >
          <iframe
            ref={frame}
            title="Application preview"
            src={url}
            key={reload}
            style={
              fit
                ? undefined
                : { width: dims[0], height: dims[1], transform: 'scale(' + scale + ')' }
            }
          />
        </div>
      </div>
    </>
  );
}
export function Preview({
  ports,
  status,
  onRun,
  disabled,
}: {
  ports: PreviewPort[];
  status: string;
  onRun: () => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const port =
    ports.find((p) => p.port === selected) || ports.find((p) => p.port === 8080) || ports[0];
  if (status !== 'running' || !port)
    return (
      <div className="blank">
        <div className="blank-icon">
          {status === 'starting' ? <Spinner /> : <Monitor size={25} />}
        </div>
        <h3>
          {status === 'starting'
            ? 'Starting application'
            : status === 'error'
              ? 'Application failed to start'
              : 'Application preview'}
        </h3>
        <p>
          {status === 'starting'
            ? 'Waiting for the project services to be ready.'
            : status === 'error'
              ? 'Inspect the workspace output and try Run again.'
              : 'Run the project to open its live preview.'}
        </p>
        {status !== 'starting' && (
          <button className="secondary small" disabled={disabled} onClick={onRun}>
            Run project
          </button>
        )}
      </div>
    );
  return (
    <div className="preview">
      <div className="port-tabs" aria-label="Preview ports">
        {ports.map((p) => (
          <button
            className={port.port === p.port ? 'selected' : ''}
            key={p.port}
            onClick={() => setSelected(p.port)}
          >
            {p.label} <code>{p.port}</code>
          </button>
        ))}
      </div>
      <PortFrame port={port} key={port.port} />
    </div>
  );
}
