// Server-only: picks the best cover photo for a saddle listing. SaddleUp covers show the saddle
// from the side facing right: pommel on the right, cantle on the left, whole saddle in frame,
// so search results line up and look alike.

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

const PickSchema = z.object({
  /** 1-based number of the best cover photo, or 0 if none shows the saddle from the side. */
  best: z.number().int(),
  facing_right: z.boolean()
});

const SYSTEM = `You pick the cover photo for a used horse saddle listing. Photos are numbered in the order sent.
The ideal cover is a side view of the whole saddle with the pommel (front) pointing to the RIGHT and the cantle (back) on the LEFT. On an English saddle the flap hangs below the seat and the cantle is the raised back of the seat; on a Western saddle the horn is at the front (pommel) end.
Choose:
1. A full side view facing right (cantle on the left), sharp and well lit, saddle filling the frame. If several qualify, pick the clearest.
2. Otherwise a full side view facing left.
3. Otherwise the photo that shows the most of the saddle.
Never pick a screenshot, a close-up of a stamp, tag or serial number, the underside/panels, or a photo where the saddle is barely visible, unless nothing else exists.
best: the photo's number (1-based); 0 only if no photo shows a saddle at all. facing_right: whether that photo shows the saddle facing right (cantle on the left).`;

/** Index (0-based) of the best cover among `urls`, or null if the check can't run or finds none. */
export async function pickCoverPhoto(urls: string[]): Promise<{ index: number; facingRight: boolean } | null> {
  if (!process.env.ANTHROPIC_API_KEY || urls.length < 2) return null;
  try {
    const client = new Anthropic({ timeout: 50_000, maxRetries: 0 }) // up to 20 photos;
    const res = await client.beta.messages.parse({
      model: 'claude-sonnet-5-5',
      max_tokens: 2000,
      output_config: { format: betaZodOutputFormat(PickSchema) },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            ...urls.flatMap((url, i) => [
              { type: 'text' as const, text: `Photo ${i + 1}:` },
              { type: 'image' as const, source: { type: 'url' as const, url } }
            ]),
            { type: 'text' as const, text: 'Which photo should be the cover?' }
          ]
        }
      ]
    });
    const out = res.parsed_output;
    if (!out || out.best < 1 || out.best > urls.length) return null;
    return { index: out.best - 1, facingRight: out.facing_right };
  } catch (e) {
    console.error('Cover photo pick failed', e);
    return null;
  }
}
