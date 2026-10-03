// Tipos de la ficha de categorías. Espejo de api/_lib/providers/categories.ts.

export type Periodo = 'd1' | 'd7' | 'd30' | 'd90' | 'y1';

export interface CategoryMember {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  cambios: Record<Periodo, number | null>;
  ath: number | null;
}

export interface CategoryData {
  id: string;
  nombre: string;
  corto: string;
  lista: 'coingecko' | 'respaldo';
  miembros: CategoryMember[];
}

export interface CategoriesData {
  categorias: CategoryData[];
  btc: CategoryMember | null;
  exchange: string | null;
  observedAt: string;
}
