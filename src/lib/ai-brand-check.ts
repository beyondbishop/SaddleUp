// Server-only: asks Claude whether a brand name someone typed is a real saddle maker and how it's
// properly spelled, so "Henri de Rival" becomes "Henri de Rivel" before it's added.

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

const CheckSchema = z.object({
  known_saddle_brand: z.boolean(),
  correct_spelling: z.string()
});

const SYSTEM = `You check saddle brand names typed by people listing used horse saddles (English and Western).
Given one typed name, answer:
- known_saddle_brand: true if you recognise it as a real saddle maker or saddle brand, false if not or unsure.
- correct_spelling: the brand's usual spelling and capitalisation (e.g. "henri de rival" -> "Henri de Rivel", "stubben" -> "Stubben", "circle y" -> "Circle Y"). If you don't recognise it, return the typed name with sensible capitalisation and nothing else changed.
Return the brand name only, without words like "Saddlery" or "Saddles" unless they are part of the brand's name.`;

/** Null when the check can't run (no key, timeout); the caller then skips it. */
export async function aiBrandCheck(typed: string): Promise<{ known: boolean; spelling: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic({ timeout: 15_000, maxRetries: 0 });
    const res = await client.beta.messages.parse({
      model: 'claude-haiku-5-5',
      max_tokens: 1000,
      output_config: { format: betaZodOutputFormat(CheckSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: `<typed_brand>${typed.slice(0, 80)}</typed_brand>` }]
    });
    const out = res.parsed_output;
    if (!out?.correct_spelling?.trim()) return null;
    return { known: out.known_saddle_brand, spelling: out.correct_spelling.trim().slice(0, 60) };
  } catch (e) {
    console.error('Brand check failed', e);
    return null;
  }
}
