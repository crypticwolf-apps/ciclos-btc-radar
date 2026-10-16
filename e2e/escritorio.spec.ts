import { expect, test, type Page } from '@playwright/test';
// @ts-expect-error — módulo JS de datos de ejemplo, sin tipos.
import { route } from './fixtures.mjs';

// =============================================================================
// Escritorio (desde 1024 px): todo en una sola hoja, sin pestañas ni
// subpestañas y sin repetir ningún cuadro, repartida en columnas por la altura
// real de cada cuadro (layout/Columnas). El menú de la barra superior baja a
// cada zona y Ajustes se abre en un panel. El móvil lo prueban las demás
// pruebas, con un Pixel 7, y no cambia.
// =============================================================================

test.use({ viewport: { width: 1920, height: 1080 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

async function abrir(page: Page, url = '/') {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.route(/binance\.com|okx\.com|bybit\.com/, (r) => r.abort());
  await route(page);
  await page.goto(url);
  await expect(page.locator('header nav[aria-label="Navegación principal"]')).toBeVisible();
  return errores;
}

/** Recorre la hoja entera y espera a que no quede ningún cuadro cargando. */
async function cargarTodo(page: Page) {
  await expect(page.locator('#zona-analisis')).toBeAttached({ timeout: 15_000 });
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.locator('#view-content .skeleton').count(), { timeout: 15_000 }).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Los títulos de todos los cuadros de la hoja. */
function titulos(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('#view-content details > summary')]
      .filter((s) => !s.parentElement?.parentElement?.closest('details'))
      .map((s) => s.querySelector('span span')?.textContent?.trim() ?? ''),
  );
}

/** Pares de cuadros de una misma caja de columnas que se pisan. */
function solapes(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const caja of new Set([...document.querySelectorAll<HTMLElement>('[data-clave]')].map((e) => e.parentElement!))) {
      const hs = [...caja.children].map((c) => ({ k: (c as HTMLElement).dataset.clave, r: c.getBoundingClientRect() }));
      for (let i = 0; i < hs.length; i++) {
        for (let j = i + 1; j < hs.length; j++) {
          const a = hs[i]!.r;
          const b = hs[j]!.r;
          if (a.height < 1 || b.height < 1) continue;
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`${hs[i]!.k}/${hs[j]!.k}`);
        }
      }
    }
    return out;
  });
}

test('sin pestañas: el menú de la barra baja a cada zona y se marca solo al bajar', async ({ page }) => {
  const errores = await abrir(page);
  const barra = page.locator('header nav[aria-label="Navegación principal"]');
  // Ni el menú del móvil ni las subpestañas de Ciclos.
  await expect(page.locator('nav[aria-label="Navegación principal"]:not(header nav)')).toBeHidden();
  await expect(page.locator('nav[aria-label="Apartados de Ciclos"]')).toHaveCount(0);

  await barra.getByRole('button', { name: 'Temperatura' }).click();
  await expect(page).toHaveURL(/vista=temperatura/);
  await expect(barra.getByRole('button', { name: 'Temperatura' })).toHaveAttribute('aria-current', 'page');
  // La zona queda arriba, justo bajo la barra (que sigue fija).
  await expect.poll(() => page.locator('#zona-temperatura').evaluate((e) => Math.round(e.getBoundingClientRect().top)), { timeout: 5000 }).toBeLessThan(120);
  await expect.poll(() => page.locator('header').evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBe(0);

  // Bajando a mano hasta Análisis, el menú lo marca solo.
  await page.locator('#zona-analisis').evaluate((e) => e.scrollIntoView({ block: 'start' }));
  await expect(barra.getByRole('button', { name: 'Análisis' })).toHaveAttribute('aria-current', 'page');
  await barra.getByRole('button', { name: 'Inicio' }).click();
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5000 }).toBe(0);
  expect(errores).toEqual([]);
});

test('Ajustes no está en la hoja: se abre en un panel y se cierra con Esc', async ({ page }) => {
  const errores = await abrir(page);
  await cargarTodo(page);
  const enHoja = await titulos(page);
  for (const t of ['Ajustes', 'Alertas', 'Información']) expect(enHoja.some((x) => x.startsWith(t)), t).toBe(false);

  await page.locator('header').getByRole('button', { name: 'Ajustes' }).click();
  const panel = page.getByRole('dialog', { name: 'Ajustes' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('summary', { hasText: 'Información' }).first()).toBeVisible();
  // Dentro, todos los cuadros se pliegan, como fuera de Inicio en el móvil.
  const sueltos = await panel.evaluate((p) =>
    [...p.querySelectorAll('.liquid-card, .glass, .glass-strong')]
      .filter((c) => !(c.firstElementChild instanceof HTMLDetailsElement) && !c.parentElement?.closest('details'))
      .map((c) => c.textContent?.trim().slice(0, 60)),
  );
  expect(sueltos).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();

  // Un enlace a Ajustes lo abre directamente.
  await page.goto('/?vista=ajustes');
  await expect(page.getByRole('dialog', { name: 'Ajustes' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar los ajustes' }).click();
  await expect(page.getByRole('dialog', { name: 'Ajustes' })).toBeHidden();
  expect(errores).toEqual([]);
});

test('en 1920 × 1080: todo en una hoja, sin repetir ningún cuadro ni pisarse, y lo esencial a la vista', async ({ page }) => {
  const errores = await abrir(page);
  await cargarTodo(page);

  const todos = (await titulos(page)).filter(Boolean);
  const repetidos = todos.filter((t, i) => todos.indexOf(t) !== i);
  expect(repetidos, 'cuadros repetidos').toEqual([]);
  for (const t of ['Precio de Bitcoin', 'Fase actual', 'Temperatura del mercado', 'Fear & Greed Index', 'Altseason Score', 'Los ciclos de Bitcoin', 'Ranking de altcoins', 'Desglose por bloques', 'Presión del mercado']) {
    expect(todos.some((x) => x.startsWith(t)), t).toBe(true);
  }

  // Ningún cuadro pisa a otro (se mira varias veces: los datos en vivo cambian alturas).
  for (let i = 0; i < 3; i++) {
    expect(await solapes(page)).toEqual([]);
    await page.waitForTimeout(400);
  }

  // Lo esencial cabe en la primera pantalla, en tres columnas.
  const inicio = await page.locator('#zona-inicio [data-clave]').evaluateAll((els) =>
    els.map((e) => ({ k: (e as HTMLElement).dataset.clave, x: Math.round(e.getBoundingClientRect().left), y: Math.round(e.getBoundingClientRect().top) })),
  );
  expect(new Set(inicio.map((e) => e.x)).size).toBe(3);
  for (const k of ['precio', 'fase', 'termometro']) expect(inicio.find((e) => e.k === k)!.y, k).toBeLessThan(200);
  await expect(page.getByRole('img', { name: /^Índice de miedo y codicia/ })).toBeInViewport();

  // Las columnas de cada zona acaban casi a la misma altura: poco hueco en total.
  const hueco = await page.evaluate(() => {
    let vacio = 0;
    let total = 0;
    for (const caja of new Set([...document.querySelectorAll<HTMLElement>('[data-clave]')].map((e) => e.parentElement!))) {
      const cb = caja.getBoundingClientRect();
      const fondos = new Map<number, number>();
      let ancho = 0;
      for (const c of caja.children) {
        const r = c.getBoundingClientRect();
        if (r.height < 1 || r.width > cb.width - 2) continue;
        ancho = r.width;
        const x = Math.round(r.left);
        fondos.set(x, Math.max(fondos.get(x) ?? 0, r.bottom - cb.top));
      }
      const max = Math.max(...fondos.values());
      for (const f of fondos.values()) vacio += (max - f) * ancho;
      total += cb.height * cb.width;
    }
    return vacio / total;
  });
  expect(hueco).toBeLessThan(0.1);
  expect(errores).toEqual([]);
});

test('los enlaces a una pestaña bajan a su zona de la hoja', async ({ page }) => {
  for (const [url, id] of [['/?vista=temperatura', 'zona-temperatura'], ['/?vista=ciclos&sub=altseason', 'zona-altseason'], ['/?vista=analisis#miedo-codicia', 'miedo-codicia']] as const) {
    const errores = await abrir(page, url);
    await expect.poll(() => page.locator(`#${id}`).evaluate((e) => Math.round(e.getBoundingClientRect().top)), { timeout: 10_000 }).toBeLessThan(140);
    expect(errores, url).toEqual([]);
  }
});

for (const ancho of [1024, 1280, 1920]) {
  test(`a ${ancho} px nada se sale a lo ancho y todos los cuadros se pliegan`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    const errores = await abrir(page);
    await cargarTodo(page);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra, 'se sale a lo ancho').toBeLessThanOrEqual(0);
    const sueltos = await page.evaluate(() =>
      [...document.querySelectorAll('#view-content .liquid-card, #view-content .glass, #view-content .glass-strong')]
        .filter((c) => !(c.firstElementChild instanceof HTMLDetailsElement) && !c.parentElement?.closest('details'))
        .map((c) => c.textContent?.trim().slice(0, 60)),
    );
    expect(sueltos, 'cuadros sin plegar').toEqual([]);
    expect(await solapes(page)).toEqual([]);
    expect(errores).toEqual([]);
  });
}
