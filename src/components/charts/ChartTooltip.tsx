import type { ReactNode } from 'react';

// Tooltip genérico con estilo glass para todos los gráficos. Acepta un render
// custom de filas o usa un formatter por defecto.

interface RowEntry {
  name?: string;
  value?: number | string | null;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown>; name?: string; value?: number | string | null; color?: string }>;
  label?: string | number;
  formatter?: (value: number) => string;
  /** Render totalmente custom a partir del datum. */
  renderBody?: (datum: Record<string, unknown>) => ReactNode;
  /** Título custom (por defecto usa `label`). */
  titleKey?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  renderBody,
  titleKey,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0].payload;
  const title = titleKey ? String(datum[titleKey] ?? '') : String(label ?? '');

  return (
    <div
      className="glass-strong rounded-xl px-3.5 py-2.5 shadow-xl animate-scale-in"
      style={{ minWidth: 140 }}
    >
      {title && (
        <p className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wide">
          {title}
        </p>
      )}
      {renderBody ? (
        renderBody(datum)
      ) : (
        <div className="space-y-0.5">
          {payload.map((entry: RowEntry, i: number) => (
            <p key={i} className="text-sm font-medium" style={{ color: entry.color || '#f59e0b' }}>
              {entry.name ? `${entry.name}: ` : ''}
              {entry.value == null
                ? 'En curso…'
                : formatter && typeof entry.value === 'number'
                  ? formatter(entry.value)
                  : entry.value}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
