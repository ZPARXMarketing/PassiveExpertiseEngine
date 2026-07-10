export const baseStats = {
  retentionPct: 91,
  conceptsHeld: 128,
  timeReclaimed: '2h 41m',
  idleMoments: 34,
  weekBars: [40, 70, 55, 30, 80, 65, 45], // % height, Mon–Sun
  weekToday: 4, // index into weekBars
}

export interface DepthRing {
  label: string
  pct: number // 0–100
  locked?: boolean
}

export const depthRings: DepthRing[] = [
  { label: 'Core intuitions', pct: 100 },
  { label: 'Undergraduate depth', pct: 79 },
  { label: 'Graduate depth', pct: 29 },
  { label: 'Research frontier', pct: 0, locked: true },
]
