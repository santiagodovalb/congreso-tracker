import { useEffect, useMemo, useState } from 'react';
import type { Chamber as ChamberId, Code, Counts, Data, Vote } from '../scripts/stats.ts';
import { blocColor } from './blocs';
import Chamber from './Chamber';

const PORTFOLIO = 'https://portfolio-santiagodoval.vercel.app/';

const LABEL: Record<string, string> = { A: 'Afirmativo', N: 'Negativo', B: 'Abstención', X: 'Ausente' };
const SEGMENTS = ['A', 'N', 'B', 'X'] as const;
// Below this many comparable votes a dissent rate is noise.
const MIN_COMPARABLE = 20;

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const size = (c: Counts) => c.A + c.N + c.B + c.X;

const TEXT = {
  diputados: {
    switch: 'Diputados',
    title: '¿Cómo vota Diputados?',
    of: 'de la Cámara de Diputados',
    person: 'diputado',
    people: 'diputados',
    source: 'las actas de la HCDN',
    blocNote:
      'La fuente solo registra el bloque actual de cada diputado y desde cuándo lo integra. En votaciones anteriores a esa fecha su bloque figura como “Sin dato” y no entra en el cálculo.',
  },
  senado: {
    switch: 'Senadores',
    title: '¿Cómo vota Senadores?',
    of: 'del Senado',
    person: 'senador',
    people: 'senadores',
    source: 'las actas del Senado',
    blocNote:
      'La fuente solo registra el bloque actual de cada senador, sin la fecha en que se incorporó. Se asume desde el 10 de diciembre de 2025, cuando asumió la composición actual (o desde el inicio de su mandato, si es posterior). En votaciones anteriores su bloque figura como “Sin dato” y no entra en el cálculo. Si un senador cambió de bloque después de esa fecha, sus votos se cuentan con el bloque actual.',
  },
} satisfies Record<ChamberId, Record<string, string>>;
type Text = (typeof TEXT)[ChamberId];

const fromHash = (): ChamberId => (location.hash === '#senado' ? 'senado' : 'diputados');

export default function App() {
  const [chamber, setChamber] = useState<ChamberId>(fromHash);
  const [data, setData] = useState<Data>();
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<'votes' | 'deputies'>('votes');
  // Same as the portfolio: the saved choice (applied pre-paint in index.html), else the system setting.
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
  };

  useEffect(() => {
    // The hash keeps the chosen chamber shareable and survives reloads.
    history.replaceState(null, '', chamber === 'senado' ? '#senado' : location.pathname);
    let current = true;
    fetch(`/${chamber}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Data) => current && setData(d), () => current && setError(true));
    return () => {
      current = false;
    };
  }, [chamber]);

  // Follow hash changes on an open page (links, back button).
  useEffect(() => {
    const onHash = () => setChamber(fromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  if (error) return <p className="state">No se pudieron cargar los datos.</p>;
  if (!data) return <p className="state">Cargando…</p>;

  // Texts follow the loaded data, so they never get ahead of it while the other chamber loads.
  const t = TEXT[data.chamber];

  return (
    <main>
      <header>
        <div className="topbar">
          <a className="byline" href={PORTFOLIO} target="_blank" rel="noopener">
            <img src="/avatar.png" alt="" width={40} height={40} />
            <span>
              <span className="by-label">Un proyecto de</span>
              <span className="by-name">
                Santiago Doval <span className="by-link">Ver portfolio ↗</span>
              </span>
            </span>
          </a>
          <button type="button" className="theme" onClick={toggleTheme} aria-label="Cambiar modo claro u oscuro">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
        <div className="switch" role="group" aria-label="Cámara">
          {(Object.keys(TEXT) as ChamberId[]).map((c) => (
            <button key={c} aria-pressed={chamber === c} onClick={() => setChamber(c)}>
              {TEXT[c].switch}
            </button>
          ))}
        </div>
        <h1>{t.title}</h1>
        <Chamber key={data.chamber} members={data.members} />
        <p className="lead">
          {data.votes.length} votaciones nominales {t.of} desde {fmtDate(data.since)}. Cómo vota cada bloque y quién vota
          en disidencia con su bloque.
        </p>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'votes'} onClick={() => setTab('votes')}>
            Votaciones
          </button>
          <button role="tab" aria-selected={tab === 'deputies'} onClick={() => setTab('deputies')}>
            {t.switch}
          </button>
        </div>
      </header>

      {tab === 'votes' ? <Votes key={data.chamber} data={data} /> : <Deputies key={data.chamber} data={data} t={t} />}

      <footer>
        <p>
          <strong>Cómo se calcula.</strong> La posición de un bloque es el voto más común entre sus miembros que votaron.
          Un {t.person} “vota en disidencia” cuando vota distinto a esa posición. Los bloques empatados o con un solo voto no
          cuentan.
        </p>
        <p>{t.blocNote}</p>
        <p>
          Datos: <a href="https://argentinadatos.com">ArgentinaDatos</a>, a partir de {t.source}. Actualizado el{' '}
          {fmtDate(data.updated)}.
        </p>
      </footer>
    </main>
  );
}

function Votes({ data }: { data: Data }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => data.votes.filter((v) => fold(v.title).includes(fold(q))), [data, q]);

  return (
    <section>
      <input type="search" placeholder="Buscar votación…" aria-label="Buscar votación" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="count">{shown.length} votaciones</p>
      <ul className="list">
        {shown.map((v) => (
          <li key={v.id}>
            <button className="row" aria-expanded={open === v.id} onClick={() => setOpen(open === v.id ? null : v.id)}>
              <span className="date">{fmtDate(v.date)}</span>
              <span className="title">{v.title}</span>
              <span className={`pill ${v.result}`}>{v.result}</span>
            </button>
            {open === v.id && <VoteDetail vote={v} data={data} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function VoteDetail({ vote, data }: { vote: Vote; data: Data }) {
  const blocs = Object.entries(vote.blocs).sort((a, b) => size(b[1]) - size(a[1]));
  const total = blocs.reduce((t, [, c]) => ({ A: t.A + c.A, N: t.N + c.N, B: t.B + c.B, X: t.X + c.X }), { A: 0, N: 0, B: 0, X: 0 });

  return (
    <div className="detail">
      <p className="totals">
        {SEGMENTS.map((s) => (
          <span key={s}>
            <i className={`dot ${s}`} /> {LABEL[s]} {total[s]}
          </span>
        ))}
      </p>
      {blocs.map(([name, c]) => (
        <div className="bloc" key={name}>
          <span className="bname">{name}</span>
          <Bar counts={c} />
          <span className="n">{size(c)}</span>
        </div>
      ))}
      <h3>Votaron en disidencia con su bloque ({vote.against.length})</h3>
      {vote.against.length ? (
        <ul className="dissent">
          {vote.against.map(({ i, bloc, pos }) => (
            <li key={i}>
              <strong>{data.deputies[i].name}</strong> ({bloc}) votó {LABEL[vote.codes[i]].toLowerCase()}; su bloque,{' '}
              {LABEL[pos].toLowerCase()}.
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Todos los bloques votaron unidos.</p>
      )}
    </div>
  );
}

function Bar({ counts }: { counts: Counts }) {
  const n = size(counts);
  return (
    <span className="bar" role="img" aria-label={SEGMENTS.map((s) => `${LABEL[s]} ${counts[s]}`).join(', ')}>
      {SEGMENTS.map((s) => counts[s] > 0 && <span key={s} className={s} style={{ width: `${(counts[s] / n) * 100}%` }} />)}
    </span>
  );
}

type Sort = 'against' | 'absent' | 'name';

function Deputies({ data, t }: { data: Data; t: Text }) {
  const [q, setQ] = useState('');
  const [bloc, setBloc] = useState('');
  const [sort, setSort] = useState<Sort>('against');
  const [open, setOpen] = useState<number | null>(null);

  const blocs = useMemo(() => {
    const n = new Map<string, number>();
    for (const d of data.deputies) n.set(d.bloc, (n.get(d.bloc) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1]).map(([b]) => b);
  }, [data]);

  const rows = useMemo(() => {
    const dissent = (d: Data['deputies'][number]) => (d.comparable >= MIN_COMPARABLE ? d.against / d.comparable : -1);
    const by: Record<Sort, (a: Data['deputies'][number], b: Data['deputies'][number]) => number> = {
      against: (a, b) => dissent(b) - dissent(a),
      absent: (a, b) => a.present / a.total - b.present / b.total,
      name: (a, b) => a.name.localeCompare(b.name, 'es'),
    };
    return data.deputies
      .map((d, i) => ({ ...d, i }))
      .filter((d) => (!bloc || d.bloc === bloc) && fold(d.name).includes(fold(q)))
      .sort(by[sort]);
  }, [data, q, bloc, sort]);

  const header = (key: Sort, label: string) => (
    <th aria-sort={sort === key ? 'descending' : undefined}>
      <button onClick={() => setSort(key)}>{label}</button>
    </th>
  );

  return (
    <section>
      <div className="filters">
        <input type="search" placeholder={`Buscar ${t.person}…`} aria-label={`Buscar ${t.person}`} value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filtrar por bloque" value={bloc} onChange={(e) => setBloc(e.target.value)}>
          <option value="">Todos los bloques</option>
          {blocs.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </div>
      <p className="count">
        {rows.length} {t.people} · bloque actual · el porcentaje de disidencia requiere al menos {MIN_COMPARABLE} votos comparables
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {header('name', t.person[0].toUpperCase() + t.person.slice(1))}
              {header('absent', 'Presencia')}
              {header('against', 'Vota en disidencia')}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <DeputyRow key={d.i} d={d} data={data} open={open === d.i} onToggle={() => setOpen(open === d.i ? null : d.i)} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DeputyRow({ d, data, open, onToggle }: { d: Data['deputies'][number] & { i: number }; data: Data; open: boolean; onToggle: () => void }) {
  const dissents = useMemo(
    () => (open ? data.votes.flatMap((v) => v.against.filter((a) => a.i === d.i).map((a) => ({ v, pos: a.pos as Code }))) : []),
    [open, data, d.i],
  );

  return (
    <>
      <tr>
        <td>
          <div className="who">
            <i className="swatch" style={{ background: blocColor(d.bloc) }} />
            <div>
              <button className="name" aria-expanded={open} onClick={onToggle}>
                {d.name}
              </button>
              <span className="sub">
                {d.bloc}
                {d.province && ` · ${d.province}`}
              </span>
            </div>
          </div>
        </td>
        <td className="num">
          {pct(d.present, d.total)}%<span className="sub">{d.total} votaciones</span>
        </td>
        <td className="num">
          {d.comparable >= MIN_COMPARABLE ? `${pct(d.against, d.comparable)}%` : '—'}
          <span className="sub">
            {d.against} de {d.comparable}
          </span>
        </td>
      </tr>
      {open && (
        <tr className="expanded">
          <td colSpan={3}>
            {dissents.length ? (
              <ul className="dissent">
                {dissents.map(({ v, pos }) => (
                  <li key={v.id}>
                    <span className="date">{fmtDate(v.date)}</span> {v.title}: votó {LABEL[v.codes[d.i]].toLowerCase()}, su bloque{' '}
                    {LABEL[pos].toLowerCase()}.
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Siempre votó con su bloque.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
