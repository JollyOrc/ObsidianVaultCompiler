# SCAR-048 — A printed form is drawn over the places where its user writes

**Area:** Requirements / Design
**Severity:** Medium — the form looked right on screen and failed on paper, in the hand of its user

---

## What went wrong

A generated character sheet was compared with its reference and judged good: fonts, colours, positions matched. On paper its user could not use it as a form. Labels and brush brackets sat in the space above the writing lines; the notes for three values sat where the values are written; and a crescent drawn for the dice count held the word "Dice", so the one place meant for a number was full. Root hexes and inventory lines lacked the line and the numbers a player fills in. Example (2026-11-23, roa-character-sheets US-003: writing-space nudges in spike S3, remarks 4, 8, 9 of the home-print check M03).

## Root cause

The story described how the form looks, not how it is used. "Where does the user write, and how much room does that take?" was never a requirement, so no test could fail on it; a mark meant to be written in (a circle, a crescent, a box) was treated as decoration and given a label.

## Prevention

- A story for a printed form lists every place its user writes — lines, boxes, circles, crescents, table cells — with the room each needs (example: 8 mm of clear height above a writing line; room for "3d6" inside a dice mark).
- That room is a measurable clear zone, checked by program on the drawing and on every shipped form (SCAR-046): no text frame and no drawn mark inside it.
- A mark meant to be filled in is writing space itself: its label stands beside it, never inside.
- The manual check writes on the printed form with a pen, at the sizes the user will.
