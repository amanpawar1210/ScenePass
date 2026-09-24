// Shared constants and pure helpers for events, seats and pricing.

export const CITIES = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Pune", "Chennai"];

export const CATEGORIES = [
  "LIVE MUSIC",
  "THEATRE",
  "COMEDY",
  "SPORT",
  "MOVIE",
  "FOOD",
  "WORKSHOP",
  "DANCE",
  "ART",
  "EXHIBITION",
];

// Tiles in client/public/event-atlas.png (4×3 grid, left→right, top→bottom).
export const ART_BY_CATEGORY = {
  "LIVE MUSIC": [0, 5, 9],
  THEATRE: [1],
  COMEDY: [2],
  SPORT: [3],
  MOVIE: [4],
  FOOD: [6],
  WORKSHOP: [7],
  DANCE: [8],
  ART: [10],
  EXHIBITION: [11],
};

export const COLORS = ["coral", "wine", "copper"];
export const DEFAULT_TIER_NAMES = ["Platinum", "Gold", "Silver"];
export const MAX_SEATS = 6;
export const HOLD_MINUTES = 8;
export const CANCEL_CUTOFF_HOURS = 2;
export const TIME_ZONE = "Asia/Kolkata";

export function rowLabel(index) {
  return String.fromCharCode(65 + index);
}

/** Splits `rows` into front/middle/back tier bands (~25% / ~35% / rest). */
export function tierBands(rows, tierCount) {
  if (tierCount === 1) return [rows];
  if (tierCount === 2) {
    const front = Math.max(1, Math.round(rows * 0.4));
    return [front, rows - front];
  }
  const front = Math.max(1, Math.round(rows * 0.25));
  const middle = Math.max(1, Math.round(rows * 0.35));
  return [front, middle, Math.max(1, rows - front - middle)];
}

/** Builds tier definitions (with row letters) from prices ordered front → back. */
export function buildTiers(prices, rows, names = DEFAULT_TIER_NAMES) {
  const bands = tierBands(rows, prices.length);
  let cursor = 0;
  return prices.map((price, i) => {
    const tierRows = Array.from({ length: bands[i] }, (_, r) => rowLabel(cursor + r));
    cursor += bands[i];
    return { name: names[i] ?? `Tier ${i + 1}`, price, rows: tierRows };
  });
}

/** Full seat list for an event: [{ id, row, number, tier, price, blocked }]. */
export function buildSeats(event) {
  const { rows, seatsPerRow } = event.layout;
  const blocked = new Set(event.blocked ?? []);
  const seats = [];
  for (let r = 0; r < rows; r++) {
    const row = rowLabel(r);
    const tier = event.tiers.find((t) => t.rows.includes(row)) ?? event.tiers[event.tiers.length - 1];
    for (let n = 1; n <= seatsPerRow; n++) {
      const id = `${row}${n}`;
      seats.push({ id, row, number: n, tier: tier.name, price: tier.price, blocked: blocked.has(id) });
    }
  }
  return seats;
}

export function capacityOf(event) {
  return event.layout.rows * event.layout.seatsPerRow - (event.blocked?.length ?? 0);
}

/** Deterministic PRNG so seeded data is stable between runs. */
export function seededRandom(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** A few accessibility / pillar seats per layout, chosen deterministically. */
export function pickBlockedSeats(key, rows, seatsPerRow) {
  const rand = seededRandom(key);
  const count = Math.round(rows * seatsPerRow * 0.04);
  const blocked = new Set();
  while (blocked.size < count) {
    blocked.add(`${rowLabel(Math.floor(rand() * rows))}${1 + Math.floor(rand() * seatsPerRow)}`);
  }
  return [...blocked];
}

const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TIME_ZONE });
export function isWeekendInIndia(date) {
  return ["Sat", "Sun"].includes(weekdayFormat.format(date));
}
