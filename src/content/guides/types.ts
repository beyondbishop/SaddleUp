export type Guide = {
  slug: string;
  /** On-page H1. */
  title: string;
  /** <title> tag, used as-is (no " | SaddleUp" suffix). */
  metaTitle: string;
  description: string;
  /** One- or two-sentence answer-first summary shown on the index and at the top of the post. */
  summary: string;
  /** ISO dates (YYYY-MM-DD). */
  published: string;
  updated: string;
  readMinutes: number;
  /** Rendered as an FAQ section and as FAQPage structured data. */
  faqs: { q: string; a: string }[];
  sources: [label: string, url: string][];
  /** Article body before the FAQ. */
  Body: () => JSX.Element;
  /** Closing section after the FAQ. */
  Conclusion?: () => JSX.Element;
};
