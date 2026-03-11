# Panel 2 — Workflow

## Purpose

The Workflow panel visualizes the sequence of processing stages that run after data is submitted. It provides a clear, step-by-step view of the pipeline.

## UI Elements

| Element         | Details                                                    |
|-----------------|------------------------------------------------------------|
| Stage Cards     | Vertical list of rounded-border cards, one per stage       |
| Stage Badge     | Numbered circle (1-7) on each card                         |
| Activation      | Panel starts at `opacity-40`; becomes `opacity-100` when `workflowActive` is true |

## Workflow Stages

Defined via the `WORKFLOW_STAGES` constant array (top-level in `App.tsx`):

1. User Input Validation
2. Nature Data Extraction
3. Regulatory Analysis
4. LLM Synthesis — Evidence Collection
5. LLM Synthesis — Adaptation Strategies
6. LLM Synthesis — Narrative Generation
7. Final Output

## Stage Card Styling

- **Default:** `border-border bg-muted/50 text-muted-foreground`
- **Active (when `currentStage === index`):** `border-primary bg-primary/10 text-foreground`

Each card contains:
- A numbered circle badge (border + text matching current color)
- The stage name in `text-sm font-medium`

## State Used

| State            | Type            | Default | Description                              |
|------------------|-----------------|---------|------------------------------------------|
| `workflowActive` | `boolean`       | `false` | Controls panel opacity (set by Panel 1)  |
| `currentStage`   | `number \| null` | `null`  | Index of the currently active stage      |

## Future Enhancements

- **Real-time stage tracking:** Connect `currentStage` to live status updates via SSE or polling from the workflow engine
- **Stage completion indicators:** Add checkmarks or progress icons for completed stages
- **Stage customization:** Make `WORKFLOW_STAGES` configurable per workflow or user instead of hardcoded
- **Stage timing:** Show elapsed time per stage

## Verification

- [ ] All 7 workflow stage cards are visible with correct numbering (1-7)
- [ ] Panel is visually dimmed (opacity-40) before workflow starts
- [ ] Panel becomes fully visible (opacity-100) after Panel 1 sends successfully
- [ ] Stage cards render with correct default styling
