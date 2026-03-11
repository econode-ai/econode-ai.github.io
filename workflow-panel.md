# Panel 2 — Workflow

## Purpose

The Workflow panel visualizes the sequential stages of the n8n processing pipeline with live status. Each stage card updates in real time as n8n progresses: blue animated border while running, green static border when complete.

---

## Workflow Stages

Defined via `WORKFLOW_STAGES` in `src/pages/App.tsx`:

| # | Stage | n8n inserts `stage:` |
|---|-------|----------------------|
| 1 | User Input Validation        | 0 |
| 2 | Nature Data Extraction       | 1 |
| 3 | Regulatory Analysis          | 2 |
| 4 | LLM Synthesis — Evidence Collection   | 3 |
| 5 | LLM Synthesis — Adaptation Strategies | 4 |
| 6 | LLM Synthesis — Narrative Generation  | 5 |
| 7 | Final Output                 | 6 |

---

## Supabase Table: `workflow_progress`

```sql
create table public.workflow_progress (
  id         uuid        default gen_random_uuid() primary key,
  request_id uuid        not null,
  stage      int         not null,  -- 0-indexed, maps to WORKFLOW_STAGES array
  created_at timestamptz default now() not null
);
alter publication supabase_realtime add table public.workflow_progress;
```

n8n inserts one row per stage at the **end** of that stage's processing node:
- Stage 0 row → inserted when User Input Validation completes
- Stage 1 row → inserted when Nature Data Extraction completes
- … and so on up to stage 6

---

## Stage Status Logic

Each stage has one of three statuses (type `StageStatus = 'pending' | 'running' | 'completed'`).

| Status | Visual | Trigger |
|--------|--------|---------|
| `pending` | Gray border, muted text | Default |
| `running` | Blue border + pulsing glow (`stage-running` CSS class) | Stage N-1 completes, OR workflow starts for stage 0 |
| `completed` | Green border + green background + checkmark badge | Supabase INSERT for that stage arrives |

**Transition rules:**
- On workflow start (`workflowActive = true`): stage 0 → `running`
- On INSERT for stage N: stage N → `completed`, stage N+1 → `running` (if not already completed)
- On final output arriving (`workflow_outputs` INSERT): all stages → `completed`

**Safety:** `applyStage` and `applyStages` are additive — they never move a stage backwards. State updates use the functional form of `setStageStatuses` to avoid stale closure issues.

---

## Data Flow

```
workflowActive = true
       │
       ▼
stage[0] = 'running'   (immediate, no Supabase)
       │
       ▼
n8n inserts { stage: 0 } into workflow_progress
       │
       ├── Realtime INSERT event ──► applyStage(0)
       └── Poll (3s fallback)    ──► applyStages([0])
                                        │
                                        ▼
                               stage[0] = 'completed'
                               stage[1] = 'running'
                                        │
                                       ...
```

---

## Client-Side Implementation

### State

| State | Type | Default | Description |
|-------|------|---------|-------------|
| `stageStatuses` | `StageStatus[]` | all `'pending'` | One entry per stage; drives card styling |
| `workflowActive` | `boolean` | `false` | Set by Panel 1 after n8n acknowledges the POST |

### Key functions

**`applyStage(stage: number)`** — Called per Realtime INSERT. Marks stage N completed and stage N+1 running.

**`applyStages(completedNs: number[])`** — Called from polling. Same logic but handles a batch; additive only.

### Subscriptions (both set up in the same `useEffect` as `workflow_outputs`)

```ts
const progressChannel = supabase
  .channel('workflow-progress-watch')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'workflow_progress' },
    (payload) => applyStage((payload.new as { stage: number }).stage)
  )
  .subscribe()
```

Polling fallback (every 3 s):
```ts
let stagesQuery = supabase
  .from('workflow_progress')
  .select('stage')
  .order('stage', { ascending: true })
if (sentAt) stagesQuery = stagesQuery.gte('created_at', sentAt)
const { data } = await stagesQuery
if (data?.length) applyStages(data.map(r => r.stage))
```

---

## Stage Card Styling

| Status | Card classes | Badge classes |
|--------|-------------|---------------|
| `pending` | `border border-transparent bg-muted/50 text-muted-foreground` | `border-current` |
| `running` | `border-2 border-blue-500 bg-blue-500/5 text-foreground stage-running` | `border-blue-500 text-blue-500` |
| `completed` | `border-2 border-green-500 bg-green-500/10 text-foreground` | `border-green-500 bg-green-500 text-white` + `<Check />` icon |

### `stage-running` CSS (in `src/index.css`)

```css
@keyframes running-border {
  0%, 100% { box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.5); }
  50%       { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15); }
}
.stage-running {
  animation: running-border 1.4s ease-in-out infinite;
}
```

---

## n8n Configuration

After each processing node, add a **Supabase → Row → Create** node:
- **Table:** `workflow_progress`
- **Columns:**
  - `stage`: hardcoded integer (0 for stage 1, 1 for stage 2, … 6 for stage 7)
  - `request_id`: `{{ $('Set Request ID').item.json.request_id }}`

---

## Future Enhancements

- **Stage timestamps:** Show elapsed time next to each completed stage
- **Error state:** Red border if n8n reports a failure at a specific stage
- **Stage customization:** Make `WORKFLOW_STAGES` configurable per workflow type

---

## Verification

- [x] 7 stages defined in `WORKFLOW_STAGES`
- [x] Stage 0 shows blue running border immediately on workflow start
- [x] Realtime subscription on `workflow_progress` (`postgres_changes` INSERT)
- [x] 3 s polling fallback for `workflow_progress`
- [x] `applyStage` / `applyStages` are additive (never go backwards)
- [x] Completed stages show green border + checkmark icon
- [x] Final output arrival marks all stages completed
- [x] `stage-running` CSS animation in `src/index.css`
- [x] Panel dimmed (`opacity-40`) before `workflowActive`
- [ ] n8n has one Supabase insert node per stage with correct `stage` index
