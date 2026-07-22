import { ShieldAlert } from 'lucide-react';

export function DisclaimerFooter() {
  return (
    <footer className="mt-10 space-y-4">
      <div className="glass flex items-start gap-3 rounded-2xl p-4">
        <ShieldAlert size={20} className="mt-0.5 shrink-0 text-btc" />
        <div className="text-sm text-secondary">
          <p className="font-semibold text-primary">
            Esto no es consejo financiero. Información con fines educativos.
          </p>
          <p className="mt-1 text-muted">
            Los datos históricos no garantizan resultados futuros. Bitcoin es un activo
            extremadamente volátil y puedes perder parte o la totalidad de tu inversión.
            Realiza siempre tu propia investigación (DYOR) y consulta con un profesional antes
            de tomar decisiones.
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1 text-center text-xs text-muted">
        <p>
          Fuentes de referencia: CoinGecko, Alternative.me (Fear &amp; Greed), Glassnode,
          Santiment, BlackRock, VanEck, ISM/FRED.
        </p>
        <p>Dashboard educativo · Construido con React, TypeScript, Tailwind y Recharts.</p>
      </div>
    </footer>
  );
}
