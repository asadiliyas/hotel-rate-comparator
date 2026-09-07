import { MockActivityEnvironment } from '@temporalio/testing';
import type { SearchHotelsInput } from '@hotel-comparator/shared';
import { fetchSupplierARates, fetchSupplierBRates } from '../../src/temporal/activities';

const input: SearchHotelsInput = { city: 'Paris', checkInDate: '2026-10-01', checkOutDate: '2026-10-05' };

describe('fetchSupplierARates / fetchSupplierBRates', () => {
  const originalFetch = global.fetch;
  let env: MockActivityEnvironment;

  beforeEach(() => {
    // Context.current() inside the activity requires a real activity
    // execution context, which only MockActivityEnvironment (or a real
    // worker) provides - calling the exported functions directly throws
    // "Activity context not initialized".
    env = new MockActivityEnvironment();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('parses a successful response into HotelRate[]', async () => {
    const hotels = [{ hotelId: 'a1', name: 'Hotel A1', price: 120 }];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hotels }),
    }) as unknown as typeof fetch;

    await expect(env.run(fetchSupplierARates, input)).resolves.toEqual(hotels);
  });

  test('returns [] when the response body has no hotels array', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(env.run(fetchSupplierBRates, input)).resolves.toEqual([]);
  });

  test('throws when the supplier responds with a non-2xx status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(env.run(fetchSupplierARates, input)).rejects.toThrow(/500/);
  });

  test('propagates a network-level failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(env.run(fetchSupplierARates, input)).rejects.toThrow('ECONNREFUSED');
  });

  test('reacts to activity cancellation by aborting the in-flight request', async () => {
    global.fetch = jest.fn().mockImplementation((_url: unknown, options: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')));
      });
    }) as unknown as typeof fetch;

    const resultPromise = env.run(fetchSupplierARates, input);
    env.cancel();

    await expect(resultPromise).rejects.toThrow();
  });
});
