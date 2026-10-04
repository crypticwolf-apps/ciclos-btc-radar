import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { persistQueries, restoreQueries } from '@/lib/data/persist';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { reloadOnce } from '@/lib/reloadOnChunkError';
import './index.css';

// Cliente único de TanStack Query. Reintentos y refetch en foco activados;
// gcTime alto para conservar datos entre navegaciones de sección.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      gcTime: 30 * 60_000,
    },
  },
});

// Tras publicar una versión, los ficheros de la anterior desaparecen. Si la app
// abierta pide uno que ya no existe, Vite avisa con este evento: se recarga una
// vez para abrir la versión nueva (ver lib/reloadOnChunkError).
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnce()) event.preventDefault();
});

// Lo del último uso, al instante; y se va guardando lo nuevo.
restoreQueries(queryClient);
persistQueries(queryClient);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fullScreen>
      <QueryClientProvider client={queryClient}>
        <CurrencyProvider>
          <App />
        </CurrencyProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('No se pudo registrar el modo instalable.', error);
    });
  });
}
