import { Context, heartbeat } from '@temporalio/activity';
import type { HotelRate, SearchHotelsInput, SupplierName } from '@hotel-comparator/shared';
import { SUPPLIER_A_URL, SUPPLIER_B_URL } from '../env';

interface SupplierHotelsResponse {
  hotels?: HotelRate[];
}

async function fetchSupplierRates(
  baseUrl: string,
  supplier: SupplierName,
  input: SearchHotelsInput
): Promise<HotelRate[]> {
  const url = new URL(baseUrl);
  url.searchParams.set('city', input.city);
  url.searchParams.set('checkInDate', input.checkInDate);
  url.searchParams.set('checkOutDate', input.checkOutDate);

  const { cancellationSignal } = Context.current();

  // Heartbeating is what lets a startToCloseTimeout (or an outright workflow
  // cancellation) actually reach this in-flight request: without it, the
  // workflow stops waiting on schedule regardless, but this fetch would keep
  // running to completion in the background with its result just discarded.
  heartbeat();
  const heartbeatHandle = setInterval(() => heartbeat(), 1000);

  try {
    const response = await fetch(url, { signal: cancellationSignal });

    if (!response.ok) {
      throw new Error(`${supplier} responded with HTTP ${response.status}`);
    }

    const body = (await response.json()) as SupplierHotelsResponse;
    return Array.isArray(body.hotels) ? body.hotels : [];
  } finally {
    clearInterval(heartbeatHandle);
  }
}

export async function fetchSupplierARates(input: SearchHotelsInput): Promise<HotelRate[]> {
  return fetchSupplierRates(SUPPLIER_A_URL, 'SupplierA', input);
}

export async function fetchSupplierBRates(input: SearchHotelsInput): Promise<HotelRate[]> {
  return fetchSupplierRates(SUPPLIER_B_URL, 'SupplierB', input);
}
