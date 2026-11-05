'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Listing photo gallery: swipe on phones (native scroll-snap), arrows + thumbnails on desktop,
 * a "3 / 11" counter, and tap/click to view full screen (arrow keys and Esc work there).
 * `children` is drawn over the main photo (e.g. the favorite button).
 */
export default function PhotoGallery({
  images,
  alt,
  children
}: {
  images: string[];
  alt: string;
  children?: React.ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const count = images.length;

  // While we scroll the gallery ourselves (arrows/thumbnails), ignore the scroll events it fires,
  // so the counter doesn't flicker through the photos in between.
  const autoScrolling = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback(
    (i: number, smooth = true) => {
      const next = (i + count) % count;
      const el = track.current;
      const from = el ? Math.round(el.scrollLeft / el.clientWidth) : 0;
      setIndex(next);
      if (!el) return;
      if (autoScrolling.current) clearTimeout(autoScrolling.current);
      autoScrolling.current = setTimeout(() => (autoScrolling.current = null), 600);
      // Neighbouring photo: glide. Wrapping around or jumping far: go straight there.
      el.scrollTo({ left: next * el.clientWidth, behavior: smooth && Math.abs(next - from) <= 2 ? 'smooth' : 'auto' });
    },
    [count]
  );

  // Keep the counter/thumbnails in step when the person swipes.
  function onScroll() {
    const el = track.current;
    if (!el || autoScrolling.current) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index && i >= 0 && i < count) setIndex(i);
  }

  // Keep the active thumbnail visible.
  useEffect(() => {
    const t = thumbs.current?.children[index] as HTMLElement | undefined;
    t?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [index]);

  // Full-screen keyboard controls.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % count);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + count) % count);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [fullscreen, count]);

  // When leaving full screen, line the main gallery up with the photo they ended on.
  useEffect(() => {
    if (!fullscreen) goTo(index, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  if (!count) {
    return (
      <div className="relative aspect-[4/3] bg-saddle-paper border border-saddle-line rounded overflow-hidden">
        <div className="flex items-center justify-center h-full text-saddle-brown/40">No photo yet</div>
        {children}
      </div>
    );
  }

  const arrow =
    'absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-saddle-paper/90 border border-saddle-line text-saddle-ink text-xl leading-none shadow hover:bg-saddle-paper';

  return (
    <div>
      <div className="relative aspect-[4/3] bg-saddle-paper border border-saddle-line rounded overflow-hidden">
        <div
          ref={track}
          onScroll={onScroll}
          className="flex h-full overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => {
                setIndex(i);
                setFullscreen(true);
              }}
              className="shrink-0 w-full h-full snap-center cursor-zoom-in"
              aria-label={`View photo ${i + 1} of ${count} full screen`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${alt} — photo ${i + 1}`}
                loading={i === 0 ? 'eager' : 'lazy'}
                className="w-full h-full object-contain"
              />
            </button>
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" onClick={() => goTo(index - 1)} aria-label="Previous photo" className={`${arrow} left-3 hidden sm:block`}>
              ‹
            </button>
            <button type="button" onClick={() => goTo(index + 1)} aria-label="Next photo" className={`${arrow} right-3 hidden sm:block`}>
              ›
            </button>
            <span className="absolute bottom-3 left-3 bg-saddle-ink/75 text-saddle-cream text-xs px-2 py-1 rounded-sm">
              {index + 1} / {count}
            </span>
          </>
        )}
        {children}
      </div>

      {count > 1 && (
        <div ref={thumbs} className="flex gap-2 mt-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              className={`shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded overflow-hidden border-2 transition-colors ${
                i === index ? 'border-saddle-brown' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setFullscreen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[index]}
            alt={`${alt} — photo ${index + 1}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label="Close"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white text-2xl leading-none"
          >
            ×
          </button>
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i - 1 + count) % count);
                }}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 text-white text-3xl leading-none"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i + 1) % count);
                }}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 text-white text-3xl leading-none"
              >
                ›
              </button>
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/80 text-sm">
                {index + 1} / {count}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
