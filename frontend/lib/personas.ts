export interface Persona {
  id: string;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Aggressive';
  description: string;
  agentId: string;
}

export const PERSONAS: Persona[] = [
  {
    id: 'easy',
    name: 'Friendly Client',
    difficulty: 'Easy',
    description: 'A friendly client who is open to suggestions and easy to talk to.',
    agentId: process.env.NEXT_PUBLIC_AGENT_ID_EASY || 'placeholder-easy',
  },
  {
    id: 'medium',
    name: 'Busy Professional',
    difficulty: 'Medium',
    description: 'Has some questions and limited time. Requires concise communication.',
    agentId: process.env.NEXT_PUBLIC_AGENT_ID_MEDIUM || 'placeholder-medium',
  },
  {
    id: 'aggressive',
    name: 'Skeptical Investor',
    difficulty: 'Aggressive',
    description: 'Highly skeptical, interrupts frequently, and challenges your expertise.',
    agentId: process.env.NEXT_PUBLIC_AGENT_ID_AGGRESSIVE || 'placeholder-aggressive',
  },
];