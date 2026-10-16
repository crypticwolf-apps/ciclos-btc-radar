import { expect, test, type Page } from '@playwright/test';
// @ts-expect-error — módulo JS de datos de ejemplo, sin tipos.
import { route } from './fixtures.mjs';

// =============================================================================
// Escritorio: las pestañas van en la barra superior y cada pestaña reparte sus
// tarjetas en columnas para aprovechar el monitor y bajar lo mínimo
// (layout/Columnas). El móvil lo prueban las demás pruebas, con un Pixel 7.
// =============================================================================

test.use({ viewport: { width: 1920, height: 1080 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

const VISTAS = ['/', '/?vista=ciclos', '/?vista=ciclos&sub=altseason', '/?vista=ciclos&sub=comparativa', '/?vista=temperatura', '/?vista=analisis', '/?vista=ajustes'];

async function abrir(page: Page, url: string) {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.route(/binance\.com|okx\.com|bybit\.com/, (r) => r.abort());
  await route(page);
  await page.goto(url);
  await expect(page.locator('header nav[aria-label="Navegación principal"]')).toBeVisible();
  return errores;
}

/** Recorre la pantalla entera para que se monten también los cuadros diferidos. */
async function recorrer(page: Page) {
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
}

test('las pestañas van en la barra superior, que se queda arriba al bajar', async ({ page }) => {
  const errores = await abrir(page, '/');
  const barra = page.locator('header nav[aria-label="Navegación principal"]');
  // El menú del móvil (abajo) no se ve en escritorio.
  await expect(page.locator('nav[aria-label="Navegación principal"]:not(header nav)')).toBeHidden();
  await barra.getByRole('button', { name: 'Temperatura' }).click();
  await expect(page).toHaveURL(/vista=temperatura/);
  await expect(barra.getByRole('button', { name: 'Temperatura' })).toHaveAttribute('aria-current', 'page');
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.locator('header').evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBe(0);
  expect(errores).toEqual([]);
});

test('en 1920 × 1080, Inicio cabe entero sin bajar y va en tres columnas', async ({ page }) => {
  const errores = await abrir(page, '/');
  await expect(page.getByRole('img', { name: /^Índice de miedo y codicia/ })).toBeVisible();
  const columnas = await page.locator('#view-content .grid').first().evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  expect(columnas).toBe(3);
  const sobra = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(sobra).toBeLessThanOrEqual(40);
  expect(errores).toEqual([]);
});

for (const ancho of [1280, 1920]) {
  test(`a ${ancho} px nada se sale a lo ancho y todo se pliega fuera de Inicio`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    for (const url of VISTAS) {
      const errores = await abrir(page, url);
      await recorrer(page);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra, `Se sale a lo ancho en ${url}`).toBeLessThanOrEqual(0);
      if (url !== '/') {
        const sueltos = await page.evaluate(() =>
          [...document.querySelectorAll('#view-content .liquid-card, #view-content .glass, #view-content .glass-strong')]
            .filter((c) => !(c.firstElementChild instanceof HTMLDetailsElement) && !c.parentElement?.closest('details'))
            .map((c) => c.textContent?.trim().slice(0, 60)),
        );
        expect(sueltos, `Cuadros sin plegar en ${url}`).toEqual([]);
      }
      expect(errores, url).toEqual([]);
    }
  });
}
