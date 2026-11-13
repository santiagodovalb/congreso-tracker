// Bloc display names and colors, shared by the seat chart and the deputies list.

// Blocs that ran as one electoral front are shown together, plus shorter names.
export const MERGE: Record<string, string> = {
  'Pts-Frente de Izquierda y de Trabajadores Unidad': 'Frente de Izquierda',
  'Partido Obrero en el Frente de Izquierda y de Trabajadores': 'Frente de Izquierda',
  'Partido Obrero en el Frente de Izquierda y de Trabajadores-U': 'Frente de Izquierda',
  'Ucr - Unión Cívica Radical': 'UCR',
  'UCR - Unión Cívica Radical': 'UCR',
  Pro: 'PRO',
  'Frente Pro': 'PRO',
};

export const OTHERS = 'Otros bloques';

// ponytail: hand-kept list. A bloc not listed here (small, former, or new) shows in the "Otros bloques" grey.
export const COLOR: Record<string, string> = {
  'Frente de Izquierda': '#a3243b',
  'Unión por la Patria': '#3d8fd6',
  Justicialista: '#3d8fd6', // the Peronist bloc's name in the Senado
  'Convicción Federal': '#2bb3a3',
  'Innovación Federal': '#4f9e5b',
  'Provincias Unidas': '#e08a2e',
  UCR: '#e2574c',
  PRO: '#f0c330',
  'La Libertad Avanza': '#7b4fc9',
  [OTHERS]: '#a9a39a',
};

export const groupOf = (bloc: string) => MERGE[bloc] ?? bloc;
export const groupColor = (group: string) => COLOR[group] ?? COLOR[OTHERS];
export const blocColor = (bloc: string) => groupColor(groupOf(bloc));
