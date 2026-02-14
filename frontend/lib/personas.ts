export interface Persona {
  id: string;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
}

export const PERSONAS: Persona[] = [
  {
    id: 'marcus',
    name: 'Marcus Johnson',
    difficulty: 'Easy',
    description:
      'A 34-year-old startup founder with $250k portfolio. Open-minded but needs convincing.',
  },
  {
    id: 'sarah',
    name: 'Sarah Mitchell',
    difficulty: 'Medium',
    description:
      'A 45-year-old VP with $750k portfolio. Busy professional with limited time.',
  },
  {
    id: 'robert',
    name: 'Robert Chen',
    difficulty: 'Hard',
    description:
      'A 58-year-old retired engineer with $400k portfolio. Highly skeptical and resistant.',
  },
];