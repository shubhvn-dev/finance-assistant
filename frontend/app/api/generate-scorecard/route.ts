import { streamObject, generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { scorecardSchema, signalSchema } from '@/lib/scorecardSchema';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const modelId = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

const PERSONA_CONTEXT: Record<string, {
  description: string;
  difficulty: string;
  main_objection: string;
  scoring_weights: Record<string, number>;
}> = {
  robert: {
    description: 'Robert Chen — 58-year-old Retired Mechanical Engineer, $400k portfolio at Fidelity',
    difficulty: 'Hard',
    main_objection: 'I already manage it myself, done fine for 30 years',
    scoring_weights: { objection_handling: 1.5, tone_confidence: 1.3, close_attempt: 1.2 },
  },
  sarah: {
    description: 'Sarah Mitchell — 45-year-old VP of Operations, $750k portfolio at Vanguard',
    difficulty: 'Medium',
    main_objection: 'Can you just send me an email?',
    scoring_weights: { objection_handling: 1.1, tone_confidence: 1.0, close_attempt: 1.1 },
  },
  marcus: {
    description: 'Marcus Johnson — 34-year-old Startup Founder, $250k portfolio at Robinhood + Crypto',
    difficulty: 'Easy',
    main_objection: "I've been managing my own stuff, it's been fine",
    scoring_weights: { objection_handling: 0.8, tone_confidence: 1.2, close_attempt: 0.9 },
  },
};

function buildTranscript(messages: { role: string; content: string; turn_number: number }[], personaName: string): string {
  return messages
    .map((m) => `${m.role === 'advisor' ? 'Advisor' : personaName}: ${m.content}`)
    .join('\n');
}

const PERSONA_NAMES: Record<string, string> = {
  robert: 'Robert Chen',
  sarah: 'Sarah Mitchell',
  marcus: 'Marcus Johnson',
};

export async function POST(req: Request) {
  const { sessionId, personaId, messages } = await req.json();

  const persona = PERSONA_CONTEXT[personaId as string];
  if (!persona) {
    return new Response(JSON.stringify({ error: `Unknown persona: ${personaId}` }), { status: 400 });
  }

  const personaName = PERSONA_NAMES[personaId as string] ?? personaId;
  const transcript = buildTranscript(messages, personaName);

  // Stage 1 — signal extraction (non-streaming)
  let signals = {};
  try {
    const { object: extractedSignals } = await generateObject({
      model: google(modelId),
      schema: signalSchema,
      prompt: `Extract behavioral signals from this sales call transcript. Return only the JSON.\n\nTranscript:\n${transcript}`,
    });
    signals = extractedSignals;
  } catch {
    // Non-fatal — proceed with empty signals
  }

  // Stage 2 — persona-aware scoring (streaming)
  const scoringPrompt = `You are a senior sales coach evaluating a financial advisor cold call.

Persona: ${persona.description}
Difficulty: ${persona.difficulty}
Main objection style: ${persona.main_objection}
Scoring weights (weight >1.0 = penalize harder for this category): ${JSON.stringify(persona.scoring_weights)}

Behavioral signals extracted from this call:
${JSON.stringify(signals, null, 2)}

Full transcript:
${transcript}

Score the advisor. Be specific — reference exact phrases. Apply scoring_weights. Generate 2-4 annotations on the most impactful advisor turns only. For bad annotations, rewrite must be the exact words to say instead.`;

  const result = streamObject({
    model: google(modelId),
    schema: scorecardSchema,
    prompt: scoringPrompt,
  });

  return result.toTextStreamResponse();
}
