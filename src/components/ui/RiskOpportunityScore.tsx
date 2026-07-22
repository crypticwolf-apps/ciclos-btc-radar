import { useEffect, useState } from 'react';
import type { OpportunityScore } from '@/types';
import { scoreColor } from '@/services/cycleDetector';

interface RiskOpportunityScoreProps {
  opportunity: OpportunityScore;
}

const CENTER_X = 120;
const CENTER_Y = 112;
const NEEDLE_LENGTH = 72;

export function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(score) ? score : 0));
}

export function scoreToNeedlePoint(score: number) {
  const angle = Math.PI + (clampScore(score) / 100) * Math.PI;
  return {
    x: CENTER_X + NEEDLE_LENGTH * Math.cos(angle),
    y: CENTER_Y + NEEDLE_LENGTH * Math.sin(angle),
  };
}

export function RiskOpportunityScore({ opportunity }: RiskOpportunityScoreProps) {
  const score = clampScore(opportunity.score);
  const color = scoreColor(score);
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    let raf = 0;
    const startedAt = performance.now();
    const from = animated;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 800);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(from + (score - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // La animación parte del valor visible y solo se reinicia si cambia el score.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const needle = scoreToNeedlePoint(animated);
  const rounded = Math.round(animated);

  return (
    <div
      role="meter"
      aria-label="Termómetro de oportunidad"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(score)}
      aria-valuetext={`${Math.round(score)} de 100, ${opportunity.etiqueta}`}
      className="w-full max-w-[340px] shrink-0"
    >
      <svg
        viewBox="0 0 240 126"
        className="block h-auto w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="score-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="48%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <filter id="needle-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.35" />
          </filter>
        </defs>

        <path
          d="M 24 112 A 96 96 0 0 1 216 112"
          fill="none"
          stroke="var(--surface-border)"
          strokeWidth="20"
          strokeLinecap="round"
        />
        <path
          d="M 24 112 A 96 96 0 0 1 216 112"
          fill="none"
          stroke="url(#score-gradient)"
          strokeWidth="13"
          strokeLinecap="round"
        />

        {[0, 25, 50, 75, 100].map((tick) => {
          const outer = scoreToPoint(tick, 88);
          const inner = scoreToPoint(tick, 78);
          return (
            <line
              key={tick}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(255,255,255,0.72)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}

        <g filter="url(#needle-shadow)">
          <line
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={needle.x}
            y2={needle.y}
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx={CENTER_X} cy={CENTER_Y} r="10" fill="var(--surface-strong)" stroke={color} strokeWidth="4" />
          <circle cx={CENTER_X} cy={CENTER_Y} r="3" fill={color} />
        </g>
      </svg>

      <div className="mt-1 flex flex-col items-center text-center">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-4xl font-extrabold tabular-nums sm:text-5xl" style={{ color }}>
            {rounded}
          </span>
          <span className="text-xs text-muted">/ 100</span>
        </div>
        <span
          className="mt-1 rounded-full px-3 py-1 text-sm font-semibold"
          style={{ background: `${color}1f`, color, border: `1px solid ${color}55` }}
        >
          {opportunity.etiqueta}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[9px] font-medium leading-tight text-muted sm:text-[10px]">
        {['Riesgo', 'Cautela', 'Neutral', 'Oport.', 'Alta'].map((label) => (
          <span key={label} className="min-w-0">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function scoreToPoint(score: number, radius: number) {
  const angle = Math.PI + (clampScore(score) / 100) * Math.PI;
  return {
    x: CENTER_X + radius * Math.cos(angle),
    y: CENTER_Y + radius * Math.sin(angle),
  };
}
