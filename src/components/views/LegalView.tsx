import { ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export function LegalView() {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-btc/10 text-btc">
          <ShieldAlert size={22} />
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-primary">Aviso legal</h2>
          <p className="mt-1 text-sm font-semibold text-secondary">Información educativa, no asesoramiento financiero.</p>
        </div>
      </div>
      <div className="mt-5 space-y-3 text-sm leading-relaxed text-secondary">
        <p>
          Ciclos BTC presenta datos de mercado, estimaciones e indicadores históricos con fines exclusivamente informativos y educativos. Nada de lo mostrado constituye una recomendación de compra, venta o mantenimiento de Bitcoin ni de ningún otro activo.
        </p>
        <p>
          Los datos históricos no garantizan resultados futuros. Bitcoin es un activo extremadamente volátil: su precio puede caer de forma rápida y prolongada, y puedes perder parte o la totalidad del capital invertido.
        </p>
        <p>
          Las métricas pueden contener retrasos, errores de proveedor, periodos sin datos o cálculos aproximados. Comprueba siempre la información en varias fuentes, realiza tu propia investigación y consulta a un profesional autorizado antes de tomar decisiones financieras.
        </p>
        <p className="rounded-2xl border border-btc/20 bg-btc/5 p-3.5 font-semibold text-primary">
          No inviertas dinero que no puedas permitirte perder y define previamente tu tolerancia al riesgo.
        </p>
      </div>
    </Card>
  );
}
