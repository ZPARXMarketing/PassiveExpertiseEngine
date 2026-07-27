export const baseStats = {
  retentionPct: 88,
  conceptsHeld: 74,
  timeReclaimed: '1h 52m',
  idleMoments: 28,
  weekBars: [35, 60, 50, 40, 75, 55, 45], // % height, Mon–Sun
  weekToday: 4, // index into weekBars
}

export interface DepthRing {
  label: string
  pct: number // 0–100
  locked?: boolean
}

export const depthRings: DepthRing[] = [
  { label: 'Shop-floor basics', pct: 100 },
  { label: 'Operator fluency', pct: 72 },
  { label: 'CFO-level judgment', pct: 24 },
  { label: 'Capital markets', pct: 0, locked: true },
]
