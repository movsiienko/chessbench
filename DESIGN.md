---
name: ChessBench
description: A restrained benchmark console for evaluating model chess puzzle solving.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  chess-amber: "oklch(0.72 0.14 70)"
  chess-amber-soft: "oklch(0.94 0.05 80)"
  chess-amber-strong: "oklch(0.58 0.16 55)"
  board-light: "#efe6d2"
  board-dark: "#b58863"
typography:
  display:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0"
  headline:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "0"
  title:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "0"
  body:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "0"
  label:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.18em"
  mono:
    fontFamily: "Geist Mono, Geist Mono Fallback, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  full: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  page-x: "1rem"
  header-h: "3.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
    typography: "{typography.title}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
    typography: "{typography.title}"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "1rem"
  nav-line-trigger:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.sm}"
    padding: "0"
    height: "2.25rem"
    typography: "{typography.label}"
  status-line:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
    typography: "{typography.title}"
---

# Design System: ChessBench

## 1. Overview

**Creative North Star: "The Analysis Board"**

ChessBench is a product UI for focused benchmark work: a quiet analysis console where chess positions, model performance, and traces can sit together without decorative noise. The atmosphere is a daylight lab desk, with a board on one side, measurements on the other, and just enough amber to connect the interface back to chess material.

The system is restrained by default. It uses shadcn/ui primitives, Geist typography, thin borders, tonal surfaces, and compact controls. Brand expression comes from structure, chessboard texture, model SVG marks, and precise data alignment, not gradients, novelty chrome, or oversized marketing composition.

**Key Characteristics:**
- Dense but readable product surfaces, built for scanning across models, puzzles, and metrics.
- Neutral-first color with amber used only when chess context or leaderboard emphasis earns it.
- Flat surfaces with ring borders and tonal layering instead of heavy shadows.
- Standard controls, standard affordances, and exact data typography.
- Lichess-like board treatment: coordinates stay at the board edge, drawing and correction arrows stay on the board.

## 2. Colors

The palette is a neutral benchmark shell with one chess-material accent and provider colors used only for model identity.

### Primary

- **Ink Primary**: the main action and foreground anchor. Use for primary controls, active text, and strong icons.
- **Paper Foreground**: the high-contrast text color on dark surfaces. Use only where the surface is already dark enough to need it.

### Secondary

- **Chess Amber**: the only product accent. Use for chess-specific emphasis, selected theme marks, and current-leader panels. It should never flood the page.
- **Board Light** and **Board Dark**: reserved for the Chessground board. Do not reuse these as generic UI fills.

### Neutral

- **Analysis Background**: the page canvas. It should feel plain, not theatrical.
- **Card Surface**: the panel background for charts, tables, board containers, and model attempts.
- **Muted Surface**: the background for secondary controls, table affordances, chart legends, and inactive tab pills.
- **Divider Line**: the standard structural separator. Use it for cards, tables, grid stats, and chart boundaries.
- **Muted Text**: secondary copy, captions, metadata, and provider labels.

### Named Rules

**The One Accent Rule.** Amber is the only product accent. It appears on chess-specific emphasis and selected analytical moments, not as decoration.

**The Provider Color Rule.** Model colors and SVGL icons belong to model identity only. Never use OpenAI green, Gemini blue, Anthropic orange, Meta purple, or xAI black as page-level accents.

**The Board Boundary Rule.** Board colors stay inside chess surfaces. UI chrome remains neutral so the board remains legible.

## 3. Typography

**Display Font:** Geist, with system sans fallbacks  
**Body Font:** Geist, with system sans fallbacks  
**Label/Mono Font:** Geist Mono for data, FEN strings, timings, token counts, and compact technical labels

**Character:** The typography is utilitarian and measured. Headings are compact and direct; labels use uppercase tracking only for metadata; mono type is reserved for values that behave like data.

### Hierarchy

- **Display** (600, 3rem to 3.75rem, line-height 1): dashboard H1 only. Keep it short and analytical.
- **Headline** (500, 1.5rem to 2rem, line-height 1.25): major section headings and current leader titles.
- **Title** (500, 1rem, line-height 1.375): card titles, table labels, and model names.
- **Body** (400, 1rem, line-height 1.75): explanatory copy. Cap narrative text at roughly 65 to 75 characters.
- **Label** (600, 0.65rem to 0.75rem, uppercase, tracking 0.12em to 0.18em): metric labels, chart captions, and compact section annotations.
- **Mono** (400, 0.75rem to 0.875rem): FEN, UCI moves, thinking tokens, elapsed time, and numeric traces.

### Named Rules

**The Data Mono Rule.** Mono is for machine-readable values and time/token data only. Do not use mono to make generic UI labels feel technical.

**The No Hero Metrics Rule.** Large numbers can appear in stats, but never as the central decorative idea of the page.

## 4. Elevation

ChessBench is flat by default. Depth comes from tonal contrast, one-pixel rings, separators, and surface stacking. Shadows are reserved for transient overlays such as select popovers and tooltips.

### Shadow Vocabulary

- **Panel Ring** (`ring: 1px color-mix(in oklch, var(--foreground) 10%, transparent)`): card boundary and default surface definition.
- **Overlay Low** (`box-shadow: 0 4px 12px oklch(0 0 0 / 10%)`): menus, select popovers, and temporary floating UI only.
- **Focus Ring** (`ring: 3px var(--ring) / 50%`): keyboard focus and validation focus states.

### Named Rules

**The Flat Evidence Rule.** Permanent analytical surfaces are flat. If a component needs depth at rest, it probably needs a border, a divider, or better spacing instead.

## 5. Components

### Buttons

- **Shape:** gently curved product controls (8px to 10px radius). Icon-only buttons are square 32px controls.
- **Primary:** Ink Primary fill, Paper Foreground text, 32px height, compact horizontal padding.
- **Hover / Focus:** hover changes tone only; focus uses the shared 3px ring. Active state may translate by 1px for tactile feedback.
- **Secondary / Ghost / Destructive:** outline and ghost variants stay neutral. Destructive is a pale red tint with red text, never a full red block unless the action is irreversible.

### Chips

- **Style:** badges are compact 20px pills with 8px horizontal padding.
- **State:** selected filters and theme labels use borders, text weight, or amber underlines. Do not fill inactive chips with saturated color.
- **Provider labels:** provider names sit inline with model names in muted mono text. Do not indent provider text under empty icon space.

### Cards / Containers

- **Corner Style:** cards default to 10px to 14px corners, but the main problem board and attempts card use tighter 8px rounding when they need to align with dense data.
- **Background:** Card Surface with Panel Ring. Use Muted Surface only for footers, table hover states, and transcript backgrounds.
- **Shadow Strategy:** no shadow at rest.
- **Border:** one-pixel ring or border only. Colored side stripes are forbidden.
- **Internal Padding:** 16px for normal cards, 12px for small cards.

### Inputs / Fields

- **Style:** selects and sliders use shadcn/Base UI primitives with transparent or muted backgrounds, 8px radius, and one-pixel borders.
- **Focus:** shared ring treatment, never custom glow.
- **Error / Disabled:** destructive border and ring for invalid, opacity reduction for disabled.

### Navigation

- **Style:** top navigation is a line-style shadcn Tabs list after the ChessBench wordmark. Triggers are uppercase 12px labels with 0.12em tracking.
- **Active state:** line variant uses the bottom active indicator. Avoid pill backgrounds in the top nav unless the page shifts to a smaller embedded context.
- **Mobile treatment:** hide tab label text below small breakpoints and keep icons visible. The header remains 56px tall.

### Chess Board

The board uses Chessground, not a hand-rolled grid. Coordinates belong on board edges in lichess-like style. User drawings, last moves, and correction arrows are board overlays, not external callouts.

### Model Attempts

Rows use a four-column grid: correctness indicator, model/provider identity, played move, and timing/token metadata. Provider labels stay inline after the model name. Expanding a row reveals the transcript without adding bottom layout chrome outside the accordion.

### Charts and Tables

Charts are neutral and monochrome unless model identity requires provider colors. Tables use compact row heights, hover-muted backgrounds, and mono values for ranks, Elo, costs, percentages, and token counts.

## 6. Do's and Don'ts

### Do:

- **Do** use shadcn/ui primitives and Base UI behavior for controls.
- **Do** keep analytical surfaces neutral and let the board, model icons, and data carry meaning.
- **Do** align provider names inline with model names in model-attempt rows.
- **Do** reserve amber for chess-specific context and current-leader emphasis.
- **Do** use Geist Mono for FEN, UCI, token counts, elapsed time, and numeric traces.
- **Do** keep move feedback in a reserved status line so playing a move does not shift layout.
- **Do** show incorrect moves with board arrows when the correction is spatial.

### Don't:

- **Don't** use gradient text, glassmorphism, decorative blur, or generic AI dashboard chrome.
- **Don't** use colored side-stripe borders on cards, rows, callouts, or alerts.
- **Don't** put every section in a floating card. Use borders, bands, and grids when the content is structural.
- **Don't** number every board square. Coordinates belong on one side and one edge like lichess.
- **Don't** show raw move strings such as `b5c6` in user-facing feedback when readable move text or SAN is available.
- **Don't** let an accordion expansion or move result add a new element that changes the surrounding layout.
- **Don't** use provider colors outside provider identity marks, chart series, or model-specific labels.
