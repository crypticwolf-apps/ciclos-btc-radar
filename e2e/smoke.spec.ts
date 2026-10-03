import { expect, test, type Page } from '@playwright/test';
// @ts-expect-error — módulo JS de datos de ejemplo, sin tipos.
import { route } from './fixtures.mjs';

// =============================================================================
// Pruebas de pantalla: que cada pantalla abra, enseñe lo suyo y no se rompa.
//
// Con datos de ejemplo en lugar de las APIs reales (e2e/fixtures.mjs). Lo que
// comprueban es lo que un test unitario no ve: un error de render que deje la
// pantalla en blanco, un cuadro que se salga a lo ancho en el móvil, o que la
// app no aguante que el servidor no responda.
// =============================================================================

/** Abre una pantalla con los datos de ejemplo y recoge los errores de la página. */
async function abrir(page: Page, url: string, tema: 'dark' | 'light' = 'dark') {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  // Fuentes y exchanges externos fuera: la prueba no depende de internet.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route(/binance\.com|okx\.com|bybit\.com/, (r) => r.abort());
  await route(page);
  await page.addInitScript((t) => localStorage.setItem('ciclos-btc-theme', t), tema);
  await page.goto(url);
  return errores;
}

/** La página no se sale a lo ancho (nada de scroll horizontal en el móvil). */
async function sinDesbordar(page: Page) {
  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sobra).toBeLessThanOrEqual(0);
}

const PANTALLAS: { nombre: string; url: string; textos: string[] }[] = [
  { nombre: 'Inicio', url: '/', textos: ['Fase estimada del ciclo', 'Precio de Bitcoin'] },
  { nombre: 'Ciclo BTC', url: '/?vista=ciclos', textos: ['Fase actual', 'Histórico de halvings'] },
  { nombre: 'Altseason', url: '/?vista=ciclos&sub=altseason', textos: ['Altseason Score', 'Ranking de altcoins'] },
  { nombre: 'Comparativa', url: '/?vista=ciclos&sub=comparativa', textos: ['Dónde está cada ciclo'] },
  { nombre: 'Oportunidad', url: '/?vista=oportunidad', textos: ['Termómetro de oportunidad', 'La fase del ciclo, día a día'] },
  { nombre: 'Análisis', url: '/?vista=analisis', textos: ['Divergencia on-chain', 'Valoración del ciclo'] },
  { nombre: 'Ajustes', url: '/?vista=ajustes', textos: ['Información', 'Alertas'] },
];

for (const tema of ['dark', 'light'] as const) {
  for (const p of PANTALLAS) {
    test(`${p.nombre} (${tema === 'dark' ? 'oscuro' : 'claro'}) abre sin errores`, async ({ page }) => {
      const errores = await abrir(page, p.url, tema);
      for (const texto of p.textos) {
        await expect(page.getByText(texto, { exact: false }).first()).toBeVisible();
      }
      // Recorre la pantalla entera: así se montan también los cuadros que
      // esperan a estar a la vista.
      for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(800);
      await sinDesbordar(page);
      expect(errores).toEqual([]);
    });
  }
}

test('el ranking de altcoins va en vivo y con los decimales de cada precio', async ({ page }) => {
  const precios: string[] = [];
  page.on('request', (r) => r.url().includes('/api/precios') && precios.push(r.url()));
  const errores = await abrir(page, '/?vista=ciclos&sub=altseason');
  const ranking = page.locator('details').filter({ hasText: 'Ranking de altcoins' }).first();
  await ranking.locator('summary').click();
  await expect(ranking.getByText('Precios en vivo de OKX')).toBeVisible({ timeout: 10_000 });
  // Se piden al mismo exchange del que salen las velas.
  expect(precios.some((u) => u.includes('ex=okx'))).toBe(true);
  // XRP vale ~2,47 $: con cuatro decimales, no redondeado a «2 €».
  await expect(ranking.getByText(/^\d,\d{4}\s?€$/).first()).toBeVisible();
  expect(errores).toEqual([]);
});

test('sin servidor enseña el aviso de error, no una pantalla en blanco', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route(/binance\.com|okx\.com|bybit\.com/, (r) => r.abort());
  await page.route('**/api/**', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false,"data":null,"meta":{"generatedAt":"","sources":[]},"error":"caído"}' }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /reintentar/i }).first()).toBeVisible({ timeout: 15_000 });
  expect(errores).toEqual([]);
});

test('sin conexión abre con los datos guardados y lo dice', async ({ page }) => {
  await abrir(page, '/');
  await expect(page.getByText('Fase estimada del ciclo')).toBeVisible();
  // Espera a que se guarden.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ciclos-datos-v1')?.length ?? 0)).toBeGreaterThan(100);

  // Como si el último uso hubiera sido hace 2 horas: así la app los da por
  // viejos y trata de renovarlos (con datos de hace segundos, ni lo intenta).
  await page.evaluate(() => {
    const guardado = JSON.parse(localStorage.getItem('ciclos-datos-v1')!) as { at: number }[];
    for (const g of guardado) g.at -= 2 * 3_600_000;
    localStorage.setItem('ciclos-datos-v1', JSON.stringify(guardado));
  });
  await page.unroute('**/api/**');
  await page.route('**/api/**', (r) => r.abort());
  await page.reload();
  await expect(page.getByText('Fase estimada del ciclo')).toBeVisible();
  await expect(page.getByText(/Sin conexión: estás viendo los datos guardados/)).toBeVisible({ timeout: 15_000 });
});

test('el gráfico de fases no repite años ni meses en el eje', async ({ page }) => {
  await abrir(page, '/?vista=oportunidad');
  const card = page.locator('details').filter({ hasText: 'La fase del ciclo, día a día' }).first();
  await card.scrollIntoViewIfNeeded();
  for (const rango of ['Desde 2018', '1 año', '90 d']) {
    await card.getByRole('button', { name: rango }).click();
    const marcas = await card.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value').allTextContents();
    expect(marcas.length).toBeGreaterThan(1);
    expect(new Set(marcas).size).toBe(marcas.length);
    if (rango === 'Desde 2018') {
      // Todos los años, seguidos, sin saltarse ninguno.
      const años = marcas.map(Number);
      expect(años).toEqual(años.map((_, i) => años[0]! + i));
    }
  }
});

test('el desglose del score va de más a menos peso nominal', async ({ page }) => {
  await abrir(page, '/?vista=oportunidad');
  const filas = page.locator('details').filter({ hasText: 'Desglose por bloques' }).first().locator('details summary');
  await expect(filas.first()).toContainText('nominal');
  const pesos = await filas.allTextContents();
  const nominal = pesos.map((t) => Number(t.match(/nominal (\d+)%/)?.[1] ?? NaN)).filter(Number.isFinite);
  expect(nominal.length).toBeGreaterThan(1);
  expect(nominal).toEqual([...nominal].sort((a, b) => b - a));
});

test('la amplitud enseña varios años y las altseasons anteriores', async ({ page }) => {
  const errores = await abrir(page, '/?vista=ciclos&sub=altseason');
  const card = page.locator('details').filter({ hasText: 'Evolución de la amplitud' }).first();
  await card.locator('summary').click();
  await expect(card.getByText(/Altseasons desde 2017/)).toBeVisible();
  // Solo los máximos de ciclo: con los datos de ejemplo, enero de 2018 y enero de 2022.
  await expect(card.locator('li').filter({ hasText: 'máximo el' })).toHaveCount(2);
  const años = (await card.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value').allTextContents()).map(Number);
  expect(años.length).toBeGreaterThan(5);
  expect(años).toEqual(años.map((_, i) => años[0]! + i));
  expect(errores).toEqual([]);
});
