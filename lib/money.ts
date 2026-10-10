export const TIP_CENTS = [200, 500, 1000] as const;

export function isTip(value: number): value is (typeof TIP_CENTS)[number] {
  return (TIP_CENTS as readonly number[]).includes(value);
}

export function money(cents: number): string {
  if (!Number.isFinite(cents)) return "$0";
  const rounded = Math.round(cents);
  return rounded % 100 === 0 ? `$${rounded / 100}` : `$${(rounded / 100).toFixed(2)}`;
}
