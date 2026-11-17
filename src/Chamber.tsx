import { useEffect, useMemo, useState } from 'react';
import type { Member } from '../scripts/stats.ts';
import { groupColor, groupOf, OTHERS } from './blocs';
import { hemicycle } from './hemicycle';

// Blocs smaller than this share the "Otros bloques" colour; each seat's tooltip still names its bloc.
const minSeats = (n: number) => (n > 100 ? 4 : 3);

// Left-to-right placement on the arc, following the usual left–right convention. Unlisted blocs go in the middle.
const ORDER = [
  'Frente de Izquierda',
  'Unión por la Patria',
  'Justicialista',
  'Convicción Federal',
  OTHERS,
  'Innovación Federal',
  'Provincias Unidas',
  'UCR',
  'PRO',
  'La Libertad Avanza',
];

// Rows that space seats evenly along and across rows: 9 for Diputados (257), 5 for the Senado (72).
const rowsFor = (n: number) => (n > 100 ? 9 : 5);
// Seat radius as a share of the gap between rows.
const SEAT_SHARE = 0.38;
const QUORUM = (n: number) => Math.floor(n / 2) + 1;

const fmtPct = (n: number, total: number) =>
  `${((n / total) * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

const COUNT_MS = 1100;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Eased 0 → 1 over `ms` after mount; jumps straight to 1 for people who ask for reduced motion. */
function useCountUp(ms: number) {
  const [p, setP] = useState(() => (reducedMotion() ? 1 : 0));
  useEffect(() => {
    if (reducedMotion()) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setP(1 - (1 - t) ** 3); // ease-out cubic: fast start, gentle landing
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Frames don't run in hidden tabs or some previews; never leave the real numbers at 0.
    const done = setTimeout(() => setP(1), ms + 200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [ms]);
  return p;
}

export default function Chamber({ members, onPick }: { members: Member[]; onPick: (name: string) => void }) {
  // Remounted per chamber (keyed in App), so the numbers count up on load and on every switch.
  const p = useCountUp(COUNT_MS);
  // Hover previews a bloc; a click or tap pins it (touch screens have no hover).
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const focus = hovered ?? pinned;

  const { seats, groups, others } = useMemo(() => {
    const sizes = new Map<string, number>();
    const named = members.map((m) => ({ ...m, group: groupOf(m.bloc) }));
    for (const m of named) sizes.set(m.group, (sizes.get(m.group) ?? 0) + 1);
    for (const m of named) if (sizes.get(m.group)! < minSeats(members.length)) m.group = OTHERS;

    const rank = (g: string) => (ORDER.includes(g) ? ORDER.indexOf(g) : ORDER.indexOf(OTHERS));
    named.sort((a, b) => rank(a.group) - rank(b.group) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name, 'es'));

    const positions = hemicycle(named.length, rowsFor(named.length));
    const seats = named.map((m, i) => ({ ...m, ...positions[i] }));

    const count = new Map<string, number>();
    for (const m of named) count.set(m.group, (count.get(m.group) ?? 0) + 1);
    const groups = [...count].sort((a, b) => b[1] - a[1]);
    const others = [...sizes].filter(([, n]) => n < minSeats(members.length)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { seats, groups, others };
  }, [members]);

  const total = members.length;
  // hemicycle() uses an inner radius of 0.4, so rows sit 0.6 / (rows - 1) apart.
  const seatR = (SEAT_SHARE * 0.6) / (rowsFor(total) - 1);
  const pad = seatR + 0.01; // keep the outermost seats inside the drawing

  // The count-up re-renders every frame; keep the 257 seats out of it.
  const circles = useMemo(
    () =>
      seats.map((s) => (
        <circle
          key={`${s.name}-${s.bloc}`}
          cx={s.x}
          cy={s.y}
          r={seatR}
          fill={groupColor(s.group)}
          opacity={focus && focus !== s.group ? 0.18 : 1}
          onClick={() => onPick(s.name)}
        >
          <title>{`${s.name} · ${s.bloc}${s.province ? ` · ${s.province}` : ''}`}</title>
        </circle>
      )),
    [seats, seatR, focus, onPick],
  );

  return (
    <section className="chamber" aria-labelledby="chamber-title">
      <figure>
        <svg viewBox={`${-1 - pad} ${-1 - pad} ${2 + 2 * pad} ${1 + 2 * pad}`} role="img" aria-labelledby="chamber-title chamber-desc">
          <desc id="chamber-desc">
            {groups.map(([g, n]) => `${g}: ${n} bancas`).join('; ')}
          </desc>
          <g transform="scale(1,-1)">{circles}</g>
          <text className="seats-total" x="0" y="-0.12" textAnchor="middle">
            {Math.round(total * p)}
          </text>
          <text className="seats-label" x="0" y="-0.02" textAnchor="middle">
            bancas · quórum {QUORUM(total)}
          </text>
        </svg>
      </figure>

      <div className="legend">
        <h2 id="chamber-title">Composición actual</h2>
        <ul>
          {groups.map(([g, n]) => (
            <li key={g}>
              <button
                aria-pressed={pinned === g}
                onClick={() => setPinned(pinned === g ? null : g)}
                onMouseEnter={() => setHovered(g)}
                onMouseLeave={() => setHovered(null)}
              >
                <i className="swatch" style={{ background: groupColor(g) }} />
                <span className="lname">{g}</span>
                <span className="lseats">{Math.round(n * p)}</span>
                <span className="lpct">{fmtPct(n * p, total)}</span>
              </button>
            </li>
          ))}
        </ul>
        {others.length > 0 && (
          <p className="others">
            <strong>{OTHERS}:</strong> {others.map(([b, n]) => `${b} (${n})`).join(', ')}.
          </p>
        )}
      </div>
    </section>
  );
}
