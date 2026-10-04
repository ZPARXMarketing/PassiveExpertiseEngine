import { useState } from 'react'
import type { Settings } from './generate.ts'
import { DEFAULT_MODEL } from './prompts.ts'

interface Props {
  settings: Settings
  mode?: 'cloud' | 'device'
  onSave: (s: Settings) => void
  onClose: () => void
}

export function SettingsSheet({ settings, mode, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(settings)
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <form
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          onSave({ ...draft, model: draft.model.trim() || DEFAULT_MODEL })
        }}
      >
        <h2>Settings</h2>
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
