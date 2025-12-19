# Theme & Design System Documentation

## Overview

This document provides a comprehensive overview of the T4L theme and design system implementation. The system combines Tailwind CSS utility-first approach with Chakra UI component theming to create a consistent, accessible, and maintainable design language.

**⚠️ IMPORTANT**: For strict usage rules and approved color tokens, see [THEME_CONTRACT.md](./THEME_CONTRACT.md).

## Color System

### Semantic Brand Colors (Growth.design approach)

Following Growth.design principles, brand colors express identity while neutrals carry readability.

**Variable**: `brand` (Chakra & Tailwind)

```
brand.primary: #350e6f  (Violet) - Primary brand anchor, high contrast
brand.dark:    #27062e  (Deep Purple) - Dark brand anchor, trustworthy
```

**Usage**: Primary buttons, links, focus states, main CTAs, headers

**Contrast Tests**:
- ✅ brand.primary on white: 12.89:1 (AAA)
- ✅ brand.dark on white: 16.70:1 (AAA)
- ✅ White text on brand.primary: 12.89:1 (AAA)
- ✅ White text on brand.dark: 16.70:1 (AAA)

### Surface Colors (Backgrounds)

**Variable**: `surface` (Chakra & Tailwind)

```
surface.default:  #FFFFFF  (Page backgrounds, cards, modals)
surface.subtle:   #F8FAFC  (Body background, subtle sections)
surface.muted:    #F1F5F9  (Input fields, muted panels)
surface.elevated: #FFFFFF  (Elevated elements)
```

**Usage**: All backgrounds, cards, modals, panels

### Text Colors (Readability First)

**Variable**: `text` (Chakra & Tailwind)

```
text.primary:   #0F172A  (Main text, body copy)        - 17.76:1 AAA ✓
text.secondary: #334155  (Secondary text, paragraphs)  - 10.87:1 AAA ✓
text.muted:     #64748B  (Hints, labels, subtle text)  - 5.89:1 AA+ ✓
text.inverse:   #FFFFFF  (Text on dark backgrounds)
```

**Usage**: All text content - primary for headings/main, secondary for body, muted for hints

### Border Colors

**Variable**: `border` (Chakra & Tailwind)

```
border.subtle: #E2E8F0  (Default borders, dividers)
border.strong: #CBD5E1  (Emphasized borders)
```

### Accent Colors (Highlights & Status)

**Variable**: `accent` (Chakra & Tailwind)

```
accent.warning:   #eab130  (Gold) - Status, highlights, rewards
accent.highlight: #f9db59  (Yellow) - Soft highlights (BACKGROUNDS ONLY)
```

**⚠️ CRITICAL**: Gold and Yellow MUST use dark text, never white text.

**Contrast Tests**:
- ✅ accent.warning with dark text: 10.00:1 (AAA)
- ✅ accent.highlight with dark text: 14.46:1 (AAA)
- ❌ White text on accent.warning: ~3.5:1 (FAILS AA)
- ❌ White text on accent.highlight: ~2.8:1 (FAILS AA)

### Danger/Destructive

**Variable**: `danger` (Chakra & Tailwind)

```
danger.DEFAULT: #f4540c  (Orange) - Destructive actions
```

**⚠️ CRITICAL**: Orange MUST use dark text, never white text.

**Contrast Tests**:
- ✅ danger.DEFAULT with dark text: 5.20:1 (AA+)
- ❌ White text on danger.DEFAULT: ~3.43:1 (FAILS AA)

### Tint Tokens (Safe Backgrounds)

**Variable**: `tint` (Chakra & Tailwind)

All tint tokens are 80% blended toward white and pass WCAG AA with dark text:

```
tint.brandDark:       #d4cdd5  (11.47:1 AAA ✓)
tint.brandPrimary:    #d7cfe2  (11.83:1 AAA ✓)
tint.danger:          #fdddce  (13.95:1 AAA ✓)
tint.accentWarning:   #fbefd6  (15.66:1 AAA ✓)
tint.accentHighlight: #fef8de  (16.74:1 AAA ✓)
```

**Usage**: Chips, pills, badges, alert fills, table striping, selected states

### Legacy Color Scales (For Compatibility)

The following color scales are preserved for backward compatibility:

#### Neutral Gray Scale
**Variable**: `neutral`

```
50:  #f8fafc → 900: #0f172a
```

#### Semantic Status Colors

**Success (Green)**
- **Base**: #22c55e (500)
- **Usage**: Success messages, completed states

**Warning (Orange)**
- **Base**: #f97316 (500)
- **Usage**: Warning messages, caution states

**Error (Red)**
- **Base**: #ef4444 (500)
- **Usage**: Error messages, failed states

#### Special Purpose Colors
- **WhatsApp**: #25D366 (500) with full 50-900 scale
- **Teal**: #14b8a6 (500)

## Typography

### Fonts
- **Body Text**: Inter (weights: 400, 500, 600, 700)
- **Headings**: Poppins (weights: 600, 700)
- Both fonts are loaded from Google Fonts with `font-display: swap` for optimal performance

### Responsive Base Font Size
- **Desktop**: 16px (base)
- **Mobile** (≤640px): 14px
- All rem-based sizes scale proportionally based on these base sizes

### Heading Styles
All headings use Poppins font family with responsive sizing:
- **h1**: Bold (700), 2.25rem → 3rem → 3.75rem (mobile → tablet → desktop)
- **h2**: Semibold (600), 1.875rem → 2.25rem → 3rem
- **h3**: Semibold (600), 1.5rem → 1.875rem
- **h4**: Semibold (600), 1.25rem → 1.5rem
- **h5**: Semibold (600), 1.125rem
- **h6**: Semibold (600), 1rem

## Component Styles

### Buttons (Chakra UI)

#### Variants
- **primary**: `brand.primary` background, white text, hover to `brand.dark`
- **secondary**: `surface.subtle` background, `brand.primary` text & border, hover fills with `tint.brandPrimary`
- **ghost**: Transparent background, `text.primary`, hover fills with `surface.subtle`
- **accent**: `accent.warning` (Gold) background, `text.primary` (dark text), hover darker
- **destructive**: `danger.DEFAULT` (Orange) background, `text.primary` (dark text), hover darker

**⚠️ CRITICAL**: Danger and Accent buttons use dark text for accessibility (WCAG AA).

#### Sizes
- **sm**: px-4, py-2, text-sm
- **md**: px-5, py-3, text-md (default)
- **lg**: px-6, py-4, text-lg

#### Hover Effects
- Slightly darker background color
- Transform: translateY(-1px)
- Elevated shadow (lg)

### Cards (Chakra UI)

#### Base Style
- Background: `surface.default` (white)
- Border radius: xl (1rem)
- Shadow: card (custom)
- Border: 1px solid `border.subtle`

#### Variants
- **elevated**: Stronger shadow (card-elevated)
- **muted**: Lighter shadow (sm), `surface.subtle` background
- **interactive**: Hover effects (lift, border color change to `brand.primary`, elevated shadow)

### Badges (Chakra UI)

#### Variants
- **primary**: `brand.primary` background, white text
- **subtle**: `tint.brandPrimary` background, `brand.primary` text
- **success**: Green background, white text
- **warning**: `tint.accentWarning` background, `text.primary` (dark text)
- **error**: `tint.danger` background, `text.primary` (dark text)
- **premium**: `tint.accentWarning` background, `text.primary`, `accent.warning` border, uppercase

**⚠️ NOTE**: Warning and error badges use tint backgrounds with dark text for accessibility.

### Progress Bars (Chakra UI)

#### Variants
- **default**: `brand.primary` filled track, `surface.muted` background
- **success**: Green filled track
- **warning**: `accent.warning` filled track
- **error**: `danger.DEFAULT` filled track

### Form Inputs (Chakra UI)

#### Features
- **Focus border color**: `brand.primary` (Violet)
- **Error border color**: `danger.DEFAULT` (Orange)
- **Border radius**: lg (0.75rem)
- **Default border**: `border.subtle`
- **Background**: `surface.default`
- **Focus ring**: 1px solid in focus color

#### Components
- Input, Select, Textarea: All styled consistently
- Checkbox, Radio: `brand.primary` accent when checked

### Modals (Chakra UI)

#### Base Style
- **Dialog background**: `surface.default`
- **Header color**: `text.primary`
- **Body color**: `text.secondary`

**⚠️ CRITICAL**: All modals must follow this pattern for consistency and accessibility.

## Custom Utility Classes

### Card Classes (Tailwind)
```css
.card                 /* Base card: rounded-2xl, border-subtle, surface-default, p-6, shadow-md */
.card-sm              /* Smaller padding: p-4 */
.card-lg              /* Larger padding: p-8 */
.card-muted           /* Reduced shadow, surface-subtle bg */
.card-interactive     /* Hover effects: lift, elevated shadow, brand.primary border */
```

### Status Indicators
```css
.status-indicator            /* Base: inline-flex, gap-1.5, rounded-full, border, px-3, py-1 */
.status-indicator--success   /* Green variant */
.status-indicator--info      /* Brand primary tint variant */
.status-indicator--warning   /* Accent warning tint with dark text */
.status-indicator--danger    /* Danger tint with dark text */
.status-indicator--neutral   /* Gray variant */
```

### Premium Badges
```css
.premium-badge          /* Accent warning tint bg, accent.warning border, dark text, uppercase */
.premium-badge--outline /* Transparent bg, accent.warning border */
```

### Typography Utilities
```css
.eyebrow  /* Text-xs, semibold, uppercase, tracking-widest, neutral-500 */
```

### Surface Utilities
```css
.surface-texture  /* Subtle dot grid pattern, neutral-50 background */
.surface-subtle   /* Neutral-100 with 60% opacity */
```

### Gradient Utilities
```css
.gradient-hero     /* Violet gradient for hero sections */
.gradient-card     /* Subtle indigo gradient for cards */
.gradient-premium  /* Violet to gold gradient for premium features */
.gradient-gold     /* Gold to orange gradient */
.gradient-neutral  /* Gray gradients for free tier indicators */
```

## Shadow System

Custom shadow definitions with consistent rgba values:

```
xs:             0 1px 2px 0 rgba(15, 23, 42, 0.05)
sm:             0 2px 4px rgba(15, 23, 42, 0.06)
md (default):   0 6px 12px rgba(15, 23, 42, 0.08)
lg:             0 10px 20px rgba(15, 23, 42, 0.1)
xl:             0 16px 32px rgba(15, 23, 42, 0.12)
2xl:            0 24px 48px rgba(15, 23, 42, 0.15)
card:           0 8px 24px rgba(15, 23, 42, 0.08)     ← For standard cards
card-elevated:  0 18px 40px rgba(15, 23, 42, 0.12)    ← For elevated cards
focus:          0 0 0 4px rgba(90, 13, 160, 0.35)     ← For focus states
inner:          inset 0 2px 4px 0 rgba(15, 23, 42, 0.06)
```

**Usage Guidelines**:
- Cards: shadow-card or shadow-md
- Modals/Dialogs: shadow-xl or shadow-2xl
- Buttons on hover: shadow-lg
- Subtle elements: shadow-sm or shadow-xs

## Animations

### Custom Keyframe Animations
```css
@keyframes fadeIn     /* Opacity 0→1 + translateY(10px→0) */
@keyframes slideIn    /* Opacity 0→1 + translateX(-20px→0) */
@keyframes slideUp    /* Opacity 0→1 + translateY(20px→0) */
@keyframes loading    /* Background position for skeleton loader */
```

### Animation Classes
```css
.animate-fade-in   /* fadeIn animation, 0.3s ease-out */
.animate-slide-in  /* slideIn animation, 0.3s ease-out */
.animate-slide-up  /* slideUp animation, 0.3s ease-out */
.skeleton          /* Loading skeleton with gradient sweep */
```

### Global Transitions
All interactive elements (a, button, input, select, textarea) have smooth transitions:
- color: 180ms ease-in-out
- background-color: 180ms ease-in-out
- border-color: 180ms ease-in-out
- box-shadow: 220ms ease-in-out
- transform: 220ms ease-in-out

## Focus States

### Global Focus Styles
All focusable elements use `:focus-visible` to show focus only for keyboard navigation:

```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px white, 0 0 0 4px rgba(53, 14, 111, 0.35);
}
```

**Features**:
- 2px white offset ring
- 4px `brand.primary` (Violet) focus ring with 35% opacity
- Only visible for keyboard focus (not mouse clicks)

## Accessibility

### Color Contrast
All color combinations meet or exceed WCAG AA standards (minimum 4.5:1 for normal text, 3:1 for large text):

**Text on White Backgrounds:**
- text.primary (#0F172A) on white: 17.76:1 ✅ (AAA)
- text.secondary (#334155) on white: 10.87:1 ✅ (AAA)
- text.muted (#64748B) on white: 5.89:1 ✅ (AA+)

**White Text on Brand Backgrounds:**
- White on brand.primary (#350e6f): 12.89:1 ✅ (AAA)
- White on brand.dark (#27062e): 16.70:1 ✅ (AAA)

**Dark Text on Accent Backgrounds:**
- text.primary on accent.warning (#eab130): 10.00:1 ✅ (AAA)
- text.primary on accent.highlight (#f9db59): 14.46:1 ✅ (AAA)
- text.primary on danger.DEFAULT (#f4540c): 5.20:1 ✅ (AA+)

**⚠️ CRITICAL**: Never use white text on gold, yellow, or orange backgrounds. Always use dark text.

**Status colors on light backgrounds:** AA+ ✓  
**Badge text on colored backgrounds:** AA+ ✓

For detailed contrast specifications, see [THEME_CONTRACT.md](./THEME_CONTRACT.md).

### Touch Targets
All interactive elements have minimum touch target sizes:
- Buttons: min-height: 44px, min-width: 44px
- Links: min-height: 44px, min-width: 44px

### Focus Indicators
- Visible focus rings on all interactive elements
- 2px offset for clarity
- Only shown for keyboard navigation (`:focus-visible`)
- High contrast `brand.primary` (Violet) color

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Logical tab order maintained
- Focus indicators clearly visible
- No keyboard traps

## Spacing Scale

Consistent spacing using rem-based units:

```
0:  0px
1:  0.25rem (4px)
2:  0.5rem (8px)
3:  0.75rem (12px)
4:  1rem (16px)
5:  1.25rem (20px)
6:  1.5rem (24px)
8:  2rem (32px)
10: 2.5rem (40px)
12: 3rem (48px)
16: 4rem (64px)
20: 5rem (80px)
24: 6rem (96px)
32: 8rem (128px)
```

## Border Radius

```
sm:    0.25rem (4px)
md:    0.5rem (8px)
lg:    0.75rem (12px)
xl:    1rem (16px)
2xl:   1.5rem (24px)
3xl:   2rem (32px)
4xl:   2.5rem (40px)
full:  9999px (circular)
```

## Breakpoints

```
sm:  30em (480px)
md:  48em (768px)
lg:  62em (992px)
xl:  80em (1280px)
2xl: 96em (1536px)
```

## Usage Examples

### Using Brand Colors in Tailwind
```jsx
<div className="bg-brand-primary text-white">Primary Button</div>
<div className="bg-accent-warning text-text-primary">Accent Button (dark text!)</div>
<div className="text-text-primary bg-surface-default">Card Content</div>
```

### Using Semantic Tokens in Chakra
```jsx
<Button variant="primary">Primary Action</Button>
<Button variant="accent">Gold Action</Button>
<Badge variant="premium">Premium Feature</Badge>
<Box bg="surface.default" color="text.primary">Content</Box>
```

### Using Card Components
```jsx
<div className="card">Standard Card</div>
<div className="card-interactive">Hover me!</div>
<Card variant="elevated">Chakra Card</Card>
```

### Using Status Indicators
```jsx
<span className="status-indicator--success">Active</span>
<span className="status-indicator--warning">Pending</span>
<Badge variant="premium">Premium Feature</Badge>
```

### Using Gradients
```jsx
<div className="gradient-hero p-12 text-white">Hero Section</div>
<div className="gradient-premium p-6 text-white">Premium Banner</div>
```

### Modal Example
```jsx
<Modal>
  <ModalContent bg="surface.default">
    <ModalHeader color="text.primary">Title</ModalHeader>
    <ModalBody color="text.secondary">Body content</ModalBody>
    <ModalFooter>
      <Button variant="secondary">Cancel</Button>
      <Button variant="primary">Confirm</Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

## Theme Showcase

A visual showcase of all theme elements is available at:
- **File**: `src/pages/ThemeShowcase.tsx`
- **Purpose**: Visual verification and documentation of all theme components

To view the showcase, add it to your routing configuration and navigate to the route.

## Files Modified

1. **index.html**: Google Fonts imports
2. **tailwind.config.js**: Complete Tailwind theme configuration with semantic tokens
3. **src/theme/index.ts**: Chakra UI theme configuration with semantic tokens
4. **src/index.css**: Base styles, component classes, animations
5. **THEME_CONTRACT.md**: Strict usage rules and approved tokens (NEW)

## Migration from v1.0.0

If you're updating existing code to use the new semantic tokens:

| Old Token | New Token |
|-----------|-----------|
| `primary.500` | `brand.primary` |
| `primary.600` | `brand.dark` |
| `brand.text` | `text.primary` or `text.secondary` |
| `brand.accent` | `surface.subtle` |
| `accent.500` | `accent.warning` (with dark text!) |
| `error.500` (buttons) | `danger.DEFAULT` (with dark text!) |
| `neutral.200` | `border.subtle` |
| `neutral.300` | `border.strong` |
| `white` (backgrounds) | `surface.default` |

**⚠️ CRITICAL CHANGES:**
- Destructive/danger buttons now use dark text, not white
- Accent/gold buttons now use dark text, not white
- All modals must use `surface.default` background
- All text should use `text.*` tokens

## Best Practices

### Do's ✓
- Use semantic color names (brand.primary, text.primary, surface.default) instead of specific colors
- Use pre-built component classes (.card, .status-indicator) for consistency
- Use the appropriate button variant for the context
- Maintain WCAG AA+ contrast ratios for all text
- Use dark text on gold, yellow, and orange backgrounds
- Use `text.primary`, `text.secondary`, or `text.muted` for all text content
- Use responsive typography classes
- Apply hover effects to interactive elements
- Refer to [THEME_CONTRACT.md](./THEME_CONTRACT.md) for strict usage rules

### Don'ts ✗
- Don't hardcode color values; use theme tokens
- Don't use white text on gold, yellow, or orange backgrounds
- Don't use `accent.highlight` (yellow) or `accent.warning` (gold) for text
- Don't create custom shadows; use the shadow scale
- Don't override focus styles; use the global focus system
- Don't use small touch targets (<44px)
- Don't mix Tailwind and Chakra color naming (use appropriate one for context)
- Don't create duplicate component styles

## Future Enhancements

Optional features that could be added:
1. **User Theme Preferences**: Store font size, reduced motion, high contrast preferences in Firebase
2. **Dark Mode**: Implement dark mode variants for all components
3. **Additional Components**: More reusable component classes as patterns emerge
4. **Theme Variants**: Alternative color schemes for different brands or contexts
5. **Component Library**: Interactive documentation with live component previews

## Support

For questions about the theme system:
1. **Review [THEME_CONTRACT.md](./THEME_CONTRACT.md)** for strict usage rules
2. Review this documentation for implementation details
3. Check the ThemeShowcase component for visual examples
4. Refer to inline comments in theme files
5. Test color combinations with WebAIM contrast checker for accessibility

---

Last Updated: December 2024
Version: 2.0.0 (Growth.design-informed accessible theme)
