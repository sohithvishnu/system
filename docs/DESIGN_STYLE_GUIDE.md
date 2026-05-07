# Design Style Guide — Electric Brutalist System

**Design Language:** Electric Brutalist  
**Last Updated:** May 2026  
**Version:** 1.0

---

## 🎨 Design Philosophy

Our interface embodies **Electric Brutalism** — a design philosophy that combines stark, minimalist aesthetics with high-contrast, neon accents. It's inspired by hacker culture, terminal interfaces, and the raw honesty of brutalist architecture adapted for digital experiences.

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Minimalism** | Eliminate visual noise; every pixel serves a purpose |
| **High Contrast** | Pure blacks with neon accents ensure readability and visual impact |
| **Honesty** | Expose structure; borders are visible, hierarchy is explicit |
| **Monospace Heritage** | Typography reflects terminal interfaces and developer mindset |
| **Precision** | Hard edges, perfect alignment, no soft shadows or gradients |
| **Accessibility** | High contrast ratios exceed WCAG AA standards for all users |

---

## 🎯 Color Palette

### Primary Colors

```
BACKGROUND:  #0A0A0A (Almost Black)
├─ Pure Black: #000000 (Regions with minimal content)
└─ Surface: #0D0D0D (Card & Container backgrounds)

ACCENT (Primary CTA):  #00FF66 (Neon Green)
├─ Glow Effect: rgba(0,255,102,0.6)
├─ Soft Tint: rgba(0,255,102,0.06) (Subtle highlights)
└─ Dark Variant: #00CC55 (Hover/Active state)

DANGER (Errors/Warnings): #FF2C55 (Hot Red/Pink)
├─ Deadline emphasis
├─ Delete confirmations
└─ Error messages

SECONDARY:
├─ Warning: #FFB800 (Amber/Gold for medium priority)
├─ Info: #38bdf8 (Cyan for notifications)
└─ Support: #A78BFA (Purple for rest/secondary actions)
```

### Neutrals (Text & Borders)

```
TEXT:
├─ Primary: #D0D0D0 (Main content, high contrast)
├─ Secondary: #888888 (Muted descriptions, meta info)
├─ Muted: #555555 (Disabled states, hints)
└─ Ghost: #2E2E2E (Minimal visibility, placeholders)

BORDERS:
├─ Default: #141414 (Subtle structural divisions)
├─ Mid: #1A1A1A (Medium emphasis borders)
├─ Hover: #222222 (Interactive feedback)
└─ White: #FFFFFF (Maximum contrast when needed)
```

### Entity Type Colors

Map semantic meaning to visual color:

| Entity Type | Color | Usage |
|-------------|-------|-------|
| **TO_DO** | `#00FF66` (Neon Green) | Standard tasks, actionable items |
| **DEADLINE** | `#FF2C55` (Hot Red) | Due dates, critical tasks |
| **MEETING** | `#38BDF8` (Cyan) | Scheduled events, calls |
| **REST** | `#A78BFA` (Purple) | Breaks, personal time, wellness |

### Priority Colors

| Level | Color | Meaning |
|-------|-------|---------|
| **HIGH** | `#FF2C55` (Red) | Urgent, requires immediate attention |
| **MEDIUM** | `#FFB800` (Gold) | Important, schedule soon |
| **LOW** | `#00FF66` (Green) | Secondary, handle when free |

### Usage Rules

```typescript
// ✅ CORRECT: Map entity to color
const color = ENTITY_COLORS[entity.type];  // e.g., TO_DO → #00FF66

// ❌ INCORRECT: Arbitrary color assignment
const color = randomColor();

// ✅ CORRECT: Respect semantic meaning
<Task priority="HIGH" color={COLORS.danger} />

// ❌ INCORRECT: Use danger for secondary items
<Task priority="LOW" color={COLORS.danger} />
```

---

## 🔤 Typography

### Font Stack

```typescript
FONT_FAMILY: {
  mono: 'Courier New',    // Terminal aesthetic, code display
  sans: 'System',         // Native OS font, maximum legibility
}
```

**Rationale:**
- **Monospace**: Reflects hacker/terminal heritage; used for data, times, priorities
- **System Font**: Ensures optimal rendering on mobile; respects OS design
- **No web fonts**: Reduces HTTP requests, faster load time

### Font Sizes (Responsive Scaling)

All sizes use `scale()` function for responsive scaling across devices:

```typescript
FONT: {
  xs:   scale(9),    // Captions, timestamps
  sm:   scale(10),   // Secondary text, hints
  base: scale(11),   // Body text, default
  md:   scale(12),   // Card titles
  lg:   scale(13),   // Section headers
  xl:   scale(15),   // Page titles
  xxl:  scale(18),   // Hero text
}
```

### Font Weights

- **Regular (400)**: Body text, descriptions
- **Medium (500)**: Sub-headings
- **Bold (700)**: Emphasis, labels
- **Black (900)**: Buttons, primary headings (only in critical CTAs)

### Examples

```
┌─────────────────────────────────────┐
│ TASK OVERVIEW             [xxl/900]  │
│                                      │
│ Write product spec        [md/700]   │
│ By Friday 3:00 PM         [sm/400]   │
│ 📌 High Priority          [sm/700]   │
└─────────────────────────────────────┘
```

---

## 📐 Spacing & Layout

### Spacing Scale

All spacing derived from `scale()` function for consistent rhythm:

```typescript
SPACE: {
  xs: scale(4),    // Minimal gaps (chip padding, icon spacing)
  sm: scale(6),    // Compact spacing (text-to-icon)
  md: scale(10),   // Standard spacing (card content, list items)
  lg: scale(14),   // Generous spacing (section breaks, sections)
  xl: scale(20),   // Large gaps (page sections, major divisions)
}
```

### Border Radius

Brutalist design uses **minimal rounding** for a raw, structured feel:

```typescript
RADIUS: {
  xs: scale(2),    // Barely rounded (almost square)
  sm: scale(4),    // Subtle softness
  md: scale(8),    // Standard cards
  lg: scale(12),   // Larger containers
  xl: scale(16),   // Max roundness (modals, overlays)
  round: 9999,     // Full circle (avatars, badges)
}
```

### Border Styles

- **Default Border:** `1px solid #141414` (subtle, almost invisible)
- **Active Border:** `1px solid #00FF66` (neon green, high visibility)
- **Error Border:** `1px solid #FF2C55` (hot red, immediate attention)
- **Disabled Border:** `1px solid #2E2E2E` (ghost color, de-emphasized)

**Principle:** Borders are structural, not decorative. They define layout, not beautify it.

---

## 🎛️ Component Library

### 1. **Button: Primary** (CTA Button)

Primary buttons trigger major actions.

```
┌──────────────────────────┐
│   CREATE NEW TASK        │ ← #00FF66 text on #000000 bg
│   [Spring animation]     │   Scale 0.97 on press
└──────────────────────────┘
```

**Specifications:**
- **Background:** #000000 (transparent, border-only style)
- **Text:** #00FF66 (neon green, bold)
- **Border:** 1px solid #00FF66
- **Padding:** SPACE.md horizontal, SPACE.sm vertical
- **Animation:** Spring scale (0.97) on press with haptic feedback
- **Radius:** RADIUS.sm

**Usage:**
```typescript
<PrimaryButton 
  label="Create Task"
  onPress={() => handleCreate()}
/>
```

### 2. **Button: Accent** (Secondary CTA)

Accent buttons provide alternative actions (less critical than primary).

```
┌──────────────────────────┐
│    SAVE CHANGES          │ ← #FFB800 (gold/amber)
│   [Spring animation]     │
└──────────────────────────┘
```

**Specifications:**
- **Background:** #000000
- **Text:** #FFB800 (gold/amber)
- **Border:** 1px solid #FFB800
- **Animation:** Spring scale (0.97) on press

### 3. **Button: Ghost** (Tertiary/Destructive)

Ghost buttons are minimalist, used for secondary actions or danger zones.

```
┌─ DELETE ─┐  ← Minimal, danger variant in red
│ [thin]   │
└──────────┘
```

**Specifications:**
- **Background:** Transparent
- **Text:** #888888 (muted) or #FF2C55 (danger mode)
- **Border:** 1px solid #1A1A1A or #FF2C55
- **Padding:** Minimal (SPACE.sm)
- **Animation:** Subtle, no haptics

**Usage:**
```typescript
// Muted variant
<GhostButton label="Cancel" onPress={handleCancel} />

// Danger variant
<GhostButton label="Delete" onPress={handleDelete} danger={true} />
```

### 4. **Card** (Container/Content Block)

Cards organize related content with clear visual hierarchy.

```
┌────────────────────────────────┐
│ CARD TITLE                     │
│ [md/700]                       │
├────────────────────────────────┤
│ Card content here              │
│ Multiple lines supported       │
│ [base/400]                     │
│                                │
│ [Primary Button] [Ghost Btn]   │
└────────────────────────────────┘
```

**Specifications:**
- **Background:** #0D0D0D (slightly lighter than page bg)
- **Border:** 1px solid #141414
- **Padding:** SPACE.lg on all sides
- **Radius:** RADIUS.md
- **Animation:** Scale 0.97 on press with haptic feedback
- **Hierarchy:** Bold title, regular body, muted meta

**Usage:**
```typescript
<Card onPress={() => handleCardPress()}>
  <Text style={{fontWeight: 'bold'}}>My Task</Text>
  <Text style={{color: COLORS.textSecondary}}>Due Friday</Text>
</Card>
```

### 5. **Section** (Content Grouping)

Sections organize related cards and content vertically.

**Specifications:**
- **Header:** Bold, uppercase text, FONT.lg
- **Separator:** Optional SPACE.md margin below header
- **Spacing:** SPACE.md between items, SPACE.lg between sections
- **Border:** Optional top border (#1A1A1A) for visual separation

### 6. **Empty State** (Placeholder)

When a section has no content, display an empty state.

```
          ┌─────────────────────┐
          │                     │
          │   📭  NO TASKS      │
          │   [sm/muted]        │
          │                     │
          │  Add your first     │
          │  task to begin      │
          │  [xs/ghost]         │
          │                     │
          │  [PRIMARY BUTTON]   │
          │                     │
          └─────────────────────┘
```

**Specifications:**
- **Icon:** Emoji or SVG, scale(30) - scale(40)
- **Title:** Uppercase, monospace flavor, FONT.md
- **Hint:** FONT.xs, color COLORS.textGhost
- **CTA:** Optional primary button below text

### 7. **Status Indicator** (Health Check)

Visual indicator for system health, connectivity, active model.

```
● #00FF66 = Online        ● #FF2C55 = Offline
```

**Specifications:**
- **Size:** scale(10) - scale(12) diameter
- **Color:** #00FF66 (online) or #FF2C55 (offline)
- **Animation:** Subtle pulse or glow effect (optional)
- **Placement:** Top-right corner, top-left sidebar, or integrated in header

### 8. **Skeleton/Loader** (Loading State)

Placeholder while content loads.

```
┌────────────────────┐
│ ░░░░░░░░░░░░░░░░  │  ← Animated pulse
│ ░░░░░░░░░░░░░░░░  │
│ ░░░░░░░░░░░░░░░░  │
└────────────────────┘
```

**Specifications:**
- **Background:** #0F0F0F
- **Border:** 1px solid #141414
- **Animation:** Opacity pulse (0.5 → 1.0) every 600ms
- **Radius:** Match expected card radius

---

## ⌨️ Input & Interactive Elements

### Text Input

```
┌────────────────────────────────┐
│ Enter task description...      │  
│ [placeholder text, muted]      │
└────────────────────────────────┘
```

**Specifications:**
- **Background:** #0D0D0D
- **Border:** 1px solid #141414
- **Border (Focus):** 1px solid #00FF66
- **Text Color:** #D0D0D0
- **Placeholder:** #555555
- **Padding:** SPACE.md
- **Radius:** RADIUS.md

### Checkbox / Toggle

**Unchecked:**
```
☐ Mark as complete
```

**Checked:**
```
☑ Mark as complete  ← #00FF66 filled
```

### Date/Time Picker

Native pickers styled to match Electric Brutalist:
- **Background:** Respects system settings (dark mode)
- **Accent:** #00FF66 in selection states
- **Typography:** Monospace for better readability

---

## 🎬 Animation & Micro-interactions

### Button Interactions

```
Press (PressIn):
  Scale: 1.0 → 0.97
  Duration: 100ms spring curve
  Haptic: Light impact (or Medium for primary CTAs)

Release (PressOut):
  Scale: 0.97 → 1.0
  Duration: 150ms spring curve
```

**Spring Config:**
```typescript
withSpring(targetValue, {
  damping: 10,
  mass: 1,
  overshootClamping: true
})
```

### Loading States

- **Skeleton Pulse:** 600ms cycle, opacity 0.5 ↔ 1.0
- **Spinner:** Indeterminate progress, neon green color
- **Progress Bar:** Linear fill from left to right, #00FF66

### Transitions

- **Page Navigation:** Instant (no fade/slide — brutalist principle)
- **Modal Appearance:** Fade in (200ms)
- **Snackbar/Toast:** Slide up from bottom (300ms)

**Rationale:** Brutalism values directness. Unnecessary animations slow down interaction.

### Haptic Feedback (Mobile)

| Interaction | Feedback |
|-------------|----------|
| Button Press (Primary) | Medium Impact |
| Button Press (Secondary) | Light Impact |
| Card Tap | Light Impact |
| Success/Confirm | Notification (Success) |
| Error/Delete | Notification (Warning) |
| Swipe Action | Selection |

---

## 🎛️ Layout Patterns

### Kanban Board Layout

```
┌─ TO_DO ───────────┬─ IN PROGRESS ──┬─ DONE ────────┐
│ [Card 1]          │ [Card 4]       │ [Card 6]      │
│ [Card 2]          │ [Card 5]       │ [Card 7]      │
│ [Card 3]          │                │               │
└───────────────────┴────────────────┴───────────────┘
```

**Specifications:**
- **Column Width:** Equal distribution or fixed width on desktop
- **Spacing:** SPACE.lg between columns, SPACE.md between cards
- **Headers:** Uppercase, bold, monospace aesthetic
- **Scroll:** Horizontal scroll for additional columns
- **Empty State:** Show per-column when no cards present

### Tab Navigation (Mobile)

```
┌─────────────────────────────────┐
│ ◇ Kanban  🗂 Archive  ☰ Menu    │  ← Bottom tabs
└─────────────────────────────────┘
```

**Specifications:**
- **Position:** Bottom of screen (mobile)
- **Active Tab:** #00FF66 text, bold
- **Inactive Tab:** #888888 text
- **Indicator:** Underline or background highlight in accent color
- **Icons:** Monospace-styled or minimal SVG

### Sidebar (Desktop/Tablet)

```
┌────────────────┐
│ SYSTEM         │  ← Logo/title
│ [ICON] Home    │  ← Nav item, bold when active
│ [ICON] Archive │
│ [ICON] Settings│
│                │
│ ● Online       │  ← Status indicator
│ Model: llama2  │  ← Active model
└────────────────┘
```

**Specifications:**
- **Width:** Fixed (200px - 250px)
- **Background:** #0A0A0A
- **Border:** Right border 1px solid #141414
- **Items:** SPACE.md vertical spacing
- **Active Item:** Bold, #00FF66 text
- **Status:** Pinned at bottom, small font (FONT.xs)

---

## 🔍 Accessibility Standards

### Color Contrast Ratios

All text meets or exceeds **WCAG AA** standards:

| Text Color | Background | Ratio | Pass |
|-----------|-----------|-------|------|
| #00FF66 (Green) | #000000 (Black) | 3.12:1 | ⚠️ AA (large text only) |
| #D0D0D0 (Primary) | #000000 (Black) | 15.4:1 | ✅ AAA |
| #888888 (Secondary) | #000000 (Black) | 5.9:1 | ✅ AAA |
| #FF2C55 (Red) | #000000 (Black) | 5.0:1 | ✅ AA |

### Recommendations

1. **Never use small text in accent colors** — Use accent colors only for large headings, buttons, or highlights
2. **Use descriptive alt text** for icons: `alt="Task priority: High"` not `alt="icon"`
3. **Keyboard Navigation:** All interactive elements must be keyboard-accessible
4. **Focus Indicators:** Show a 2px dashed border (#00FF66) on focus
5. **Screen Readers:** Use semantic HTML, ARIA labels where appropriate

---

## 📊 Data Visualization

### Priority Badges

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  HIGH   │     │ MEDIUM  │     │  LOW    │
│ #FF2C55 │     │ #FFB800 │     │ #00FF66 │
└─────────┘     └─────────┘     └─────────┘
```

**Specifications:**
- **Shape:** Rounded pill (RADIUS.round)
- **Padding:** SPACE.xs horizontal, SPACE.xs vertical
- **Font:** FONT.xs, bold, monospace aesthetic
- **Background:** Transparent with colored border
- **Example:** `[HIGH]`, `[MEDIUM]`, `[LOW]`

### Timeline / Calendar

- **Today Highlight:** #00FF66 border or background tint
- **Past Events:** #555555 (muted)
- **Future Events:** #D0D0D0 (normal)
- **Selected:** #00FF66 background with #000000 text

### Status Indicators (Multi-state)

```
✓ Complete   → #00FF66
→ In Progress → #FFB800
⊗ Blocked    → #FF2C55
○ Todo       → #888888
```

---

## 🚀 Implementation Guidelines

### React Native / Expo

```typescript
// ✅ CORRECT: Use centralized theme constants
import { COLORS, FONT, SPACE, RADIUS } from '../constants/theme';

export function MyComponent() {
  return (
    <View style={{ 
      backgroundColor: COLORS.surface,
      padding: SPACE.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
    }}>
      <Text style={{
        color: COLORS.textPrimary,
        fontSize: FONT.md,
        fontWeight: '700',
        fontFamily: FONT_FAMILY.mono,
      }}>
        My Content
      </Text>
    </View>
  );
}
```

```typescript
// ❌ INCORRECT: Magic numbers, hardcoded colors
export function MyComponent() {
  return (
    <View style={{ 
      backgroundColor: '#0D0D0D',
      padding: 12,
      borderRadius: 8,
      borderColor: '#00FF66',
    }}>
      <Text style={{
        color: '#00FF66',
        fontSize: 14,
      }}>
        My Content
      </Text>
    </View>
  );
}
```

### Web / CSS

```css
/* ✅ CORRECT: Use CSS custom properties */
.card {
  background-color: var(--md-primary-bg-color);
  border: 1px solid var(--md-accent-fg-color);
  color: var(--md-typeset-color);
}

/* ❌ INCORRECT: Hardcoded values */
.card {
  background-color: #0D0D0D;
  border: 1px solid #00FF66;
  color: #D0D0D0;
}
```

### Documentation (MkDocs)

- **Links:** #00FF66 (neon green, underlined)
- **Code Blocks:** #0A0A0A background, #00FF66 syntax highlighting
- **Headings:** #FFFFFF (white), bold
- **Borders/Dividers:** #1A1A1A (mid-tone gray)

---

## ✅ Design Checklist

Before shipping a feature, verify:

- [ ] **Colors:** All text passes WCAG AA contrast ratio test
- [ ] **Typography:** Consistent use of FONT scale, no magic font sizes
- [ ] **Spacing:** All gaps derived from SPACE scale, no random padding/margin
- [ ] **Borders:** Used structurally, not decoratively; 1px solid only
- [ ] **Buttons:** Spring animation on press, correct haptic feedback
- [ ] **Empty States:** Shown when content unavailable, CTA provided
- [ ] **Loading States:** Skeleton or spinner shown during fetch
- [ ] **Accessibility:** All interactive elements keyboard-navigable
- [ ] **Responsive:** Tested on phone, tablet, desktop
- [ ] **Dark Mode:** No hardcoded light colors, all theme-driven
- [ ] **Consistency:** Component usage aligns with library patterns

---

## 📚 Resources

### Internal Files
- **Theme Constants:** `System-Frontend/constants/theme.ts`
- **UI Components:** `System-Frontend/components/ui/`
- **CSS Overrides:** `docs/stylesheets/extra.css`

### External References
- **Material Design 3:** https://material.io/design
- **WCAG 2.1:** https://www.w3.org/WAI/WCAG21/quickref/
- **Brutalism Architecture:** https://en.wikipedia.org/wiki/Brutalist_architecture

---

## 🔄 Updates & Versioning

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | May 2026 | Initial design system documentation |
| | | Comprehensive color palette, typography, spacing scale |
| | | Component specifications with examples |
| | | Animation principles and accessibility guidelines |

---

**Questions?** Refer to the architecture docs or review component implementations in the codebase.
