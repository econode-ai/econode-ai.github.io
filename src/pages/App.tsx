import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button, ConfigProvider, Form, InputNumber, Modal, Select, Segmented } from 'antd'
import { DeleteOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { generatePdf } from '@/lib/generatePdf'

const WORKFLOW_STAGES = [
  'User Input Validation',
  'Nature Data Extraction',
  'Regulatory Analysis',
  'LLM Synthesis — Evidence Collection',
  'LLM Synthesis — Adaptation Strategies',
  'LLM Synthesis — Narrative Generation',
  'Final Output',
]

const DEFAULT_WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || 'https://nmudit.app.n8n.cloud/webhook/d626ab46-dfae-4ae8-8dc1-6cac48ca9e07'

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
  // { key: 'nature_dependency', label: 'Nature Dependency' },
  // { key: 'financial_impact', label: 'Financial Impact' },
  // { key: 'stakeholder_narratives', label: 'Stakeholder Narratives' },
  // { key: 'adaptation_strategy', label: 'Adaptation Strategy' },
  { key: 'tnfd_scenario_frame', label: 'TNFD Scenario Frame' },
  { key: 'evidence_synthesis', label: 'Evidence Synthesis' },
  { key: 'evaluation_result', label: 'Evaluation Result' },
  { key: 'explainability_pack', label: 'Explainability Pack' },
  { key: 'asset', label: 'Asset' },
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

// ─── Executive Summary ────────────────────────────────────────────────────────

/** Replace first-person possessive with impersonal third-person for display. */
function impersonal(text: string): string {
  return text
    .replace(/\bOur\b/g, 'The')
    .replace(/\bour\b/g, 'the')
    .replace(/\bWe\b/g, 'The organisation')
    .replace(/\bwe\b/g, 'the organisation')
}

function KpiCard({
  value,
  label,
  barPercent,
  barColorClass,
}: {
  value: string
  label: string
  barPercent?: number      // 0–100; omit for no bar
  barColorClass?: string   // Tailwind bg-* class for the filled portion
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-white px-4 py-4 text-center shadow-sm">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {barPercent != null && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
          <div
            className={`h-1.5 rounded-full ${barColorClass ?? 'bg-blue-400'}`}
            style={{ width: `${Math.min(100, Math.max(0, barPercent))}%` }}
          />
        </div>
      )}
      <div className="mt-1.5 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function ExecutiveSummaryCard({ data }: { data: AnalysisOutput }) {
  const fi = data.financial_impact as Record<string, any> | null
  const tnfd = data.tnfd_scenario_frame as Record<string, any> | null
  const evalResult = data.evaluation_result as Record<string, any> | null
  const narratives = data.stakeholder_narratives as Record<string, any> | null
  const execSummary = narratives?.executive_summary as Record<string, any> | undefined

  const severeMid: number | undefined = fi?.headline?.severe_exposure_range?.mid
  const exposureLabel = severeMid != null ? `€${(severeMid / 1e6).toFixed(1)}M` : '—'

  const physicalScore: number | undefined = tnfd?.physical_axis_detail?.score
  const transitionScore: number | undefined = tnfd?.transition_axis_detail?.score

  const qualityScore: number | undefined = evalResult?.overall_score

  const narrative: string = impersonal(execSummary?.narrative ?? '')
  const riskLevel: string = execSummary?.risk_rating?.level ?? '—'
  const riskTrend: string = execSummary?.risk_rating?.trend ?? '—'
  const riskConfidence: string = execSummary?.risk_rating?.confidence ?? '—'
  const strategicImperative: string = impersonal(execSummary?.strategic_imperative ?? '')
  const rawRecommendedAction: string = execSummary?.recommended_board_action ?? ''
  // Supplement with the investment amount from CFO brief when not already present in the action text
  const proposedInvestment: string = narratives?.cfo_brief?.investment_case?.proposed_investment ?? ''
  const recommendedAction: string = impersonal(
    rawRecommendedAction && proposedInvestment && !rawRecommendedAction.includes('€')
      ? rawRecommendedAction.replace(/\.$/, '') + ` — proposed investment: ${proposedInvestment}.`
      : rawRecommendedAction
  )

  const [open, setOpen] = useState(true)

  return (
    <div id="exec-summary-card" className="mb-4 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      {/* Gradient accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500" />
      <div
        className="flex cursor-pointer select-none items-center justify-between px-6 py-4"
        onClick={() => setOpen(o => !o)}
      >
        <h2 className="text-xl font-bold text-foreground">Executive Summary</h2>
        {open ? <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
      </div>
      {open && (
        <div className="px-6 pb-6">

          {/* KPI row */}
          <div className="mb-5 grid grid-cols-4 gap-3">
            {/* Exposure — currency value, no score bar */}
            <KpiCard value={exposureLabel} label="Severe Exposure (Mid)" />

            {/* Physical Risk — higher score = more risk → red bar */}
            <KpiCard
              value={physicalScore != null ? physicalScore.toFixed(2) : '—'}
              label="Physical Risk Score"
              barPercent={physicalScore != null ? physicalScore * 100 : undefined}
              barColorClass="bg-gradient-to-r from-orange-400 to-red-500"
            />

            {/* Transition Score — higher = more alignment (neutral/positive) → blue bar */}
            <KpiCard
              value={transitionScore != null ? transitionScore.toFixed(2) : '—'}
              label="Transition Score"
              barPercent={transitionScore != null ? transitionScore * 100 : undefined}
              barColorClass="bg-gradient-to-r from-sky-400 to-blue-500"
            />

            {/* Quality Score — higher = better → green bar */}
            <KpiCard
              value={qualityScore != null ? `${qualityScore}/100` : '—'}
              label="Quality Score"
              barPercent={qualityScore}
              barColorClass="bg-gradient-to-r from-emerald-400 to-green-500"
            />
          </div>

          {/* Narrative */}
          {narrative && (
            <p className="mb-4 text-sm leading-relaxed text-foreground">{narrative}</p>
          )}

          {/* Risk rating box */}
          <div className="mb-4 rounded border border-amber-400 bg-amber-50 px-4 py-2.5">
            <span className="text-sm">
              <span className="font-semibold text-foreground">Risk Rating:&nbsp;</span>
              <span className="font-semibold text-amber-700">{riskLevel}</span>
              <span className="mx-3 text-amber-300">|</span>
              <span className="font-semibold text-foreground">Trend:&nbsp;</span>
              <span className="font-semibold text-amber-700">{riskTrend}</span>
              <span className="mx-3 text-amber-300">|</span>
              <span className="font-semibold text-foreground">Confidence:&nbsp;</span>
              <span className="font-semibold text-amber-700">{riskConfidence}</span>
            </span>
          </div>

          {strategicImperative && (
            <div className="mb-3 rounded border border-orange-400 bg-orange-50 px-4 py-2.5">
              <span className="text-sm font-semibold text-foreground">Strategic Imperative:&nbsp;</span>
              <span className="text-sm text-orange-800">{strategicImperative}</span>
            </div>
          )}
          {recommendedAction && (
            <div className="rounded border border-emerald-400 bg-emerald-50 px-4 py-2.5">
              <span className="text-sm font-semibold text-foreground">Recommended Board Action:&nbsp;</span>
              <span className="text-sm text-emerald-800">{recommendedAction}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Nature Dependency ────────────────────────────────────────────────────────

function strengthColor(strength: string): string {
  switch (strength?.toLowerCase()) {
    case 'high': return 'text-red-600 font-semibold'
    case 'medium': return 'text-orange-500 font-semibold'
    case 'low': return 'text-green-600 font-semibold'
    default: return 'text-foreground'
  }
}

function NatureDependencyCard({ data }: { data: AnalysisOutput }) {
  const nd = data.nature_dependency as Record<string, any> | null
  if (!nd) return null

  const dependencies: any[] = nd.dependencies ?? []
  const dependencyCount: number = nd.dependency_count ?? dependencies.length
  const sector: string = nd.sector ?? ''
  const derivationMethod: string = nd.derivation?.method ?? ''
  const sensitivityFlag: string = nd.sensitivity_flag ?? '—'
  const envCtx = nd.environmental_context as Record<string, any> | undefined

  const [open, setOpen] = useState(true)

  return (
    <div id="nature-dependency-card" className="mb-4 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-green-400" />
      <div
        className="flex cursor-pointer select-none items-center justify-between px-6 py-4"
        onClick={() => setOpen(o => !o)}
      >
        <h2 className="text-xl font-bold text-foreground">Nature Dependencies</h2>
        {open ? <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
      </div>
      {open && (
        <div className="px-6 pb-6">

          {/* Summary sentence */}
          <p className="mb-5 text-sm leading-relaxed text-foreground">
            This analysis identified{' '}
            <span className="font-semibold">{dependencyCount} ecosystem service dependencies</span>{' '}
            for the {sector.toLowerCase()} sector, derived using {derivationMethod}. Overall sensitivity flag:{' '}
            <span className="font-semibold">{sensitivityFlag}</span>.
            {envCtx?.biome && (
              <span> Biome: <span className="font-medium">{envCtx.biome}</span>
                {envCtx.water_stress_level && <span> · Water stress: <span className="font-medium">{envCtx.water_stress_level}</span></span>}
              </span>
            )}
          </p>

          {/* Dependencies table */}
          {dependencies.length > 0 && (
            <div className="mb-6 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700 text-white">
                    <th className="px-3 py-2.5 text-left font-semibold">Ecosystem Service</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Category</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Strength</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Type</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Substitutability</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Time to Failure</th>
                  </tr>
                </thead>
                <tbody>
                  {dependencies.map((dep, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-3 py-2.5 font-medium text-foreground">{dep.ecosystem_service}</td>
                      <td className="px-3 py-2.5 text-foreground">{dep.category}</td>
                      <td className={`px-3 py-2.5 ${strengthColor(dep.dependency_strength)}`}>{dep.dependency_strength}</td>
                      <td className="px-3 py-2.5 text-foreground">{dep.dependency_type}</td>
                      <td className="px-3 py-2.5 text-foreground">{dep.substitutability}</td>
                      <td className="px-3 py-2.5 text-foreground">{dep.time_to_failure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Dependency rationales */}
          <div>
            <h3 className="mb-3 text-base font-bold text-foreground">Dependency Rationales</h3>
            <div className="flex flex-col gap-1.5">
              {dependencies.map((dep, i) => (
                <p key={i} className="text-sm text-foreground">
                  <span className="font-semibold">{dep.ecosystem_service}:&nbsp;</span>
                  {dep.rationale}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const PANEL_LABELS: Record<PanelId, string> = {
  1: 'Input',
  2: 'Workflow',
  3: 'Analysis Output',
}

// ─── Financial Impact ─────────────────────────────────────────────────────────

function fmtEur(val: number | null | undefined): string {
  if (val == null) return '—'
  if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `€${Math.round(val / 1_000)}K`
  return `€${val.toLocaleString()}`
}

function FinancialImpactCard({ data }: { data: AnalysisOutput }) {
  const fi = data.financial_impact as Record<string, any> | null
  if (!fi) return null

  const headline: string = fi.headline?.headline_text ?? ''
  const tiers: any[] = fi.totals_by_tier ?? []
  const topDrivers: any[] = fi.top_drivers ?? []

  // Build ordered tier columns: base → adverse → severe
  const tierOrder = ['base', 'adverse', 'severe']
  const tierMap: Record<string, any> = {}
  for (const t of tiers) tierMap[t.tier_id] = t

  const metrics: { label: string; field: string; format: (v: number) => string }[] = [
    { label: 'Total Exposure', field: 'total_eur', format: fmtEur },
    { label: 'Operational Costs', field: 'opex_eur', format: fmtEur },
    { label: 'Capital Requirements', field: 'capex_eur', format: fmtEur },
    { label: 'Revenue at Risk', field: 'revenue_loss_eur', format: fmtEur },
    { label: 'Downtime (days)', field: 'downtime_days', format: (v) => String(v) },
  ]

  const severeRange = fi.headline?.severe_exposure_range as Record<string, number> | undefined
  const adverseRange = fi.headline?.adverse_exposure_range as Record<string, number> | undefined

  const [open, setOpen] = useState(true)

  return (
    <div id="financial-impact-card" className="mb-4 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400" />
      <div
        className="flex cursor-pointer select-none items-center justify-between px-6 py-4"
        onClick={() => setOpen(o => !o)}
      >
        <h2 className="text-xl font-bold text-foreground">Financial Impact Analysis</h2>
        {open ? <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
      </div>
      {open && (
        <div className="px-6 pb-6">

          {/* Headline */}
          {headline && (
            <p className="mb-5 rounded bg-slate-50 px-3 py-2 text-sm text-foreground">
              <span className="font-semibold">Headline:&nbsp;</span>{headline}
            </p>
          )}

          {/* Main metrics table */}
          <div className="mb-6 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700 text-white">
                  <th className="px-3 py-2.5 text-left font-semibold">Metric</th>
                  {tierOrder.map(tid => (
                    <th key={tid} className={`px-3 py-2.5 text-right font-semibold ${tid === 'severe' ? 'bg-red-700' : ''}`}>
                      {tierMap[tid]?.tier_label ?? tid}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map(({ label, field, format }, i) => (
                  <tr key={label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-2.5 font-medium text-foreground">{label}</td>
                    {tierOrder.map(tid => {
                      const val = tierMap[tid]?.totals_midpoint?.[field]
                      const isSevereTotal = tid === 'severe' && field === 'total_eur'
                      return (
                        <td
                          key={tid}
                          className={`px-3 py-2.5 text-right tabular-nums ${isSevereTotal ? 'font-bold text-red-700' : 'text-foreground'
                            } ${tid === 'severe' ? 'bg-red-50/40' : ''}`}
                        >
                          {val != null ? format(val) : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Exposure Ranges */}
          <h3 className="mb-3 text-base font-bold text-foreground">Exposure Ranges</h3>
          <div className="mb-6 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700 text-white">
                  <th className="px-3 py-2.5 text-left font-semibold">Scenario</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Low</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Mid</th>
                  <th className="px-3 py-2.5 text-right font-semibold">High</th>
                </tr>
              </thead>
              <tbody>
                {severeRange && (
                  <tr className="bg-white">
                    <td className="px-3 py-2.5 font-medium text-foreground">Severe</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{fmtEur(severeRange.low)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-foreground">{fmtEur(severeRange.mid)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{fmtEur(severeRange.high)}</td>
                  </tr>
                )}
                {adverseRange && (
                  <tr className="bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-foreground">Adverse</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{fmtEur(adverseRange.low)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-foreground">{fmtEur(adverseRange.mid)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{fmtEur(adverseRange.high)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Top Risk Drivers */}
          {topDrivers.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-bold text-foreground">Top Risk Drivers (Severe Scenario)</h3>
              <div className="flex flex-col gap-1.5">
                {topDrivers.map((d, i) => (
                  <p key={i} className="text-sm text-foreground">
                    <span className="font-semibold">{d.ecosystem_service}</span>
                    <span className="text-muted-foreground"> (Dependency: {d.dependency_strength})</span>
                    <span className="font-medium"> → {fmtEur(d.severe_total_eur)}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StakeholderNarrativesCard({ data }: { data: AnalysisOutput }) {
  const sn = data.stakeholder_narratives as Record<string, any> | null
  if (!sn) return null

  const oneLiner: string = sn.key_messages_summary?.one_liner ?? ''
  const cfoNarrative: string = impersonal(sn.cfo_brief?.narrative ?? '')
  const cfoBreakdown: Record<string, string> = sn.cfo_brief?.financial_exposure_summary?.breakdown ?? {}
  const cfoHeadline: string = sn.cfo_brief?.financial_exposure_summary?.headline_figure ?? ''
  const sustainNarrative: string = impersonal(sn.sustainability_report_section?.narrative ?? '')
  const leap: Record<string, string> = sn.sustainability_report_section?.leap_process_summary ?? {}
  const leapOrder: { key: string; label: string }[] = [
    { key: 'locate', label: 'Locate' },
    { key: 'evaluate', label: 'Evaluate' },
    { key: 'assess', label: 'Assess' },
    { key: 'prepare', label: 'Prepare' },
  ]

  const breakdownLabels: Record<string, string> = {
    revenue_at_risk: 'Revenue at Risk',
    operational_costs: 'Operational Costs',
    capital_requirements: 'Capital Requirements',
    potential_impairments: 'Potential Impairments',
  }

  const [open, setOpen] = useState(true)

  return (
    <div id="stakeholder-narratives-card" className="mb-4 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-400" />
      <div
        className="flex cursor-pointer select-none items-center justify-between px-6 py-4"
        onClick={() => setOpen(o => !o)}
      >
        <h2 className="text-xl font-bold text-foreground">Stakeholder Narratives</h2>
        {open ? <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
      </div>
      {open && (
        <div className="px-6 pb-6">

          {/* One-Liner */}
          {oneLiner && (
            <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <span className="font-semibold text-amber-800">One-Liner:&nbsp;</span>
              <span className="text-amber-900">{impersonal(oneLiner)}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* CFO Brief */}
            {cfoNarrative && (
              <div className="rounded-lg border border-border bg-slate-50 p-4">
                <h3 className="mb-2 text-base font-bold text-foreground">CFO Brief</h3>
                {cfoHeadline && (
                  <p className="mb-2 text-xs font-semibold text-blue-700">{cfoHeadline}</p>
                )}
                <p className="mb-3 text-sm leading-relaxed text-foreground">{cfoNarrative}</p>
                {Object.keys(cfoBreakdown).length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Breakdown</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(cfoBreakdown).map(([k, v]) => (
                        <span key={k} className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs text-foreground">
                          <span className="text-muted-foreground">{breakdownLabels[k] ?? k}:</span>
                          <span className="font-semibold">{v}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sustainability Report Section */}
            {sustainNarrative && (
              <div className="rounded-lg border border-border bg-slate-50 p-4">
                <h3 className="mb-2 text-base font-bold text-foreground">Sustainability Report Section</h3>
                <p className="mb-3 text-sm leading-relaxed text-foreground">{sustainNarrative}</p>
                {leapOrder.some(({ key }) => leap[key]) && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">LEAP Process Summary</p>
                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-700 text-white">
                            <th className="px-3 py-2 text-left font-semibold">Step</th>
                            <th className="px-3 py-2 text-left font-semibold">Summary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leapOrder.filter(({ key }) => leap[key]).map(({ key, label }, i) => (
                            <tr key={key} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="px-3 py-2 font-semibold text-violet-700 whitespace-nowrap">{label}</td>
                              <td className="px-3 py-2 text-foreground">{leap[key]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AdaptationStrategyCard({ data }: { data: AnalysisOutput }) {
  const as_ = data.adaptation_strategy as Record<string, any> | null
  if (!as_) return null

  const overview = as_.strategic_overview as Record<string, any> | undefined
  const pathways: any[] = as_.pathway_strategies ?? []
  const roadmap = as_.implementation_roadmap as Record<string, any> | undefined

  const totalInv = overview?.total_estimated_investment
  const invText = totalInv
    ? `${fmtEur(totalInv.low)} – ${fmtEur(totalInv.high)} (Confidence: ${totalInv.confidence ?? '—'})`
    : null

  const horizons: { key: string; label: string }[] = [
    { key: 'short_term_actions', label: '0–12 months' },
    { key: 'medium_term_investments', label: '1–3 years' },
    { key: 'long_term_transformations', label: '3–10 years' },
  ]

  const feasibilityColor = (f: string) => {
    switch (f?.toLowerCase()) {
      case 'high': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-amber-100 text-amber-800'
      case 'low': return 'bg-red-100 text-red-800'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  const roadmapPhases = roadmap
    ? (['phase_1', 'phase_2', 'phase_3'] as const).map(pk => roadmap[pk]).filter(Boolean)
    : []

  const [open, setOpen] = useState(true)

  return (
    <div id="adaptation-strategy-card" className="mb-4 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300" />
      <div
        className="flex cursor-pointer select-none items-center justify-between px-6 py-4"
        onClick={() => setOpen(o => !o)}
      >
        <h2 className="text-xl font-bold text-foreground">Adaptation Strategy</h2>
        {open ? <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
      </div>
      {open && (
        <div className="px-6 pb-6">

          {/* Strategic Overview */}
          {overview && (
            <div className="mb-5 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm space-y-1">
              {overview.risk_posture && (
                <p><span className="font-semibold text-orange-900">Risk Posture:&nbsp;</span><span className="text-foreground">{overview.risk_posture}</span></p>
              )}
              {overview.strategic_intent && (
                <p><span className="font-semibold text-orange-900">Strategic Intent:&nbsp;</span><span className="text-foreground">{impersonal(overview.strategic_intent)}</span></p>
              )}
              {invText && (
                <p><span className="font-semibold text-orange-900">Total Estimated Investment:&nbsp;</span><span className="text-foreground">{invText}</span></p>
              )}
              {overview.potential_risk_reduction?.percentage != null && (
                <p><span className="font-semibold text-orange-900">Potential Risk Reduction:&nbsp;</span><span className="text-foreground">{overview.potential_risk_reduction.percentage}%</span></p>
              )}
            </div>
          )}

          {/* Pathway Cards */}
          {pathways.map((pathway, pi) => (
            <div key={pi} className="mb-4 rounded-lg border border-border overflow-hidden">
              <div className="flex items-center gap-3 bg-slate-700 px-4 py-2.5">
                <span className="font-semibold text-white">Pathway: {pathway.pathway_name}</span>
                {pathway.ecosystem_service && (
                  <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-medium text-amber-900">{pathway.ecosystem_service}</span>
                )}
              </div>
              <div className="divide-y divide-border">
                {horizons.map(({ key, label }) => {
                  const actions: any[] = pathway[key]?.actions ?? []
                  if (actions.length === 0) return null
                  return actions.map((action: any, ai: number) => (
                    <div key={`${key}-${ai}`} className="p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{action.title}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">{label}</span>
                      </div>
                      {action.description && (
                        <p className="mb-3 text-sm text-muted-foreground leading-relaxed">{action.description}</p>
                      )}
                      {/* Chips row */}
                      <div className="mb-2 flex flex-wrap gap-2 text-xs">
                        {action.estimated_cost && (
                          <span className="rounded-full border border-border bg-white px-2.5 py-1 text-foreground">
                            <span className="text-muted-foreground">Cost ({action.estimated_cost.type}):&nbsp;</span>
                            <span className="font-semibold">{fmtEur(action.estimated_cost.amount_eur)}</span>
                          </span>
                        )}
                        {action.risk_reduction?.estimate && (
                          <span className="rounded-full border border-border bg-white px-2.5 py-1 text-foreground">
                            <span className="text-muted-foreground">Risk Reduction:&nbsp;</span>
                            <span className="font-semibold text-green-700">{action.risk_reduction.estimate}</span>
                          </span>
                        )}
                        {action.feasibility && (
                          <span className={`rounded-full px-2.5 py-1 font-semibold ${feasibilityColor(action.feasibility)}`}>
                            Feasibility: {action.feasibility}
                          </span>
                        )}
                      </div>
                      {/* Case Study */}
                      {action.grounding?.case_study_support && (
                        <div className="mt-2 rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          <span className="font-semibold text-slate-700">Case Study: {action.grounding.case_study_support.entity}&nbsp;—&nbsp;</span>
                          {action.grounding.case_study_support.action_taken}
                          {action.grounding.case_study_support.outcome && (
                            <span className="ml-1 text-green-700">Outcome: {action.grounding.case_study_support.outcome}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                })}
              </div>
            </div>
          ))}

          {/* Implementation Roadmap */}
          {roadmapPhases.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-bold text-foreground">Implementation Roadmap</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {roadmapPhases.map((phase: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border bg-slate-50 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">{i + 1}</span>
                      <span className="font-semibold text-foreground">{phase.name}</span>
                    </div>
                    <p className="mb-2 text-xs text-muted-foreground">{phase.duration}</p>
                    <ul className="space-y-1">
                      {(phase.key_milestones ?? []).map((m: string, mi: number) => (
                        <li key={mi} className="flex items-start gap-1.5 text-xs text-foreground">
                          <span className="mt-0.5 text-orange-400">•</span>{m}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
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
      // If all stages are pending, workflow was cancelled — ignore stale updates
      if (prev.every(s => s === 'pending')) return prev
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
      // If all stages are pending, workflow was cancelled — ignore stale updates
      if (prev.every(s => s === 'pending')) return prev
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
    // Reset stage statuses immediately so Panel 2 never shows stale checkmarks
    setStageStatuses(PENDING_STAGES)

    // Validate form first
    await form.validateFields()

    setStatus({ type: 'loading' })
    setWorkflowActive(false)
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

  function handleCancel() {
    Modal.confirm({
      title: 'Cancel workflow?',
      content: 'This will abandon the current request and reset all data. You will return to the input screen.',
      okText: 'Yes, cancel',
      okButtonProps: { danger: true },
      cancelText: 'Keep running',
      onOk() {
        setWorkflowActive(false)
        setStageStatuses(PENDING_STAGES)
        lsSet('econode_stage_statuses', PENDING_STAGES)
        setAnalysisOutput(null)
        setStatus({ type: 'idle' })
        sentAtRef.current = null
        lsSet('econode_sent_at', null)
        setActivePanel(1)
      },
    })
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
                {workflowActive && (
                  <Button danger size="small" onClick={handleCancel}>
                    Cancel
                  </Button>
                )}
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
            <section className={`flex flex-1 flex-col p-6 min-w-0 transition-opacity ${workflowActive || analysisOutput ? 'opacity-100' : 'opacity-40'}`}>
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                <h2 className="text-lg font-semibold text-foreground flex-1">Analysis Output</h2>
                {analysisOutput && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => generatePdf(analysisOutput)}
                  >
                    Download PDF
                  </Button>
                )}
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
                  <ExecutiveSummaryCard data={analysisOutput} />
                  <NatureDependencyCard data={analysisOutput} />
                  <FinancialImpactCard data={analysisOutput} />
                  <StakeholderNarrativesCard data={analysisOutput} />
                  <AdaptationStrategyCard data={analysisOutput} />
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
