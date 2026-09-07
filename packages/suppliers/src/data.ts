import type { HotelRate, SupplierName } from '@hotel-comparator/shared';

const HOTEL_NAME_POOL = [
  'Grand Plaza',
  'Riverside Inn',
  'Sunset Suites',
  'Harbor View Hotel',
  'Central Park Lodge',
  'The Metropolitan',
  'Old Town Boutique',
  'Skyline Towers',
  'Garden Court',
  'Royal Crest Hotel',
];

const BASE_PRICE_RANGE_BY_SUPPLIER: Record<SupplierName, { min: number; max: number }> = {
  SupplierA: { min: 80, max: 260 },
  SupplierB: { min: 75, max: 270 },
};

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministic PRNG (mulberry32) so a given seed always produces the same sequence. */
function createRng(seed: number): () => number {
  let state = seed;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a stable, deterministic hotel list for any (city, supplier) pair
 * with no hardcoded city list — the city name is just part of the seed.
 * Supplier A and Supplier B use different price ranges so the same city
 * produces genuinely different, comparable offers from each supplier.
 */
export function generateHotels(city: string, supplier: SupplierName): HotelRate[] {
  const normalizedCity = city.trim().toLowerCase();
  const rng = createRng(hashString(`${normalizedCity}|${supplier}`));
  const count = 2 + Math.floor(rng() * 3); // 2-4 hotels
  const { min, max } = BASE_PRICE_RANGE_BY_SUPPLIER[supplier];

  const hotels: HotelRate[] = [];
  const usedNameIndexes = new Set<number>();

  for (let i = 0; i < count; i++) {
    let nameIndex = Math.floor(rng() * HOTEL_NAME_POOL.length);
    while (usedNameIndexes.has(nameIndex)) {
      nameIndex = (nameIndex + 1) % HOTEL_NAME_POOL.length;
    }
    usedNameIndexes.add(nameIndex);

    const price = Math.round((min + rng() * (max - min)) * 100) / 100;
    hotels.push({
      hotelId: `${supplier.toLowerCase()}-${normalizedCity.replace(/\s+/g, '-')}-${nameIndex}`,
      name: `${HOTEL_NAME_POOL[nameIndex]} ${city}`,
      price,
    });
  }

  return hotels;
}
