# 🎯 Quick Tool Position Reference

## Standard Page Layout (All Pages)

```
┌─────────────────────────────────────────────────────────────┐
│  NAVBAR (Sticky Top - 72px height)                          │
│  ☰  📊 FMCG Control  [Links...]  [User]  [Logout]          │
└─────────────────────────────────────────────────────────────┘
       ↓ 100px padding
┌─────────────────────────────────────────────────────────────┐
│  PAGE HEADER                                                 │
│  ┌───────────────────────────────┬──────────────────────┐  │
│  │  📊 Page Title                │  [Action Button]     │  │
│  │  Subtitle description          │                      │  │
│  └───────────────────────────────┴──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
       ↓ 24px gap
┌─────────────────────────────────────────────────────────────┐
│  SEARCH/FILTER CARD (if applicable)                         │
│  🔍 [Search input with icon]                                │
└─────────────────────────────────────────────────────────────┘
       ↓ 24px gap
┌─────────────────────────────────────────────────────────────┐
│  MAIN CONTENT AREA                                           │
│  (Tables, Forms, Charts, Cards, etc.)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Page-Specific Tool Positions

### 📊 Dashboard
```
Page Header: [Refresh Button] (top-right with pulse animation)
Quick Actions: 4 cards in grid (2x2, staggered animation)
Widgets: KPI cards in responsive grid
Charts: Glassmorphic cards below widgets
```

### 👥 Retailers
```
Page Header: [➕ Add Retailer] (right-aligned)
Search Card: 🔍 Search bar (full-width card)
Table: Action buttons in last column (Edit | Delete)
Modal: Centered overlay form
```

### 🏷️ Brands & SKUs
```
Page Header: Title + Subtitle
Tabs: [🏪 Brands] [📦 SKUs] (premium style, below header)
Section Header: Title + [➕ Add Brand/SKU] (per tab)
Tables: Search bars above, action buttons in rows
```

### 🚚 Dispatch
```
Form Sections: 
  ├─ 📋 Basic Details (date, retailer, payment)
  ├─ 🛒 Items (multi-row with SKU, qty, stock)
  │   └─ [➕ Add Item] (below items, green gradient)
  │   └─ [✕ Remove] (per row, red)
  └─ Form Actions: [💾 Save] [🔄 Reset] (bottom-right)
```

### 💳 Credit Control
```
Summary Cards: 3-column grid (Aging | Risk | Cash)
Filters: Date range + search (below summary)
Aging Buckets: 4-column grid (0-7 | 8-15 | 16-30 | 30+ days)
Tables: Risk analysis with badges
```

### 📈 Profit Analysis
```
Date Filter Card: [Start Date] [End Date] [Apply] (gradient button)
Tabs: [By Brand] [By Retailer] [By SKU]
Tables: Rank badges (🥇🥈🥉) + ROI indicators
```

### 📅 Weekly Review
```
Review Cards: Vertical stack with colored headers
Action Tags: [STOP] [WARN] [EXPAND] [KILL] (inline, gradient)
Summary Grid: 4-column metrics at bottom
```

### 🧪 Product Test
```
Test Cards: Grid layout with status badges
Badges: [CONTINUE] [KILL] [PENDING] (gradient styles)
Modals: Test details on click
```

### 📤 Excel Import
```
Step Cards: Numbered 1-3 (vertical flow)
Upload Zone: Drag-drop area (dashed border, center)
Mapping Interface: Column dropdowns (below upload)
Progress: Visual indicator during import
```

---

## Button Position Guidelines

### Primary Actions (Add/Submit)
- **Position**: Right side of page header or section header
- **Style**: Primary gradient (blue)
- **Size**: 12px padding, 24px horizontal
- **Icon**: ➕ or 💾 before text

### Secondary Actions (Edit/Delete)
- **Position**: Table action column (last column)
- **Style**: Outlined with hover fill
- **Size**: Small (8px padding)
- **Icon**: ✏️ or 🗑️

### Form Actions
- **Position**: Bottom-right of form
- **Order**: [Primary Submit] [Secondary Cancel/Reset]
- **Spacing**: 10px gap between buttons

### Mobile Menu
- **Position**: Top-left navbar (hamburger icon)
- **Breakpoint**: Shows at ≤768px
- **Style**: Fixed overlay when active

---

## Responsive Breakpoints

### Desktop (>1200px)
```
Navbar: Full horizontal layout
Grid: 3-4 columns
Forms: 3 columns
Tables: All columns visible
```

### Tablet (768px - 1200px)
```
Navbar: Switches to mobile menu
Grid: 2 columns
Forms: 2 columns
Tables: Horizontal scroll
```

### Mobile (<768px)
```
Navbar: Hamburger menu
Grid: 1 column (stacked)
Forms: 1 column (full-width)
Tables: Card view or scroll
Buttons: Full-width or stacked
```

---

## Z-Index Layers

```
Layer 10: Navbar (sticky top)
Layer 50: Dropdowns
Layer 100: Modals
Layer 200: Toasts/Notifications
Layer 500: Critical overlays
```

---

## Spacing System

```
Micro:   4px  (icon gaps, badge padding)
Small:   8px  (button padding, card internal)
Medium:  16px (between elements)
Large:   24px (section gaps)
XLarge:  32px (major section separators)
XXLarge: 48px (page sections)
```

---

## Color-Coded Indicators

### Status Colors
- 🟢 Green: Positive (Good credit, High profit, Active)
- 🟡 Yellow: Warning (Medium risk, Pending)
- 🔴 Red: Critical (Overdue, Loss, Inactive)
- 🔵 Blue: Neutral (Info, Default)

### Credit Classes
- **A**: Green gradient (Excellent - ₹100K+)
- **B**: Blue gradient (Good - ₹50K-100K)
- **C**: Yellow gradient (Fair - ₹25K-50K)
- **D**: Red gradient (Poor - <₹25K)

### Action Tags
- **STOP**: Red gradient (Immediate action required)
- **WARN**: Orange gradient (Monitor closely)
- **EXPAND**: Green gradient (Scale up)
- **KILL**: Purple gradient (Discontinue)

---

## Animation Triggers

### On Page Load
- Navbar: Slide down from top
- Page title: Fade in + scale
- Cards: Staggered fade-in (50ms delay each)
- Charts: Draw animation

### On Hover
- Buttons: Lift up 2px + glow shadow
- Cards: Subtle scale (1.02x)
- Nav links: Underline slide-in
- Tables: Row highlight

### On Interaction
- Form submit: Button pulse + spinner
- Modal open: Backdrop fade + modal scale
- Toast: Slide in from right
- Search: Results fade in

---

## Testing Checklist for Each Page

✅ **Visual Check**
- [ ] Navbar sticky at top
- [ ] Page title with gradient
- [ ] All buttons visible and aligned
- [ ] Cards have glassmorphic effect
- [ ] Animations smooth (60fps)

✅ **Functional Check**
- [ ] Mobile menu toggles
- [ ] Search/filter works
- [ ] Forms submit correctly
- [ ] Modals open/close
- [ ] Data loads from API

✅ **Responsive Check**
- [ ] Resize to 768px → mobile menu appears
- [ ] Buttons stack properly
- [ ] Tables scroll or adapt
- [ ] No horizontal overflow

✅ **Accessibility Check**
- [ ] Tab key navigates all interactive elements
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader labels present

---

*Use this guide for quick reference when verifying tool positions across all pages.*
