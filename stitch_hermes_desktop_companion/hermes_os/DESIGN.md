---
name: Hermes OS
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1b1b1d'
  surface-container: '#1f1f21'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e4e2e4'
  on-surface-variant: '#bac9cc'
  inverse-surface: '#e4e2e4'
  inverse-on-surface: '#303032'
  outline: '#849396'
  outline-variant: '#3b494c'
  surface-tint: '#00daf3'
  primary: '#c3f5ff'
  on-primary: '#00363d'
  primary-container: '#00e5ff'
  on-primary-container: '#00626e'
  inverse-primary: '#006875'
  secondary: '#c8c6c8'
  on-secondary: '#303032'
  secondary-container: '#474649'
  on-secondary-container: '#b7b4b7'
  tertiary: '#ececec'
  on-tertiary: '#2f3131'
  tertiary-container: '#d0d0d0'
  on-tertiary-container: '#575959'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9cf0ff'
  primary-fixed-dim: '#00daf3'
  on-primary-fixed: '#001f24'
  on-primary-fixed-variant: '#004f58'
  secondary-fixed: '#e5e1e4'
  secondary-fixed-dim: '#c8c6c8'
  on-secondary-fixed: '#1b1b1d'
  on-secondary-fixed-variant: '#474649'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#131315'
  on-background: '#e4e2e4'
  surface-variant: '#353437'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  label-caps:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.08em
  mono-status:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: '0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 1.5rem
  element-gap: 0.75rem
  panel-margin: 1rem
  max-width-chat: 320px
---

## Brand & Style

This design system is built for an ethereal, AI-driven companion experience. The brand personality is **precise, calm, and futuristic**, acting as a silent but intelligent layer over the user's existing workspace. 

The aesthetic is rooted in **Glassmorphism**, utilizing multi-layered translucency to ensure the application feels lightweight and integrated into the desktop environment rather than a heavy, intrusive window. The emotional response should be one of "digital serenity"—where high-tech utility meets a soft, approachable companion interface. Key visual drivers include:
- **Minimalism:** Stripping away unnecessary chrome to focus on the Live2D entity.
- **Atmospheric Depth:** Using background blurs and light-refracting borders to simulate physical glass.
- **Kinetic Energy:** Subtle glows and pulses that indicate the AI's "life" and listening states.

## Colors

The palette is optimized for a dark-mode desktop environment to minimize eye strain and maximize the "pop" of the Live2D model.

- **Primary (Electric Blue):** Used exclusively for interaction cues, voice activity pulses, and critical highlights. It represents the "energy" of the AI.
- **Secondary (Deep Charcoal):** The foundation of all surfaces. It is desaturated to prevent clashing with various desktop wallpapers.
- **Tertiary (Soft White):** Employed for high-readability text. It is slightly capped at 90% brightness to avoid "blooming" against dark glass backgrounds.
- **Translucency:** Surfaces utilize a 70% opacity charcoal with a high-saturation background blur (30px-40px) to maintain legibility over complex backgrounds.

## Typography

The system utilizes **Inter** for its neutral, highly legible characteristics, ensuring that AI-generated dialogue is easy to process at a glance. **Geist** is introduced for technical labels and status indicators to reinforce the "developer-tool" and "futuristic" precision of the pet's interface.

Typography should always be rendered with anti-aliasing optimized for dark backgrounds. Use `Soft White` for primary content and 60% opacity white for secondary metadata or descriptions.

## Layout & Spacing

As a desktop pet, the layout follows a **Floating Panel** model rather than a standard windowed grid. Elements are anchored to the Live2D character or docked to screen edges.

- **Dynamic Anchoring:** UI panels (chat bubbles, settings, status) float with a consistent `1rem` margin from the character's bounding box.
- **Tight Rhythm:** A 4px baseline grid ensures alignment. Use `element-gap` (12px) for spacing between related items like buttons in a row.
- **Chat Constraints:** To maintain the "pet" feel, chat bubbles have a maximum width to prevent the UI from spanning the entire screen, ensuring the character remains the focal point.

## Elevation & Depth

Depth is conveyed through **Backdrop Blur** and **Inner Glows** rather than traditional drop shadows, which can look muddy on dark desktop wallpapers.

- **Level 1 (Base):** The main character overlay (no background).
- **Level 2 (Floating Panels):** 70% Charcoal tint, 32px backdrop blur, and a 1px solid `glass_border`.
- **Level 3 (Popovers/Tooltips):** 85% Charcoal tint, 40px blur, and a subtle `Electric Blue` outer glow (5px blur, 10% opacity) to indicate active focus.
- **Visual Connection:** Use thin, 1px lines (20% white) to "tether" floating panels to the character when active.

## Shapes

The design system uses **Rounded (Level 2)** shapes to balance the "tech" aesthetic with "friendliness." 

- **Panels:** Use `rounded-xl` (1.5rem) to create a soft, bubble-like container for chat and settings.
- **Interactive Elements:** Buttons and input fields use `rounded-lg` (1rem) for a distinct, tactile feel.
- **Status Indicators:** Small circular pips for connectivity and activity states.

## Components

### Buttons & Interaction
- **Ghost Buttons:** Transparent background with a 1px white border (15% opacity). On hover, the border becomes `Electric Blue` with a subtle 2px outer glow.
- **Action Chips:** Small, pill-shaped buttons for quick responses, using a 20% `Electric Blue` fill to indicate they are secondary to the main AI interaction.

### Voice Activity Ring
- A circular, high-precision stroke surrounding the character's base or the "listen" button. When audio is detected, it uses a **Gaussian blur pulse** in `Electric Blue` that reacts to frequency input.

### Chat Bubbles
- Semi-transparent glass containers. User text is aligned right with a subtle grey tint; Hermes' text is aligned left with a faint `Electric Blue` vertical accent line on the leading edge.

### Settings Panels
- Uses a vertical list format with **Lucide-style iconography** (thin strokes). Each list item has a subtle hover state that increases the background opacity from 70% to 80%.

### Input Fields
- Minimalist bottom-aligned stroke that expands into a full glass container when focused. The caret should be `Electric Blue`.