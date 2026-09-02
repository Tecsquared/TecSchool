# TecSchool — Decisions Log

Permanent `R<n>` rulings and `F<n>` defects found upstream. Supersede a stale
ruling with `SUPERSEDED BY R<n>` rather than editing or deleting it — other
files cite these IDs. Convention:
`04-wiki/ai-system/decisions-log-convention.md`.

---

## R1 — Thai pricing ships via PR + preview, not a direct push to main

**Date:** 2026-08-26
**Scope:** `thai/index.html`, `llms.txt`, `llms-full.txt` — pricing section
rewrite, weekly rhythm change, week/level graphic. PR
[#7](https://github.com/Tecsquared/TecSchool/pull/7), branch `thai-pricing-v2`.

Damien asked for the change to go live. The `AI-OS.md` security review gate
returned **hold for verification**, so it ships as a pull request with a Vercel
preview instead of a direct push to `main` (which auto-deploys to production).

**Why:** published prices are a commercial commitment — a visitor can screenshot
฿39,900 and hold TEC to it, and the numbers propagate to caches, the Wayback
Machine and `llms.txt`, which AI assistants quote. What was verified is that the
page is *internally consistent* (arithmetic, no stale figures, renders at
320–629px, works with JavaScript disabled, JSON-LD parses). What was **not**
verified is that the figures are *commercially correct*; only Damien can confirm
that. AI checking its own output is not certification.

**Rollback condition:** if a published figure is wrong, revert the merge commit
and redeploy; then correct `llms.txt` and `llms-full.txt` in the same change,
since AI agents read those independently of the page.

---

## F1 — Local `main` was 14 commits behind origin; first commit was discarded

**Date:** 2026-08-26
**Found in:** the TecSchool working copy, not in shipped code.

The first commit of the pricing work was built on local `main` (166abe4), which
was 14 commits behind `origin/main` and had no commits of its own. Merging it
would have reverted six commits of live work on the Thai page — self-hosted
fonts, CSP/HSTS hardening, accessibility fixes, site-wide language tags, the
cookie control, and the SEO indexing fixes (288 lines of `thai/index.html`).

That commit was discarded. The work was re-applied on a branch cut from current
`origin/main` (684ec9f) and the upstream changes were confirmed intact.

**Standing implication:** fetch and check `git rev-list --left-right --count
main...origin/main` before branching in this repo. The local clone goes stale
between sessions because most merges happen through GitHub PRs.

---

## F2 — The page claimed 8 face-to-face hours a week; it is 6 + 2

**Date:** 2026-08-26
**Fixed in:** PR [#7](https://github.com/Tecsquared/TecSchool/pull/7).

The "8 hours a week: double the usual" card read *"You get 8 face-to-face
hours."* Once Tuesday became an online guided-learning session that was false:
the 8 weekly hours are **6 face-to-face (Wed–Fri, 10am–12pm) + 2 online
(Tue, flexibly scheduled)**. Damien caught this on review.

The corrected split is now stated on the card, in the graphic's sub-line, the
schedule note, the FAQ, both JSON-LD offers, `llms.txt` and `llms-full.txt`.

**Standing implication:** the hours breakdown lives in seven places on this
page. Changing the timetable means changing all seven — grep for
`face-to-face`, `hours a week` and `hours/week` across `thai/index.html`,
`llms.txt` and `llms-full.txt` before calling a schedule change done.

---

## R2 — `/book` ships `noindex`, fires two submit events, and never fires `placement_interview_clicked`

**Date:** 2026-08-31
**Scope:** new `book/index.html`; one redirect in `vercel.json`; one regex
branch in `assets/tec-track.js`. Branch
`claude/tecschool-placement-landing-yxfh1h`.

A slim Thai-first landing page for Facebook ad traffic to the free 30-minute
placement interview. High-intent paid traffic was landing on `/english/`,
where the callback form sits at section P11, far below a brochure. `/book` is
one screen: Klua's clip as the single proof moment, two fields, one CTA.

Three rulings, each of which will look like a bug to whoever reads the code
next:

**1. `noindex, follow`, and deliberately absent from `sitemap.xml`.** `/book`
and `/english/` target the same Thai queries. `/english/` is the page that
should rank (priority 1.0 in the sitemap); a two-field landing page competing
with it would split the signal and add a thin page to the site's quality
profile. Do not "fix" the missing sitemap entry.

**2. The page fires both `enquiry_submitted` and `enquiry_submit`.** This is
not a duplicate. `tec-track.js` fires `enquiry_submitted` automatically for
every page, via the `MutationObserver` on `.form-thanks`; the ad conversion
action is pointed at `enquiry_submit`, so the page captures that one itself.
Renaming the shared event would have silently broken every existing
`enquiry_submitted` dashboard for `/english`, `/thai`, `/chinese` and
`/courses`. Both fire; `enquiry_started` is unchanged.

**3. `placement_interview_clicked` must not fire here.** On `/book` the whole
page *is* the placement-interview CTA, so counting a click on it would inflate
the funnel against the other pages, where the event means "scrolled down and
chose to engage". `tec-track.js` fires it for any `href` containing
`#callback-section` and for `button#open-callback` — so `/book` uses neither
name, and its sticky CTA is a `<button form="book-form">` rather than an
anchor. Anyone adding a jump-link to this page must keep it off those two
identifiers.

**Standing implication (the F2 trap again):** the `90% / EP` claim is now
published in **five** places — `english/index.html` (the `og:description`),
`wall-of-love/index.html` (the `sticker` entry in the `WALL` array),
`book/index.html` (the `EP 90%` pill and the `.proof-line` beneath it),
`llms.txt` and `llms-full.txt`. Grep for `90%` and `EP` across all five before
calling a change to that figure done.

**Rollback condition:** `/book` is additive — deleting `book/` and reverting
the one-line `vercel.json` redirect removes it with no effect on any other
page. The `tec-track.js` change only adds a branch the existing pages cannot
match.

---

## F3 — Remote sessions cannot read the AI-OS notes, so conventions get re-derived every time

**Date:** 2026-08-31
**Found in:** the working environment, not in shipped code.

A session was told to fetch a video from "the AI inbox" and could not find it.
It searched Google Drive (no folder by that name and no video files at all),
Notion, and the Gmail labels, then had to ask. The cause was not a bad search.

Claude Code on the web clones this repo **fresh**, so every `.gitignore` entry
is absent from disk. `HANDOVER.md`, `_work/`, `mockups/` and `seo/` do not
exist there, and `.claude/` contains only `settings.local.json`. Meanwhile
`R1` above cites `AI-OS.md` and the header of this file cites
`04-wiki/ai-system/decisions-log-convention.md` — neither is in this
repository. Both are local-vault paths, unreadable from a remote session.

So every convention that lives only in the vault is invisible, and each new
session re-derives it from the code, slowly and sometimes wrongly.

**Fix applied:** added a committed `CLAUDE.md` at the repo root, which Claude
Code loads automatically in every session including fresh remote clones. It
records the deploy shape, the `tec-track.js` behaviours that silently act on
any new form or CTA, the brand tokens, the video-orientation check, the
sandbox's inability to decode H.264, and the five places the 90%/EP claim
appears.

**Resolved:** the "AI inbox" is
`C:\Users\User\Documents\AI-Second-Brain\00-AI-Inbox-App` — a folder on
Damien's own PC. It is reachable by an assistant running on that machine and
by nothing else. A web session has no mount from his filesystem (`/mnt/c`
does not exist; `/mnt/attach` is empty unless a file is attached to the
chat), so files dropped there never arrive. `CLAUDE.md` now records this
along with the three ways to actually get a file here, so no future session
repeats the hunt.

**Standing implication:** a convention that a session must follow belongs in
`CLAUDE.md` or `_DECISIONS.md`, both committed. Writing it only in the local
vault, or relying on a session to remember it, does not work — a fresh
container has neither the files nor the memory.
