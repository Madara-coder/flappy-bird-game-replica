export interface Medal {
  id: 'bronze' | 'silver' | 'gold' | 'platinum';
  label: string;
}

const MEDALS: (Medal & { min: number })[] = [
  { id: 'platinum', label: 'Platinum', min: 40 },
  { id: 'gold', label: 'Gold', min: 30 },
  { id: 'silver', label: 'Silver', min: 20 },
  { id: 'bronze', label: 'Bronze', min: 10 },
];

export function medalFor(score: number): Medal | null {
  return MEDALS.find((m) => score >= m.min) ?? null;
}
