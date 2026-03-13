import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtEur(val: number): string {
  if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `€${Math.round(val / 1_000)}K`
  return `€${val.toLocaleString()}`
}

function impersonal(text: string): string {
  return (text ?? '')
    .replace(/\bOur\b/g, 'The').replace(/\bour\b/g, 'the')
    .replace(/\bWe\b/g, 'The organisation').replace(/\bwe\b/g, 'the organisation')
}

function toLabel(key: string): string {
  return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/** Flatten an object to readable "Label: value" lines, max depth. */
function flatLines(obj: unknown, depth = 0, maxDepth = 3): string[] {
  if (obj == null) return ['—']
  if (typeof obj !== 'object') return [String(obj)]
  if (Array.isArray(obj)) {
    return obj.flatMap((item, i) => {
      const sub = flatLines(item, depth + 1, maxDepth)
      return sub.length === 1 ? [`  ${i + 1}. ${sub[0]}`] : [`  ${i + 1}.`, ...sub.map(l => '    ' + l)]
    })
  }
  if (depth >= maxDepth) return [JSON.stringify(obj)]
  const lines: string[] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const label = toLabel(k)
    if (v == null) continue
    if (typeof v === 'object') {
      lines.push(`${label}:`)
      flatLines(v, depth + 1, maxDepth).forEach(l => lines.push('  ' + l))
    } else {
      lines.push(`${label}: ${v}`)
    }
  }
  return lines
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const MARGIN = 14
const PAGE_W = 210  // A4 mm
const CONTENT_W = PAGE_W - MARGIN * 2

// Brand palette
const C = {
  primary:    [34, 197, 94]   as [number, number, number],   // emerald-500
  dark:       [30, 41, 59]    as [number, number, number],   // slate-800
  mid:        [71, 85, 105]   as [number, number, number],   // slate-600
  light:      [241, 245, 249] as [number, number, number],   // slate-100
  white:      [255, 255, 255] as [number, number, number],
  amber:      [217, 119, 6]   as [number, number, number],   // amber-600
  red:        [185, 28, 28]   as [number, number, number],   // red-700
  blue:       [37, 99, 235]   as [number, number, number],   // blue-600
  violet:     [109, 40, 217]  as [number, number, number],   // violet-700
  orange:     [234, 88, 12]   as [number, number, number],   // orange-600
  teal:       [15, 118, 110]  as [number, number, number],   // teal-700
}

// ─── Doc helpers ─────────────────────────────────────────────────────────────

function accentBar(doc: jsPDF, y: number, colors: [number, number, number][]) {
  const segW = CONTENT_W / colors.length
  colors.forEach((c, i) => {
    doc.setFillColor(...c)
    doc.rect(MARGIN + i * segW, y, segW, 1.5, 'F')
  })
}

function sectionHeader(
  doc: jsPDF,
  text: string,
  y: number,
  accentColors: [number, number, number][],
): number {
  checkPageBreak(doc, y, 18)
  y = (doc as any).__curY ?? y
  accentBar(doc, y, accentColors)
  y += 2.5
  doc.setFillColor(...C.dark)
  doc.rect(MARGIN, y, CONTENT_W, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...C.white)
  doc.text(text, MARGIN + 3, y + 5.5)
  doc.setTextColor(...C.dark)
  return y + 10
}

function bodyText(doc: jsPDF, text: string, y: number, opts?: { color?: [number,number,number]; bold?: boolean }): number {
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...(opts?.color ?? C.mid))
  const lines = doc.splitTextToSize(text, CONTENT_W) as string[]
  checkPageBreak(doc, y, lines.length * 4.5)
  y = (doc as any).__curY ?? y
  doc.text(lines, MARGIN, y)
  return y + lines.length * 4.5 + 1
}

function labelValue(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...C.dark)
  const lw = doc.getTextWidth(label + ' ')
  doc.text(label, MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.mid)
  const valLines = doc.splitTextToSize(value, CONTENT_W - lw) as string[]
  doc.text(valLines, MARGIN + lw, y)
  return y + valLines.length * 4.5 + 1
}

function highlightBox(
  doc: jsPDF,
  text: string,
  y: number,
  border: [number,number,number],
  bg: [number,number,number],
  textColor: [number,number,number],
): number {
  doc.setFontSize(9)
  const lines = doc.splitTextToSize(text, CONTENT_W - 6) as string[]
  const h = lines.length * 4.5 + 4
  checkPageBreak(doc, y, h + 2)
  y = (doc as any).__curY ?? y
  doc.setFillColor(...bg)
  doc.setDrawColor(...border)
  doc.roundedRect(MARGIN, y, CONTENT_W, h, 1, 1, 'FD')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...textColor)
  doc.text(lines, MARGIN + 3, y + 4.5)
  return y + h + 2
}

function kpiRow(doc: jsPDF, items: { label: string; value: string }[], y: number): number {
  const colW = CONTENT_W / items.length
  checkPageBreak(doc, y, 18)
  y = (doc as any).__curY ?? y
  items.forEach((item, i) => {
    const x = MARGIN + i * colW
    doc.setFillColor(...C.light)
    doc.setDrawColor(220, 220, 220)
    doc.roundedRect(x + 1, y, colW - 2, 16, 1, 1, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...C.dark)
    doc.text(item.value, x + colW / 2, y + 7, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.mid)
    doc.text(item.label, x + colW / 2, y + 13, { align: 'center' })
  })
  return y + 19
}

/** Auto page-break helper — sets doc.__curY. */
function checkPageBreak(doc: jsPDF, y: number, neededH: number) {
  const PAGE_H = 297 - 14
  if (y + neededH > PAGE_H) {
    doc.addPage()
    ;(doc as any).__curY = 14
  } else {
    ;(doc as any).__curY = y
  }
}

function getY(doc: jsPDF, y: number): number {
  return (doc as any).__curY ?? y
}

// ─── Section renderers ───────────────────────────────────────────────────────

function renderExecutiveSummary(doc: jsPDF, data: AnalysisOutput, y: number): number {
  const fi = data.financial_impact as Record<string, any> | null
  const tnfd = data.tnfd_scenario_frame as Record<string, any> | null
  const evalResult = data.evaluation_result as Record<string, any> | null
  const narratives = data.stakeholder_narratives as Record<string, any> | null
  const execSummary = narratives?.executive_summary as Record<string, any> | undefined

  y = sectionHeader(doc, 'Executive Summary', y, [C.primary, C.blue, C.violet])

  // KPIs
  const severeMid = fi?.headline?.severe_exposure_range?.mid
  const physicalScore = tnfd?.physical_axis_detail?.score
  const transitionScore = tnfd?.transition_axis_detail?.score
  const qualityScore = evalResult?.overall_score

  y = kpiRow(doc, [
    { label: 'Severe Exposure (Mid)', value: severeMid != null ? `€${(severeMid / 1e6).toFixed(1)}M` : '—' },
    { label: 'Physical Risk Score', value: physicalScore != null ? physicalScore.toFixed(2) : '—' },
    { label: 'Transition Score', value: transitionScore != null ? transitionScore.toFixed(2) : '—' },
    { label: 'Quality Score', value: qualityScore != null ? `${qualityScore}/100` : '—' },
  ], y)
  y += 2

  // Narrative
  const narrative = impersonal(execSummary?.narrative ?? '')
  if (narrative) y = bodyText(doc, narrative, y)

  // Risk rating
  const riskLevel = execSummary?.risk_rating?.level ?? '—'
  const riskTrend = execSummary?.risk_rating?.trend ?? '—'
  const riskConfidence = execSummary?.risk_rating?.confidence ?? '—'
  y = highlightBox(doc,
    `Risk Rating: ${riskLevel}   |   Trend: ${riskTrend}   |   Confidence: ${riskConfidence}`,
    y, C.amber, [255, 251, 235], C.amber)

  // Strategic Imperative
  const si = impersonal(execSummary?.strategic_imperative ?? '')
  if (si) y = highlightBox(doc, `Strategic Imperative: ${si}`, y, C.orange, [255, 247, 237], C.orange)

  // Recommended action
  const rawAction = execSummary?.recommended_board_action ?? ''
  const proposedInv = narratives?.cfo_brief?.investment_case?.proposed_investment ?? ''
  const action = impersonal(
    rawAction && proposedInv && !rawAction.includes('€')
      ? rawAction.replace(/\.$/, '') + ` — proposed investment: ${proposedInv}.`
      : rawAction
  )
  if (action) y = highlightBox(doc, `Recommended Board Action: ${action}`, y, C.primary, [240, 253, 244], [16, 122, 68])

  return y + 4
}

function renderNatureDependency(doc: jsPDF, data: AnalysisOutput, y: number): number {
  const nd = data.nature_dependency as Record<string, any> | null
  if (!nd) return y

  y = sectionHeader(doc, 'Nature Dependencies', y, [C.teal, C.primary, [74, 222, 128]])

  const dependencies: any[] = nd.dependencies ?? []
  const dependencyCount = nd.dependency_count ?? dependencies.length
  const sector = nd.sector ?? ''
  const method = nd.derivation?.method ?? ''
  const sensFlag = nd.sensitivity_flag ?? '—'
  const envCtx = nd.environmental_context as Record<string, any> | undefined

  let summary = `${dependencyCount} ecosystem service dependencies identified for the ${sector.toLowerCase()} sector, derived using ${method}. Overall sensitivity flag: ${sensFlag}.`
  if (envCtx?.biome) {
    summary += ` Biome: ${envCtx.biome}`
    if (envCtx.water_stress_level) summary += ` · Water stress: ${envCtx.water_stress_level}`
  }
  y = bodyText(doc, summary, y)

  if (dependencies.length > 0) {
    y += 1
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Ecosystem Service', 'Category', 'Strength', 'Type', 'Substitutability', 'Time to Failure']],
      body: dependencies.map(d => [
        d.ecosystem_service ?? '',
        d.category ?? '',
        d.dependency_strength ?? '',
        d.dependency_type ?? '',
        d.substitutability ?? '',
        d.time_to_failure ?? '',
      ]),
      headStyles: { fillColor: C.dark, textColor: C.white, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: C.mid },
      alternateRowStyles: { fillColor: C.light },
      columnStyles: { 2: { textColor: C.red } },
      theme: 'grid',
    })
    y = (doc as any).lastAutoTable.finalY + 4

    // Rationales
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.dark)
    doc.text('Dependency Rationales', MARGIN, y)
    y += 5
    for (const dep of dependencies) {
      if (dep.rationale) {
        y = labelValue(doc, `${dep.ecosystem_service}:`, dep.rationale, y)
        checkPageBreak(doc, y, 5)
        y = getY(doc, y)
      }
    }
  }

  return y + 4
}

function renderFinancialImpact(doc: jsPDF, data: AnalysisOutput, y: number): number {
  const fi = data.financial_impact as Record<string, any> | null
  if (!fi) return y

  y = sectionHeader(doc, 'Financial Impact Analysis', y, [C.blue, [6, 182, 212], C.teal])

  const headline = fi.headline?.headline_text ?? ''
  if (headline) y = highlightBox(doc, `Headline: ${headline}`, y, [148, 163, 184], C.light, C.mid)

  const tiers: any[] = fi.totals_by_tier ?? []
  const tierOrder = ['base', 'adverse', 'severe']
  const tierMap: Record<string, any> = {}
  for (const t of tiers) tierMap[t.tier_id] = t

  const metrics = [
    { label: 'Total Exposure', field: 'total_eur', fmt: fmtEur },
    { label: 'Operational Costs', field: 'opex_eur', fmt: fmtEur },
    { label: 'Capital Requirements', field: 'capex_eur', fmt: fmtEur },
    { label: 'Revenue at Risk', field: 'revenue_loss_eur', fmt: fmtEur },
    { label: 'Downtime (days)', field: 'downtime_days', fmt: (v: number) => String(v) },
  ]

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Metric', ...tierOrder.map(tid => tierMap[tid]?.tier_label ?? tid)]],
    body: metrics.map(({ label, field, fmt }) => [
      label,
      ...tierOrder.map(tid => {
        const val = tierMap[tid]?.totals_midpoint?.[field]
        return val != null ? fmt(val) : '—'
      }),
    ]),
    headStyles: { fillColor: C.dark, textColor: C.white, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: C.mid },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: { 3: { textColor: C.red, fontStyle: 'bold' } },
    theme: 'grid',
  })
  y = (doc as any).lastAutoTable.finalY + 4

  // Exposure ranges
  const severeRange = fi.headline?.severe_exposure_range
  const adverseRange = fi.headline?.adverse_exposure_range
  if (severeRange || adverseRange) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.dark)
    doc.text('Exposure Ranges', MARGIN, y)
    y += 3
    const rangeRows: string[][] = []
    if (severeRange) rangeRows.push(['Severe', fmtEur(severeRange.low), fmtEur(severeRange.mid), fmtEur(severeRange.high)])
    if (adverseRange) rangeRows.push(['Adverse', fmtEur(adverseRange.low), fmtEur(adverseRange.mid), fmtEur(adverseRange.high)])
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Scenario', 'Low', 'Mid', 'High']],
      body: rangeRows,
      headStyles: { fillColor: C.dark, textColor: C.white, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: C.mid, halign: 'right' },
      columnStyles: { 0: { halign: 'left' } },
      alternateRowStyles: { fillColor: C.light },
      theme: 'grid',
    })
    y = (doc as any).lastAutoTable.finalY + 4
  }

  // Top drivers
  const topDrivers: any[] = fi.top_drivers ?? []
  if (topDrivers.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.dark)
    doc.text('Top Risk Drivers (Severe Scenario)', MARGIN, y)
    y += 5
    for (const d of topDrivers) {
      y = labelValue(doc, `${d.ecosystem_service} (${d.dependency_strength}):`, fmtEur(d.severe_total_eur), y)
      checkPageBreak(doc, y, 5)
      y = getY(doc, y)
    }
  }

  return y + 4
}

function renderStakeholderNarratives(doc: jsPDF, data: AnalysisOutput, y: number): number {
  const sn = data.stakeholder_narratives as Record<string, any> | null
  if (!sn) return y

  y = sectionHeader(doc, 'Stakeholder Narratives', y, [C.violet, [168, 85, 247], [232, 121, 249]])

  const oneLiner = sn.key_messages_summary?.one_liner ?? ''
  if (oneLiner) y = highlightBox(doc, `One-Liner: ${impersonal(oneLiner)}`, y, C.amber, [255, 251, 235], [120, 53, 15])

  // CFO Brief
  const cfoNarrative = impersonal(sn.cfo_brief?.narrative ?? '')
  const cfoHeadline = sn.cfo_brief?.financial_exposure_summary?.headline_figure ?? ''
  const cfoBreakdown: Record<string, string> = sn.cfo_brief?.financial_exposure_summary?.breakdown ?? {}
  if (cfoNarrative) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.dark)
    doc.text('CFO Brief', MARGIN, y)
    y += 5
    if (cfoHeadline) {
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...C.blue)
      doc.setFontSize(8)
      doc.text(cfoHeadline, MARGIN, y)
      y += 4.5
    }
    y = bodyText(doc, cfoNarrative, y)
    if (Object.keys(cfoBreakdown).length > 0) {
      const breakdownLabels: Record<string, string> = {
        revenue_at_risk: 'Revenue at Risk',
        operational_costs: 'Operational Costs',
        capital_requirements: 'Capital Requirements',
        potential_impairments: 'Potential Impairments',
      }
      const rows = Object.entries(cfoBreakdown).map(([k, v]) => [breakdownLabels[k] ?? toLabel(k), v])
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [['Category', 'Value']],
        body: rows,
        headStyles: { fillColor: C.dark, textColor: C.white, fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: C.mid },
        alternateRowStyles: { fillColor: C.light },
        theme: 'grid',
      })
      y = (doc as any).lastAutoTable.finalY + 4
    }
    y += 2
  }

  // Sustainability section
  const sustainNarrative = impersonal(sn.sustainability_report_section?.narrative ?? '')
  const leap: Record<string, string> = sn.sustainability_report_section?.leap_process_summary ?? {}
  const leapOrder = [
    { key: 'locate', label: 'Locate' },
    { key: 'evaluate', label: 'Evaluate' },
    { key: 'assess', label: 'Assess' },
    { key: 'prepare', label: 'Prepare' },
  ]
  if (sustainNarrative) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.dark)
    checkPageBreak(doc, y, 8)
    y = getY(doc, y)
    doc.text('Sustainability Report Section', MARGIN, y)
    y += 5
    y = bodyText(doc, sustainNarrative, y)

    const leapRows = leapOrder.filter(l => leap[l.key]).map(l => [l.label, leap[l.key]])
    if (leapRows.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...C.mid)
      doc.text('LEAP Process Summary', MARGIN, y)
      y += 3
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [['Step', 'Summary']],
        body: leapRows,
        headStyles: { fillColor: C.dark, textColor: C.white, fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: C.mid },
        columnStyles: { 0: { fontStyle: 'bold', textColor: C.violet, cellWidth: 24 } },
        alternateRowStyles: { fillColor: C.light },
        theme: 'grid',
      })
      y = (doc as any).lastAutoTable.finalY + 4
    }
  }

  return y + 4
}

function renderAdaptationStrategy(doc: jsPDF, data: AnalysisOutput, y: number): number {
  const as_ = data.adaptation_strategy as Record<string, any> | null
  if (!as_) return y

  y = sectionHeader(doc, 'Adaptation Strategy', y, [C.orange, C.amber, [234, 179, 8]])

  const overview = as_.strategic_overview as Record<string, any> | undefined
  if (overview) {
    const totalInv = overview.total_estimated_investment
    const invText = totalInv
      ? `${fmtEur(totalInv.low)} – ${fmtEur(totalInv.high)} (Confidence: ${totalInv.confidence ?? '—'})`
      : null
    const lines: string[] = []
    if (overview.risk_posture) lines.push(`Risk Posture: ${overview.risk_posture}`)
    if (overview.strategic_intent) lines.push(`Strategic Intent: ${impersonal(overview.strategic_intent)}`)
    if (invText) lines.push(`Total Estimated Investment: ${invText}`)
    if (overview.potential_risk_reduction?.percentage != null) lines.push(`Potential Risk Reduction: ${overview.potential_risk_reduction.percentage}%`)
    if (lines.length) y = highlightBox(doc, lines.join('\n'), y, C.orange, [255, 247, 237], C.orange)
  }

  const pathways: any[] = as_.pathway_strategies ?? []
  const horizons = [
    { key: 'short_term_actions', label: '0–12 months' },
    { key: 'medium_term_investments', label: '1–3 years' },
    { key: 'long_term_transformations', label: '3–10 years' },
  ]

  for (const pathway of pathways) {
    checkPageBreak(doc, y, 10)
    y = getY(doc, y)
    doc.setFillColor(...C.dark)
    doc.rect(MARGIN, y, CONTENT_W, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.white)
    doc.text(`Pathway: ${pathway.pathway_name}${pathway.ecosystem_service ? `  ·  ${pathway.ecosystem_service}` : ''}`, MARGIN + 3, y + 5)
    doc.setTextColor(...C.dark)
    y += 9

    const rows: string[][] = []
    for (const { key, label } of horizons) {
      const actions: any[] = pathway[key]?.actions ?? []
      for (const action of actions) {
        const costStr = action.estimated_cost ? `${fmtEur(action.estimated_cost.amount_eur)} (${action.estimated_cost.type})` : '—'
        const riskRed = action.risk_reduction?.estimate ?? '—'
        const feasibility = action.feasibility ?? '—'
        rows.push([label, action.title ?? '', action.description ?? '', costStr, riskRed, feasibility])
      }
    }

    if (rows.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [['Horizon', 'Action', 'Description', 'Cost', 'Risk Reduction', 'Feasibility']],
        body: rows,
        headStyles: { fillColor: [71, 85, 105], textColor: C.white, fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5, textColor: C.mid },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: {
          0: { cellWidth: 20, fontStyle: 'bold', textColor: C.orange },
          1: { cellWidth: 30, fontStyle: 'bold', textColor: C.dark },
          2: { cellWidth: 60 },
          3: { cellWidth: 24, halign: 'right' },
          4: { cellWidth: 22, textColor: [22, 101, 52] },
          5: { cellWidth: 18 },
        },
        theme: 'grid',
      })
      y = (doc as any).lastAutoTable.finalY + 4
    }
  }

  // Implementation Roadmap
  const roadmap = as_.implementation_roadmap as Record<string, any> | undefined
  const phases = roadmap
    ? (['phase_1', 'phase_2', 'phase_3'] as const).map(pk => roadmap[pk]).filter(Boolean)
    : []

  if (phases.length > 0) {
    checkPageBreak(doc, y, 8)
    y = getY(doc, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.dark)
    doc.text('Implementation Roadmap', MARGIN, y)
    y += 5
    for (const [i, phase] of phases.entries()) {
      const milestones: string[] = phase.key_milestones ?? []
      y = labelValue(doc, `Phase ${i + 1} – ${phase.name} (${phase.duration}):`, milestones.join('; '), y)
      checkPageBreak(doc, y, 5)
      y = getY(doc, y)
    }
  }

  return y + 4
}

/** Render a "raw" section (TNFD, Evidence Synthesis, etc.) in a readable flat format. */
function renderRawSection(
  doc: jsPDF,
  label: string,
  value: unknown,
  y: number,
  accentColors: [number,number,number][],
): number {
  if (value == null) return y

  y = sectionHeader(doc, label, y, accentColors)

  if (typeof value !== 'object' || Array.isArray(value)) {
    y = bodyText(doc, String(value), y)
    return y + 4
  }

  const obj = value as Record<string, unknown>
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue
    checkPageBreak(doc, y, 8)
    y = getY(doc, y)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.dark)
    doc.text(toLabel(k), MARGIN, y)
    y += 5

    if (typeof v === 'string') {
      y = bodyText(doc, v, y)
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      y = bodyText(doc, String(v), y)
    } else if (Array.isArray(v)) {
      const rows = (v as any[]).map((item, i) => {
        if (typeof item === 'object' && item != null) {
          return flatLines(item).join(' | ')
        }
        return `${i + 1}. ${String(item)}`
      })
      for (const row of rows) {
        checkPageBreak(doc, y, 5)
        y = getY(doc, y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...C.mid)
        const lines = doc.splitTextToSize(`• ${row}`, CONTENT_W - 4) as string[]
        doc.text(lines, MARGIN + 4, y)
        y += lines.length * 4 + 1
      }
    } else {
      // nested object — render as sub-table
      const entries = Object.entries(v as Record<string, unknown>).filter(([, val]) => val != null)
      if (entries.length > 0) {
        autoTable(doc, {
          startY: y,
          margin: { left: MARGIN + 4, right: MARGIN },
          head: [['Field', 'Value']],
          body: entries.map(([ek, ev]) => [toLabel(ek), typeof ev === 'object' ? JSON.stringify(ev, null, 1) : String(ev ?? '—')]),
          headStyles: { fillColor: C.dark, textColor: C.white, fontSize: 7.5 },
          bodyStyles: { fontSize: 7.5, textColor: C.mid },
          alternateRowStyles: { fillColor: C.light },
          columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold', textColor: C.dark } },
          theme: 'grid',
        })
        y = (doc as any).lastAutoTable.finalY + 4
      }
    }
  }

  return y + 4
}

// ─── Page header / footer ─────────────────────────────────────────────────────

function addPageDecorations(doc: jsPDF, assetLabel: string, date: string) {
  const totalPages: number = (doc as any).internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    // Top bar
    doc.setFillColor(...C.primary)
    doc.rect(0, 0, 210, 6, 'F')
    // Footer
    doc.setFillColor(...C.dark)
    doc.rect(0, 291, 210, 6, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.white)
    doc.text(`EcoNode Nature Risk Analysis — ${assetLabel} — ${date}`, MARGIN, 295)
    doc.text(`Page ${p} / ${totalPages}`, 210 - MARGIN, 295, { align: 'right' })
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generatePdf(data: AnalysisOutput): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  // Derive asset info for title / filename
  const asset = data.asset as Record<string, any> | null
  const assetType: string = asset?.asset_type ?? asset?.type ?? 'Asset'
  const assetId: string = asset?.asset_id ?? asset?.id ?? ''
  const assetTypeLabel = assetType
    .split(/[_\s]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')

  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10)
  const dateLabel = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  // ── Cover / Title page ─────────────────────────────────────────────────────
  doc.setFillColor(...C.dark)
  doc.rect(0, 0, 210, 297, 'F')

  // Accent band
  accentBar(doc, 80, [C.primary, C.blue, C.violet, C.orange, C.teal])

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(...C.white)
  doc.text('Nature Risk', 105, 100, { align: 'center' })
  doc.text('Analysis Report', 105, 115, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(...C.primary)
  doc.text(assetTypeLabel + (assetId ? ` · ${assetId}` : ''), 105, 132, { align: 'center' })

  doc.setFontSize(10)
  doc.setTextColor(148, 163, 184)
  doc.text(`Generated ${dateLabel}`, 105, 145, { align: 'center' })

  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Powered by EcoNode AI', 105, 280, { align: 'center' })

  // ── Content pages ──────────────────────────────────────────────────────────
  doc.addPage()
  let y = 14

  y = renderExecutiveSummary(doc, data, y)
  y = renderNatureDependency(doc, data, y)
  y = renderFinancialImpact(doc, data, y)
  y = renderStakeholderNarratives(doc, data, y)
  y = renderAdaptationStrategy(doc, data, y)

  // Raw sections
  const rawSections: { key: keyof AnalysisOutput; label: string; colors: [number,number,number][] }[] = [
    { key: 'tnfd_scenario_frame', label: 'TNFD Scenario Frame', colors: [C.blue, C.teal, C.primary] },
    { key: 'evidence_synthesis', label: 'Evidence Synthesis', colors: [C.mid, [100, 116, 139], C.light] },
    { key: 'evaluation_result', label: 'Evaluation Result', colors: [C.violet, C.blue, C.mid] },
    { key: 'explainability_pack', label: 'Explainability Pack', colors: [C.teal, C.primary, [74, 222, 128]] },
    { key: 'asset', label: 'Asset Details', colors: [C.dark, C.mid, [148, 163, 184]] },
  ]

  for (const { key, label, colors } of rawSections) {
    if (data[key] != null) {
      checkPageBreak(doc, y, 20)
      y = getY(doc, y)
      y = renderRawSection(doc, label, data[key], y, colors)
    }
  }

  // ── Page decorations (header/footer on every page) ─────────────────────────
  addPageDecorations(doc, `${assetTypeLabel}${assetId ? ` · ${assetId}` : ''}`, dateStr)

  // ── Download ───────────────────────────────────────────────────────────────
  const filename = `${assetTypeLabel}_RiskAnalysis_${dateStr}.pdf`
  doc.save(filename)
}
