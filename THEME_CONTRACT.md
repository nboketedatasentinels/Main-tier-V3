# Theme Contract - Brand Colors & Accessibility

## Overview

This document defines the approved color tokens and usage rules for the T4L theme system, following Growth.design principles to ensure brand identity is strong while maintaining WCAG AA accessibility standards.

## Core Principle

**Brand colors express identity — not carry readability.**

Readability belongs to neutrals. Brand colors belong to actions, accents, and meaning.

## Approved Color Tokens

### Brand Colors (Identity & Actions)

| Token | Hex | Role | Allowed Usage |
|-------|-----|------|---------------|
| `brand.primary` | #350e6f | Primary brand anchor (Violet) | Primary buttons, links, focus rings, CTA |
| `brand.dark` | #27062e | Dark brand anchor (Deep Purple) | Headers, nav bar, logo background, hover states |

**Contrast Tests:**
- ✅ `brand.primary` on white: 12.89:1 (AAA)
- ✅ `brand.dark` on white: 16.70:1 (AAA)
- ✅ White text on `brand.primary`: 12.89:1 (AAA)
- ✅ White text on `brand.dark`: 16.70:1 (AAA)

### Surface Colors (Backgrounds)

| Token | Hex | Role |
|-------|-----|------|
| `surface.default` | #FFFFFF | Page backgrounds, cards, modals |
| `surface.subtle` | #F8FAFC | Body background, subtle sections |
| `surface.muted` | #F1F5F9 | Input fields, muted panels |
| `surface.elevated` | #FFFFFF | Elevated elements (same as default) |

### Text Colors (Readability First)

| Token | Hex | Role | Contrast on White |
|-------|-----|------|-------------------|
| `text.primary` | #0F172A | Main text, body copy | 17.76:1 ✅ (AAA) |
| `text.secondary` | #334155 | Secondary text, paragraphs | 10.87:1 ✅ (AAA) |
| `text.muted` | #64748B | Hints, labels, subtle text | 5.89:1 ✅ (AA+) |
| `text.inverse` | #FFFFFF | Text on dark backgrounds | N/A |

### Border Colors

| Token | Hex | Role |
|-------|-----|------|
| `border.subtle` | #E2E8F0 | Default borders, dividers |
| `border.strong` | #CBD5E1 | Emphasized borders |

### Accent Colors (Highlights & Status)

| Token | Hex | Role | Usage Rules |
|-------|-----|------|-------------|
| `accent.warning` | #eab130 | Gold - Status, highlights, rewards | **Use with dark text only** |
| `accent.highlight` | #f9db59 | Yellow - Soft highlights | **Background ONLY, never for text** |

**Contrast Tests:**
- ✅ `accent.warning` with dark text (#0F172A): 10.00:1 (AAA)
- ✅ `accent.highlight` with dark text (#0F172A): 14.46:1 (AAA)
- ❌ White text on `accent.warning`: ~3.5:1 (FAILS AA)
- ❌ White text on `accent.highlight`: ~2.8:1 (FAILS AA)

### Danger/Destructive

| Token | Hex | Role | Usage Rules |
|-------|-----|------|-------------|
| `danger.DEFAULT` | #f4540c | Orange - Destructive actions | **Use with dark text only** |

**Contrast Tests:**
- ✅ `danger.DEFAULT` with dark text (#0F172A): 5.20:1 (AA+)
- ❌ White text on `danger.DEFAULT`: ~3.43:1 (FAILS AA)

### Tint Tokens (Safe Backgrounds)

All tint tokens are 80% blended toward white and pass WCAG AA with dark text:

| Token | Hex | Contrast vs #0F172A | Use Case |
|-------|-----|---------------------|----------|
| `tint.brandDark` | #d4cdd5 | 11.47:1 ✅ | Chips, pills, table rows |
| `tint.brandPrimary` | #d7cfe2 | 11.83:1 ✅ | Alert fills, selected states |
| `tint.danger` | #fdddce | 13.95:1 ✅ | Error backgrounds |
| `tint.accentWarning` | #fbefd6 | 15.66:1 ✅ | Warning backgrounds |
| `tint.accentHighlight` | #fef8de | 16.74:1 ✅ | Subtle highlights |

---

## Usage Rules (Strict)

### ✅ DO

- **Primary buttons**: `brand.primary` background + white text
- **Secondary buttons**: `surface.subtle` background + `brand.primary` text
- **Danger buttons**: `danger.DEFAULT` background + `text.primary` (dark text)
- **Links**: `brand.primary` color
- **Body text**: `text.primary` or `text.secondary`
- **Cards**: `surface.default` background
- **Modal backgrounds**: `surface.default`
- **Gold badges**: `tint.accentWarning` background + `text.primary`
- **Focus rings**: `brand.primary`

### ❌ DON'T

- ❌ White text on `danger.DEFAULT` (orange)
- ❌ White text on `accent.warning` (gold)
- ❌ White text on `accent.highlight` (yellow)
- ❌ Use `accent.highlight` or `accent.warning` as body text
- ❌ Use brand colors as large background surfaces (except `brand.primary` and `brand.dark`)
- ❌ Use raw hex values in components (use tokens only)
- ❌ Use `color="white"` outside of buttons with dark backgrounds

---

## Component Examples

### Buttons

```tsx
// ✅ Correct
<Button variant="primary">Primary Action</Button> 
// bg: brand.primary (#350e6f), color: white

<Button variant="secondary">Secondary</Button>
// bg: surface.subtle, color: brand.primary, border: brand.primary

<Button variant="destructive">Delete</Button>
// bg: danger.DEFAULT (#f4540c), color: text.primary (dark)

<Button variant="accent">Upgrade</Button>
// bg: accent.warning (#eab130), color: text.primary (dark)

// ❌ Wrong
<Button bg="danger.DEFAULT" color="white">Delete</Button> 
// Fails contrast
```

### Badges

```tsx
// ✅ Correct
<Badge variant="premium">Gold Tier</Badge>
// bg: tint.accentWarning, color: text.primary, border: accent.warning

<Badge variant="subtle">Info</Badge>
// bg: tint.brandPrimary, color: brand.primary

// ❌ Wrong
<Badge bg="accent.warning" color="white">Premium</Badge>
// Fails contrast
```

### Cards & Modals

```tsx
// ✅ Correct
<Box bg="surface.default" color="text.primary">
  <Heading color="text.primary">Title</Heading>
  <Text color="text.secondary">Body text</Text>
</Box>

// ❌ Wrong
<Box bg="accent.highlight" color="white">
  <Text>Content</Text> {/* Fails contrast */}
</Box>
```

### Status Indicators

```tsx
// ✅ Correct - Use Tailwind utility classes
<span className="status-indicator--warning">Pending</span>
// bg: tint-accent-warning, border: accent-warning, color: text-primary

<span className="status-indicator--danger">Failed</span>
// bg: tint-danger, border: danger, color: text-primary
```

### Text

```tsx
// ✅ Correct
<Text color="text.primary">Main content</Text>
<Text color="text.secondary">Supporting text</Text>
<Text color="text.muted">Hints and labels</Text>
<Text color="text.inverse" bg="brand.primary">Text on dark</Text>

// ❌ Wrong
<Text color="white">Body text</Text> {/* No background specified */}
<Text color="accent.highlight">Warning</Text> {/* Yellow text fails contrast */}
```

---

## Modal & Dialog Rules

**Standard Modal Styling (Non-negotiable):**

- **Background**: `surface.default`
- **Header text**: `text.primary`
- **Body text**: `text.secondary`
- **Primary action button**: `brand.primary` background + white text
- **Secondary action button**: `surface.subtle` background + `brand.primary` text

```tsx
// ✅ Correct Modal Example
<Modal>
  <ModalContent bg="surface.default">
    <ModalHeader color="text.primary">Confirm Action</ModalHeader>
    <ModalBody color="text.secondary">
      Are you sure you want to proceed?
    </ModalBody>
    <ModalFooter>
      <Button variant="secondary">Cancel</Button>
      <Button variant="primary">Confirm</Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

---

## Visual Hierarchy Best Practices

Instead of using more color, use:

- **Spacing**: Consistent padding and margins
- **Font weight**: `font-semibold` for section headers
- **Borders**: `border-subtle` for card separation

**Example:**

```tsx
// ✅ Use hierarchy, not color
<Box>
  <Heading fontWeight="semibold">Section Title</Heading>
  {/* No need for color="brand.primary" */}
</Box>

<Box borderColor="border.subtle" borderWidth="1px">
  {/* Clear separation without heavy color */}
</Box>
```

---

## Accessibility Checklist

Before merging any component:

- ✅ No text below 4.5:1 contrast (WCAG AA)
- ✅ No white text on light backgrounds
- ✅ Color is never the only signal (use icons/labels too)
- ✅ Primary CTA always stands out
- ✅ Pages readable in sunlight (high contrast)

---

## Enforcement Rules

### Code Review Requirements

1. ❌ No raw hex values in components
2. ❌ No `color="white"` outside approved button variants
3. ✅ Theme tokens only
4. ✅ All text must use `text.*` tokens or approved component variants

### Testing

Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) to verify any new color combinations:

- Normal text: Minimum 4.5:1
- Large text (18pt+): Minimum 3:1

---

## Migration Guide

If you see old tokens in existing code, replace them as follows:

| Old Token | New Token |
|-----------|-----------|
| `primary.500` | `brand.primary` |
| `primary.600` | `brand.dark` |
| `brand.text` | `text.primary` or `text.secondary` |
| `brand.accent` | `surface.subtle` |
| `accent.500` | `accent.warning` |
| `error.500` (on buttons) | `danger.DEFAULT` + dark text |
| `neutral.200` | `border.subtle` |
| `white` (backgrounds) | `surface.default` |

---

## Summary

This theme contract ensures:

- ✅ Brand identity is stronger, not diluted
- ✅ Accessibility issues disappear
- ✅ UI feels calmer, more premium
- ✅ Designers & devs stop fighting colors
- ✅ Growth.design-style clarity emerges naturally

**Last Updated**: December 2024  
**Version**: 2.0.0
