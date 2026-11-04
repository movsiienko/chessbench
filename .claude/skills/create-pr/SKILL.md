---
name: create-pr
description: Use before opening any PR: run reviews, browser-test the preview, post a short PR with before/after screenshots.
---
# Create a PR

Run this every time before opening a PR.

## 1. Check the work (silently)
1. Typecheck, lint, test and build. Fix anything that fails.
2. Run the three reviews in this order, and fix what's worth fixing:
   1. The code-review skill on the diff.
   2. `/impeccable critique` and `/impeccable audit`, if the change touches UI.
   3. `/ponytail-review`.
3. Push, open the PR, and wait for the preview deployment to be READY.
4. In a real browser, test the change on the preview URL at desktop (1280px) and mobile (390px) widths. Fix what you find and push again.

None of this goes in the PR. Don't post review results, a findings list, a log of the process or test transcripts.

## 2. Screenshots: before and after, side by side
- Take **before** from production (or the base branch's deployment) and **after** from the PR preview. Use the same URL, viewport, state and crop.
- Join each pair into one image with a label on each half, e.g.
  `magick before.png after.png +append pair.png`, after adding "Before" and "After" captions.
- Use 1 to 3 pairs that show the change itself. Crop to the area that changed, not the whole page. Add a mobile pair only if mobile looks different.
- If the change has no visible UI, add no screenshots.
- Host the images outside the code diff (e.g. an orphan `pr-screenshots` branch under `pr-<n>/`). Embed them with raw URLs, then check they load.

## 3. PR description: short, final results only
```
<one sentence: what problem this fixes>

## Changes
- <user-visible result, 1-4 bullets>

## Before / After
![<what it shows>](<pair image url>)

## Not addressed
- [ ] <only real remaining gaps; omit section if none>

Closes #<issue>
```
- No "Reviews", "Verification" or "How I tested" sections. Don't narrate what the agent did.
- Keep the whole description to about 15 lines plus images.
- Don't post extra PR comments. Update the description instead.

## 4. Before you hand off
- The screenshots load, CI is green, the PR has no conflicts with the base branch, and nobody has merged it.
- Report the PR URL and preview URL in one or two lines.
