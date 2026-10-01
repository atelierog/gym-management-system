# Gym Manager V1 — Design System

Status: Phase 0.5C baseline

## 1. Purpose

This document is the visual source of truth for Gym Manager V1. It prevents screen-by-screen visual drift and avoids creating separate, unrelated mobile and desktop products.

The interface should feel like a premium, restrained SaaS product for gym operations: dark, clean, practical, high contrast, and fast to understand.

The design system defines reusable tokens and components. Individual screens may compose them differently, but should not invent a new visual language without an explicit product decision.

## 2. Design principles

1. Mobile-first: optimize the core experience for phone widths while remaining responsive on tablet and desktop.
2. One product, responsive layouts: mobile is not a separate design system.
3. Hierarchy over decoration: important actions and operational information receive the strongest visual emphasis.
4. Premium restraint: use glow, gradients, blur, and borders sparingly.
5. Accessibility: text and controls must remain readable and usable at all supported widths.
6. State clarity: loading, empty, error, success, disabled, and destructive states must be visually distinct.
7. Consistency: use tokens and shared components instead of page-specific magic numbers.

## 3. Brand direction

Primary visual direction:
- dark charcoal / near-black surfaces
- cool blue-gray secondary text
- restrained electric-blue accent
- light neutral primary action surface where appropriate
- subtle metallic/white highlights for Gym Manager branding
- cinematic imagery only where it improves the experience; never behind dense operational data unless readability is preserved

Avoid:
- excessive neon
- bright saturated backgrounds
- decorative gradients behind every component
- excessive glassmorphism
- inconsistent corner radii
- random shadows or glow effects

## 4. Color tokens

These are semantic tokens. Components should reference semantic names rather than hard-coding colors repeatedly.

```css
:root {
  --gm-bg: #05080d;
  --gm-bg-elevated: #0a1018;
  --gm-surface: #0d141d;
  --gm-surface-2: #111a25;
  --gm-surface-muted: #151f2b;

  --gm-text: #f5f7fa;
  --gm-text-secondary: #aab7c7;
  --gm-text-muted: #748397;
  --gm-text-inverse: #070a0e;

  --gm-border: rgba(150, 165, 185, 0.24);
  --gm-border-strong: rgba(170, 185, 205, 0.38);

  --gm-accent: #4f9cff;
  --gm-accent-strong: #2f83ee;
  --gm-accent-soft: rgba(79, 156, 255, 0.14);

  --gm-success: #35c98a;
  --gm-warning: #f2b84b;
  --gm-danger: #ef6b73;
  --gm-info: #62aafc;

  --gm-overlay: rgba(0, 0, 0, 0.64);
}
```

These values are starting tokens, not permission for individual pages to invent nearby variants.

## 5. Typography

Use a modern sans-serif system/UI font stack.

```css
--gm-font: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
```

Type scale:

| Token | Size | Weight | Use |
|---|---:|---:|---|
| display | 36–44px | 700–800 | major product/hero heading |
| h1 | 28–32px | 700–800 | page heading |
| h2 | 22–26px | 700 | section heading |
| h3 | 18–20px | 650–700 | card/subsection heading |
| body-lg | 16–18px | 400–500 | important supporting text |
| body | 14–16px | 400–500 | standard UI text |
| label | 14–16px | 600–700 | form labels |
| caption | 12–14px | 400–500 | metadata/help |

Line-height should normally be between 1.2 and 1.6 depending on the text role.

## 6. Spacing

Use a 4px base rhythm:

```text
4  8  12  16  20  24  28  32  40  48  56  64
```

Preferred page padding:
- mobile: 16–24px
- tablet: 24–32px
- desktop: 32–48px

Do not use arbitrary one-off spacing values unless a measured visual requirement justifies them.

## 7. Radius

```text
small controls: 10–12px
inputs/buttons: 14–18px
cards: 18–24px
large hero/auth surfaces: 24–32px
pill/status: 999px
```

Use the smallest radius that matches the component's hierarchy. Do not mix unrelated radii on one screen.

## 8. Borders and shadows

Borders are subtle and primarily establish hierarchy:

```css
border: 1px solid var(--gm-border);
```

Use the stronger border only for focused/important surfaces.

Shadows should communicate elevation rather than decoration. Default surfaces should use restrained dark shadows. Glow is reserved for brand/primary-focus moments.

## 9. Buttons

Button hierarchy:

### Primary

High-priority action such as Sign in, Register Member, Collect Payment.

- strong contrast
- 48–56px standard height
- 14–18px radius
- 600–700 weight
- clear hover/pressed/disabled states

### Secondary

Useful alternative action.

- dark/elevated surface
- visible border

### Ghost

Low-emphasis actions.

- transparent background
- text/icon emphasis

### Destructive

Delete/deactivate/correct actions.

- danger semantic color
- confirmation required where irreversible

Buttons must expose disabled and loading states without changing their dimensions.

## 10. Inputs

Default input target:
- 48–56px height for operational forms
- 58–70px only where the design intentionally needs a larger touch target, such as authentication
- 14–18px radius
- 16px text baseline
- visible focus ring
- leading icons only when they improve recognition

Never clip placeholder or entered text.

Password visibility must use a real button with an accessible label.

## 11. Cards

Standard card:

```text
background: var(--gm-surface)
border: 1px solid var(--gm-border)
radius: 20px
```

Glass treatment is reserved for authentication/marketing surfaces and selected overlays. Operational dashboards should generally use opaque or mostly opaque surfaces for readability and performance.

## 12. Tables and lists

Mobile-first rule:
- do not force wide desktop tables onto phones
- use stacked rows/cards or horizontal scrolling only when the data genuinely requires a table
- preserve primary information and actions
- never hide critical status or amount information solely to make a table fit

Desktop may use conventional tables where appropriate.

## 13. Status indicators

Use semantic colors consistently:

- success → green
- warning → amber
- danger → red/coral
- info → blue
- neutral → muted gray-blue

Status should not rely on color alone; include text/icon/context.

## 14. Icons

Use one consistent icon family throughout the application. Icons should be simple, geometric, and recognizable.

Default sizes:
- inline: 16–18px
- control: 18–22px
- prominent action: 22–24px

Interactive icons must be buttons with accessible labels, not decorative clickable SVGs.

## 15. Navigation

Navigation must be role-specific but use the same visual primitives.

Owner primary areas:
- Dashboard
- Members
- Trainers
- Memberships
- Payments / Dues
- Attendance
- Reports
- Settings

Trainer/member navigation should expose only their approved capabilities.

Mobile navigation should prioritize the most frequently used actions and place secondary navigation behind an accessible menu where necessary.

## 16. Authentication screen rules

The current approved Gym Manager login design is the visual baseline for authentication:

```text
Atelier OG branding
        ↓
Gym Manager branding
        ↓
Premium glass login surface
        ↓
Credentials
        ↓
Primary sign-in action
        ↓
Secure access / product footer
```

The login screen keeps its existing authentication behavior while sharing these system tokens.

Important: do not create a second authentication implementation just to achieve a visual change.

## 17. Responsive rules

Primary supported widths:

```text
360 × 800
375 × 812
390 × 844   ← primary mobile reference
393 × 873
412 × 915
430 × 932
tablet
desktop
```

Use CSS media queries and fluid layout primitives. Avoid fixed absolute positioning for page structure.

Minimum expectations:
- no horizontal scrolling
- no clipped text
- no overlapping controls
- touch targets remain usable
- cards respect viewport padding
- form controls remain readable

## 18. States

Every data-driven feature should account for:

```text
loading
empty
success
error
permission denied
network failure
validation failure
saving/submitting
```

Do not silently fail. Preserve the user's entered data when possible after recoverable errors.

## 19. Accessibility

Required baseline:
- keyboard/focus support on web/desktop
- visible focus state
- semantic buttons/links/inputs
- labels for form controls
- accessible names for icon-only controls
- sufficient contrast
- error messages associated with relevant fields
- no interaction dependent only on hover

## 20. Component rule

Before creating a new UI component, check whether an existing shared component can be reused.

If a new reusable pattern appears in two or more features, promote it into the shared component layer.

Do not duplicate visually identical buttons, inputs, cards, modals, or status badges with separate CSS.

## 21. Visual QA rule

A screen is not visually complete until it is checked at the target responsive widths and against the approved reference when one exists.

For reference-driven screens:
1. render
2. compare
3. correct spacing/proportions
4. check text clipping
5. check asset loading
6. check responsive behavior
7. verify functionality remains intact

## 22. Change-control rule

A visual change should affect only the intended component/screen unless the change is explicitly a design-system change.

Do not globally change a token to fix a page-specific mistake.

Do not introduce page-specific CSS that silently overrides the design system.

## 23. Definition of Done for UI

```text
[ ] Correct component and route
[ ] Uses design-system tokens
[ ] Mobile checked
[ ] Tablet checked where applicable
[ ] Desktop checked where applicable
[ ] Loading state
[ ] Empty state
[ ] Error state
[ ] Permission state
[ ] No clipping/overlap
[ ] No console errors
[ ] Existing functionality preserved
[ ] Backend integration verified where applicable
```

## 24. Implementation rule

This document defines the visual system, not a requirement to rewrite the application immediately.

During Phase 1, introduce shared tokens/components incrementally and migrate feature screens deliberately. Do not perform a giant UI rewrite that risks existing backend functionality.
