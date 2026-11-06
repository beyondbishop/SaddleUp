/** The message an importer pastes into Messenger. Honest: the listing isn't public until claimed. */
export function claimMessage(sellerName: string | null | undefined, saddle: string, claimUrl: string) {
  const first = (sellerName ?? '').trim().split(/\s+/)[0];
  return (
    `Hi${first ? ` ${first}` : ''}! I saw your ${saddle} for sale. I'm with SaddleUp, a marketplace where riders search ` +
    `saddles by tree width and seat size. I set up a free listing for yours. If you'd like more buyers to see it, ` +
    `claim it here and it goes live (no cost, no obligation): ${claimUrl}\n` +
    `If you'd rather not, just ignore this and it never goes public.`
  );
}

export function claimUrlFor(token: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost') ? 'https://saddleup.me' : process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me';
  return `${site.replace(/\/$/, '')}/claim/${token}`;
}
