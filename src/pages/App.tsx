import { useState } from 'react'

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

export function App() {
  const [jsonBody, setJsonBody] = useState(EXAMPLE_JSON)
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_WEBHOOK_URL)
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ type: 'idle' })
  const [workflowActive, setWorkflowActive] = useState(false)
  const [currentStage, setCurrentStage] = useState<number | null>(null)
  const [analysisOutput, setAnalysisOutput] = useState<string | null>(null)

  async function handleSend() {
    setStatus({ type: 'loading' })
    try {
      const parsed = JSON.parse(jsonBody)
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
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

          <pre className="flex-1 overflow-auto rounded-lg border border-border bg-muted/50 p-4 font-mono text-sm text-muted-foreground">
            {analysisOutput ?? 'Waiting for workflow completion...'}
          </pre>
        </section>
      </div>
    </div>
  )
}
