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
