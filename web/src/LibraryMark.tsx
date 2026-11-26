import { useEffect, useMemo, useRef, useState } from 'react';
import artwork from './studio-mark.txt?raw';

const face = artwork.trimEnd().split(/\r?\n/);
const faceWidth = Math.max(...face.map((row) => row.length));
const columns = faceWidth + 2;
const height = columns * 0.75;
const lineHeight = height / face.length;
const frameCount = 72;

function renderFrame(frame: number) {
  const angle = (frame * 2 * Math.PI) / frameCount;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const halfDepth = Math.round(faceWidth / 12);
  return face.map((row) => {
    const line = Array<string>(columns).fill(' ');
    const depths = Array<number>(columns).fill(-Infinity);
    for (let column = 0; column < row.length; column++) {
      if (row[column] === ' ') continue;
      const x = column - (faceWidth - 1) / 2;
      // Project the folded face and its cut edges onto a fixed grid of upright glyphs.
      for (let z = -halfDepth; z <= halfDepth; z++) {
        const screenX = Math.round((columns - 1) / 2 + x * cos + z * sin);
        const depth = z * cos - x * sin;
        if (depth > depths[screenX]) {
          depths[screenX] = depth;
          line[screenX] = Math.abs(z) === halfDepth ? row[column] : '=';
        }
      }
    }
    return line.join('');
  });
}

export function LibraryMark() {
  const image = useRef<SVGSVGElement>(null);
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const rows = useMemo(() => renderFrame(frame), [frame]);
  useEffect(() => {
    const element = image.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let inView = false;
    let timer: number | undefined;
    function updatePlayback() {
      window.clearInterval(timer);
      if (reduced.matches) setFrame(0);
      else if (inView && !paused && !document.hidden) {
        timer = window.setInterval(() => setFrame((n) => (n + 1) % frameCount), 100);
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updatePlayback();
    });
    observer.observe(element);
    reduced.addEventListener('change', updatePlayback);
    document.addEventListener('visibilitychange', updatePlayback);
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      reduced.removeEventListener('change', updatePlayback);
      document.removeEventListener('visibilitychange', updatePlayback);
    };
  }, [paused]);

  return (
    <div className="library-mark">
      <svg
        ref={image}
        className="ascii-mark"
        viewBox={`0 0 ${columns} ${height}`}
        role="img"
        aria-label="AI Coding Interview Studio"
      >
        <text
          aria-hidden="true"
          xmlSpace="preserve"
          fill="currentColor"
          fontSize={lineHeight}
          dominantBaseline="central"
        >
          {rows.map((line, row) => (
            <tspan
              key={row}
              x="0"
              y={(row + 0.5) * lineHeight}
              textLength={columns}
              lengthAdjust="spacingAndGlyphs"
            >
              {line}
            </tspan>
          ))}
        </text>
      </svg>
      <button
        type="button"
        className="mark-toggle"
        aria-label="Pause logo rotation"
        aria-pressed={paused}
        title={paused ? 'Resume logo rotation' : 'Pause logo rotation'}
        onClick={() => setPaused(!paused)}
      />
    </div>
  );
}
