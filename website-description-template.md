# Website Build Plan: EcoNode

This document outlines the precise plan and specifications for building the webapp. The webapp should include classic landing page attributes such as CTA buttons, SEO optimization, Terms, Privacy, FAQs etc.

```text
APP_NAME = "EcoNode-AI"
```
## 1. Project Specifications
* **App Name**: {{ APP_NAME }}
* **Framework**: React, Vite
* **Language**: TypeScript
* **UI/Styling**: shadcn/ui (and Tailwind CSS)
* **Deployment & CI/CD**: GitHub Actions

    `.github/workflows/deploy.yml`

    ```yaml
    # Simple workflow for deploying static content to GitHub Pages
    name: Deploy static content to Pages

    on:
    # Runs on pushes targeting the default branch
    push:
        branches: ['main']

    # Allows you to run this workflow manually from the Actions tab
    workflow_dispatch:

    # Sets the GITHUB_TOKEN permissions to allow deployment to GitHub Pages
    permissions:
    contents: read
    pages: write
    id-token: write

    # Allow one concurrent deployment
    concurrency:
    group: 'pages'
    cancel-in-progress: true

    jobs:
    # Single deploy job since we're just deploying
    deploy:
        environment:
        name: github-pages
        url: ${{ steps.deployment.outputs.page_url }}
        runs-on: ubuntu-latest
        steps:
        - name: Checkout
            uses: actions/checkout@v5
        - name: Set up Node
            uses: actions/setup-node@v6
            with:
            node-version: lts/*
            cache: 'npm'
        - name: Install dependencies
            run: npm ci
        - name: Build
            run: npm run build
        - name: Setup Pages
            uses: actions/configure-pages@v5
        - name: Upload artifact
            uses: actions/upload-pages-artifact@v4
            with:
            # Upload dist folder
            path: './dist'
        - name: Deploy to GitHub Pages
            id: deployment
            uses: actions/deploy-pages@v4
    ```

## 2. Global Design & Theme Requirements
* **Theme**: [Insert Theme Description, e.g., Minimalist, stark, and distraction-free.]
* **Colors**: [Insert Colors, e.g., High contrast, clean.]
* **Typography**: Clean, sans-serif fonts optimized for absolute clarity (e.g., Inter, Roboto, or SF Pro). 

## 3. Page Structure & Components

### A. Landing / Hero Section
* **Headline**: [Insert Headline]
* **Subheadline**: [Insert Subheadline]
* **Primary Call to Action (CTA)**: A prominent "[Insert CTA Text]" button linking to `/app`.
* **Visual**: [Insert Visual Description]

### B. Core Features Section
* Present the methodology cleanly with feature cards:
  1. **[Feature 1]** — [Description]
  2. **[Feature 2]** — [Description]
  3. **[Feature 3]** — [Description]
  4. **[Feature 4]** — [Description]

### C. Static Boilerplate Pages
* Added via `react-router-dom` to support easy navigation without reloading the app.
* **Support Page**: `/support` - Replaces the direct email link with a dedicated contact page.
* **Privacy Policy**: `/privacy` - Detailed explanation of the privacy approach.
* **Terms of Service**: `/terms` - Standard software license and disclaimer terms.

### D. Global Navigation
* **Header**: A sticky top navigation bar featuring the App's logo and name, linking back to the Home page.
* **Footer**: Contains routing links mapping to the individual Support, Privacy, and Terms of Service pages under a "Resources" column.

## 4. Technical Pitfalls & Setup Notes
* **Shadcn & Tailwind Configuration**: When manually configuring shadcn/ui without utilizing the CLI wizard, the generated Vite `tsconfig.app.json` requires explicit addition of the `@/*` alias utilizing `baseUrl: "."`. Furthermore, the root `tsconfig.json` requires the exact same structural paths array mapping to `./src/*` to correctly resolve `lib/utils` and components.
* **Tailwind Versioning**: Shadcn/ui currently possesses structural dependencies implicitly expecting Tailwind CSS v3. Ensure that `tailwindcss@3` is installed alongside `postcss` and `autoprefixer` instead of automatically upgrading to Tailwind v4, otherwise components.json compilation triggers PostCSS nesting and CSS `@layer` errors. 
* **React Router Dom & Scroll Restoration**: Implementing `<ScrollRestoration />` enforces the usage of the newer React Router v6 Data API. The application must be structured using `createBrowserRouter` and `RouterProvider` with an `<Outlet />` element, as the legacy `<BrowserRouter>` tag does not support scroll restoration hooks.
* **GitHub Pages Deployment Rules**: For projects using `econode` as a slug name, after starting the Vite TypeScript React project, rename `name` in `package.json` to `econode.github.io` and set `base: '/'` in `vite.config.ts` so that it can be seamlessly deployed under `https://econode-ai.github.io`.

## 5. GitHub Actions CI/CD Setup
Define a `.github/workflows/deploy.yml` to automate the deployment process.
* **Trigger**: Push to the `main` branch.
* **Jobs**:
  1. **Checkout**: Fetch the repository code.
  2. **Install**: Set up Node.js and run `npm install`.
  3. **Lint/Type-Check**: Validate the TypeScript code.
  4. **Build**: Run Vite/React build scripts to output static files (`npm run build`).
  5. **Deploy**: Push the built artifacts to the chosen hosting provider (e.g., GitHub Pages, AWS S3, or Vercel).

---

## 6. App Page (`/app`) — App Specifications

### Layout
* **[Insert Layout Specifications]**

### Components
* **[Insert specific components or pane descriptions]**

### Libraries
```text
react-router-dom
[Insert other specific libraries]
```

## 7. Master Prompt for Lovable / AI Builders
*You can copy and paste the following prompt directly into Lovable to generate the site:*

> "Build a modern, highly minimalist single-page landing website for an app called 'EcoNode'.
> 
> Technical constraints: Use React, TypeScript, and shadcn/ui. 
> 
> Design Requirements: The UI must be [Insert Design Requirements]. Follow modern, clean typography.
> 
> Content & Component Requirements:
...
> Ensure the code is production-ready and structured optimally so I can easily add GitHub Actions for CI/CD later."
