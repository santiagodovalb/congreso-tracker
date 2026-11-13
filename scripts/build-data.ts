// Fetches roll-call votes and members for both chambers from ArgentinaDatos and writes
// public/diputados.json and public/senado.json.
// Run: npm run data
import { writeFileSync } from 'node:fs';
import { blocPosition, CODE, isCast, nameKey, type Chamber, type Code, type Data, type Deputy, type Vote } from './stats.ts';

const API = 'https://api.argentinadatos.com/v1';
// ponytail: both sources are sparse before 2024; widen this if they get backfilled.
const SINCE = '2024-01-01';
// The senate source has no bloc history: assume each senator's current bloc from when the
// current composition took office (or their own mandate start, if later).
const SENATE_BLOCS_FROM = '2025-12-10';
const NO_BLOC = 'Sin dato';
const today = new Date().toISOString().slice(0, 10);

/** A member record, normalized across chambers. Dates are YYYY-MM-DD. */
type Rec = { name: string; bloc: string | null; province: string; from: string; to: string; blocFrom: string };
type Roll = { id: string; date: string; title: string; result: string; votos: { name: string; code: Code }[] };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}
const day = (s: string | null | undefined, fallback = '9999-12-31') => (s ? s.slice(0, 10) : fallback);
// Results come as "afirmativo" (Diputados) or "afirmativa" (Senado).
const result = (r: string) => ({ afirmativa: 'afirmativo', negativa: 'negativo' })[r.toLowerCase()] ?? r.toLowerCase();

async function diputados(): Promise<{ recs: Rec[]; rolls: Roll[] }> {
  type Period = { inicio: string; fin: string };
  type Acta = { id: string; fecha: string; titulo: string; resultado: string; votos: { diputado: string; tipoVoto: string }[] };
  type Diputado = { nombre: string; apellido: string; provincia: string; bloque: string; periodoMandato: Period; periodoBloque: Period; ceseFecha?: string | null };
  const [actas, people] = await Promise.all([get<Acta[]>('diputados/actas'), get<Diputado[]>('diputados/diputados')]);
  return {
    recs: people.map((d) => ({
      name: `${d.apellido}, ${d.nombre}`,
      bloc: d.bloque,
      province: d.provincia,
      from: day(d.periodoMandato.inicio),
      to: day(d.ceseFecha) < day(d.periodoMandato.fin) ? day(d.ceseFecha) : day(d.periodoMandato.fin),
      blocFrom: day(d.periodoBloque.inicio),
    })),
    rolls: actas.map((a) => ({
      id: a.id,
      date: day(a.fecha),
      title: a.titulo,
      result: result(a.resultado),
      votos: a.votos.map((v) => ({ name: v.diputado, code: CODE[v.tipoVoto] ?? '.' })),
    })),
  };
}

async function senado(): Promise<{ recs: Rec[]; rolls: Roll[] }> {
  type Acta = { actaId: number; fecha: string | null; titulo: string; proyecto: string; descripcion: string; resultado: string; votos: { nombre: string; voto: string }[] };
  type Senador = { nombre: string; provincia: string; bloque: string | null; periodoReal: { inicio: string; fin: string | null } };
  const [actas, people] = await Promise.all([get<Acta[]>('senado/actas'), get<Senador[]>('senado/senadores')]);
  // "no emite" and "lev.vot." = present but didn't vote.
  const SENATE_CODE: Record<string, Code> = { si: 'A', no: 'N', abstencion: 'B', ausente: 'X', 'no emite': 'P', 'lev.vot.': 'P' };
  return {
    recs: people.map((s) => {
      const from = day(s.periodoReal.inicio);
      return { name: s.nombre, bloc: s.bloque, province: s.provincia, from, to: day(s.periodoReal.fin), blocFrom: from > SENATE_BLOCS_FROM ? from : SENATE_BLOCS_FROM };
    }),
    rolls: actas
      .filter((a) => a.fecha)
      .map((a) => ({
        id: String(a.actaId),
        date: day(a.fecha),
        // ponytail: whichever of titulo / proyecto is longer is usually the descriptive one.
        title: [a.titulo.length >= a.proyecto.length ? a.titulo : a.proyecto, a.descripcion].filter(Boolean).join(' – '),
        result: result(a.resultado),
        votos: a.votos.map((v) => ({ name: v.nombre, code: SENATE_CODE[v.voto] ?? '.' })),
      })),
  };
}

function build(chamber: Chamber, recs: Rec[], rolls: Roll[]): Data {
  const records = new Map<string, Rec[]>();
  for (const r of recs) records.set(nameKey(r.name), [...(records.get(nameKey(r.name)) ?? []), r]);
  // The record whose mandate covers the date, else the latest one.
  const recordAt = (name: string, date: string) => {
    const rs = records.get(nameKey(name));
    return rs?.find((r) => r.from <= date && date <= r.to) ?? rs?.at(-1);
  };

  // Drop placeholder rows: blank names and vacant seats ("Dip, Pendiente de Incorporacion").
  const isPerson = (name: string) => /[a-z]/i.test(name) && !/pendiente de incorporaci/i.test(name);
  // The senate source repeats a few roll calls (same id, one copy with extra metadata); keep one.
  const unique = [...new Map(rolls.map((r) => [r.id, r])).values()];
  const recent = unique
    .filter((r) => r.date >= SINCE)
    .map((r) => ({ ...r, votos: r.votos.filter((v) => isPerson(v.name)) }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id, undefined, { numeric: true }));
  const names = [...new Set(recent.flatMap((r) => r.votos.map((v) => v.name)))].sort((a, b) => a.localeCompare(b, 'es'));
  const index = new Map(names.map((n, i) => [n, i]));
  const deputies: Deputy[] = names.map((name) => ({ name, bloc: '', province: '', total: 0, present: 0, comparable: 0, against: 0 }));

  const votes: Vote[] = recent.map((r) => {
    const codes: Code[] = names.map(() => '.');
    const members = new Map<string, number[]>();

    for (const v of r.votos) {
      const i = index.get(v.name)!;
      const rec = recordAt(v.name, r.date);
      // Only count a bloc from when the member is known to belong to it, so a bloc switch
      // isn't mistaken for dissent.
      const bloc = rec?.bloc && r.date >= rec.blocFrom ? rec.bloc : NO_BLOC;
      codes[i] = v.code;
      members.set(bloc, [...(members.get(bloc) ?? []), i]);
      deputies[i].bloc ||= rec?.bloc ?? NO_BLOC;
      deputies[i].province ||= rec?.province ?? '';
    }

    const blocs: Vote['blocs'] = {};
    const against: Vote['against'] = [];
    for (const [bloc, idx] of members) {
      const blocCodes = idx.map((i) => codes[i]);
      blocs[bloc] = { A: 0, N: 0, B: 0, X: 0 };
      for (const c of blocCodes) if (isCast(c) || c === 'X') blocs[bloc][c]++;

      const pos = bloc === NO_BLOC ? null : blocPosition(blocCodes);
      for (const i of idx) {
        const c = codes[i];
        const d = deputies[i];
        d.total++;
        if (c !== 'X' && c !== '.') d.present++;
        if (!pos || !isCast(c)) continue;
        d.comparable++;
        if (c !== pos) {
          d.against++;
          against.push({ i, bloc, pos });
        }
      }
    }
    return { id: r.id, date: r.date, title: r.title, result: r.result, codes: codes.join(''), blocs, against };
  });

  const sitting = recs
    .filter((r) => r.from <= today && today <= r.to)
    .map((r) => ({ name: r.name, bloc: r.bloc ?? NO_BLOC, province: r.province }));

  const unmatched = deputies.filter((d) => d.bloc === NO_BLOC).map((d) => d.name);
  console.log(
    `${chamber}: ${sitting.length} sitting, ${votes.length} votes, ${deputies.length} members, ${unmatched.length} without bloc data${unmatched.length ? `: ${unmatched.join('; ')}` : ''}`,
  );
  return { chamber, updated: today, since: SINCE, members: sitting, deputies, votes };
}

for (const [chamber, load] of [['diputados', diputados], ['senado', senado]] as const) {
  const { recs, rolls } = await load();
  writeFileSync(new URL(`../public/${chamber}.json`, import.meta.url), JSON.stringify(build(chamber, recs, rolls)));
}
