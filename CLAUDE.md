# CLAUDE.md — working notes for this repo

Read this before changing anything. Everything here was verified against the
code, not assumed. Add to it when you learn something that cost you time.

## Read this first: remote sessions start blind

Claude Code on the web clones this repo **fresh**. Anything in `.gitignore`
never arrives — `HANDOVER.md`, `_work/`, `mockups/`, `seo/` and the whole
`.claude/` directory are simply absent on disk. `_DECISIONS.md` cites
`04-wiki/ai-system/decisions-log-convention.md` and `AI-OS.md`; neither is in
this repo, so a remote session cannot read them.

**Consequence:** if a convention matters to the work, it has to be committed
here. Context that lives only in the local vault is invisible and will be
re-derived, badly, every session.

### The "AI inbox" is a local folder — a web session cannot read it

```
C:\Users\User\Documents\AI-Second-Brain\00-AI-Inbox-App
```

Damien drops files there for AI to pick up. That works for an assistant
running **on his PC**. It does not work here: a web session runs in an
isolated cloud container with nothing from his machine mounted — there is no
`/mnt/c`, and `/mnt/attach` is empty unless a file is attached to the chat.

So when he says "it's in the AI inbox", **do not go hunting**. One session
burned a dozen calls searching Google Drive, Notion and Gmail labels for a
folder that was never in any of them. Say plainly that the folder is on his
machine and ask for the file one of these ways:

1. **Upload to the branch on github.com** — Add file → Upload files, into
   `assets/video/` (or wherever it belongs), committed to the working branch.
   Best for binaries; no git knowledge needed.
2. **Drag it into the chat.**
3. **Google Drive**, if it is small — but note a multi-MB download returns
   base64 into the context window, so this is unsuitable for video.

Also check *whose* account a connector is on before concluding a file is
missing. The Gmail connector authenticates as Damien's **personal** account
(PARA labels, family, tax), while school mail goes to `tratenglish@gmail.com`
and `tratenglishmgt@gmail.com` — so a search for enquiry email finds nothing
there and that is not evidence of a problem. Google Drive is on
`tratenglish@gmail.com` and holds 27 videos, all class recordings and kids'
songs, newest January 2025; no marketing footage lives there.

And do not filter a Drive search by date on a first pass. A session searched
`mimeType contains 'video/' and modifiedTime > …`, got nothing, and reported
"no video files at all" — there were 27.

## Shape of the site

Plain HTML/CSS/JS, **no build step**. Each page is one self-contained file
with inline `<style>` and `<script>`. Deployed by Vercel from `main`; pushes
to `main` go straight to production.

```
/            index.html          language picker
/english/    english/index.html  the big brochure page
/thai/  /chinese/  /courses/  /wall-of-love/  /privacy/  /book/
/assets/     tec.css, tec-track.js, fonts/, video/, wall/
```

A new page is `<name>/index.html` **plus a redirect in `vercel.json`**:

```json
{ "source": "/book", "destination": "/book/", "permanent": true }
```

Without it the bare no-slash URL 404s. Easy to miss; nothing warns you.

Preview locally: `bunx serve -l 5173 .` (or `python3 -m http.server 5173`).
Run `node scripts/verify-seo.mjs` before pushing — it is the only test.

## `assets/tec-track.js` does more than you expect

It is loaded by every page and acts on the DOM automatically. Before writing
any form or CTA, know that it already:

| Behaviour | Trigger |
|---|---|
| Injects a `Found via` hidden input | every `<form>`, on `DOMContentLoaded` |
| Fires `enquiry_started` + POSTs a copy to the Notion webhook | **any** `submit` event, capture phase **on `document`** |
| Fires `enquiry_submitted` + Meta `Lead` | a `.form-thanks` element losing its `hidden` attribute |
| Fires `placement_interview_clicked` | any `href` containing `#callback-section`, or `button#open-callback` |
| Fires `testimonial_played` | `data-video` on a `<button>` (not on other elements) |
| Fires `line_click` / `phone_click` / `email_click` | `href` matching `line.me` / `tel:` / `mailto:` |
| Renders the cookie pill in Thai | path matching `/(english\|chinese\|courses\|wall-of-love\|book)/` |

Traps that have already caused bugs:

- **Validating inside a `submit` handler is too late.** The tracker listens in
  the capture phase on `document`, so it runs before any form-level listener.
  Every rejected attempt counts as `enquiry_started` *and* beacons a
  half-empty enquiry to Notion. Gate validation on the submit button's
  **click** instead — a prevented click never dispatches `submit`.
- **Don't reuse `#callback-section` or `#open-callback`** for a jump link or
  button unless you actually want `placement_interview_clicked` counted.
- **The `.form-thanks` class is load-bearing.** Drop it and you silently lose
  `enquiry_submitted` and the Meta `Lead`.
- **The Meta Pixel only loads after explicit cookie consent.** A visitor who
  ignores or declines the pill converts invisibly as far as Facebook is
  concerned. PostHog is unaffected — treat it as the true count.
- Test with `?posthog_internal=1` to keep your own clicks out of the numbers;
  `?posthog_internal=0` clears it.

Forms POST to `https://formsubmit.co/ajax/tratenglishmgt@gmail.com`, cc
`tratenglish@gmail.com`. Keep the field names `Name` and `LINE or phone` —
the Notion webhook reads them by name.

## Brand and fonts

`assets/tec.css` is the shared design system and holds the tokens:
`--tec-yellow #FED501`, `--tec-blue #1DB2FF`, `--tec-pink #FF208D`,
`--tec-bg #F4F2EC`, `--tec-ink #1A1A1A`. `body.page-english` sets
`--accent: var(--tec-yellow)` and `--accent-deep: #806200` — use the deep
variant for text, since the yellow is unreadable on white.

Fonts are self-hosted woff2 in `assets/fonts/`; `fonts.css` is the source of
truth and pages inline the `@font-face` blocks they need. Typekit
(`use.typekit.net/agc2tne.css`) supplies `chaloops` for display type, loaded
`media="print" onload="this.media='all'"` with a `<noscript>` fallback.

## Video assets — check orientation before designing around one

Every clip in `assets/video/` is **landscape** except `parent.mp4`
(720×1280). `klua.mp4` is 1280×720, 4:07 long, with the English section
starting at 3:27. Designing a portrait hero around a landscape source means
`object-fit: cover` throws most of the frame away — verify dimensions first:

```bash
python3 -c "
import struct,glob,os
for p in sorted(glob.glob('assets/video/*.mp4')):
    d=open(p,'rb').read(400000); i=d.find(b'avc1')
    w,h=struct.unpack('>HH', d[i+28:i+32])
    print(f'{os.path.basename(p):22} {w}x{h}')"
```

All files are faststart (`moov` before `mdat`), so seeking works over range
requests. Confirm with the same trick if you add one.

**The sandbox cannot decode H.264.** Neither the bundled Chromium nor
Playwright's ffmpeg build has the codec, so video playback, seeking and
poster extraction cannot be verified in a remote session. Say so plainly
rather than implying a clip was tested; ask for a device check.

## Shipping

`R1` in `_DECISIONS.md`: changes ship as a **PR with a Vercel preview**, never
a direct push to `main`. The preview URL is posted on the PR by the Vercel bot.

`F1`: the local clone goes stale between sessions because most merges happen
through GitHub. Check before branching:

```bash
git fetch origin main && git rev-list --left-right --count main...origin/main
```

## Published claims are commitments

Prices and statistics propagate to caches, the Wayback Machine, and
`llms.txt`/`llms-full.txt`, which AI assistants quote. Never invent a figure,
a student name, a quote, or a face.

The **90% / EP** claim currently appears in five places — `english/index.html`
(`og:description`), `wall-of-love/index.html` (the `sticker` entry in `WALL`),
`book/index.html` (the `EP 90%` pill and `.proof-line`), `llms.txt` and
`llms-full.txt`. Changing it means changing all five. `F2` records the same
trap for the weekly-hours figure, which lives in seven.

## Record what you learn

Permanent rulings go in `_DECISIONS.md` as `R<n>`, defects as `F<n>`.
Supersede a stale ruling rather than editing it — other files cite the IDs.
If a session cost you time re-deriving something, add it here too.
