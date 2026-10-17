import { expect, test, type Page } from '@playwright/test';
// @ts-expect-error — módulo JS de datos de ejemplo, sin tipos.
import { route } from './fixtures.mjs';

// =============================================================================
// Escritorio (desde 1024 px): todo en una sola hoja, sin pestañas ni
// subpestañas, sin repetir ningún cuadro y cada uno en su zona (la de las
// pestañas del móvil), siempre desplegado y fijo, repartida en columnas por la
// altura real de cada cuadro y con cada zona cuadrada (layout/Columnas). El menú
// de la barra superior baja a cada zona, «Inicio» sube arriba y Ajustes se abre
// en un panel. El móvil lo prueban las demás pruebas, con un Pixel 7, y no cambia.
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
  return page.evaluate(() => [...document.querySelectorAll('#view-content [data-titulo]')].map((t) => t.textContent?.trim() ?? ''));
}

/** Lo que se puede plegar (no debe haber nada en escritorio) y los cuadros sin título. */
function plegables(page: Page, donde: string) {
  return page.evaluate((donde) => {
    const raiz = document.querySelector(donde)!;
    return {
      plegables: raiz.querySelectorAll('details, summary').length,
      sinTitulo: [...raiz.querySelectorAll('.liquid-card')]
        .filter((c) => !c.querySelector('[data-titulo]'))
        .map((c) => c.textContent?.trim().slice(0, 60)),
    };
  }, donde);
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

test('sin pestañas: el menú de la barra baja a cada zona y se marca solo; «Inicio» solo sube arriba', async ({ page }) => {
  const errores = await abrir(page);
  const barra = page.locator('header nav[aria-label="Navegación principal"]');
  // Ni el menú del móvil, ni las subpestañas de Ciclos, ni el botón de plegar.
  await expect(page.locator('nav[aria-label="Navegación principal"]:not(header nav)')).toBeHidden();
  await expect(page.locator('nav[aria-label="Apartados de Ciclos"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Plegar|Desplegar) todos los cuadros$/ })).toBeHidden();
  // Arriba del todo, «Inicio»; la hoja empieza por Ciclos.
  await expect(barra.getByRole('button', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#zona-inicio')).toHaveCount(0);

  await barra.getByRole('button', { name: 'Temperatura' }).click();
  await expect(page).toHaveURL(/vista=temperatura/);
  await expect(barra.getByRole('button', { name: 'Temperatura' })).toHaveAttribute('aria-current', 'page');
  // La zona queda arriba, justo bajo la barra (que sigue fija).
  await expect.poll(() => page.locator('#zona-temperatura').evaluate((e) => Math.round(e.getBoundingClientRect().top)), { timeout: 5000 }).toBeLessThan(120);
  await expect.poll(() => page.locator('header').evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBe(0);

  // Bajando a mano hasta Análisis, el menú lo marca solo.
  await page.mouse.wheel(0, 10);
  await page.locator('#zona-analisis').evaluate((e) => e.scrollIntoView({ block: 'start' }));
  await expect(barra.getByRole('button', { name: 'Análisis' })).toHaveAttribute('aria-current', 'page');
  await barra.getByRole('button', { name: 'Inicio' }).click();
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5000 }).toBe(0);
  await expect(barra.getByRole('button', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
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
  await expect(panel.locator('[data-titulo]', { hasText: 'Información' })).toBeVisible();
  // Dentro, como en la hoja: todo desplegado y fijo.
  expect(await plegables(page, '[role="dialog"]')).toEqual({ plegables: 0, sinTitulo: [] });
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();

  // Un enlace a Ajustes lo abre directamente.
  await page.goto('/?vista=ajustes');
  await expect(page.getByRole('dialog', { name: 'Ajustes' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar los ajustes' }).click();
  await expect(page.getByRole('dialog', { name: 'Ajustes' })).toBeHidden();
  expect(errores).toEqual([]);
});

test('en 1920 × 1080: cada cuadro en su zona, una sola vez, sin pisarse y con cada zona cuadrada', async ({ page }) => {
  const errores = await abrir(page);
  await cargarTodo(page);

  const todos = (await titulos(page)).filter(Boolean);
  const repetidos = todos.filter((t, i) => todos.indexOf(t) !== i);
  expect(repetidos, 'cuadros repetidos').toEqual([]);

  // Cada uno en su sitio, el de las pestañas del móvil.
  const zonaDe = (titulo: string) =>
    page.evaluate((titulo) => {
      const t = [...document.querySelectorAll('#view-content [data-titulo]')].find((e) => e.textContent?.trim().startsWith(titulo));
      return t?.closest('section[id^="zona-"]')?.id ?? null;
    }, titulo);
  const sitio: [string, string][] = [
    ['Precio de Bitcoin', 'zona-ciclos'],
    ['Los ciclos de Bitcoin', 'zona-ciclos'],
    ['Fase actual', 'zona-ciclos'],
    ['Altseason Score', 'zona-ciclos'],
    ['Dónde está cada ciclo', 'zona-ciclos'],
    ['Ranking de altcoins', 'zona-ciclos'],
    ['Temperatura del mercado', 'zona-temperatura'],
    ['Desglose por bloques', 'zona-temperatura'],
    ['Fear & Greed Index', 'zona-analisis'],
    ['Presión del mercado', 'zona-analisis'],
  ];
  for (const [titulo, zona] of sitio) expect(await zonaDe(titulo), titulo).toBe(zona);

  // Ningún cuadro pisa a otro (se mira varias veces: los datos en vivo cambian alturas).
  for (let i = 0; i < 3; i++) {
    expect(await solapes(page)).toEqual([]);
    await page.waitForTimeout(400);
  }

  // Tres columnas, y en cada zona todas acaban a la misma altura: sin huecos.
  const columnas = await page.locator('#zona-ciclos [data-clave]').evaluateAll((els) => new Set(els.filter((e) => e.getBoundingClientRect().width < 1000).map((e) => Math.round(e.getBoundingClientRect().left))).size);
  expect(columnas).toBe(3);
  const desiguales = await page.evaluate(() => {
    const out: string[] = [];
    for (const caja of new Set([...document.querySelectorAll<HTMLElement>('[data-clave]')].map((e) => e.parentElement!))) {
      const cb = caja.getBoundingClientRect();
      // Por tramos: lo que hay entre un cuadro a todo el ancho y el siguiente.
      const hijos = [...caja.children].map((c) => c.getBoundingClientRect()).filter((r) => r.height >= 1);
      const anchos = hijos.filter((r) => r.width > cb.width - 2).map((r) => r.top);
      const cortes = [-Infinity, ...anchos, Infinity];
      for (let k = 0; k < cortes.length - 1; k++) {
        const fondos = new Map<number, number>();
        for (const r of hijos) {
          if (r.width > cb.width - 2 || r.top < cortes[k]! || r.top >= cortes[k + 1]!) continue;
          const x = Math.round(r.left);
          fondos.set(x, Math.max(fondos.get(x) ?? 0, Math.round(r.bottom)));
        }
        const f = [...fondos.values()];
        if (f.length > 1 && Math.max(...f) - Math.min(...f) > 2) out.push(`${caja.closest('section')?.id}: ${f.join('/')}`);
      }
    }
    return out;
  });
  expect(desiguales, 'columnas que no acaban a la misma altura').toEqual([]);
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
  test(`a ${ancho} px nada se sale a lo ancho y todo va desplegado y fijo`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    const errores = await abrir(page);
    await cargarTodo(page);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra, 'se sale a lo ancho').toBeLessThanOrEqual(0);
    expect(await plegables(page, '#view-content')).toEqual({ plegables: 0, sinTitulo: [] });
    expect(await solapes(page)).toEqual([]);
    expect(errores).toEqual([]);
  });
}
