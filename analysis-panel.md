# Panel 3 — Analysis

## Purpose

The Analysis panel displays the output/results from the workflow engine after processing completes. It receives results via Supabase Realtime (primary) and a 3-second polling fallback, triggered by `workflowActive` becoming true.

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
       │                                  │  { request_id, ...columns } ───► │  (Supabase Realtime OR poll)
       │                                  │                                  │
       │                                  │                                  │  setState(analysisOutput)
```

**Flow:**
1. Panel 1 generates a `requestId` (UUID) and includes it in the POST body
2. n8n workflow processes the data and inserts a row into `workflow_outputs`
3. Panel 3 is watching via Realtime (any INSERT) + a 3 s polling fallback
4. Whichever fires first — Realtime or poll — sets `analysisOutput` and stops the other

> **Note on `requestId` matching:** The frontend sends `requestId` to n8n but does **not** currently filter by it when reading from Supabase. Instead it matches by `created_at >= sentAt` (the timestamp when Send was clicked). This is intentional — Supabase Realtime's server-side `filter` only works on primary key columns unless the table has `REPLICA IDENTITY FULL`, and n8n was observed inserting rows without reliably forwarding the `requestId`. When n8n is fixed to forward `requestId` correctly and `REPLICA IDENTITY FULL` is set, the filtering can be tightened.

---

## Supabase Setup

### Table schema (current)

```sql
create table public.workflow_outputs (
  id         uuid        default gen_random_uuid() primary key,
  request_id uuid        not null,
  output     jsonb       not null,
  created_at timestamptz default now() not null,

  -- Analysis columns (jsonb, all nullable)
  asset                  jsonb,
  nature_dependency      jsonb,
  tnfd_scenario_frame    jsonb,
  financial_impact       jsonb,
  evidence_synthesis     jsonb,
  adaptation_strategy    jsonb,
  stakeholder_narratives jsonb,
  evaluation_result      jsonb,
  explainability_pack    jsonb
);

create index idx_workflow_outputs_request_id on public.workflow_outputs (request_id);
```

### Enable Realtime

```sql
alter publication supabase_realtime add table public.workflow_outputs;
```

Verify in Dashboard: **Database → Publications → supabase_realtime** → `workflow_outputs` listed.

### RLS

RLS is currently **disabled** on this table — all users receive all Realtime events. If RLS is enabled in the future, add these policies:

```sql
create policy "Allow anonymous read access"
  on public.workflow_outputs for select to anon using (true);

create policy "Allow service role insert"
  on public.workflow_outputs for insert to service_role with check (true);
```

### Keys

From Supabase Dashboard → **Settings → API**:
- **anon key** → used in the browser client (`src/lib/supabase.ts`)
- **service_role key** → used in n8n only, never client-side

---

## n8n Workflow

### Node A: "Set Request ID" (after Webhook trigger)

- **Type:** Set
- **Assignments:**
  - `request_id` (String) = `{{ $json.body.requestId }}` (or `{{ $json.requestId }}`)
  - Keep other fields: ON
- **Purpose:** Carries `request_id` through the workflow so the final Supabase insert node can use it

### Node B: "Save Output to Supabase" (final node)

- **Type:** Supabase → Row → Create
- **Table:** `workflow_outputs`
- **Columns:** map each analysis column (`asset`, `nature_dependency`, etc.) from the final processing node output, plus `request_id` from Node A

#### Node sequence

```
Webhook Trigger  →  Set Request ID  →  [... processing ...]  →  Save Output to Supabase
```

> **Known issue:** If the n8n "Set Request ID" node is not correctly extracting `requestId` from the POST body, rows will be inserted with a wrong or hardcoded `request_id`. The frontend handles this gracefully via time-based matching (see Client-Side Implementation). Fix the n8n node expression to resolve this for production.

---

## Client-Side Implementation

### Files

| File | Role |
|------|------|
| `src/lib/supabase.ts` | Supabase client singleton |
| `src/pages/App.tsx` | All three panels including analysis |

### `src/lib/supabase.ts`

```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://aetdyzoxwdvycjcpaeho.supabase.co',
  '<anon-key>'
)
```

### State

| State            | Type                   | Default | Description |
|------------------|------------------------|---------|-------------|
| `workflowActive` | `boolean`              | `false` | Set to `true` when n8n acknowledges the POST; triggers the Realtime+poll effect |
| `analysisOutput` | `AnalysisOutput\|null` | `null`  | Object with one key per analysis column; `null` shows placeholder |
| `waitingForOutput` | `boolean`            | `false` | `true` between workflow start and first row received; shows spinner |
| `sentAtRef`      | `useRef<string\|null>` | `null`  | ISO timestamp recorded when Send succeeds; used as `created_at` lower bound in the poll query |

### `AnalysisOutput` type

```ts
type AnalysisOutput = {
  asset: unknown
  nature_dependency: unknown
  tnfd_scenario_frame: unknown
  financial_impact: unknown
  evidence_synthesis: unknown
  adaptation_strategy: unknown
  stakeholder_narratives: unknown
  evaluation_result: unknown
  explainability_pack: unknown
}
```

### Realtime + polling effect

Triggered by `workflowActive` becoming `true`. Uses a `settled` flag so only the first result (Realtime or poll) applies.

```ts
useEffect(() => {
  if (!workflowActive) return

  setWaitingForOutput(true)
  setAnalysisOutput(null)
  let settled = false

  function applyRow(row: AnalysisOutput) {
    if (settled) return
    settled = true
    setAnalysisOutput({ ...row })
    setWaitingForOutput(false)
  }

  // Primary: Realtime — any INSERT on the table
  const channel = supabase
    .channel('workflow-output-watch')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'workflow_outputs' },
      (payload) => applyRow(payload.new as AnalysisOutput)
    )
    .subscribe()

  // Fallback: poll every 3 s for the newest row since Send was clicked
  const sentAt = sentAtRef.current
  const interval = setInterval(async () => {
    const query = supabase
      .from('workflow_outputs')
      .select('asset,nature_dependency,...')
      .order('created_at', { ascending: false })
      .limit(1)
    if (sentAt) query.gte('created_at', sentAt)
    const { data } = await query.maybeSingle()
    if (data) applyRow(data as AnalysisOutput)
  }, 3000)

  return () => {
    settled = true
    supabase.removeChannel(channel)
    clearInterval(interval)
  }
}, [workflowActive])
```

### POST body (Panel 1 → n8n)

```ts
const requestId = crypto.randomUUID()
// sentAtRef.current = new Date().toISOString()  ← set after successful response
body: JSON.stringify({ ...parsed, requestId })
```

---

## UI Elements

| Element       | Details |
|---------------|---------|
| Output area   | 9 labeled cards, one per analysis column, each with a `<pre>` block |
| Placeholder   | Centered "Waiting for workflow completion..." before workflow starts |
| Loading state | Pulsing green dot + text while `waitingForOutput` is true |
| Opacity       | `opacity-40` before `workflowActive`; `opacity-100` after |
| Null fields   | Columns with no data render an italic `—` instead of blank |

---

## Known Issues & Future Work

- **`requestId` not forwarded by n8n:** n8n currently inserts rows without reliably using the `requestId` sent by the frontend. The frontend works around this via `created_at >= sentAt` filtering. Fix the n8n "Set Request ID" node expression to wire this up properly for multi-user production use.
- **`REPLICA IDENTITY FULL` for server-side Realtime filter:** To re-enable server-side filtering (more efficient at scale), run `ALTER TABLE public.workflow_outputs REPLICA IDENTITY FULL;` and add `filter: \`request_id=eq.${requestId}\`` back to the `postgres_changes` subscription.
- **JSON syntax highlighting:** `react-json-view` or Prism.js
- **Copy to clipboard / Download as `.json`**
- **Error handling:** Surface a `status: 'error'` field from the workflow row
- **Timeout UX:** Show "Workflow may have failed" if no result arrives within N seconds

---

## Verification

- [x] Supabase table `workflow_outputs` exists with 9 analysis columns (jsonb)
- [x] Realtime enabled on `workflow_outputs` (in `supabase_realtime` publication)
- [x] `@supabase/supabase-js` installed; client in `src/lib/supabase.ts`
- [x] Panel 3 subscribes to Realtime on `workflowActive` (no server-side filter)
- [x] 3 s polling fallback queries newest row by `created_at`
- [x] `settled` flag prevents double-apply from Realtime + poll
- [x] Channel and interval cleaned up on effect teardown
- [x] Panel dimmed (`opacity-40`) before workflow starts
- [x] Spinner shown while `waitingForOutput`
- [x] 9 sub-sections rendered, one per analysis column
- [ ] n8n "Set Request ID" node correctly forwards `requestId` from POST body
- [ ] `REPLICA IDENTITY FULL` set (optional — enables server-side Realtime filter)
