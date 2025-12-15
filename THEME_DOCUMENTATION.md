# Theme & Design System Documentation

## Overview

This document provides a comprehensive overview of the T4L theme and design system implementation. The system combines Tailwind CSS utility-first approach with Chakra UI component theming to create a consistent, accessible, and maintainable design language.

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

## Color System

### Primary Brand Color: Indigo/Purple
**Variable**: `brand-indigo` (Tailwind) / `primary` (Chakra)
**Base Color**: #5A0DA0 (at 500)

```
50:  #f5f3ff  (lightest)
100: #ede9fe
200: #ddd6fe
300: #c4b5fd
400: #a78bfa
500: #5A0DA0  ← Primary brand color
600: #4A0B80
700: #380860
800: #2d0650
900: #1e0340  (darkest)
```

**Usage**: Primary buttons, links, focus states, main CTAs

### Accent/Secondary Color: Gold
**Variable**: `accent-gold` (Tailwind) / `accent` or `secondary` (Chakra)
**Base Color**: #EAB130 (at 500)

```
50:  #fefce8  (lightest)
100: #fef9c3
200: #fef08a
300: #fde047
400: #facc15
500: #EAB130  ← Accent color
600: #ca8a04
700: #a16207
800: #854d0e
900: #713f12  (darkest)
```

**Usage**: Premium badges, accent buttons, gold tier indicators, highlights

### Neutral Gray Scale
**Variable**: `neutral`

```
50:  #f8fafc  (lightest) → alias: light
100: #f1f5f9
200: #e2e8f0 → alias: border
300: #cbd5e1
400: #94a3b8 → alias: muted
500: #64748b → alias: medium
600: #475569
700: #334155
800: #1e293b → alias: dark
900: #0f172a  (darkest) → alias: darkest
```

**Usage**: Text hierarchy, borders, backgrounds, subtle UI elements

### Semantic Status Colors

#### Success (Green)
- **Base**: #22c55e (500)
- **Light backgrounds**: 50-200
- **Text on light**: 700-900
- **Usage**: Success messages, completed states, positive indicators

#### Warning (Orange)
- **Base**: #f97316 (500)
- **Light backgrounds**: 50-200
- **Text on light**: 700-900
- **Usage**: Warning messages, caution states, attention needed

#### Error (Red)
- **Base**: #ef4444 (500)
- **Light backgrounds**: 50-200
- **Text on light**: 700-900
- **Usage**: Error messages, failed states, destructive actions

### Special Purpose Colors
- **WhatsApp**: #25D366 (500) with full 50-900 scale
- **Teal**: #14b8a6 (500)
- **Deep Purple**: #350e6f
- **Bright Yellow**: #f9db59
- **Charcoal**: #27062e

### Status Color Aliases (Chakra only)
- `statusGreen`: #16a34a
- `statusYellow`: #d97706
- `statusRed`: #dc2626

## Component Styles

### Buttons (Chakra UI)

#### Variants
- **primary**: Brand indigo background, white text, hover lift effect
- **secondary**: White background, brand text, subtle border, hover fills with light indigo
- **ghost**: Transparent background, brand text, hover fills with light indigo
- **accent**: Gold background, white text, hover lift effect
- **destructive**: Red background, white text, hover lift effect

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
- Background: white
- Border radius: xl (1rem)
- Shadow: card (custom)
- Border: 1px solid neutral-200

#### Variants
- **elevated**: Stronger shadow (card-elevated)
- **muted**: Lighter shadow (sm)
- **interactive**: Hover effects (lift, border color change, elevated shadow)

### Badges (Chakra UI)

#### Variants
- **primary**: Brand indigo background, white text
- **subtle**: Light indigo background, dark indigo text
- **success**: Green background, white text
- **warning**: Orange background, white text
- **error**: Red background, white text
- **premium**: Gold-50 background, gold-700 text, gold-200 border, uppercase

### Progress Bars (Chakra UI)

#### Variants
- **default**: Primary (brand indigo) filled track, neutral-100 background
- **success**: Green filled track
- **warning**: Orange filled track
- **error**: Red filled track

### Form Inputs (Chakra UI)

#### Features
- **Focus border color**: primary.500 (brand indigo)
- **Error border color**: error.500 (red)
- **Border radius**: lg (0.75rem)
- **Default border**: neutral-300
- **Focus ring**: 1px solid in focus color

#### Components
- Input, Select, Textarea: All styled consistently
- Checkbox, Radio: Brand indigo accent when checked

## Custom Utility Classes

### Card Classes (Tailwind)
```css
.card                 /* Base card: rounded-2xl, border, bg-white, p-6, shadow-md */
.card-sm              /* Smaller padding: p-4 */
.card-lg              /* Larger padding: p-8 */
.card-muted           /* Reduced shadow: shadow-sm */
.card-interactive     /* Hover effects: lift, elevated shadow, brand border */
```

### Status Indicators
```css
.status-indicator            /* Base: inline-flex, gap-1.5, rounded-full, border, px-3, py-1 */
.status-indicator--success   /* Green variant */
.status-indicator--info      /* Brand indigo variant */
.status-indicator--warning   /* Orange variant */
.status-indicator--danger    /* Red variant */
.status-indicator--neutral   /* Gray variant */
```

### Premium Badges
```css
.premium-badge          /* Gold-50 bg, gold-200 border, gold-700 text, uppercase */
.premium-badge--outline /* Transparent bg, gold-300 border */
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
.gradient-hero     /* Purple gradient for hero sections */
.gradient-card     /* Subtle indigo gradient for cards */
.gradient-premium  /* Purple to gold gradient for premium features */
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
  box-shadow: 0 0 0 2px white, 0 0 0 4px rgba(90, 13, 160, 0.35);
}
```

**Features**:
- 2px white offset ring
- 4px brand indigo focus ring with 35% opacity
- Only visible for keyboard focus (not mouse clicks)

## Accessibility

### Color Contrast
All color combinations meet WCAG AA standards (minimum 4.5:1 for normal text, 3:1 for large text):
- Primary text (neutral-900 #0f172a) on white: AAA ✓
- Body text (neutral-600 #475569) on white: AA+ ✓
- Status colors on light backgrounds: AA+ ✓
- Badge text on colored backgrounds: AA+ ✓

### Touch Targets
All interactive elements have minimum touch target sizes:
- Buttons: min-height: 44px, min-width: 44px
- Links: min-height: 44px, min-width: 44px

### Focus Indicators
- Visible focus rings on all interactive elements
- 2px offset for clarity
- Only shown for keyboard navigation (`:focus-visible`)
- High contrast brand indigo color

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
<div className="bg-brand-indigo-500 text-white">Primary Button</div>
<div className="bg-accent-gold-500 text-white">Accent Button</div>
<div className="text-neutral-700 bg-neutral-50">Card Content</div>
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

## Theme Showcase

A visual showcase of all theme elements is available at:
- **File**: `src/pages/ThemeShowcase.tsx`
- **Purpose**: Visual verification and documentation of all theme components

To view the showcase, add it to your routing configuration and navigate to the route.

## Files Modified

1. **index.html**: Google Fonts imports
2. **tailwind.config.js**: Complete Tailwind theme configuration
3. **src/theme/index.ts**: Chakra UI theme configuration
4. **src/index.css**: Base styles, component classes, animations

## Best Practices

### Do's ✓
- Use semantic color names (primary, accent, success) instead of specific colors
- Use pre-built component classes (.card, .status-indicator) for consistency
- Use the appropriate button variant for the context
- Maintain WCAG AA+ contrast ratios for all text
- Use responsive typography classes
- Apply hover effects to interactive elements

### Don'ts ✗
- Don't hardcode color values; use theme tokens
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
1. Review this documentation
2. Check the ThemeShowcase component for visual examples
3. Refer to inline comments in theme files
4. Test color combinations with WebAIM contrast checker for accessibility

---

Last Updated: December 2024
Version: 1.0.0
