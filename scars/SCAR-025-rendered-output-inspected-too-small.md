# SCAR-025 — Rendered output is inspected too small to see its defects

**Area:** Verification
**Severity:** Low — every automated check and every step of the manual check passed; the user saw the defect at a glance at reading size

---

## What went wrong

A page background was drawn from four separately drawn gradient strips. Before
the handover the rendered page was looked at as a small image (437 px high),
and it looked right. At reading size the strips showed hard seams where they
overlapped: the strip drawn last covered the others. The programmatic checks
(colours present, gradients counted) could not see it either, because every
colour and every gradient was there.

In Obsidian2Typst: the "A5 MU Print" template (US-023, M13, 2026-10-22); fixed by
fading each strip to transparent.

## Root cause

Visual inspection was done at a size chosen for convenience, not at the size
the reader uses. Defects at joins (overlaps, edges, corners) are a few pixels
wide and vanish when the image is scaled down, and checks by program count
parts without looking at how they meet.

## Prevention

- A rendered result that is judged by looking at it is inspected at least at
  its printed or reading size (for a page: the whole page at full width, not
  a thumbnail).
- The joins of separately drawn parts — overlaps, edges, corners, the meeting
  of backgrounds and frames — are zoomed in on before the handover.
- When a visual defect is found, a check by program that tells the defect
  from the fix is added where one exists (here: the number of shading
  objects, opaque against blending strips).
- A layout drawn into a container whose width varies (a pane, a window, a
  column) is checked at several widths, from the widest it reaches down to
  the narrowest it is meant to work at, and its edges are compared by
  program (each part's outer edge against its frame's inner edge), not only
  judged by eye at the one width at hand: an overrun a fraction of a box
  wide looks like part of the frame line. The narrowest width at which the
  layout still holds is measured and stated. Example (2026-11-08,
  Obsidian2Typst US-035, #138): the on-screen statblock passed its manual
  check, looked at in one pane; a full row of tick boxes ended 0.7 em past
  the frame at every width (grid columns `1fr`, whose minimum is the
  content, plus margins between the groups of boxes). A browser harness
  measured the edges at page widths of 100 to 900 px: 11.4 px past the
  content edge before the fix; at the edge from 190 px up after it
  (`minmax(0, 1fr)` columns, gap columns instead of margins).
- Applies next to: backgrounds, frames and ornaments, cover pages, image
  crops, the preview's canvas, on-screen views drawn into panes of any
  width.
