import { useEffect, useState } from 'react'

interface UsageData {
  total: number | null
  week: number | null
  day: number | null
}

/**
 * OpenRouter spend on this site's key — all time · this week · today, to the cent's tenth.
 * Refreshes every minute while the tab is visible, and when you come back to it.
 */
export function Usage() {
  const [u, setU] = useState<UsageData | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    const load = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/usage')
        if (!res.ok) throw new Error()
        setU((await res.json()) as UsageData)
        setErr(false)
      } catch {
        setErr(true)
      }
    }
    void load()
    const t = window.setInterval(load, 60_000)
    document.addEventListener('visibilitychange', load)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', load)
    }
  }, [])
  const f = (n: number | null | undefined) => (typeof n === 'number' ? `$${n.toFixed(3)}` : '—')
  return (
    <div className="usage" title="OpenRouter spend on this key: all time · this week · today">
      {err && !u ? (
        <span>usage —</span>
      ) : (
        <>
          <span>
            <i>all</i> {f(u?.total)}
          </span>
          <span>
            <i>wk</i> {f(u?.week)}
          </span>
          <span>
            <i>day</i> {f(u?.day)}
          </span>
        </>
      )}
    </div>
  )
}
