import type { Drill, RapidCalcSpec } from './types'

export interface CalcQuestion {
  prompt: string
  answer: number
  /** accepted absolute error */
  tolerance: number
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function nextCalcQuestion(formula: RapidCalcSpec['formula']): CalcQuestion {
  switch (formula) {
    case 'net-profit-margin': {
      const revenue = randInt(40, 120) * 1000
      const cogs = Math.round(revenue * (randInt(25, 45) / 100))
      const opex = Math.round(revenue * (randInt(15, 35) / 100))
      const net = revenue - cogs - opex
      const pct = Math.round((net / revenue) * 1000) / 10
      return {
        prompt: `Revenue $${revenue.toLocaleString()} · COGS $${cogs.toLocaleString()} · OpEx $${opex.toLocaleString()}. Net profit margin %?`,
        answer: pct,
        tolerance: 0.2,
      }
    }
    case 'gross-margin': {
      const revenue = randInt(20, 90) * 1000
      const cogs = Math.round(revenue * (randInt(20, 55) / 100))
      const pct = Math.round(((revenue - cogs) / revenue) * 1000) / 10
      return {
        prompt: `Sales $${revenue.toLocaleString()} · COGS $${cogs.toLocaleString()}. Gross margin %?`,
        answer: pct,
        tolerance: 0.2,
      }
    }
    case 'cpc': {
      const spend = randInt(5, 40) * 100
      const clicks = randInt(40, 400)
      const cpc = Math.round((spend / clicks) * 100) / 100
      return {
        prompt: `Ad spend $${spend} · ${clicks} clicks. CPC $?`,
        answer: cpc,
        tolerance: 0.02,
      }
    }
  }
}

export function checkCalcAnswer(given: number, q: CalcQuestion): boolean {
  return Math.abs(given - q.answer) <= q.tolerance
}

/** Build startDrill action payload for a drill definition. */
export function drillStartPayload(drill: Drill): {
  drill: Drill
  firstPrompt?: string
  firstAnswer?: number
  tolerance?: number
} {
  if (drill.kind === 'rapid-calc') {
    const q = nextCalcQuestion((drill.spec as RapidCalcSpec).formula)
    return {
      drill,
      firstPrompt: q.prompt,
      firstAnswer: q.answer,
      tolerance: q.tolerance,
    }
  }
  return { drill }
}
