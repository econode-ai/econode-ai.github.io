import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const WORKFLOW_STAGES = [
  'User Input Validation',
  'Nature Data Extraction',
  'Regulatory Analysis',
  'LLM Synthesis — Evidence Collection',
  'LLM Synthesis — Adaptation Strategies',
  'LLM Synthesis — Narrative Generation',
  'Final Output',
]

const DEFAULT_WEBHOOK_URL = 'https://nmudit.app.n8n.cloud/webhook-test/d626ab46-dfae-4ae8-8dc1-6cac48ca9e07'

const EXAMPLE_JSON = `{
  "source": "solar_panel_array_1",
  "readings": [
    { "timestamp": "2026-03-09T10:00:00Z", "kwh": 42.5 }
  ]
}`

type StageStatus = 'pending' | 'running' | 'completed'

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

const ANALYSIS_SECTIONS: { key: keyof AnalysisOutput; label: string }[] = [
  { key: 'asset',                  label: 'Asset' },
  { key: 'nature_dependency',      label: 'Nature Dependency' },
  { key: 'tnfd_scenario_frame',    label: 'TNFD Scenario Frame' },
  { key: 'financial_impact',       label: 'Financial Impact' },
  { key: 'evidence_synthesis',     label: 'Evidence Synthesis' },
  { key: 'adaptation_strategy',    label: 'Adaptation Strategy' },
  { key: 'stakeholder_narratives', label: 'Stakeholder Narratives' },
  { key: 'evaluation_result',      label: 'Evaluation Result' },
  { key: 'explainability_pack',    label: 'Explainability Pack' },
]

const POLL_INTERVAL_MS = 3000
const PENDING_STAGES: StageStatus[] = WORKFLOW_STAGES.map(() => 'pending')

export function App() {
  const [jsonBody, setJsonBody] = useState(EXAMPLE_JSON)
  const [webhookUrl] = useState(DEFAULT_WEBHOOK_URL)
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ type: 'idle' })
  const [workflowActive, setWorkflowActive] = useState(false)
  const [stageStatuses, setStageStatuses] = useState<StageStatus[]>(PENDING_STAGES)
  const [analysisOutput, setAnalysisOutput] = useState<AnalysisOutput | null>(null)
  const [waitingForOutput, setWaitingForOutput] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  function toggleSection(key: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // ISO timestamp recorded the moment Send succeeds — used to filter for rows
  // newer than this run, regardless of what request_id n8n writes.
  const sentAtRef = useRef<string | null>(null)

  // Advance stage N to completed and mark N+1 as running (additive — never goes backwards)
  function applyStage(stage: number) {
    setStageStatuses(prev => {
      if (prev[stage] === 'completed') return prev // already know about this
      const next = [...prev]
      next[stage] = 'completed'
      if (stage + 1 < WORKFLOW_STAGES.length && next[stage + 1] !== 'completed') {
        next[stage + 1] = 'running'
      }
      return next
    })
  }

  // Apply a batch of completed stage indices (from polling) — additive
  function applyStages(completedNs: number[]) {
    if (completedNs.length === 0) return
    setStageStatuses(prev => {
      const next = [...prev]
      let changed = false
      let maxCompleted = -1
      for (const n of completedNs) {
        if (next[n] !== 'completed') {
          next[n] = 'completed'
          changed = true
        }
        if (n > maxCompleted) maxCompleted = n
      }
      if (!changed) return prev
      const nextRunning = maxCompleted + 1
      if (nextRunning < WORKFLOW_STAGES.length && next[nextRunning] === 'pending') {
        next[nextRunning] = 'running'
      }
      return next
    })
  }

  useEffect(() => {
    if (!workflowActive) return

    // Stage 0 starts running immediately when the workflow is triggered
    setStageStatuses(prev => {
      const next = [...prev] as StageStatus[]
      if (next[0] !== 'completed') next[0] = 'running'
      return next
    })
    setWaitingForOutput(true)
    setAnalysisOutput(null)

    let outputSettled = false
    const sentAt = sentAtRef.current

    function applyOutput(row: AnalysisOutput) {
      if (outputSettled) return
      outputSettled = true
      setAnalysisOutput({
        asset:                  row.asset,
        nature_dependency:      row.nature_dependency,
        tnfd_scenario_frame:    row.tnfd_scenario_frame,
        financial_impact:       row.financial_impact,
        evidence_synthesis:     row.evidence_synthesis,
        adaptation_strategy:    row.adaptation_strategy,
        stakeholder_narratives: row.stakeholder_narratives,
        evaluation_result:      row.evaluation_result,
        explainability_pack:    row.explainability_pack,
      })
      setWaitingForOutput(false)
      // Mark all stages complete when final output arrives
      setStageStatuses(WORKFLOW_STAGES.map(() => 'completed'))
    }

    // --- Realtime: stage progress ---
    const progressChannel = supabase
      .channel('workflow-progress-watch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workflow_progress' },
        (payload) => applyStage((payload.new as { stage: number }).stage)
      )
      .subscribe()

    // --- Realtime: final output ---
    const outputChannel = supabase
      .channel('workflow-output-watch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workflow_outputs' },
        (payload) => applyOutput(payload.new as AnalysisOutput)
      )
      .subscribe()

    // --- Polling fallback every 3 s ---
    const interval = setInterval(async () => {
      // Check stage progress
      let stagesQuery = supabase
        .from('workflow_progress')
        .select('stage')
        .order('stage', { ascending: true })
      if (sentAt) stagesQuery = stagesQuery.gte('created_at', sentAt)
      const { data: stagesData } = await stagesQuery
      if (stagesData && stagesData.length > 0) {
        applyStages(stagesData.map((r: { stage: number }) => r.stage))
      }

      // Check final output
      if (!outputSettled) {
        let outputQuery = supabase
          .from('workflow_outputs')
          .select('asset,nature_dependency,tnfd_scenario_frame,financial_impact,evidence_synthesis,adaptation_strategy,stakeholder_narratives,evaluation_result,explainability_pack')
          .order('created_at', { ascending: false })
          .limit(1)
        if (sentAt) outputQuery = outputQuery.gte('created_at', sentAt)
        const { data: outputData } = await outputQuery.maybeSingle()
        if (outputData) applyOutput(outputData as AnalysisOutput)
      }
    }, POLL_INTERVAL_MS)

    return () => {
      outputSettled = true
      supabase.removeChannel(progressChannel)
      supabase.removeChannel(outputChannel)
      clearInterval(interval)
    }
  }, [workflowActive])

  async function handleSend() {
    setStatus({ type: 'loading' })
    setWorkflowActive(false)
    setStageStatuses(PENDING_STAGES)
    setAnalysisOutput(null)
    try {
      const parsed = JSON.parse(jsonBody)
      const requestId = crypto.randomUUID()

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed, requestId }),
      })
      const data = await res.json()
      if (res.ok && data.message === 'Workflow was started') {
        sentAtRef.current = new Date().toISOString()
        setStatus({ type: 'success', message: 'Workflow started successfully' })
        setWorkflowActive(true)
      } else {
        setStatus({ type: 'error', message: data.message || `Error: ${res.status}` })
      }
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof SyntaxError ? 'Invalid JSON' : String(err) })
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* Panel 1 — Input */}
        <section className="flex flex-col p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
            <h2 className="text-lg font-semibold text-foreground">Input</h2>
          </div>

          <label className="mb-1 text-sm font-medium text-muted-foreground">JSON Body</label>
          <textarea
            value={jsonBody}
            onChange={(e) => setJsonBody(e.target.value)}
            rows={12}
            className="mb-4 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <button
            onClick={handleSend}
            disabled={status.type === 'loading'}
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {status.type === 'loading' ? 'Sending…' : 'Send'}
          </button>

          {status.type === 'success' && (
            <p className="mt-3 text-sm text-green-600">{status.message}</p>
          )}
          {status.type === 'error' && (
            <p className="mt-3 text-sm text-red-600">{status.message}</p>
          )}
        </section>

        {/* Panel 2 — Workflow */}
        <section className={`flex flex-col p-6 transition-opacity ${workflowActive ? 'opacity-100' : 'opacity-40'}`}>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
            <h2 className="text-lg font-semibold text-foreground">Workflow</h2>
          </div>

          <div className="flex flex-col gap-3">
            {WORKFLOW_STAGES.map((stage, i) => {
              const s = stageStatuses[i]
              return (
                <div
                  key={stage}
                  className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 transition-all ${
                    s === 'completed'
                      ? 'border-green-500 bg-green-500/10 text-foreground'
                      : s === 'running'
                      ? 'stage-running border-blue-500 bg-blue-500/5 text-foreground'
                      : 'border-transparent border bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                    s === 'completed'
                      ? 'border-green-500 bg-green-500 text-white'
                      : s === 'running'
                      ? 'border-blue-500 text-blue-500'
                      : 'border-current'
                  }`}>
                    {s === 'completed' ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="text-sm font-medium">{stage}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Panel 3 — Analysis */}
        <section className={`flex flex-col p-6 transition-opacity ${workflowActive ? 'opacity-100' : 'opacity-40'}`}>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
            <h2 className="text-lg font-semibold text-foreground">Analysis Output</h2>
          </div>

          {waitingForOutput ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/50 p-4 text-muted-foreground">
              <span className="relative flex h-6 w-6">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
                <span className="relative inline-flex h-6 w-6 rounded-full bg-primary/70" />
              </span>
              <p className="text-sm font-mono">Waiting for workflow completion...</p>
            </div>
          ) : analysisOutput ? (
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {ANALYSIS_SECTIONS.map(({ key, label }) => {
                const isOpen = expandedSections.has(key)
                return (
                  <div key={key} className="rounded-lg border border-border bg-muted/50">
                    <button
                      onClick={() => toggleSection(key)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {label}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="border-t border-border px-3 pb-3 pt-2">
                        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm text-foreground">
                          {analysisOutput[key] != null
                            ? JSON.stringify(analysisOutput[key], null, 2)
                            : <span className="italic text-muted-foreground">—</span>
                          }
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-muted/50 p-4">
              <p className="font-mono text-sm text-muted-foreground">Waiting for workflow completion...</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
