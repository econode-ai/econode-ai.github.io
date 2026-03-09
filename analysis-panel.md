# Panel 3 — Analysis

## Purpose

The Analysis panel displays the output/results from the workflow engine after processing completes. It receives results in real time via Supabase Realtime, listening for rows inserted by the n8n workflow.

---

## Architecture

```
Browser (Panel 1)                    n8n Workflow                     Browser (Panel 3)
       │                                  │                                  │
       │  POST /webhook/start             │                                  │
       │  { requestId, ...data }  ──────► │                                  │
       │                                  │                                  │
       │  ◄── { message: "Workflow        │                                  │
       │        was started" }            │                                  │
       │                                  │  ... processing stages ...       │
       │                                  │                                  │
       │                                  │  INSERT into workflow_outputs    │
       │                                  │  { request_id, output }  ──────► │  (Supabase Realtime)
       │                                  │                                  │
       │                                  │                                  │  setState(analysisOutput)
```

**Flow:**
1. Panel 1 generates a `requestId` (UUID) and includes it in the POST body
2. n8n workflow carries `requestId` through all stages
3. n8n's final node inserts a row into `workflow_outputs` with the `request_id` and the JSON output
4. Panel 3 is subscribed to Supabase Realtime filtered on `request_id=eq.{requestId}`
5. On receiving the INSERT event, Panel 3 sets `analysisOutput` with the result

---

## Supabase Setup

### Step 1: Create the table

Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query):

```sql
create table public.workflow_outputs (
  id uuid default gen_random_uuid() primary key,
  request_id uuid not null,
  output jsonb not null,
  created_at timestamptz default now() not null
);

-- Index for fast lookups by request_id
create index idx_workflow_outputs_request_id on public.workflow_outputs (request_id);
```

### Step 2: Enable Realtime on the table

```sql
alter publication supabase_realtime add table public.workflow_outputs;
```

You can verify this worked in the Dashboard: go to **Database → Publications → supabase_realtime** and confirm `workflow_outputs` is listed.

### Step 3: Configure Row Level Security (RLS)

RLS is enabled by default on new tables. Add a policy to allow anonymous reads:

```sql
-- Allow anyone with the anon key to SELECT (read-only)
create policy "Allow anonymous read access"
  on public.workflow_outputs
  for select
  to anon
  using (true);

-- Allow the service_role (used by n8n) to INSERT
-- (service_role bypasses RLS by default, so this is not strictly needed,
--  but explicit is better)
create policy "Allow service role insert"
  on public.workflow_outputs
  for insert
  to service_role
  with check (true);
```

### Step 4: Get your keys

From the Supabase Dashboard → **Settings → API**:
- **Project URL**: `https://<your-project-ref>.supabase.co` — used in both n8n and the client
- **anon (public) key**: used in the browser client (safe to expose)
- **service_role key**: used in n8n only (never expose client-side)

---

## n8n Workflow Changes

Two nodes need to be added to your existing n8n workflow.

### Node A: "Set Request ID" (placed right after the Webhook trigger)

This extracts the `requestId` from the incoming webhook body so it's available to later nodes.

- **Node type:** Set
- **Position:** Immediately after the Webhook trigger node
- **Configuration:**
  - Mode: Manual Mapping
  - Assignments:
    - `request_id` (String) = `{{ $json.body.requestId }}` (or `{{ $json.requestId }}` depending on your webhook config)
    - Keep other fields: toggle ON ("Include Other Input Fields")
- **Purpose:** Ensures `request_id` flows through every subsequent node in the workflow

### Node B: "Save Output to Supabase" (placed as the last node, after your final processing node)

- **Node type:** Supabase
- **Position:** Final node in the workflow (after the node that produces the JSON output)
- **Credential setup** (one-time):
  1. In the Supabase node, click **Credential to connect with** → **Create New**
  2. **Host**: `https://<your-project-ref>.supabase.co`
  3. **Service Role Key**: paste your service_role key (from Supabase Dashboard → Settings → API)
  4. Save the credential
- **Configuration:**
  - **Resource:** Row
  - **Operation:** Create
  - **Table Name:** `workflow_outputs`
  - **Columns:**
    - `request_id`: `{{ $('Set Request ID').item.json.request_id }}`
    - `output`: `{{ JSON.stringify($json) }}` (or `{{ $json }}` if the previous node output is already the final result — Supabase will store it as JSONB)

#### n8n workflow summary (node sequence):

```
Webhook Trigger  →  Set Request ID  →  [... existing processing nodes ...]  →  Save Output to Supabase
```

> **Tip:** To test, you can temporarily add a "Respond to Webhook" node right after "Set Request ID" that returns `{ "message": "Workflow was started" }`. This ensures Panel 1 gets the expected response immediately while the rest of the workflow continues.

---

## Client-Side Implementation

### Dependencies

Install the Supabase client:

```bash
npm install @supabase/supabase-js
```

### Supabase client setup

Create `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://<your-project-ref>.supabase.co'
const SUPABASE_ANON_KEY = '<your-anon-key>'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

> Replace the placeholders with your actual values from Supabase Dashboard → Settings → API.

### Changes to `App.tsx`

#### 1. Generate `requestId` in Panel 1 and include it in the POST body

```ts
import { v4 as uuidv4 } from 'uuid'  // or use crypto.randomUUID()

// Inside handleSend(), before the fetch call:
const requestId = crypto.randomUUID()
setCurrentRequestId(requestId)

const res = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...parsed, requestId }),
})
```

New state needed:
```ts
const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
```

#### 2. Subscribe to Supabase Realtime when workflow activates

```ts
import { supabase } from '../lib/supabase'

// Inside a useEffect that reacts to currentRequestId:
useEffect(() => {
  if (!currentRequestId) return

  const channel = supabase
    .channel(`output-${currentRequestId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'workflow_outputs',
        filter: `request_id=eq.${currentRequestId}`,
      },
      (payload) => {
        const output = payload.new.output
        setAnalysisOutput(JSON.stringify(output, null, 2))
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [currentRequestId])
```

#### 3. Display states for Panel 3

The panel shows three possible states:

| `workflowActive` | `analysisOutput` | Display                                    |
|-------------------|------------------|--------------------------------------------|
| `false`           | `null`           | Dimmed panel, placeholder text             |
| `true`            | `null`           | Active panel, "Waiting for workflow..." + spinner |
| `true`            | `string`         | Active panel, formatted JSON output        |

---

## UI Elements

| Element         | Details                                                    |
|-----------------|------------------------------------------------------------|
| Output Area     | `<pre>` block (monospace, scrollable, full-height)         |
| Placeholder     | "Waiting for workflow completion..." when no output        |
| Loading State   | Spinner or pulsing dot while waiting for Realtime event    |
| Activation      | Panel starts at `opacity-40`; becomes `opacity-100` when `workflowActive` is true |

## State Used

| State              | Type             | Default | Description                                      |
|--------------------|------------------|---------|--------------------------------------------------|
| `workflowActive`   | `boolean`        | `false` | Controls panel opacity (set by Panel 1)          |
| `analysisOutput`   | `string \| null` | `null`  | Pretty-printed JSON string; null shows placeholder |
| `currentRequestId` | `string \| null` | `null`  | UUID generated per request; drives the Realtime subscription filter |

## Styling

- Container: `rounded-lg border border-border bg-muted/50 p-4`
- Text: `font-mono text-sm text-muted-foreground`
- Full height within the panel via `flex-1`

---

## Future Enhancements

- **JSON syntax highlighting:** Use a library like `react-json-view` or Prism.js
- **Copy to clipboard:** Button to copy output
- **Download:** Export analysis results as `.json` file
- **Structured view:** Toggle between raw JSON and formatted table/card view
- **Error from workflow:** Handle a `status: 'error'` field in the Supabase row to show workflow failures
- **Timeout:** If no Realtime event arrives within N seconds, show a "Workflow may have failed" message
- **Multi-user:** When concurrent users are expected, enforce `requestId` filtering strictly and consider adding user auth

---

## Verification

- [ ] Supabase table `workflow_outputs` exists with correct schema
- [ ] Realtime is enabled on `workflow_outputs` (listed under `supabase_realtime` publication)
- [ ] RLS policies allow anon SELECT and service_role INSERT
- [ ] n8n workflow has "Set Request ID" node extracting `requestId` from webhook body
- [ ] n8n workflow has "Save Output to Supabase" node as the final step
- [ ] n8n Supabase credential uses the **service_role** key (not anon)
- [ ] Browser client uses the **anon** key (not service_role)
- [ ] Panel 1 generates a UUID and sends it as `requestId` in the POST body
- [ ] Panel 3 subscribes to Realtime filtered on the `requestId`
- [ ] On n8n inserting a row, Panel 3 receives the event and displays the output
- [ ] Supabase channel is cleaned up (unsubscribed) on component unmount or new request
- [ ] Panel is visually dimmed (opacity-40) before workflow starts
- [ ] Panel becomes fully visible (opacity-100) after Panel 1 sends successfully
- [ ] Shows "Waiting for workflow completion..." while waiting for Realtime event
