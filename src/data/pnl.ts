import type { CsvRow, PnlTag, PracticeTask } from './types'

export type TagMap = Record<string, PnlTag | undefined>

export interface PnlTotals {
  revenue: number
  cogs: number
  opex: number
  grossProfit: number
  netProfit: number
  grossMarginPct: number | null
  netMarginPct: number | null
}

export function computePnl(rows: CsvRow[], tags: TagMap): PnlTotals {
  let revenue = 0
  let cogs = 0
  let opex = 0
  for (const row of rows) {
    const t = tags[row.id]
    if (t === 'revenue') revenue += row.amount
    else if (t === 'cogs') cogs += row.amount
    else if (t === 'opex') opex += row.amount
  }
  const grossProfit = revenue - cogs
  const netProfit = grossProfit - opex
  return {
    revenue,
    cogs,
    opex,
    grossProfit,
    netProfit,
    grossMarginPct: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : null,
    netMarginPct: revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : null,
  }
}

export interface PnlEval {
  pass: boolean
  tagAccuracy: number
  tagCorrect: number
  tagTotal: number
  grossOk: boolean
  netOk: boolean
  computed: PnlTotals
  message: string
}

export function evaluatePnlTask(task: PracticeTask, tags: TagMap): PnlEval {
  const rows = task.dataset ?? []
  const correct = task.correct
  const computed = computePnl(rows, tags)

  if (!correct) {
    return {
      pass: Object.values(tags).filter(Boolean).length === rows.length,
      tagAccuracy: 1,
      tagCorrect: rows.length,
      tagTotal: rows.length,
      grossOk: true,
      netOk: true,
      computed,
      message: 'Tagged. No answer key on this task.',
    }
  }

  let tagCorrect = 0
  const tagTotal = rows.length
  for (const row of rows) {
    if (tags[row.id] && tags[row.id] === correct.tags[row.id]) tagCorrect++
  }
  const tagAccuracy = tagTotal ? tagCorrect / tagTotal : 0

  // Margins: accept if tags fully correct OR computed margins within 1.5pp of key
  // (key assumes correct tagging; wrong tags will miss both)
  const grossOk =
    computed.grossMarginPct !== null &&
    Math.abs(computed.grossMarginPct - correct.grossMarginPct) <= 1.5
  const netOk =
    computed.netMarginPct !== null && Math.abs(computed.netMarginPct - correct.netMarginPct) <= 1.5

  // For owner-draw ambiguity: pass if ≥80% tags right and gross within tolerance
  // (net may drift if draw tagged differently)
  const pass = tagAccuracy >= 0.8 && grossOk

  let message: string
  if (pass) {
    message = `Locked in — ${tagCorrect}/${tagTotal} tags. Gross ${computed.grossMarginPct}% · Net ${computed.netMarginPct}%. ${task.evalNote.split('.')[0]}.`
  } else if (tagAccuracy < 0.8) {
    message = `Tag accuracy ${Math.round(tagAccuracy * 100)}% (${tagCorrect}/${tagTotal}). Revenue = client charges; COGS = product/consumables for delivery; OpEx = rent, wages, ads.`
  } else {
    message = `Tags mostly right, but margins drifted (gross ${computed.grossMarginPct}% vs target ~${correct.grossMarginPct}%). Recheck COGS vs OpEx splits.`
  }

  return { pass, tagAccuracy, tagCorrect, tagTotal, grossOk, netOk, computed, message }
}
