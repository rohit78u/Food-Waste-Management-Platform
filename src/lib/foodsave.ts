export const WASTE_CATEGORIES = [
  "produce",
  "dairy",
  "bakery",
  "meat",
  "leftovers",
  "other",
] as const;

export const WASTE_REASONS = [
  "spoiled",
  "expired",
  "over-cooked",
  "plate scraps",
  "forgot about it",
] as const;

export const UNITS = ["kg", "g", "items"] as const;

export const FOOD_TYPES = [
  "cooked meals",
  "fresh produce",
  "bakery",
  "dairy",
  "packaged / dry goods",
  "mixed",
] as const;

/** Impact factors per kilogram of food wasted. */
const IMPACT: Record<string, { co2: number; water: number; money: number }> = {
  produce: { co2: 1.1, water: 320, money: 2.4 },
  dairy: { co2: 3.2, water: 1000, money: 4.1 },
  bakery: { co2: 1.6, water: 1600, money: 2.8 },
  meat: { co2: 12.5, water: 4300, money: 9.5 },
  leftovers: { co2: 2.5, water: 900, money: 3.6 },
  other: { co2: 2.0, water: 800, money: 3.0 },
};

export function toKilograms(quantity: number, unit: string): number {
  if (unit === "g") return quantity / 1000;
  if (unit === "items") return quantity * 0.25;
  return quantity;
}

export function impactOf(category: string, kilograms: number) {
  const factor = IMPACT[category] ?? IMPACT.other;
  return {
    co2: factor.co2 * kilograms,
    water: factor.water * kilograms,
    money: factor.money * kilograms,
  };
}

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Round coordinates to roughly a 1 km grid so open listings never reveal an exact door. */
export function coarsen(value: number): number {
  return Math.round(value * 100) / 100;
}
