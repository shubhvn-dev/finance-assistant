import { z } from 'zod';

export const signalSchema = z.object({
  question_ratio: z.number(),
  filler_word_count: z.number(),
  objection_count: z.number(),
  objection_responses: z.array(
    z.object({
      objection: z.string(),
      response_type: z.enum(['deflect', 'address', 'hedge', 'reframe']),
    })
  ),
  price_mentioned_turn: z.number().nullable(),
  close_attempted: z.boolean(),
  close_type: z.enum(['hard', 'soft', 'none']),
  avg_rep_turn_length: z.number(),
  interruptions: z.number(),
});

export const annotationSchema = z.object({
  turn_number: z.number(),
  type: z.enum(['good', 'bad']),
  label: z.string(),
  insight: z.string(),
  rewrite: z.string().optional(),
});

export const scorecardSchema = z.object({
  overall_score: z.number(),
  opener_score: z.number(),
  opener_feedback: z.string(),
  objection_handling_score: z.number(),
  objection_handling_feedback: z.string(),
  tone_confidence_score: z.number(),
  tone_confidence_feedback: z.string(),
  close_attempt_score: z.number(),
  close_attempt_feedback: z.string(),
  best_moment: z.string(),
  biggest_mistake: z.string(),
  what_to_say_instead: z.string(),
  meeting_booked: z.boolean(),
  annotations: z.array(annotationSchema).optional(),
});

export type ScorecardSchema = z.infer<typeof scorecardSchema>;
export type SignalSchema = z.infer<typeof signalSchema>;
export type AnnotationSchema = z.infer<typeof annotationSchema>;
