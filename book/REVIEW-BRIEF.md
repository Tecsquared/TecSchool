# `/book` — review brief

Handover for a second pass. Branch `claude/tecschool-placement-landing-yxfh1h`,
PR [#9](https://github.com/Tecsquared/TecSchool/pull/9). Read `CLAUDE.md` at the
repo root first — it carries the traps that cost the last session time.

## What the page is

A Thai-first, mobile-first landing page for Facebook ad traffic to a free
placement interview. **One job: get the four-field form submitted on the first
screen.** High-intent paid traffic, Thai parents on phones. It is
deliberately not a brochure — `/english/` is the brochure.

Files in scope: `book/index.html` (self-contained), plus one redirect line in
`vercel.json` and one regex branch in `assets/tec-track.js`.
`/`, `/english/` and `/wall-of-love/` are out of scope and must not change.

## The two things only a local machine can check

This page was built in a cloud container **with no H.264 decoder** — neither
Chromium nor the bundled ffmpeg can decode `assets/video/book-hero.mp4`. So
these were never verified, and they are the most valuable thing a local
reviewer can do:

1. **The crop.** The inline still shows a horizontal band of a 720x1280 clip
   at `object-position: 50% 28%`, chosen by reasoning, not by looking. Does it
   frame the students' faces, or cut heads / land on torsos? Extract frames
   and check. The fix is one line.
2. **A poster frame.** There is no `book-hero-poster.jpg`, so there is a beat
   of black before the first frame paints. Every other clip in
   `assets/video/` ships one. Extract a frame with a face visible, save as
   720x1280 JPEG ~50KB, add `poster="…"`, and switch the element to
   `preload="none"` — that also stops a 5.2MB fetch for everyone who never
   taps.

Also worth a real-device check: the sticky CTA lifts above the on-screen
keyboard using `visualViewport` and a `--kb` custom property. That was only
tested by faking a viewport resize. iOS Safari's fixed-element behaviour under
an open keyboard is the risk.

## Hard constraints — do not break these

- **Never invent** a statistic, student name, quote, testimonial or face. The
  only numbers allowed are **30** (minutes) and **90%** (EP), both already
  published on `/english/` and `/wall-of-love/`. Changing the 90% figure means
  changing it in five files — see `CLAUDE.md`.
- `assets/tec-track.js` acts on every page automatically. In particular it
  listens for `submit` in the **capture phase on `document`**, so validation
  must stay gated on the submit button's **click** — validating inside a
  `submit` handler is too late and inflates `enquiry_started` while beaconing
  half-empty enquiries to a Notion webhook. This was a real bug, already fixed.
- Do not introduce the id `open-callback` or any href containing
  `#callback-section` — the tracker counts those as `placement_interview_clicked`,
  which must never fire here.
- The class `form-thanks` is load-bearing; the tracker watches it to fire
  `enquiry_submitted` and the Meta Lead.
- Field names `Name` and `LINE or phone` must not change — the webhook reads
  them by name. `Student nickname` and `Student age` were added after Thai
  parent feedback. Neither may the form `action` or the hidden fields change.
- Thai-first. English is a small secondary sub-line only.

## Already verified — please don't re-derive

- The original two-field layout kept its CTA and consent copy above the fold at
  320x568, 360x780, 375x667, 390x844, 412x915 and 1280x900. The later student
  nickname/age row intentionally adds height; preserve the compact two-column
  row and sticky CTA when reviewing those viewports. No horizontal scroll was
  present at any size.
- `enquiry_started` fires exactly once, only on a valid submit; rejected
  attempts POST nothing and beacon nothing.
- `enquiry_submit` and `enquiry_submitted` both fire on success (deliberate —
  see `_DECISIONS.md` R2). `placement_interview_clicked` never fires.
- `Found via` reaches the POST; `Consent` is a hidden field recording the
  notice wording shown under the button.
- Submit failure shows an inline block with a tappable LINE link and keeps the
  typed values; a 12s `AbortController` covers a stalled request.
- Full-screen player: focus trapped, Escape closes, `src` released, scroll lock
  restored.
- No-JS: the form still POSTs natively and native `required` still guards
  (`novalidate` is set from script deliberately).
- `node scripts/verify-seo.mjs` passes.

## Where a second opinion would help most

1. **The crop and the poster** (above) — highest value.
2. **Vertical budget.** Six elements stack above the video. Does the hierarchy
   earn its space, or should the kicker move to sit against the clip it points
   at ("อยากให้ลูกพูดแบบนี้ได้ไหม?" — *like this* — currently ~140px above it)?
3. **The inline still's shape changes with viewport height** (2.2:1 at 360x780,
   1.4:1 at 412x915) because it is flex-sized. Below 660px tall it is replaced
   by a compact one-tap row. Is a fixed aspect ratio better than a fluid one?
4. **Thai copy and typography** — a native reader's eye on the wording, and on
   Noto Sans Thai line-height (Thai needs more than Latin; check for clipped
   ascenders).
5. **Visual/brand consistency against `assets/tec.css` and `/english/`** — this
   review never ran; the agent assigned to it died on a rate limit.
6. **Accessibility and performance** — likewise never ran. Contrast was
   spot-checked and three failures fixed, but no full axe pass was done.

## Running it

No build step. From the repo root:

```bash
python3 -m http.server 5173      # or: bunx serve -l 5173 .
# → http://localhost:5173/book/
node scripts/verify-seo.mjs      # the only test in the repo
```

Live preview of the branch is posted by the Vercel bot on PR #9.
Append `?posthog_internal=1` when testing to keep clicks out of the real
analytics; `?posthog_internal=0` clears it. Note the form posts to the **live**
FormSubmit endpoint — a test submission sends a real email.

## Open decisions for Damien, not for a reviewer

- Whether to add a stronger reassurance naming the interview day itself (e.g.
  "no course sold on the day"). Only he can make that promise.
- Whether the clip should autoplay muted. Burnt-in captions would support it
  and Facebook traffic expects it; the brief specified a play overlay.
- The Meta Pixel only loads after cookie consent, so Facebook undercounts
  conversions relative to PostHog. Known and accepted, not a bug.
