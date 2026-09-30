# Security Operations Dashboard — UI Spec

A dark-themed cybersecurity analytics dashboard. Use this doc as the source of truth for building similar screens, components, and layout.

## 1. Design Tokens

### Colors
| Token | Hex | Usage |
|---|---|---|
| Brand Base (accent) | `#E5FF8F` | Primary buttons, highlights, active nav, chart accents, positive badges |
| Accent tint 1 | `#EDFFB1` | Secondary highlight surfaces |
| Accent tint 2 | `#F2FFC7` | Lighter highlight surfaces |
| Accent tint 3 | `#F7FFDD` | Subtle tint backgrounds |
| Accent tint 4 | `#FCFFF4` | Near-white tint |
| Background (page) | `#0A0A0A` – `#111111` | App background, near-black |
| Surface / card | `#161616` – `#1A1A1A` | Card backgrounds, slightly lighter than page |
| Border/divider | `#2A2A2A` | Subtle 1px card borders/dividers on dark surfaces |
| Text primary | `#FFFFFF` | Headings, key values |
| Text secondary | `#9A9A9A` | Labels, captions, muted text |
| Status success/high | `#7CFF6B` / green | "High" status pill, GDPR % |
| Status warning | `#E5D34F` / yellow-amber | "HIPAA" %, medium alerts |
| Status critical | `#FF5C5C` / red | "Critical" pill, ISO 27001 %, alerts |

### Typography
- Font: geometric sans-serif (e.g., "Inter", "Space Grotesk", or similar) — bold rounded headline weight for hero text ("Hello Jams"), regular weight for body/table text.
- Hero heading: ~48–56px bold, mixed color (white + accent word in `#E5FF8F`).
- Section titles ("Firewall Activity", "Alert Volume"): ~20–24px semibold white.
- Stat numbers (big KPIs): ~32–40px bold, dark text on accent cards.
- Body/table text: ~14px regular, secondary gray.
- Small pill/badge text: ~12px medium.

### Spacing & Shape
- Base corner radius: 16–20px on cards, 24px+ on the outer dashboard frame, full-pill (999px) on badges/buttons.
- Card padding: ~24–32px.
- Grid gutter: ~20–24px.
- Outer app shell has a soft drop shadow / floats over a neutral page background (light cream `#F5F5DC`-ish in mockups, but the app itself is dark).

## 2. Layout Structure

### App Shell
- Fixed left icon sidebar (~64px wide), dark, containing:
  - Logo/brand mark (top)
  - Nav icons (grid/dashboard, analytics/line-chart, card/database, scan/incident, profile) — active item has accent-colored (`#E5FF8F`) rounded square background
  - Settings + logout icons pinned to bottom
- Top bar (full width, right of sidebar):
  - Left: page title ("Dashboard")
  - Center-right: date navigator ("< Today, Sep 25 >")
  - Right: notification bell icon, user avatar + name + handle
- Primary content area: scrollable, grid of cards below a page header.

### Page Header
- Large greeting/title on the left (e.g., "Hello **Jams**" with the name in accent color), or page-specific title (e.g., "Incident Reports – **Sep 2025**", "Incident - **#INC-2048**").
- Primary CTA button top-right, accent-colored pill (e.g., "Check Alerts", "Export All", "Download").

### KPI Stat Row
- 3 equal-width accent-colored (`#E5FF8F`) rounded cards in a row.
- Each contains: small icon top-left, label text, large bold stat number, small dark pill badge showing % change (e.g., "+3.2%") to the right of the number.

### Charts Grid (Dashboard view)
- 3-column responsive grid of dark cards, each ~equal height:
  1. **Radial/Gauge card** — big arc gauge with a floating value-change pill on the gauge line, current total displayed as text above.
  2. **Bar chart card** — vertical bars per month (Jun–Dec), one bar highlighted/tallest with a floating "+80%" pill above it.
  3. **Line/area chart card** — two overlapping smooth line series (white + accent), with a floating "+35%" pill at their intersection point, dropdown selector top-right (e.g., "Week ▾").
- Card header row: title left, overflow menu (⋮) or dropdown right.

### Secondary Row
- **Vertical bar/sparkline card** ("Operations") — ascending bar chart (white bars) with two callout data points (percent labels with dot markers).
- **Data table card** ("Alert Queue") — title + subtitle, dropdown selector, columns: Time, Alert ID, Severity, Status (colored pill: green=High, red=Critical), Action (link "View").

### Incident Detail View
- Header: "Incident - #ID" + Download button.
- 4-column KPI row (accent cards): Affected Asset, MITRE Technique, Source IP, Confidence — each with small icon.
- **Incident Timeline card**: horizontal stepper/timeline with 5 nodes on a dotted connecting line; alternating nodes show a colored callout box above (red = suspicious/critical, amber = warning, gray = neutral) with title + subtext + timestamp below each node.
- 3-column bottom row:
  1. **AI Suggested Actions** — list rows: action title + date, with "Reject" (ghost) / "Approve" (accent pill) buttons.
  2. **Login Attempts** — dot-matrix / scatter chart by month, accent dots highlight a cluster, count shown top-right.
  3. **Threat Detection** — horizontal "candlestick/wave" band chart with floating % callouts.

### Incident Reports / Compliance View
- Header: "Incident Reports – Month Year" + "Export All" button.
- Row of 3 incident summary cards: Incident #ID title, download icon, description text, "Resolved by" footer with avatar, name, MTTR, date.
- **Alert Queue card**: candlestick-style time-series chart (financial-chart look, white/accent candles) with a floating tooltip callout, dropdown selector.
- **Compliance Overview card** (side panel): stacked list rows of compliance frameworks (GDPR, HIPAA, ISO 27001) each with a colored percentage (green/amber/red by score).
- **Compliance Overview table** (full width below): columns Compliance, Alert ID, Date, Time, Source, Status (pill), Action (Download link).

## 3. Reusable Components to Build

1. `SidebarNav` — icon-only vertical nav with active state.
2. `TopBar` — title, date navigator, notifications, user menu.
3. `PageHeader` — title (with accent-colored keyword span) + primary CTA button.
4. `StatCard` (accent variant) — icon, label, big number, delta pill.
5. `ChartCard` — generic dark card wrapper with title, optional dropdown/menu, and a chart slot (gauge, bar, line, candlestick, dot-matrix, wave-band all as swappable chart types).
6. `DataTable` — dark table with header row, colored status pills, action links/buttons.
7. `Badge/Pill` — colored status indicator (High=green, Critical=red, neutral=gray) and delta pill (dark bg, accent text, e.g. "+15%").
8. `TimelineStepper` — horizontal dotted-line timeline with alternating callout cards and timestamps.
9. `ActionListItem` — title + date + Approve/Reject button pair.
10. `SummaryCard` — title, description, footer with avatar/name/metric/date (for incident report cards).
11. `Button` — primary (accent pill, dark text), ghost/secondary (transparent/dark, light text).
12. `Avatar` — circular image with name + handle stacked text.

## 4. Interaction / Chart Notes
- Charts use floating "callout pills" positioned directly on the data point of interest (not axis-based tooltips) — accent-colored (or dark) rounded pill with the % change value.
- Chart color palette: white/light-gray as one series, accent lime (`#E5FF8F` or brighter `#D4FF4F`-ish for highlighted bars) as the other/highlight series.
- All numeric deltas are shown as small dark pill badges next to the metric.
- Dropdowns ("Week ▾") are simple text + chevron, no heavy borders.

## 5. Suggested Stack
- **Framework**: React + Tailwind CSS (utility classes map well to the spacing/radius/color tokens above).
- **Charts**: Recharts or Chart.js for bar/line/area; a custom SVG component for the radial gauge, candlestick, and dot-matrix charts since they're stylistically custom.
- **Icons**: Lucide or Phosphor (thin-line style matches the sidebar icons).
- Define the palette above as Tailwind theme extensions (`colors.brand.DEFAULT = '#E5FF8F'`, etc.) and reuse `rounded-2xl`, `rounded-full` consistently.

## 6. Prompt Snippet for the Coding Agent
> Build a dark-mode security operations dashboard using the design tokens, layout structure, and component list in this spec. Background near-black (`#0A0A0A`), cards `#161616` with `rounded-2xl` corners, accent color `#E5FF8F` used for primary buttons, KPI cards, active nav state, and chart highlights. Follow the three page layouts described (Dashboard overview, Incident detail, Incident Reports/Compliance) and reuse the shared component list (SidebarNav, TopBar, StatCard, ChartCard, DataTable, Badge, TimelineStepper, ActionListItem, SummaryCard).
