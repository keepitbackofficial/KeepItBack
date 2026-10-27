---
name: Warm Editorial Archive
colors:
  surface: '#fff8f8'
  surface-dim: '#e2d7d8'
  surface-bright: '#fff8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fcf1f2'
  surface-container: '#f6ebec'
  surface-container-high: '#f1e6e7'
  surface-container-highest: '#ebe0e1'
  on-surface: '#1f1a1b'
  on-surface-variant: '#534340'
  inverse-surface: '#352f30'
  inverse-on-surface: '#f9eeef'
  outline: '#86736f'
  outline-variant: '#d8c2bd'
  surface-tint: '#8c4d41'
  primary: '#8a4a3f'
  on-primary: '#ffffff'
  primary-container: '#a76255'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb4a6'
  secondary: '#7e544c'
  on-secondary: '#ffffff'
  secondary-container: '#ffc8bd'
  on-secondary-container: '#7a5149'
  tertiary: '#8b493d'
  on-tertiary: '#ffffff'
  tertiary-container: '#a96154'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad4'
  primary-fixed-dim: '#ffb4a6'
  on-primary-fixed: '#390c05'
  on-primary-fixed-variant: '#70362b'
  secondary-fixed: '#ffdad3'
  secondary-fixed-dim: '#f0baaf'
  on-secondary-fixed: '#30130d'
  on-secondary-fixed-variant: '#633d35'
  tertiary-fixed: '#ffdad4'
  tertiary-fixed-dim: '#ffb4a6'
  on-tertiary-fixed: '#390b05'
  on-tertiary-fixed-variant: '#71352a'
  background: '#fff8f8'
  on-background: '#1f1a1b'
  surface-variant: '#ebe0e1'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 3.5rem
    fontWeight: '600'
    lineHeight: 4rem
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.75rem
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 2.5rem
    fontWeight: '500'
    lineHeight: 3rem
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 1.75rem
    fontWeight: '500'
    lineHeight: 2.25rem
    letterSpacing: 0em
  headline-md:
    fontFamily: Playfair Display
    fontSize: 1.75rem
    fontWeight: '500'
    lineHeight: 2.25rem
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: 1.75rem
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-desktop: 2rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies an editorial curation aesthetic rooted in literary luxury, thoughtful preservation, and tactile warmth. Tailored for sophisticated archival tools, digital scrapbooks, and reading repositories, it replaces cold, utilitarian interfaces with the warmth of aged archival paper, fine bookbinding, and pressed terracotta pigments. 

The aesthetic marries classical editorial sensibilities with contemporary digital utility. It evokes feelings of permanence, calm discernment, and deliberate curation. The interface recedes to let collected thoughts, links, and imagery breathe, while typographic high-contrast moments instill an authoritative, museum-grade dignity.

## Colors

The palette balances warm earthen ceramics against deep typographic ink:

- **Canvas Background (`#f3e4e0`)**: A warm, blush-tinted alabaster that evokes fine, heavyweight uncoated paper stock.
- **Ink & Typography (`#1c1718`)**: Deep espresso ink providing high legibility without the sterile severity of pure black.
- **Primary Accent (`#b46d60`)**: Weathered terracotta used for primary actions, active indicators, and high-priority interactive highlights.
- **Secondary Tint (`#d9a59b`)**: Soft clay blush used for container fills, subtle hover states, and delicate badges.
- **Tertiary Accent (`#8c4a3e`)**: Roasted sienna utilized for focused interaction states, bold subheadings, and contextual metadata.
- **Borders & Rules (`rgba(28, 23, 24, 0.08)`)**: Hairline ink strokes providing structural separation without visual friction.

## Typography

The pairing blends the literary authority of Playfair Display with the functional, legible warmth of Plus Jakarta Sans. 

Editorial headlines rely on Playfair Display’s high stroke contrast and sculptural serifs to anchor page layouts and evoke literary journalism. Body copy and operational controls utilize Plus Jakarta Sans to maintain swift scanning, accessible metadata hierarchies, and comfortable sustained reading across varying screen resolutions.

## Layout & Spacing

Layouts follow a structured fluid grid inspired by broadsheet editorial design. On desktop screens, content conforms to a flexible 12-column grid anchored by generous outer margins (`margin-desktop`), giving content breathing room reminiscent of margins in high-end art books. Tablet displays compress down to an 8-column layout, while mobile viewports utilize a 4-column flow with dense vertical rhythm.

Vertical cadence relies on consistent multi-tiered spacing tokens. Elements within a component use compact gaps (`space-xs` to `space-sm`), while sections and archival groupings breathe through expanded negative space (`space-lg` to `space-xl`).

## Elevation & Depth

Visual hierarchy is maintained primarily through tonal layering and low-contrast outlines rather than synthetic drop shadows. Elevated surfaces mimic physical paper resting on archival cardboard:

- **Level 0 (Base Canvas)**: `#f3e4e0`.
- **Level 1 (Surface Containers & Cards)**: A warmer, lighter tint (`#faf3f1`) or soft blush tint (`rgba(217, 165, 155, 0.2)`), framed by a delicate 1px boundary (`rgba(28, 23, 24, 0.08)`).
- **Level 2 (Popovers, Modals & Floating Menus)**: `#ffffff` layered over base surfaces, supported by a warm, ambient tint shadow: `0 12px 32px -4px rgba(28, 23, 24, 0.06), 0 4px 12px -2px rgba(180, 109, 96, 0.04)`.

## Shapes

The shape system adopts a balanced roundedness of level 2 (0.5rem base radius). This subtle curvature softens functional controls while maintaining clean, crisp silhouettes suitable for an editorial grid. 

- **Interactive Elements (Buttons, Inputs, Badges)**: Feature a base radius of `0.5rem` (8px).
- **Surface Panels & Content Cards**: Utilize `rounded-lg` (`1rem` / 16px) to frame multi-element collections.
- **Modals & Media Viewers**: Utilize `rounded-xl` (`1.5rem` / 24px) for expansive framing.

## Components

### Buttons
- **Primary**: Solid terracotta background (`#b46d60`) with crisp off-white text (`#faf3f1`), `0.5rem` corner radius, and subtle hover deepening to `#8c4a3e`.
- **Secondary / Ghost**: Transparent fill with a hairline stroke (`rgba(28, 23, 24, 0.15)`), text in espresso ink (`#1c1718`), shifting to a soft clay background tint (`rgba(217, 165, 155, 0.15)`) on hover.

### Chips & Tags
Compact informational markers with `0.5rem` rounding, styled with a soft clay tint (`rgba(217, 165, 155, 0.25)`), deep espresso text (`#1c1718`), and uppercase `label-sm` typography to evoke catalog library tabs.

### Cards & Curated Snippets
Enclosed within `rounded-lg` containers using light tinted surfaces (`#faf3f1`), 1px borders (`rgba(28, 23, 24, 0.06)`), and inner padding scaled to `space-lg`. Media displays within cards preserve clean proportioning with matching inner radii.

### Input Fields
Soft blush-toned input fields (`rgba(255, 255, 255, 0.6)`) featuring a delicate border (`rgba(28, 23, 24, 0.12)`), transitioning to a terracotta focus ring (`#b46d60`) with `0 0 0 1px #b46d60`. Placeholder copy uses subdued espresso tones (`rgba(28, 23, 24, 0.4)`).

### Checkboxes & Radio Controls
Custom controls styled in espresso ink borders with terracotta check states (`#b46d60`), reinforcing visual warmth during list organization and bulk collection actions.

### Archival Specific Components
- **Collection Dividers**: Thin hairline borders accompanied by roman-numeral or editorial category markers set in italicized `Playfair Display`.
- **Bookmark & Metadata Pills**: Clean timestamp and source URL chips using `label-sm` with subtle tinted backgrounds to maintain effortless scanning.