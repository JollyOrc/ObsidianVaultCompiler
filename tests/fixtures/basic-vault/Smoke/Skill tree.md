# Skill tree

A skill tree in its own style: green brush outlines, checkboxes, a
watercolour core, and the directive that drops the plugin's black hex
outlines and white label glow (US-4.10).

```text-mapper
# vault-compiler: no-outlines no-glow
option global
<filter id="rough" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="wash" x="-40%" y="-40%" width="180%" height="180%"><feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="4" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="55" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="2.5"/></filter>
skill-moss attributes fill="none" stroke="#4f7d4a" stroke-width="7" stroke-linejoin="round" transform="scale(0.93)" filter="url(#rough)"
<g id="splash-moss"><g filter="url(#wash)" opacity="0.55"><path d="M -80,-50 L 75,-60 L 92,10 L 60,80 L -55,85 L -95,5 Z" fill="#8fb486"/></g><g fill="#4f7d4a" opacity="0.45"><circle cx="-88" cy="70" r="5"/><circle cx="96" cy="58" r="4"/><rect x="-22" y="80" width="3" height="40" rx="1.5"/><rect x="12" y="84" width="2.5" height="30" rx="1.2"/></g></g>
<g id="box"><polygon points="74,-70 64,-53 44,-53 34,-70 44,-87 64,-87" fill="white" stroke="#4f7d4a" stroke-width="3" filter="url(#rough)"/></g>
<g id="check"><path d="M 36,-80 L 50,-62 L 84,-106" fill="none" stroke="#1b1b1b" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></g>
<g id="dice"><text x="-28" y="66" font-size="15">Dice</text></g>
0302 skill-moss box "Thorn-weaving Hands"
0303 skill-moss box "Bark Skin"
0402 skill-moss box check "Root Grip"
0403 splash-moss skill-moss box check dice "Feats of Moss"
0502 skill-moss box "Seed Whisper"
0503 skill-moss box "Fog Lantern|Lantern Lore"
0602 skill-moss box "Bramble Stride"
0303-0403-0503 trail "Old Road"
```
