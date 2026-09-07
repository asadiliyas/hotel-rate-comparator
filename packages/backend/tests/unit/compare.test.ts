import type { HotelRate } from '@hotel-comparator/shared';
import { pickBestRate } from '../../src/compare';

function fulfilled(hotels: HotelRate[]): PromiseFulfilledResult<HotelRate[]> {
  return { status: 'fulfilled', value: hotels };
}

function rejected(reason: unknown): PromiseRejectedResult {
  return { status: 'rejected', reason };
}

const cheapA: HotelRate = { hotelId: 'a1', name: 'Hotel A1', price: 100 };
const expensiveA: HotelRate = { hotelId: 'a2', name: 'Hotel A2', price: 200 };
const cheapB: HotelRate = { hotelId: 'b1', name: 'Hotel B1', price: 90 };
const expensiveB: HotelRate = { hotelId: 'b2', name: 'Hotel B2', price: 250 };

describe('pickBestRate - basic scenarios', () => {
  test('Supplier A cheaper -> returns A result', () => {
    const result = pickBestRate(fulfilled([expensiveA, cheapA]), fulfilled([expensiveB]));
    expect(result).toEqual({ status: 'OK', hotel: { ...cheapA, supplier: 'SupplierA' } });
  });

  test('Supplier B cheaper -> returns B result', () => {
    const result = pickBestRate(fulfilled([expensiveA]), fulfilled([cheapB, expensiveB]));
    expect(result).toEqual({ status: 'OK', hotel: { ...cheapB, supplier: 'SupplierB' } });
  });

  test('Both suppliers return the same rate -> deterministically picks Supplier A', () => {
    const sameA: HotelRate = { hotelId: 'a1', name: 'Hotel A', price: 150 };
    const sameB: HotelRate = { hotelId: 'b1', name: 'Hotel B', price: 150 };
    const result = pickBestRate(fulfilled([sameA]), fulfilled([sameB]));
    expect(result).toEqual({ status: 'OK', hotel: { ...sameA, supplier: 'SupplierA' } });
  });

  test('Supplier A fails, Supplier B succeeds -> returns B result', () => {
    const result = pickBestRate(rejected(new Error('A down')), fulfilled([cheapB]));
    expect(result).toEqual({ status: 'OK', hotel: { ...cheapB, supplier: 'SupplierB' } });
  });

  test('Supplier B fails, Supplier A succeeds -> returns A result', () => {
    const result = pickBestRate(fulfilled([cheapA]), rejected(new Error('B down')));
    expect(result).toEqual({ status: 'OK', hotel: { ...cheapA, supplier: 'SupplierA' } });
  });

  test('Both suppliers fail -> ALL_SUPPLIERS_FAILED', () => {
    const errA = new Error('A down');
    const errB = new Error('B down');
    const result = pickBestRate(rejected(errA), rejected(errB));
    expect(result).toEqual({ status: 'ALL_SUPPLIERS_FAILED', errors: [errA, errB] });
  });

  test('Supplier A returns empty, Supplier B has results -> uses Supplier B', () => {
    const result = pickBestRate(fulfilled([]), fulfilled([cheapB]));
    expect(result).toEqual({ status: 'OK', hotel: { ...cheapB, supplier: 'SupplierB' } });
  });

  test('Supplier B returns empty, Supplier A has results -> uses Supplier A', () => {
    const result = pickBestRate(fulfilled([cheapA]), fulfilled([]));
    expect(result).toEqual({ status: 'OK', hotel: { ...cheapA, supplier: 'SupplierA' } });
  });

  test('Both suppliers return empty -> "No hotels found"', () => {
    const result = pickBestRate(fulfilled([]), fulfilled([]));
    expect(result).toEqual({ status: 'NO_HOTELS_FOUND' });
  });
});

describe('pickBestRate - edge cases beyond the required table', () => {
  test('one supplier empty, the other failed -> still NO_HOTELS_FOUND, not an error', () => {
    // Empty is a valid, non-error answer; a sibling failure doesn't change that.
    const result = pickBestRate(fulfilled([]), rejected(new Error('B down')));
    expect(result).toEqual({ status: 'NO_HOTELS_FOUND' });
  });

  test('a tie among several offers still prefers Supplier A over Supplier B', () => {
    const result = pickBestRate(
      fulfilled([{ hotelId: 'a1', name: 'A', price: 120 }, { hotelId: 'a2', name: 'A2', price: 100 }]),
      fulfilled([{ hotelId: 'b1', name: 'B', price: 100 }])
    );
    expect(result).toEqual({ status: 'OK', hotel: { hotelId: 'a2', name: 'A2', price: 100, supplier: 'SupplierA' } });
  });
});
