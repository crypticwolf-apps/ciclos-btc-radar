import type { CyclePhase, CyclePhaseId } from '@/types';

// =============================================================================
// Catálogo de fases del ciclo de Bitcoin.
// Cada fase incluye color, narrativa, señales, riesgos, oportunidades y una
// comparación histórica. El detector de ciclo (services/cycleDetector.ts)
// devuelve uno de estos identificadores.
// =============================================================================

export const PHASES: Record<CyclePhaseId, CyclePhase> = {
  acumulacion: {
    id: 'acumulacion',
    nombre: 'Acumulación',
    color: '#22c55e',
    emoji: '🌱',
    descripcion:
      'El precio se mueve lateral tras una gran caída. El miedo aún domina, pero las manos fuertes empiezan a comprar a quien capitula.',
    senales: [
      'Volatilidad baja y rango lateral prolongado',
      'Volumen decreciente y desinterés del público',
      'Direcciones de largo plazo dejan de vender',
    ],
    riesgos: [
      'La paciencia se prueba: puede durar meses',
      'Posibles nuevos mínimos antes del giro',
    ],
    oportunidades: [
      'Costes de entrada históricamente bajos',
      'Asimetría favorable a largo plazo',
    ],
    comparacionHistorica: 'Similar a 2015 y finales de 2022, antes de los grandes ciclos alcistas.',
  },
  'expansion-temprana': {
    id: 'expansion-temprana',
    nombre: 'Expansión temprana',
    color: '#3b82f6',
    emoji: '📈',
    descripcion:
      'La tendencia se vuelve alcista de forma sostenida. El precio supera medias clave y recupera niveles perdidos sin euforia todavía.',
    senales: [
      'Estructura de máximos y mínimos crecientes',
      'Recuperación de medias móviles largas',
      'Entradas institucionales constantes',
    ],
    riesgos: ['Correcciones bruscas pero sanas', 'Falsas rupturas en resistencias'],
    oportunidades: ['Tendencia a favor con riesgo aún moderado', 'Margen amplio hasta el ATH'],
    comparacionHistorica: 'Comparable a 2016 o principios de 2023.',
  },
  'expansion-avanzada': {
    id: 'expansion-avanzada',
    nombre: 'Expansión avanzada',
    color: '#8b5cf6',
    emoji: '🚀',
    descripcion:
      'El mercado acelera y se acerca o supera máximos previos. El interés público crece y los titulares vuelven.',
    senales: [
      'Ruptura de máximos históricos previos',
      'Aumento del volumen y de la búsqueda pública',
      'Apalancamiento creciente en derivados',
    ],
    riesgos: ['Sobrecalentamiento puntual', 'Correcciones del 20-30% habituales'],
    oportunidades: ['Tendencia fuerte', 'Momentum institucional y retail alineados'],
    comparacionHistorica: 'Recuerda a mediados de 2017 o finales de 2020.',
  },
  euforia: {
    id: 'euforia',
    nombre: 'Euforia',
    color: '#f59e0b',
    emoji: '🤩',
    descripcion:
      'Optimismo extremo. Todo el mundo habla de Bitcoin, el RSI se dispara y la codicia marca máximos. Suele coincidir con techos de ciclo.',
    senales: [
      'Fear & Greed en codicia extrema',
      'RSI mensual muy sobrecomprado',
      'Entrada masiva de retail y apalancamiento récord',
    ],
    riesgos: ['Riesgo de techo de ciclo', 'Caídas profundas tras el clímax'],
    oportunidades: ['Gestión de riesgo y toma parcial de beneficios', 'Disciplina sobre avaricia'],
    comparacionHistorica: 'Como diciembre de 2017 o noviembre de 2021.',
  },
  correccion: {
    id: 'correccion',
    nombre: 'Corrección',
    color: '#ef4444',
    emoji: '📉',
    descripcion:
      'El precio cae con fuerza desde el máximo. El optimismo se enfría y aparecen las dudas, pero la estructura de largo plazo aún no se rompe.',
    senales: [
      'Caída relevante desde el ATH reciente',
      'Sentimiento girando de codicia a miedo',
      'Liquidación de apalancamiento',
    ],
    riesgos: ['Puede profundizar hacia capitulación', 'Volatilidad elevada'],
    oportunidades: ['Reentradas escalonadas', 'El miedo empieza a crear valor'],
    comparacionHistorica: 'Típica de las correcciones intermedias de cada ciclo.',
  },
  capitulacion: {
    id: 'capitulacion',
    nombre: 'Capitulación / miedo extremo',
    color: '#b91c1c',
    emoji: '🩸',
    descripcion:
      'Venta por pánico generalizada. RSI en sobreventa histórica y Fear & Greed en mínimos. Históricamente, zonas de máximo pesimismo y de oportunidad asimétrica.',
    senales: [
      'RSI por debajo de 30',
      'Fear & Greed en miedo extremo',
      'Retail vende mientras las ballenas acumulan',
    ],
    riesgos: ['El mínimo exacto es impredecible', 'La presión vendedora puede continuar'],
    oportunidades: [
      'Históricamente, las mejores zonas de acumulación',
      'Asimetría riesgo/recompensa máxima a largo plazo',
    ],
    comparacionHistorica: 'Como marzo 2020 (COVID), la quiebra de FTX o el suelo de 2018.',
  },
  recuperacion: {
    id: 'recuperacion',
    nombre: 'Recuperación',
    color: '#10b981',
    emoji: '🔄',
    descripcion:
      'Tras el clímax de miedo, el precio se estabiliza y rebota. La confianza empieza a regresar lentamente y se forma un nuevo suelo.',
    senales: [
      'Rebote desde mínimos con volumen',
      'RSI saliendo de sobreventa',
      'Mejora del sentimiento desde niveles extremos',
    ],
    riesgos: ['Posibles retests del mínimo', 'Recuperaciones en forma de dientes de sierra'],
    oportunidades: ['Confirmación del cambio de tendencia', 'Riesgo decreciente'],
    comparacionHistorica: 'Como la segunda mitad de 2019 o principios de 2023.',
  },
};

export const PHASE_ORDER: CyclePhaseId[] = [
  'acumulacion',
  'expansion-temprana',
  'expansion-avanzada',
  'euforia',
  'correccion',
  'capitulacion',
  'recuperacion',
];
