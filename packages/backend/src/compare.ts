import type { HotelRate, SearchHotelsResult, SupplierName } from '@hotel-comparator/shared';

export type SupplierOutcome = PromiseSettledResult<HotelRate[]>;

export type CompareResult = SearchHotelsResult | { status: 'ALL_SUPPLIERS_FAILED'; errors: [unknown, unknown] };

/**
 * Pure and total: never throws, touches no Temporal/Node APIs, and always
 * returns a value for every combination of inputs. This is what keeps it
 * safe to call from workflow code and cheap to unit-test as a plain
 * input/output table, independent of Temporal entirely.
 *
 * "Both suppliers failed" is surfaced as a value here (ALL_SUPPLIERS_FAILED),
 * not thrown — the caller (the workflow) decides whether/how to turn that
 * into a real error. An empty array from a supplier is treated as "no offer
 * from that supplier", not a failure.
 */
export function pickBestRate(outcomeA: SupplierOutcome, outcomeB: SupplierOutcome): CompareResult {
  if (outcomeA.status === 'rejected' && outcomeB.status === 'rejected') {
    return { status: 'ALL_SUPPLIERS_FAILED', errors: [outcomeA.reason, outcomeB.reason] };
  }

  const offers: Array<{ hotel: HotelRate; supplier: SupplierName }> = [];
  if (outcomeA.status === 'fulfilled') {
    for (const hotel of outcomeA.value) offers.push({ hotel, supplier: 'SupplierA' });
  }
  if (outcomeB.status === 'fulfilled') {
    for (const hotel of outcomeB.value) offers.push({ hotel, supplier: 'SupplierB' });
  }

  if (offers.length === 0) {
    return { status: 'NO_HOTELS_FOUND' };
  }

  // Offers are pushed in Supplier-A-then-Supplier-B order, and only a
  // strictly-cheaper offer ever replaces the current best, so on an exact
  // tie the earlier (Supplier A) offer wins deterministically.
  let best = offers[0];
  for (const offer of offers.slice(1)) {
    if (offer.hotel.price < best.hotel.price) {
      best = offer;
    }
  }

  return { status: 'OK', hotel: { ...best.hotel, supplier: best.supplier } };
}
