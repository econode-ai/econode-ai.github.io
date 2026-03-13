import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button, ConfigProvider, Form, InputNumber, Select, Segmented } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'

const WORKFLOW_STAGES = [
  'User Input Validation',
  'Nature Data Extraction',
  'Regulatory Analysis',
  'LLM Synthesis — Evidence Collection',
  'LLM Synthesis — Adaptation Strategies',
  'LLM Synthesis — Narrative Generation',
  'Final Output',
]

const DEFAULT_WEBHOOK_URL = 'https://nmudit.app.n8n.cloud/webhook/d626ab46-dfae-4ae8-8dc1-6cac48ca9e07'

// Full payload — always sent as-is; form is display only
const EXAMPLE_JSON_DATA = [
  {
    "asset_id": "ASSET_001",
    "lat": 51.965,
    "lon": 4.485,
    "value_eur": 42000000,
    "nace_code": "C25",
    "asset_type": "manufacturing_site",
    "sector": "Manufacturing",
    "country": "NL",
    "operational_status": "operating",
    "ownership_type": "owned",
    "value_chain_position": "own_operations",
    "energy_intensity": "high",
    "primary_energy_source": "electricity",
    "water_dependency": "high",
    "water_source_type": "groundwater",
    "land_use_type": "industrial",
    "emissions_profile": "high",
    "pollution_risk": "air",
    "hazardous_materials": "unknown",
    "near_protected_area": "no",
    "ecosystem_type": "urban",
    "nature_dependency_type": "water",
    "labour_intensity": "medium",
    "local_community_presence": "yes",
    "health_safety_risk": "medium",
    "insurance_coverage": "partial",
    "capex_lock_in_years": "long",
    "adaptation_measures_present": "no",
    "revenue_critical_asset": "yes",
    "data_source": "hybrid",
    "estimation_method": "sector_benchmark + GIS_overlay",
    "data_confidence": 0.72,
    "last_updated": "2025-03-01"
  },
  {
    "asset_id": "ASSET_002",
    "lat": 48.8566,
    "lon": 2.3522,
    "value_eur": 18000000,
    "nace_code": "L68",
    "asset_type": "office_building",
    "sector": "Real Estate",
    "country": "FR",
    "operational_status": "operating",
    "ownership_type": "leased",
    "value_chain_position": "downstream",
    "energy_intensity": "medium",
    "primary_energy_source": "electricity",
    "water_dependency": "low",
    "water_source_type": "municipal",
    "land_use_type": "urban",
    "emissions_profile": "low",
    "pollution_risk": "none",
    "hazardous_materials": "no",
    "near_protected_area": "no",
    "ecosystem_type": "urban",
    "nature_dependency_type": "none",
    "labour_intensity": "low",
    "local_community_presence": "yes",
    "health_safety_risk": "low",
    "insurance_coverage": "yes",
    "capex_lock_in_years": "medium",
    "adaptation_measures_present": "planned",
    "revenue_critical_asset": "no",
    "data_source": "hybrid",
    "estimation_method": "client_input + sector_defaults",
    "data_confidence": 0.85,
    "last_updated": "2025-03-01"
  }
]

const ASSET_TYPE_OPTIONS = [
  { value: 'manufacturing_site', label: 'Manufacturing Site' },
  { value: 'office_building', label: 'Office Building' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'retail_store', label: 'Retail Store' },
  { value: 'data_center', label: 'Data Center' },
  { value: 'other', label: 'Other' },
]

// Convert snake_case key to Title Case label
function toLabel(key: string) {
  return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

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
  { key: 'asset', label: 'Asset' },
  { key: 'nature_dependency', label: 'Nature Dependency' },
  { key: 'tnfd_scenario_frame', label: 'TNFD Scenario Frame' },
  { key: 'financial_impact', label: 'Financial Impact' },
  { key: 'evidence_synthesis', label: 'Evidence Synthesis' },
  { key: 'adaptation_strategy', label: 'Adaptation Strategy' },
  { key: 'stakeholder_narratives', label: 'Stakeholder Narratives' },
  { key: 'evaluation_result', label: 'Evaluation Result' },
  { key: 'explainability_pack', label: 'Explainability Pack' },
]

const POLL_INTERVAL_MS = 3000
const PENDING_STAGES: StageStatus[] = WORKFLOW_STAGES.map(() => 'pending')

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota full */ }
}

type PanelId = 1 | 2 | 3

const PANEL_LABELS: Record<PanelId, string> = {
  1: 'Input',
  2: 'Workflow',
  3: 'Analysis Output',
}

// Initial form values — one entry per example asset, only the displayed fields
const INITIAL_ASSETS = EXAMPLE_JSON_DATA.map(a => ({
  lat: a.lat,
  lon: a.lon,
  value_eur: a.value_eur,
  asset_type: a.asset_type,
  ecosystem_type: a.ecosystem_type === 'urban' ? 'Urban' : 'Rural',
}))

export function App() {
  const [form] = Form.useForm()
  const [assetCount, setAssetCount] = useState(EXAMPLE_JSON_DATA.length)

  const [webhookUrl] = useState(DEFAULT_WEBHOOK_URL)
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ type: 'idle' })
  const [workflowActive, setWorkflowActive] = useState(
    () => lsGet<boolean>('econode_workflow_active', false)
  )
  const [stageStatuses, setStageStatuses] = useState<StageStatus[]>(
    () => lsGet<StageStatus[]>('econode_stage_statuses', PENDING_STAGES)
  )
  const [analysisOutput, setAnalysisOutput] = useState<AnalysisOutput | null>(
    () => lsGet<AnalysisOutput | null>('econode_analysis_output', null)
  )
  const [waitingForOutput, setWaitingForOutput] = useState(
    () => lsGet<boolean>('econode_workflow_active', false) && !lsGet<AnalysisOutput | null>('econode_analysis_output', null)
  )
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(lsGet<string[]>('econode_expanded_sections', []))
  )
  const [activePanel, setActivePanel] = useState<PanelId>(
    () => lsGet<PanelId>('econode_active_panel', 1)
  )

  // Persist to localStorage whenever these values change
  useEffect(() => { lsSet('econode_analysis_output', analysisOutput) }, [analysisOutput])
  useEffect(() => { lsSet('econode_stage_statuses', stageStatuses) }, [stageStatuses])
  useEffect(() => { lsSet('econode_expanded_sections', Array.from(expandedSections)) }, [expandedSections])
  useEffect(() => { lsSet('econode_active_panel', activePanel) }, [activePanel])
  useEffect(() => { lsSet('econode_workflow_active', workflowActive) }, [workflowActive])

  function toggleSection(key: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const sentAtRef = useRef<string | null>(lsGet<string | null>('econode_sent_at', null))

  function applyStage(stage: number) {
    setStageStatuses(prev => {
      if (prev[stage] === 'completed') return prev
      const next = [...prev]
      next[stage] = 'completed'
      if (stage + 1 < WORKFLOW_STAGES.length && next[stage + 1] !== 'completed') {
        next[stage + 1] = 'running'
      }
      return next
    })
  }

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
        asset: row.asset,
        nature_dependency: row.nature_dependency,
        tnfd_scenario_frame: row.tnfd_scenario_frame,
        financial_impact: row.financial_impact,
        evidence_synthesis: row.evidence_synthesis,
        adaptation_strategy: row.adaptation_strategy,
        stakeholder_narratives: row.stakeholder_narratives,
        evaluation_result: row.evaluation_result,
        explainability_pack: row.explainability_pack,
      })
      setWaitingForOutput(false)
      setStageStatuses(WORKFLOW_STAGES.map(() => 'completed'))
      setWorkflowActive(false)  // stops re-polling on next refresh
      setActivePanel(3)
    }

    const progressChannel = supabase
      .channel('workflow-progress-watch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workflow_progress' },
        (payload) => applyStage((payload.new as { stage: number }).stage)
      )
      .subscribe()

    const outputChannel = supabase
      .channel('workflow-output-watch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workflow_outputs' },
        (payload) => applyOutput(payload.new as AnalysisOutput)
      )
      .subscribe()

    const interval = setInterval(async () => {
      let stagesQuery = supabase
        .from('workflow_progress')
        .select('stage')
        .order('stage', { ascending: true })
      if (sentAt) stagesQuery = stagesQuery.gte('created_at', sentAt)
      const { data: stagesData } = await stagesQuery
      if (stagesData && stagesData.length > 0) {
        applyStages(stagesData.map((r: { stage: number }) => r.stage))
      }

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
    // Validate form first
    await form.validateFields()

    setStatus({ type: 'loading' })
    setWorkflowActive(false)
    setStageStatuses(PENDING_STAGES)
    setAnalysisOutput(null)
    sentAtRef.current = null
    lsSet('econode_sent_at', null)

    try {
      const requestId = crypto.randomUUID()
      // Send slice of example data based on how many assets are in the form
      const payload = EXAMPLE_JSON_DATA.slice(0, Math.min(assetCount, EXAMPLE_JSON_DATA.length))

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.map(a => ({ ...a, requestId }))),
      })
      const data = await res.json()
      if (res.ok && data.message === 'Workflow was started') {
        sentAtRef.current = new Date().toISOString()
        lsSet('econode_sent_at', sentAtRef.current)
        setStatus({ type: 'success', message: 'Workflow started successfully' })
        setWorkflowActive(true)
        setActivePanel(2)
      } else {
        setStatus({ type: 'error', message: data.message || `Error: ${res.status}` })
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return // validation error, stay on form
      setStatus({ type: 'error', message: err instanceof SyntaxError ? 'Invalid JSON' : String(err) })
    }
  }

  const panel1Disabled = workflowActive && !analysisOutput

  function CollapsedStrip({ id }: { id: PanelId }) {
    return (
      <div
        onClick={() => setActivePanel(id)}
        className="flex w-12 shrink-0 cursor-pointer flex-col items-center gap-3 border-border py-5 transition-colors hover:bg-muted/40 first:border-r last:border-l [&:not(:first-child):not(:last-child)]:border-x"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/80 text-xs font-bold text-primary-foreground">
          {id}
        </span>
        <span className="[writing-mode:vertical-lr] rotate-180 text-xs font-medium text-muted-foreground tracking-wide">
          {PANEL_LABELS[id]}
        </span>
        <ChevronRight className="mt-auto h-4 w-4 text-muted-foreground" />
      </div>
    )
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#22c55e',
          borderRadius: 6,
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontSize: 13,
        },
      }}
    >
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 divide-x divide-border overflow-hidden">

          {/* Panel 1 — Input */}
          {activePanel === 1 ? (
            <section className="flex flex-1 flex-col p-6 min-w-0 overflow-y-auto">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                <h2 className="text-lg font-semibold text-foreground flex-1">Input</h2>
                <button
                  onClick={() => setActivePanel(2)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
                  title="Collapse panel"
                >
                  <ChevronDown className="h-4 w-4 rotate-90" />
                </button>
              </div>

              <Form
                form={form}
                layout="vertical"
                initialValues={{ assets: INITIAL_ASSETS }}
                disabled={panel1Disabled}
                size="small"
              >
                <Form.List name="assets">
                  {(fields, { add, remove }) => {
                    // Keep assetCount in sync
                    if (fields.length !== assetCount) setAssetCount(fields.length)
                    return (
                      <div className="grid grid-cols-2 gap-4">
                        {fields.map((field, index) => (
                          <div
                            key={field.key}
                            className="rounded-lg border border-border bg-muted/30 p-4"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Asset {index + 1}
                              </span>
                              {fields.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => remove(field.name)}
                                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <DeleteOutlined />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                              {/* Lat */}
                              <Form.Item
                                name={[field.name, 'lat']}
                                label={<span className="text-xs text-muted-foreground">{toLabel('lat')}</span>}
                                rules={[
                                  { required: true, message: 'Required' },
                                  { type: 'number', min: -90, max: 90, message: '-90 to 90' },
                                ]}
                              >
                                <InputNumber
                                  className="w-full"
                                  step={0.001}
                                  placeholder="e.g. 51.965"
                                />
                              </Form.Item>

                              {/* Lon */}
                              <Form.Item
                                name={[field.name, 'lon']}
                                label={<span className="text-xs text-muted-foreground">{toLabel('lon')}</span>}
                                rules={[
                                  { required: true, message: 'Required' },
                                  { type: 'number', min: -180, max: 180, message: '-180 to 180' },
                                ]}
                              >
                                <InputNumber
                                  className="w-full"
                                  step={0.001}
                                  placeholder="e.g. 4.485"
                                />
                              </Form.Item>

                              {/* Value EUR */}
                              <Form.Item
                                name={[field.name, 'value_eur']}
                                label={<span className="text-xs text-muted-foreground">{toLabel('value_eur')}</span>}
                                rules={[
                                  { required: true, message: 'Required' },
                                  { type: 'number', min: 1, message: 'Must be positive' },
                                ]}
                                className="col-span-2"
                              >
                                <InputNumber
                                  className="w-full"
                                  formatter={v => `€ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                  parser={v => v!.replace(/€\s?|(,*)/g, '') as unknown as number}
                                  placeholder="e.g. 42000000"
                                />
                              </Form.Item>

                              {/* Asset Type */}
                              <Form.Item
                                name={[field.name, 'asset_type']}
                                label={<span className="text-xs text-muted-foreground">{toLabel('asset_type')}</span>}
                                rules={[{ required: true, message: 'Required' }]}
                                className="col-span-2"
                              >
                                <Select
                                  options={ASSET_TYPE_OPTIONS}
                                  placeholder="Select asset type"
                                />
                              </Form.Item>

                              {/* Ecosystem Type */}
                              <Form.Item
                                name={[field.name, 'ecosystem_type']}
                                label={<span className="text-xs text-muted-foreground">{toLabel('ecosystem_type')}</span>}
                                rules={[{ required: true, message: 'Required' }]}
                                className="col-span-2"
                              >
                                <Segmented
                                  options={['Urban', 'Rural']}
                                  block
                                />
                              </Form.Item>
                            </div>
                          </div>
                        ))}

                        <div className="col-span-2">
                          <Button
                            type="dashed"
                            onClick={() => add({ ...INITIAL_ASSETS[0] })}
                            icon={<PlusOutlined />}
                            block
                            disabled={panel1Disabled}
                          >
                            Add Asset
                          </Button>
                        </div>
                      </div>
                    )
                  }}
                </Form.List>
              </Form>

              <div className="mt-4">
                <button
                  onClick={handleSend}
                  disabled={status.type === 'loading' || panel1Disabled || assetCount === 0}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status.type === 'loading' ? 'Submitting…' : 'Submit'}
                </button>

                {status.type === 'success' && (
                  <p className="mt-3 text-sm text-green-600">{status.message}</p>
                )}
                {status.type === 'error' && (
                  <p className="mt-3 text-sm text-red-600">{status.message}</p>
                )}
              </div>
            </section>
          ) : (
            <CollapsedStrip id={1} />
          )}

          {/* Panel 2 — Workflow */}
          {activePanel === 2 ? (
            <section className={`flex flex-1 flex-col p-6 min-w-0 transition-opacity ${workflowActive ? 'opacity-100' : 'opacity-40'}`}>
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                <h2 className="text-lg font-semibold text-foreground flex-1">Workflow</h2>
                <button
                  onClick={() => setActivePanel(1)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
                  title="Collapse panel"
                >
                  <ChevronDown className="h-4 w-4 rotate-90" />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {WORKFLOW_STAGES.map((stage, i) => {
                  const s = stageStatuses[i]
                  return (
                    <div
                      key={stage}
                      className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 transition-all ${s === 'completed'
                        ? 'border-green-500 bg-green-500/10 text-foreground'
                        : s === 'running'
                          ? 'stage-running border-blue-500 bg-blue-500/5 text-foreground'
                          : 'border-transparent border bg-muted/50 text-muted-foreground'
                        }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${s === 'completed'
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
          ) : (
            <CollapsedStrip id={2} />
          )}

          {/* Panel 3 — Analysis */}
          {activePanel === 3 ? (
            <section className={`flex flex-1 flex-col p-6 min-w-0 transition-opacity ${workflowActive ? 'opacity-100' : 'opacity-40'}`}>
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                <h2 className="text-lg font-semibold text-foreground flex-1">Analysis Output</h2>
                <button
                  onClick={() => setActivePanel(2)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
                  title="Collapse panel"
                >
                  <ChevronDown className="h-4 w-4 rotate-90" />
                </button>
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
          ) : (
            <CollapsedStrip id={3} />
          )}

        </div>
      </div>
    </ConfigProvider>
  )
}
