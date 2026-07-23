import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// =============================================================================
// El proyecto es ESM (`"type": "module"`), y Node —el que ejecuta las funciones
// serverless en producción— EXIGE la extensión .js en los imports relativos.
// Vite y tsc no la exigen, así que un import sin extensión compila, pasa los
// tests y luego revienta en producción con ERR_MODULE_NOT_FOUND.
//
// Ya ocurrió dos veces (en api/ y luego en src/lib/altseason/score.ts). Este
// test recorre el código que acaba dentro de las funciones y lo impide.
// =============================================================================

const ROOT = resolve(__dirname, '../..');

/** Ficheros .ts de un directorio, recursivo, sin tests. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

/** Imports/exports relativos sin extensión de un fichero. */
function extensionlessImports(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const found: string[] = [];
  const re = /(?:from|import)\s+['"](\.[^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const spec = m[1]!;
    if (!/\.(js|json|css|mjs|cjs)$/.test(spec)) found.push(spec);
  }
  return found;
}

describe('Imports ESM del código que se ejecuta en las funciones serverless', () => {
  it('todos los imports relativos de api/ llevan extensión .js', () => {
    const offenders: string[] = [];
    for (const file of tsFiles(join(ROOT, 'api'))) {
      for (const spec of extensionlessImports(file)) {
        offenders.push(`${file.replace(ROOT, '')} → ${spec}`);
      }
    }
    expect(offenders, `Sin extensión .js fallarían en producción:\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });

  it('los módulos de src/ que importa el backend también la llevan', () => {
    // Módulos compartidos entre frontend y funciones serverless.
    const shared = [
      join(ROOT, 'src/lib/indicators.ts'),
      join(ROOT, 'src/lib/altseason/config.ts'),
      join(ROOT, 'src/lib/altseason/score.ts'),
    ];
    const offenders: string[] = [];
    for (const file of shared) {
      for (const spec of extensionlessImports(file)) {
        offenders.push(`${file.replace(ROOT, '')} → ${spec}`);
      }
    }
    expect(offenders, `Sin extensión .js fallarían en producción:\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });
});
