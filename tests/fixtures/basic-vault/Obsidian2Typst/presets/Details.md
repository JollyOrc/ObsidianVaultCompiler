---
schemaVersion: 1
page:
  trimWidth: 148
  trimHeight: 210
  bleed: 3
headingRules:
  Lore: entries
entries:
  statblock:
    stats: [{key: pace, label: Pace}]
    boxes: vigour
details:
  items:
    - key: pace
      icons:
        slow: Details/icons/slow.svg
        brisk: Details/icons/brisk.svg
        swift: Details/icons/swift.svg
      labels: {slow: Slow, brisk: Brisk, swift: Swift}
    - key: kind
      icon: Details/icons/kind.svg
      labels: {craft: Craft}
    - key: needs
      icon: Details/icons/lock.svg
    - key: starter
      icon: Details/icons/sprout.svg
      label: Known from the start
---
Obsidian2Typst preset for manual check M22 of the Vault Compiler (#122): the
compiled `Details/Detail book.md` read with Obsidian2Typst 0.14.0. The icons
in `Details/icons/` are invented for the check. Synthetic.
