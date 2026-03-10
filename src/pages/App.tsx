import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const WORKFLOW_STAGES = [
  'Data Ingestion',
  'Processing',
  'Validation',
  'Transformation',
  'Output Generation',
]

const DEFAULT_WEBHOOK_URL = 'https://n8n.econode.ai/webhook/start'

const EXAMPLE_JSON = `{
  "source": "solar_panel_array_1",
  "readings": [
    { "timestamp": "2026-03-09T10:00:00Z", "kwh": 42.5 }
  ]
}`

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
  { key: 'asset',                label: 'Asset' },
  { key: 'nature_dependency',    label: 'Nature Dependency' },
  { key: 'tnfd_scenario_frame',  label: 'TNFD Scenario Frame' },
  { key: 'financial_impact',     label: 'Financial Impact' },
  { key: 'evidence_synthesis',   label: 'Evidence Synthesis' },
  { key: 'adaptation_strategy',  label: 'Adaptation Strategy' },
  { key: 'stakeholder_narratives', label: 'Stakeholder Narratives' },
  { key: 'evaluation_result',    label: 'Evaluation Result' },
  { key: 'explainability_pack',  label: 'Explainability Pack' },
]

export function App() {
  const [jsonBody, setJsonBody] = useState(EXAMPLE_JSON)
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_WEBHOOK_URL)
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ type: 'idle' })
  const [workflowActive, setWorkflowActive] = useState(false)
  const [currentStage, _setCurrentStage] = useState<number | null>(null)
  const [analysisOutput, setAnalysisOutput] = useState<AnalysisOutput | null>(null)
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
  const [waitingForOutput, setWaitingForOutput] = useState(false)

  // Subscribe to Supabase Realtime whenever a new request is sent
  useEffect(() => {
    if (!currentRequestId) return

    setWaitingForOutput(true)
    setAnalysisOutput(null)

    let settled = false

    function applyRow(row: AnalysisOutput) {
      if (settled) return
      settled = true
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
    }

    // 1. Realtime subscription — catches rows inserted after subscribe() activates.
    //    No server-side filter: filtering on a non-PK column requires REPLICA IDENTITY
    //    FULL; without it the server filter silently drops all events. We match client-side.
    const channel = supabase
      .channel(`output-${currentRequestId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workflow_outputs' },
        (payload) => {
          const row = payload.new as AnalysisOutput & { request_id: string }
          if (row.request_id === currentRequestId) applyRow(row)
        }
      )
      .subscribe()

    // 2. Fallback query — catches rows that were inserted before the subscription
    //    activated (race condition), or while the WebSocket was still connecting
    async function checkExisting() {
      const { data } = await supabase
        .from('workflow_outputs')
        .select('asset,nature_dependency,tnfd_scenario_frame,financial_impact,evidence_synthesis,adaptation_strategy,stakeholder_narratives,evaluation_result,explainability_pack')
        .eq('request_id', currentRequestId)
        .maybeSingle()

      if (data) applyRow(data as AnalysisOutput)
    }
    checkExisting()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentRequestId])

  async function handleSend() {
    setStatus({ type: 'loading' })
    try {
      const parsed = JSON.parse(jsonBody)
      const requestId = crypto.randomUUID()
      setCurrentRequestId(requestId)

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed, requestId }),
      })
      const data = await res.json()
      if (res.ok && data.message === 'Workflow was started') {
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

          <label className="mb-1 text-sm font-medium text-muted-foreground">Webhook URL</label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="mb-4 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />

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
            {WORKFLOW_STAGES.map((stage, i) => (
              <div
                key={stage}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  currentStage === i
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-muted/50 text-muted-foreground'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs font-medium">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{stage}</span>
              </div>
            ))}
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
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
              {ANALYSIS_SECTIONS.map(({ key, label }) => (
                <div key={key} className="rounded-lg border border-border bg-muted/50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm text-foreground">
                    {analysisOutput[key] != null
                      ? JSON.stringify(analysisOutput[key], null, 2)
                      : <span className="text-muted-foreground italic">—</span>
                    }
                  </pre>
                </div>
              ))}
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
