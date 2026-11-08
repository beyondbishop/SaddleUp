// Emails that Supabase Auth sends itself (not through our code), written as Supabase templates.
// Supabase only reads them from its dashboard, so after changing one here, copy it in:
//   Supabase → Authentication → Emails → Templates → "Confirm sign up" → Subject, and Body → Source
//   (the raw template is under "Supabase template source" on /admin/emails).
// {{ ... }} parts are Supabase template variables, filled in when the email is sent.
// Same look and voice as every other SaddleUp email: logo, Danielle's voice, her sign-off.
import { emailLogo, emailSignature } from '@/lib/welcome';

const p = (t: string, margin = '0 0 14px') => `<p style="font-size:15px;line-height:1.5;margin:${margin}">${t}</p>`;

/** Hidden preview line inboxes show after the subject. */
const preheader = (t: string) =>
  `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${t}</div>`;

/** Greets by first name when sign-up saved one (AuthPanels and the claim page do). */
const HI = '{{ with .Data.first_name }}Hi {{ . }},{{ else }}Hi there,{{ end }}';

/** "Confirm sign up": sent when someone creates an account with email and password. */
export const CONFIRM_SIGNUP = {
  subject: 'Confirm your email to finish joining SaddleUp',
  html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2b2118">
  ${preheader('One tap and your SaddleUp account is ready.')}
  ${emailLogo()}
  ${p(HI)}
  ${p('Thanks for signing up for SaddleUp. Tap the button below to confirm this is your email address, and your account is ready to go.')}
  <p style="margin:24px 0"><a href="{{ .ConfirmationURL }}" style="background:#2f4a3a;color:#fff;padding:12px 20px;border-radius:4px;text-decoration:none;font-weight:bold">Confirm my email</a></p>
  ${p('The link works once and expires in 1 hour. Open it on the same device you signed up on, so anything you started (like a saddle listing) is waiting for you. If it has expired, just sign up again with the same email and I’ll send a fresh one.')}
  ${p('<strong>Pro tip:</strong> once you’re in, save a search with your seat size and tree width. I’ll email you as soon as a saddle that fits is listed, so you don’t have to keep checking.')}
  ${p('Happy riding,', '0 0 16px')}
  ${emailSignature()}
  <p style="font-size:12px;color:#7a6a5a;margin:24px 0 0;line-height:1.5">If the button doesn’t work, paste this into your browser:<br><span style="word-break:break-all">{{ .ConfirmationURL }}</span></p>
  <p style="font-size:12px;color:#7a6a5a;margin:12px 0 0;line-height:1.5">You’re getting this because someone signed up for SaddleUp with {{ .Email }}. If that wasn’t you, just ignore this email. Nothing happens without that tap.</p>
</div>`
};

/** The template with sample values filled in, for /admin/emails. */
export function previewConfirmSignup() {
  const html = CONFIRM_SIGNUP.html
    .replace(/\{\{ with \.Data\.first_name \}\}Hi \{\{ \. \}\},\{\{ else \}\}Hi there,\{\{ end \}\}/g, 'Hi Jane,')
    .replace(/\{\{ \.ConfirmationURL \}\}/g, 'https://saddleup.me/auth/callback?code=…')
    .replace(/\{\{ \.Email \}\}/g, 'jane@example.com');
  const text = html
    .replace(/<div style="display:none[^>]*>.*?<\/div>/, '')
    .replace(/<br>/g, '\n')
    .replace(/<\/(p|div|tr)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/^[ \t]+/gm, '')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
  return { subject: CONFIRM_SIGNUP.subject, html, text };
}
