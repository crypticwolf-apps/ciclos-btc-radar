import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="glass flex flex-col items-center gap-4 rounded-2xl p-10 text-center animate-fade-in">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bear/10 text-bear">
        <AlertTriangle size={28} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-primary">No se pudieron cargar los datos</h3>
        <p className="mt-1 max-w-md text-sm text-muted">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-btc px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-105"
        >
          <RefreshCw size={16} /> Reintentar
        </button>
      )}
    </div>
  );
}
