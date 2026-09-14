# Attio style reference (from Refero)

Used as the styling reference for VOUCH's UI from 2026-09-13, combined with Linear for the
system (sidebar, density, grouped lists). Condensed to what the app uses.

## Colours
- Canvas #ffffff · Paper #f4f5f6 · Haze #eeeff1 (bands, hover) · Mist 50 #e4e7ec (primary border)
- Ink #1c1d1f (text) · Graphite #232529 (primary filled button) · Carbon #2e3238 · Slate 600 #6f7988 (muted) · Slate 700 #8f99a8 (captions) · Fog 400 #9fa1a7 (placeholder)
- Cobalt #266df0 (links, focus rings, active states; the one accent) · Cobalt bright #407ff2 (hover) · Ice wash #e4edff · Periwinkle #bad0fa

## Type
- Inter only, weight 500 as the default UI voice; 600 for titles; `font-feature-settings: "ss03", "cv11"`.
- Sizes: 11, 12, 13, 14, 15, 16, 20. Tight tracking: -0.02em at 14px, -0.01em at 16px, 0 at 12px.

## Shape
- Radius: buttons/inputs/tabs 10px, badges/tags 7px, cards 12px.
- Borders: 1px Mist 50. Shadows blue-tinted only: `rgba(28,40,64,.1) 0 2px 3px -2px, rgba(28,40,64,.04) 0 4px 6px -2px`.
- Buttons: primary = Graphite fill, white text; secondary = white, 1px Mist 50; ghost = text only. Height 32px in tables, 36px default.
- Tab bar: text 14px/500, inactive Slate 600, active Ink with 2px bottom border.
- Sidebar: Paper background, no border, items 14px/500, 16px 1.5px-stroke monochrome icons.

## Semantic colours (VOUCH addition, Attio-app style soft tags)
| State | Background | Text | Dot |
|---|---|---|---|
| Waiting on employee | #FFF4D6 | #8A5A00 | #E0A100 |
| Employee reached out | #E4EDFF | #1D4ED8 | #266DF0 |
| Candidate interested | #E3F6EA | #14683D | #22A06B |
| Employee / candidate passed | #FCE8E8 | #A32D2D | #D64545 |
| Closed | #EEEFF1 | #505967 | #8F99A8 |
| Needs you (band) | #FFF1D6 | #7A4B00 | — |
