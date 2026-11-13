// Shared by the data build script and the site.

export type Code = 'A' | 'N' | 'B' | 'X' | 'P' | '.';
type Cast = 'A' | 'N' | 'B';

// '.' = not a member of the chamber at the time of that vote. 'P' = present without voting (presiding, or didn't cast).
export const CODE: Record<string, Code> = {
  afirmativo: 'A',
  negativo: 'N',
  abstencion: 'B',
  ausente: 'X',
  presidente: 'P',
};

export type Counts = Record<Cast | 'X', number>;

export type Vote = {
  id: string;
  date: string;
  title: string;
  result: string;
  /** One char per deputy, indexed like Data.deputies. */
  codes: string;
  blocs: Record<string, Counts>;
  /** Deputies who cast a different vote from their bloc's position. */
  against: { i: number; bloc: string; pos: Code }[];
};

export type Deputy = {
  name: string;
  bloc: string;
  province: string;
  /** Votes held while a member. */
  total: number;
  /** Present: voted, abstained or presided. */
  present: number;
  /** Cast a vote on a roll call where their bloc took a clear position. */
  comparable: number;
  against: number;
};

/** A sitting deputy, for the seat chart. */
export type Member = { name: string; bloc: string; province: string };

export type Chamber = 'diputados' | 'senado';

export type Data = {
  chamber: Chamber;
  updated: string;
  since: string;
  /** Sitting members, for the seat chart. */
  members: Member[];
  /** Everyone who voted since `since`, indexed like Vote.codes. */
  deputies: Deputy[];
  votes: Vote[];
};

export const isCast = (c: Code): c is Cast => c === 'A' || c === 'N' || c === 'B';

/** A bloc's position: its most common cast vote. null on a tie or with fewer than 2 votes cast. */
export function blocPosition(codes: Code[]): Code | null {
  const n = { A: 0, N: 0, B: 0 };
  for (const c of codes) if (isCast(c)) n[c]++;
  const ranked = (Object.entries(n) as [Cast, number][]).sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] + ranked[1][1] + ranked[2][1] < 2 || ranked[0][1] === ranked[1][1]) return null;
  return ranked[0][0];
}

/** "Ali, Ernesto \"Pipi\"" and "Alí, Ernesto Félix" both → "ali|ernesto". */
export function nameKey(name: string): string {
  const [surname = '', given = ''] = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/"[^"]*"/g, '')
    .toLowerCase()
    .split(',');
  return `${surname.replace(/[^a-z]/g, '')}|${given.trim().split(/\s+/)[0] ?? ''}`;
}
