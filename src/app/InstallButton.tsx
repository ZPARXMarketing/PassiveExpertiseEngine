import { useEffect, useState } from 'react'

type PromptEvent = Event & { prompt: () => Promise<void> }

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

/**
 * "Add to home screen". iOS has no install API, so there it shows the Share-sheet steps;
 * Chrome/Android get the real install prompt. Hidden once running from the home screen.
 */
export function InstallButton({ className }: { className: string }) {
  const [event, setEvent] = useState<PromptEvent | null>(null)
  const [steps, setSteps] = useState(false)

  useEffect(() => {
    const keep = (e: Event) => {
      e.preventDefault()
      setEvent(e as PromptEvent)
    }
    window.addEventListener('beforeinstallprompt', keep)
    return () => window.removeEventListener('beforeinstallprompt', keep)
  }, [])

  if (standalone()) return <p className="install-done">✓ Running from the home screen</p>

  return (
    <div className="install">
      <button
        type="button"
        className={className}
        onClick={() => (event ? void event.prompt().then(() => setEvent(null)) : setSteps(!steps))}
      >
        📲 Add to home screen
      </button>
      {steps && (
        <ol className="install-steps">
          <li>
            In Safari, tap <strong>Share</strong> (the square with the arrow up). Don't see it? Tap <strong>•••</strong>{' '}
            first.
          </li>
          <li>
            Tap <strong>Add to Home Screen</strong> (scroll the list if needed), then <strong>Add</strong>.
          </li>
          <li>Open it from the icon and enter the password once. It then runs full screen, like an app.</li>
        </ol>
      )}
    </div>
  )
}
