export type Seat = { x: number; y: number; angle: number; r: number };

/**
 * Seat positions for a semicircular chamber: outer radius 1, centre (0, 0), y pointing up.
 * Returned left to right by angle, so giving each bloc a run of consecutive seats draws it as a wedge.
 */
export function hemicycle(n: number, rows: number, inner = 0.4): Seat[] {
  const radii = Array.from({ length: rows }, (_, i) => inner + ((1 - inner) * i) / (rows - 1));
  const total = radii.reduce((a, b) => a + b, 0);

  // Seats per row proportional to the row's length; largest remainders absorb the rounding.
  const exact = radii.map((r) => (n * r) / total);
  const counts = exact.map(Math.floor);
  const missing = n - counts.reduce((a, b) => a + b, 0);
  exact
    .map((e, i) => [e - counts[i], i])
    .sort((a, b) => b[0] - a[0])
    .slice(0, missing)
    .forEach(([, i]) => counts[i]++);

  const seats = radii.flatMap((r, i) =>
    Array.from({ length: counts[i] }, (_, j) => {
      const angle = counts[i] > 1 ? Math.PI * (1 - j / (counts[i] - 1)) : Math.PI / 2;
      return { x: r * Math.cos(angle), y: r * Math.sin(angle), angle, r };
    }),
  );
  return seats.sort((a, b) => b.angle - a.angle || a.r - b.r);
}
