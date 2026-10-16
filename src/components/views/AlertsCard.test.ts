import { describe, expect, it } from 'vitest';
import { sameServerKey } from './AlertsCard';

const b64url = (bytes: number[]) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sub = (bytes: number[] | null) => ({
  options: { applicationServerKey: bytes ? new Uint8Array(bytes).buffer : null, userVisibleOnly: true },
});

describe('suscripción a los avisos y clave del servidor', () => {
  const clave = [4, 200, 13, 77, 255, 0, 31];

  it('con la misma clave, la suscripción vale', () => {
    expect(sameServerKey(sub(clave), b64url(clave))).toBe(true);
  });

  it('si el servidor renovó la clave, hay que suscribirse de nuevo', () => {
    expect(sameServerKey(sub(clave), b64url([4, 200, 13, 77, 255, 0, 32]))).toBe(false);
    expect(sameServerKey(sub(clave), b64url([4, 200]))).toBe(false);
  });

  it('si el navegador no expone la clave, no se puede comprobar y se da por buena', () => {
    expect(sameServerKey(sub(null), b64url(clave))).toBe(true);
  });
});
