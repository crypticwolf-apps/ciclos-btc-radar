import { useEffect, useState } from 'react';
import type { OpportunityScore } from '@/types';
import { scoreColor } from '@/services/cycleDetector';

// Medidor semicircular animado del score 0-100 (0 = riesgo, 100 = oportunidad).
interface RiskOpportunityScoreProps {
  opportunity: OpportunityScore;
  size?: number;
}

export function RiskOpportunityScore({ opportunity, size = 220 }: RiskOpportunityScoreProps) {
  const { score, etiqueta } = opportunity;
  const color = scoreColor(score);

  // Animación de barrido de la aguja al montar / cambiar el score.
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = animated;
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(from + (score - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const radius = size / 2 - 16;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * radius; // semicírculo
  const progress = (animated / 100) * circumference;

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        {/* Pista */}
        <path
          d={describeArc(cx, cy, radius, 180, 360)}
          fill="none"
          stroke="var(--surface-border)"
          strokeWidth={14}
          strokeLinecap="round"
        />
        {/* Progreso */}
        <path
          d={describeArc(cx, cy, radius, 180, 360)}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
        />
      </svg>
      <div className="-mt-[68%] flex flex-col items-center">
        <span className="font-mono text-5xl font-extrabold tabular-nums" style={{ color }}>
          {Math.round(animated)}
        </span>
        <span className="text-xs text-muted">/ 100</span>
        <span
          className="mt-2 rounded-full px-3 py-1 text-sm font-semibold"
          style={{ background: `${color}1f`, color, border: `1px solid ${color}55` }}
        >
          {etiqueta}
        </span>
      </div>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}
