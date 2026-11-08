/** A round headshot, or the person's initials when there's no photo. */
export default function Avatar({ url, initials, size = 36, className = '' }: {
  url: string | null | undefined; initials: string; size?: number; className?: string;
}) {
  const style = { width: size, height: size };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" width={size} height={size} style={style} referrerPolicy="no-referrer"
        className={`rounded-full object-cover bg-saddle-sand shrink-0 ${className}`} />
    );
  }
  return (
    <span aria-hidden="true" style={{ ...style, fontSize: Math.round(size * 0.38) }}
      className={`rounded-full bg-saddle-green text-saddle-cream font-semibold inline-flex items-center justify-center shrink-0 ${className}`}>
      {initials}
    </span>
  );
}
