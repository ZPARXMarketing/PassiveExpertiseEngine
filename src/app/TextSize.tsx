import { useState } from 'react'

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

function apply(step: number) {
  document.documentElement.style.setProperty('--fs', String(STEPS[step].scale))
}

/** Put this device's saved size in place (call once at start). */
export const applyTextSize = () => apply(stored())

/** A / A+ / A++ picker for Settings; takes effect at once. */
export function TextSizeSetting() {
  const [step, setStep] = useState(stored)
  const choose = (n: number) => {
    setStep(n)
    apply(n)
    try {
      localStorage.setItem(KEY, String(n))
    } catch {
      /* private mode: the size still applies this visit */
    }
  }
  return (
    <div className="text-size-pick" role="radiogroup" aria-label="Text size">
      {STEPS.map((s, i) => (
        <button key={s.label} type="button" role="radio" aria-checked={step === i} className={step === i ? 'on' : ''} onClick={() => choose(i)}>
          <span style={{ fontSize: `${14 * s.scale}px` }}>{s.label}</span>
          <small>{s.name}</small>
        </button>
      ))}
    </div>
  )
}
