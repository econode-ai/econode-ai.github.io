# EcoNode AI — Product Requirements Document

## 1. Project Overview

**EcoNode AI** is an AI-powered nature risk analytics platform that provides TNFD‑ready risk profiles for SMEs: automated baseline analysis + self‑serve upgrades that satisfy lender disclosure requirements and reveal fixable risks.

The website serves as both a marketing landing page and the entry point to the core application interface. It is deployed to GitHub Pages at `econode-ai.github.io`.

---

## 2. Tech Stack

| Layer          | Technology                                      |
|----------------|------------------------------------------------|
| Framework      | React 19 + TypeScript 5.9                      |
| Build tool     | Vite 7                                          |
| Styling        | Tailwind CSS 3.4 with HSL CSS custom properties |
| Routing        | React Router DOM 7 (createBrowserRouter)        |
| Icons          | Lucide React                                    |
| Utilities      | clsx, tailwind-merge, class-variance-authority  |
| Hosting        | GitHub Pages (SPA with 404.html redirect hack)  |
| Linting        | ESLint 9 + typescript-eslint                    |

---

## 3. Project Structure

```
econode-ai.github.io/
├── index.html                  # Entry HTML (includes GH Pages SPA redirect script)
├── public/                     # Static assets (404.html, vite.svg)
├── src/
│   ├── main.tsx                # Router setup & app entry
│   ├── index.css               # Tailwind directives + CSS custom properties (HSL theme)
│   ├── components/
│   │   ├── Layout.tsx          # Shell: Header + <Outlet /> + Footer
│   │   ├── Header.tsx          # Sticky top nav (logo only)
│   │   └── Footer.tsx          # Site footer with links
│   └── pages/
│       ├── Home.tsx            # Landing page (hero, features, CTA)
│       ├── App.tsx             # Core application — 3-panel layout (NEW)
│       ├── Support.tsx         # Support/contact page
│       ├── Privacy.tsx         # Privacy policy
│       ├── Terms.tsx           # Terms of service
│       └── NotFound.tsx        # 404 fallback
├── tailwind.config.js          # Tailwind config with shadcn/ui-style HSL theme
├── vite.config.ts              # Vite config (react plugin, @ alias)
├── tsconfig.json               # TS project references
├── tsconfig.app.json           # App TS config
├── tsconfig.node.json          # Node TS config (vite.config)
├── eslint.config.js            # ESLint flat config
└── package.json
```

---

## 4. Design System

The project uses a **shadcn/ui-inspired** HSL custom property theme defined in `src/index.css`:

| Token                  | HSL Value              | Usage                       |
|------------------------|------------------------|-----------------------------|
| `--background`         | `0 0% 100%`           | Page background (white)     |
| `--foreground`         | `222.2 84% 4.9%`      | Primary text (near-black)   |
| `--primary`            | `142.1 76.2% 36.3%`   | Brand green (buttons, links)|
| `--primary-foreground` | `355.7 100% 97.3%`    | Text on primary background  |
| `--muted`              | `210 40% 96.1%`       | Subtle backgrounds          |
| `--muted-foreground`   | `215.4 16.3% 46.9%`   | Secondary/dimmed text       |
| `--border`             | `214.3 31.8% 91.4%`   | Borders and dividers        |
| `--destructive`        | `0 84.2% 60.2%`       | Error states                |
| `--radius`             | `0.5rem`               | Default border radius       |

Colors are consumed via Tailwind utilities (e.g., `bg-primary`, `text-muted-foreground`, `border-border`). Dark mode class toggling is configured but not yet implemented.

Font: Inter (with system-ui fallback).

---

## 5. Routing

Defined in `src/main.tsx` using `createBrowserRouter`:

| Path       | Component     | Description                        |
|------------|---------------|------------------------------------|
| `/`        | `<Home />`    | Landing page (index route)         |
| `/app`     | `<App />`     | Core application (3-panel layout)  |
| `/support` | `<Support />` | Support/contact information        |
| `/privacy` | `<Privacy />` | Privacy policy                     |
| `/terms`   | `<Terms />`   | Terms of service                   |
| `*`        | `<NotFound />`| 404 catch-all                      |

All routes render inside `<Layout />` which provides the sticky Header and Footer.

GitHub Pages SPA support is handled by a `404.html` that encodes the path into a query parameter, and `index.html` decodes it back via an inline script.

---

## 6. Page Specifications

### 6.1 Home Page (`/`)

**Purpose:** Marketing landing page to introduce EcoNode AI and drive users to the app.

**Sections:**
1. **Hero** — Headline ("Low Cost Actionable Risk Analytics"), subtext about TNFD-ready profiles for SMEs, and two CTAs:
   - "Get Started Free" → links to `/app`
   - "Learn More" → links to `/support`
2. **Features Grid** — 4 cards (Automated Baseline Analysis, TNFD-Ready Reports, Fixable Risk Identification, Self-Serve Upgrades), each with a Lucide icon, title, and description.
3. **CTA Banner** — "Ready to understand your nature risk?" with "Start for Free" button → `/app`.

### 6.2 App Page (`/app`) — 3-Panel Layout

**Purpose:** Core application interface where users send data to a workflow engine, monitor workflow stages, and view analysis results.

**Layout:**
- Full-height below header (`flex-1`)
- 3 equal-width columns via CSS grid (`grid-cols-1 lg:grid-cols-3`)
- Columns separated by border dividers (`divide-x` on desktop, `divide-y` on mobile)
- Each panel has a numbered badge + title header

#### Panel 1 — Input

> Full specification: [input-panel.md](./input-panel.md)

Webhook URL input + JSON body editor + Send button. POSTs to the n8n webhook and activates Panels 2 & 3 on success.

#### Panel 2 — Workflow

> Full specification: [workflow-panel.md](./workflow-panel.md)

Vertical list of 7 stage cards (User Input Validation → Final Output) with live status tracking via Supabase Realtime. Blue pulsing border for running stage, green static border + checkmark for completed. Starts dimmed; activates when Panel 1 succeeds.

#### Panel 3 — Analysis

> Full specification: [analysis-panel.md](./analysis-panel.md)

9 collapsible sub-sections (one per analysis column), each with a ChevronDown toggle, collapsed by default. Receives results via Supabase Realtime + 3s polling fallback. Starts dimmed; activates with Panel 2.

#### State Management

All state is local to the `App` component via `useState`:

| State              | Type                                           | Default                  |
|--------------------|------------------------------------------------|--------------------------|
| `jsonBody`         | `string`                                       | `EXAMPLE_JSON`           |
| `webhookUrl`       | `string`                                       | `DEFAULT_WEBHOOK_URL`    |
| `status`           | `{ type: 'idle'\|'loading'\|'success'\|'error'; message?: string }` | `{ type: 'idle' }` |
| `workflowActive`   | `boolean`                                      | `false`                  |
| `stageStatuses`    | `StageStatus[]`                                | all `'pending'`          |
| `analysisOutput`   | `AnalysisOutput \| null`                       | `null`                   |
| `waitingForOutput` | `boolean`                                      | `false`                  |
| `expandedSections` | `Set<string>`                                  | empty set                |
| `sentAtRef`        | `useRef<string \| null>`                       | `null`                   |

---

## 7. Component Architecture

The codebase follows a flat, minimal structure:

- **`Layout.tsx`** — App shell (Header + Outlet + Footer + ScrollRestoration)
- **`Header.tsx`** — Sticky header with logo link to `/`
- **`Footer.tsx`** — Footer with navigation links and copyright
- **Page components** — Each page is a single self-contained file

**Design decision:** The `App.tsx` page is kept as a single file. Sub-components (InputPanel, WorkflowPanel, AnalysisPanel) should be extracted when the file grows beyond ~200 lines or when panels gain complex internal logic.

---

## 8. External Integrations

### n8n Webhook

- **URL:** `https://n8n.econode.ai/webhook/start` (configurable in the UI)
- **Method:** POST
- **Content-Type:** `application/json`
- **Expected Success Response:** `{ "message": "Workflow was started" }`
- **No authentication** is currently configured (webhook is expected to be open or IP-whitelisted)

---

## 9. Deployment

- **Platform:** GitHub Pages
- **Build:** `tsc -b && vite build` (TypeScript compilation + Vite bundling)
- **SPA Routing:** Handled via `404.html` redirect trick (encodes path to query string, `index.html` decodes it back)
- **Base URL:** `/` (configured in `vite.config.ts`)

---

## 10. Future Roadmap / Prepared Extension Points

| Feature                     | Current State                                   | Next Step                                           |
|-----------------------------|------------------------------------------------|-----------------------------------------------------|
| Workflow stage tracking     | Live via Supabase Realtime + 3s poll fallback   | Fix n8n `requestId` forwarding for multi-user       |
| Analysis output             | Live via Supabase Realtime + 3s poll fallback   | JSON syntax highlighting, copy/download buttons     |
| Dark mode                   | Tailwind `darkMode: ['class']` configured       | Add theme toggle in Header                          |
| Authentication              | None                                            | Add auth layer before `/app` route                  |
| Panel sub-components        | Single `App.tsx` file                           | Extract when complexity warrants it                 |
| Webhook auth                | No auth headers sent                            | Add Bearer token / API key support                  |
| Error retry                 | Manual only (click Send again)                  | Add retry button or auto-retry with backoff         |
| Workflow stage customization| Hardcoded `WORKFLOW_STAGES` array               | Make configurable per workflow/user                 |

---

## 11. Verification Checklist

- [ ] `npm run dev` starts successfully
- [ ] Navigating to `/app` renders the 3-panel layout
- [ ] Panels display side-by-side on desktop (lg breakpoint), stacked on mobile
- [ ] Panel 1: JSON textarea and webhook URL input are editable
- [ ] Panel 1: "Send" button fires a POST request to the webhook URL
- [ ] Panel 1: Invalid JSON shows "Invalid JSON" error
- [ ] Panel 1: Successful response activates Panels 2 and 3 (opacity change)
- [ ] Panel 2: All 7 workflow stage cards are visible with numbering
- [ ] Panel 2: Stage 0 shows blue running border immediately after Send
- [ ] Panel 2: Completed stages show green border + checkmark
- [ ] Panel 3: Shows "Waiting for workflow completion..." placeholder
- [ ] Panel 3: 9 collapsible sub-sections shown after output received (collapsed by default)
- [ ] "Get Started Free" button on Home page navigates to `/app`
- [ ] "Start for Free" CTA on Home page navigates to `/app`
- [ ] All existing routes (`/`, `/support`, `/privacy`, `/terms`) still work
