export type SupplierName = 'SupplierA' | 'SupplierB';

export interface HotelRate {
  hotelId: string;
  name: string;
  price: number;
}

export interface SearchHotelsInput {
  city: string;
  checkInDate: string;
  checkOutDate: string;
  /**
   * Per-activity start-to-close timeout override, in milliseconds.
   * Only meant to be set by tests; the workflow defaults this to 5000.
   */
  supplierTimeoutMs?: number;
}

/**
 * "Both suppliers failed" is intentionally NOT a member of this union — it's
 * a real error (thrown ApplicationFailure), not a result value. "Both empty"
 * (NO_HOTELS_FOUND) is a valid, non-error result.
 */
export type SearchHotelsResult =
  | { status: 'OK'; hotel: HotelRate & { supplier: SupplierName } }
  | { status: 'NO_HOTELS_FOUND' };
