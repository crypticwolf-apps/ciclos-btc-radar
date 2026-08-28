import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// El proveedor prueba tres exchanges en cadena; se falsea la capa HTTP para
// comprobar el ORDEN y que un libro roto no se da por bueno.
const fetchJson = vi.fn();
vi.mock('../http.js', () => ({ fetchJson: (...args: unknown[]) => fetchJson(...args) }));
vi.mock('../cache.js', () => ({
  // Sin cache: cada prueba parte de cero.
  swr: async (_key: string, _ttl: unknown, load: () => Promise<unknown>) => ({
    value: await load(),
    status: 'live',
    storedAt: Date.now(),
  }),
}));

const { getOrderBookPressure } = await import('./orderbook.js');

const binance = { bids: [['100', '3']], asks: [['102', '1']] };
const okx = { data: [{ bids: [['100', '1']], asks: [['101', '1']] }] };
const bybit = { result: { b: [['100', '2']], a: [['104', '2']] } };

const hostOf = (call: unknown[]) => new URL(String(call[0])).hostname;

beforeEach(() => fetchJson.mockReset());
afterEach(() => vi.clearAllMocks());

describe('presión del libro de órdenes', () => {
  it('mide el reparto entre compra y venta', async () => {
    fetchJson.mockResolvedValueOnce(binance);
    const { data } = await getOrderBookPressure();

    // 3 BTC comprando frente a 1 vendiendo.
    expect(data.buyPct).toBe(75);
    expect(data.sellPct).toBe(25);
    expect(data.imbalance).toBeCloseTo(0.5, 4);
    expect(data.spread).toBe(2);
    expect(data.source).toBe('binance');
  });

  it('pasa a OKX cuando Binance no responde', async () => {
    fetchJson.mockRejectedValueOnce(new Error('451')).mockResolvedValueOnce(okx);
    const { data } = await getOrderBookPressure();

    expect(data.source).toBe('okx');
    expect(hostOf(fetchJson.mock.calls[0]!)).toBe('api.binance.com');
    expect(hostOf(fetchJson.mock.calls[1]!)).toBe('www.okx.com');
  });

  it('llega hasta Bybit si los dos primeros fallan', async () => {
    fetchJson
      .mockRejectedValueOnce(new Error('451'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(bybit);
    const { data } = await getOrderBookPressure();

    expect(data.source).toBe('bybit');
    expect(fetchJson).toHaveBeenCalledTimes(3);
  });

  it('descarta un libro vacío y sigue con el siguiente', async () => {
    fetchJson.mockResolvedValueOnce({ bids: [], asks: [] }).mockResolvedValueOnce(okx);
    const { data } = await getOrderBookPressure();
    expect(data.source).toBe('okx');
  });

  it('descarta un libro cruzado: la mejor venta nunca va por debajo de la compra', async () => {
    // Un diferencial negativo solo puede ser un error del proveedor, y pintarlo
    // dejaría la tarjeta diciendo que se puede comprar más barato que vender.
    fetchJson
      .mockResolvedValueOnce({ bids: [['105', '1']], asks: [['100', '1']] })
      .mockResolvedValueOnce(okx);
    const { data } = await getOrderBookPressure();
    expect(data.source).toBe('okx');
    expect(data.spread).toBeGreaterThanOrEqual(0);
  });

  it('si no responde ninguno, falla en vez de inventarse un libro', async () => {
    // Uno por exchange: con una implementación permanente, Vitest ve la
    // promesa rechazada que sobra como un error sin recoger.
    fetchJson
      .mockRejectedValueOnce(new Error('caído'))
      .mockRejectedValueOnce(new Error('caído'))
      .mockRejectedValueOnce(new Error('caído'));
    await expect(getOrderBookPressure()).rejects.toThrow(/Ningún exchange/);
  });
});
