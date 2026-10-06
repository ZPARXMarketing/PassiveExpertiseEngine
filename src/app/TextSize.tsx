import { useEffect, useState } from 'react'

/** Reading text size, per device. Step 0 is the original (smallest) size. */
const STEPS = [
  { scale: 1, label: 'A', name: 'Small' },
  { scale: 1.15, label: 'A+', name: 'Medium' },
  { scale: 1.3, label: 'A++', name: 'Large' },
]
const KEY = 'text-size'

function stored(): number {
  try {
    const n = Number(localStorage.getItem(KEY))
    return n > 0 && n < STEPS.length ? n : 0
  } catch {
    return 0
  }
}

export function TextSizeButton({ className }: { className: string }) {
  const [step, setStep] = useState(stored)
  useEffect(() => {
    document.documentElement.style.setProperty('--fs', String(STEPS[step].scale))
    try {
      localStorage.setItem(KEY, String(step))
    } catch {
      /* private mode: the size still applies this visit */
    }
  }, [step])
  const next = (step + 1) % STEPS.length
  return (
    <button
      type="button"
      className={`${className} text-size`}
      onClick={() => setStep(next)}
      title={`Text size: ${STEPS[step].name} (tap for ${STEPS[next].name})`}
      aria-label={`Text size ${STEPS[step].name}`}
    >
      {STEPS[step].label}
    </button>
  )
}
