// =============================================================================
// Tipos del contrato con la API interna (/api/*). Reflejan el envelope que
// devuelve el backend (ver api/_lib/respond.ts). El front NUNCA llama a APIs
// externas directamente: siempre pasa por estas rutas.
// =============================================================================

export type DataStatus = 'live' | 'cached' | 'stale' | 'unavailable' | 'locked';

export interface SourceMeta {
  provider: string;
  status: DataStatus;
  /** ISO UTC en que se obtuvo el dato de la fuente. */
  fetchedAt: string | null;
  /** Fecha real de observación (series macro, etc.). */
  observedAt?: string | null;
  latencyMs?: number;
  note?: string;
}

export interface Envelope<T> {
  ok: boolean;
  data: T | null;
  meta: {
    generatedAt: string;
    sources: SourceMeta[];
  };
  error?: string;
}

// --- "Estado de fuentes" (/api/health) --------------------------------------

export interface ProviderProbe {
  provider: string;
  label: string;
  status: DataStatus;
  fetchedAt: string | null;
  latencyMs: number;
  note?: string;
}

export interface HealthReport {
  checkedAt: string;
  macroConfigured: boolean;
  healthy: number;
  total: number;
  providers: ProviderProbe[];
}

/** ¿El estado representa un dato utilizable (aunque sea de cache)? */
export function isUsable(status: DataStatus): boolean {
  return status === 'live' || status === 'cached' || status === 'stale';
}

/** Etiqueta corta en español para un estado de dato. */
export function statusLabel(status: DataStatus): string {
  switch (status) {
    case 'live':
      return 'En vivo';
    case 'cached':
      return 'Cacheado';
    case 'stale':
      return 'Retrasado';
    case 'locked':
      return 'Requiere proveedor';
    case 'unavailable':
    default:
      return 'No disponible';
  }
}
