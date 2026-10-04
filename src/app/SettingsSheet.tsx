import { useRef, useState } from 'react'
import { speak, type Settings } from './generate.ts'
import { DEFAULT_MODEL, STYLES, VOICES } from './prompts.ts'
import type { Teacher } from './types.ts'

interface Props {
  settings: Settings
  mode?: 'cloud' | 'device'
  teacher: Teacher
  onTeacher: (t: Teacher) => void
  onSave: (s: Settings) => void
  onClose: () => void
}

const SAMPLE = "Hi, I'm your teacher for this course. Let's start with the one idea that makes everything else in this chapter click."
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function SettingsSheet({ settings, mode, teacher, onTeacher, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(settings)
  const [t, setT] = useState(teacher)
  const [previewing, setPreviewing] = useState(false)
  const [previewErr, setPreviewErr] = useState('')
  /** voice+style → sample audio, so replaying a preview costs nothing */
  const samples = useRef(new Map<string, string>())
  const audio = useRef<HTMLAudioElement | null>(null)

  const preview = async () => {
    const k = `${t.voice}:${t.style}`
    setPreviewErr('')
    try {
      let url = samples.current.get(k)
      if (!url) {
        setPreviewing(true)
        url = URL.createObjectURL(await speak({ text: SAMPLE, voice: t.voice, style: t.style }, draft))
        samples.current.set(k, url)
      }
      audio.current?.pause()
      audio.current = new Audio(url)
      audio.current.playbackRate = t.speed
      await audio.current.play()
    } catch (e) {
      setPreviewErr(e instanceof Error ? e.message : 'Preview failed.')
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <form
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          audio.current?.pause()
          onTeacher(t)
          onSave({ ...draft, model: draft.model.trim() || DEFAULT_MODEL })
        }}
      >
        <h2>Settings</h2>

        <h3 className="sheet-sub">Teacher voice</h3>
        <div className="sheet-grid">
          <label>
            Voice
            <select value={t.voice} onChange={(e) => setT({ ...t, voice: e.target.value })}>
              {VOICES.map((v) => (
                <option key={v} value={v}>
                  {cap(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Style
            <select value={t.style} onChange={(e) => setT({ ...t, style: e.target.value })}>
              {Object.entries(STYLES).map(([k, s]) => (
                <option key={k} value={k}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Speed
            <select value={t.speed} onChange={(e) => setT({ ...t, speed: Number(e.target.value) })}>
              {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="btn-ghost preview-btn" onClick={() => void preview()} disabled={previewing}>
          {previewing ? 'Loading…' : '▶ Preview voice'}
        </button>
        {previewErr && <p className="error">{previewErr}</p>}
        <p className="sheet-note">Synced to all your devices. Applies to new lectures; existing ones keep their voice.</p>

        <h3 className="sheet-sub">AI</h3>
        <label>
          OpenRouter key <small>optional: leave blank to use the site's key</small>
          <input
            type="password"
            value={draft.openRouterKey}
            onChange={(e) => setDraft({ ...draft, openRouterKey: e.target.value })}
            placeholder="sk-or-…"
            autoComplete="off"
          />
        </label>
        <label>
          Model
          <input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
        </label>
        <p className="sheet-note">
          Storage: {mode === 'cloud' ? 'synced to Supabase.' : 'this device only (Supabase tables not set up yet).'}
        </p>
        <p className="sheet-note">
          <a className="lock-link" href="/__logout">
            Lock this device
          </a>{' '}
          (asks for the site password again)
        </p>
        <div className="sheet-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-neon">Save</button>
        </div>
      </form>
    </div>
  )
}
