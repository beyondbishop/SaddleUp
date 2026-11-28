/** '17.5" Devoucoux Chiberta', leaving out the 'Other' placeholder brand. */
export function listingTitle(l: { seat_size: number | string; model: string; brands?: { name: string } | null }) {
  const brand = l.brands?.name;
  return `${Number(l.seat_size)}" ${brand && brand !== 'Other' ? `${brand} ` : ''}${l.model}`;
}
