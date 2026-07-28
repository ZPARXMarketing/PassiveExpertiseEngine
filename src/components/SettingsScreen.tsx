import { useState } from 'react'
import { useApp } from '../state/AppContext'
import { StudyUnavailableError, testOpenRouterKey } from '../data/study'
import { DEFAULT_MODEL } from '../data/studyPrompt'

/** Cheap models that do well on structured study pages. */
const SUGGESTED_MODELS = [
  'deepseek/deepseek-chat',
  'deepseek/deepseek-r1',
  'google/gemini-2.0-flash-001',
  'meta-llama/llama-3.3-70b-instruct',
  'openai/gpt-4o-mini',
]

export function SettingsScreen() {
  const { state, dispatch } = useApp()
  const [reveal, setReveal] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const { openRouterKey, model } = state.settings
  const hasKey = openRouterKey.trim().length > 0

  const update = (patch: Partial<typeof state.settings>) => {
    setResult(null)
    dispatch({ type: 'setSettings', settings: patch })
  }

  const runTest = async () => {
    setTesting(true)
    setResult(null)
    try {
      const message = await testOpenRouterKey(state.settings)
      setResult({ ok: true, message })
    } catch (err) {
      setResult({
        ok: false,
        message:
          err instanceof StudyUnavailableError ? err.message : 'Test failed. Try again in a moment.',
      })
    } finally {
      setTesting(false)
    }
  }

  const clearKey = () => {
    update({ openRouterKey: '' })
    dispatch({ type: 'showToast', message: 'API key cleared from this browser' })
  }

  return (
    <main className="content-pane">
      <header className="page-header">
        <div className="feed-kicker">configuration</div>
        <h1 className="feed-title">Settings</h1>
        <p className="page-lead">
          Study pages are generated through <strong>OpenRouter</strong>, so you can point the app at
          any cheap model. Everything here is stored in this browser only.
        </p>
      </header>

      <section className="card settings-card">
        <div className="feed-kicker">openrouter api key</div>
        <p className="card-sub">
          Create a key at <span className="settings-url">openrouter.ai/keys</span> and paste it
          below. With a key set, the browser calls OpenRouter directly — the key never leaves this
          device except to OpenRouter.
        </p>

        <label className="field-label" htmlFor="or-key">
          API key
        </label>
        <div className="settings-row">
          <input
            id="or-key"
            className="goal-input"
            type={reveal ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-or-v1-…"
            value={openRouterKey}
            onChange={(e) => update({ openRouterKey: e.target.value })}
          />
          <button type="button" className="pill mini" onClick={() => setReveal((v) => !v)}>
            {reveal ? 'Hide' : 'Show'}
          </button>
        </div>

        <label className="field-label" htmlFor="or-model" style={{ marginTop: 10 }}>
          Model
        </label>
        <input
          id="or-model"
          className="goal-input"
          list="or-models"
          spellCheck={false}
          placeholder={DEFAULT_MODEL}
          value={model}
          onChange={(e) => update({ model: e.target.value })}
        />
        <datalist id="or-models">
          {SUGGESTED_MODELS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <div className="card-hint">
          Any OpenRouter model slug works. Default is {DEFAULT_MODEL} — cheap and reliable at
          structured JSON.
        </div>

        <div className="settings-actions">
          <button type="button" className="pill primary" onClick={runTest} disabled={testing || !hasKey}>
            {testing ? 'Testing…' : 'Test key'}
          </button>
          {hasKey && (
            <button type="button" className="text-btn danger" onClick={clearKey}>
              Clear key
            </button>
          )}
        </div>

        {result && (
          <p className={`explain${result.ok ? '' : ' fail'} settings-result`}>{result.message}</p>
        )}
      </section>

      <section className="card settings-card">
        <div className="feed-kicker">how generation resolves</div>
        <ul className="path-goals">
          <li>
            <strong>Key set here</strong> — the browser calls OpenRouter directly. Works on
            <code> vite dev</code> with no deploy.
          </li>
          <li>
            <strong>No key here</strong> — the app falls back to this site&apos;s serverless
            function, which uses <code>OPENROUTER_API_KEY</code> from the site environment.
          </li>
          <li>
            <strong>Neither</strong> — concept pages still show their authored curriculum notes;
            only the deep-dive button is unavailable.
          </li>
        </ul>
        <p className="card-hint">
          A key stored in the browser is readable by anything with access to this browser profile.
          For a shared or public deployment, leave this blank and configure the server-side key
          instead.
        </p>
      </section>

      <section className="card settings-card">
        <div className="feed-kicker">generated pages</div>
        <p className="card-sub">
          Each generated study page is cached on its concept, so a page is only paid for once.
          Regenerate from the concept page when you want a fresh take. Cached pages survive a
          project progress reset.
        </p>
        <div className="settings-stat">
          <span className="stat-num">
            {state.subjects.reduce(
              (total, s) =>
                total + s.blueprint.nodes.filter((n) => n.study?.source === 'generated').length,
              0,
            )}
          </span>
          <span className="stat-label">study pages generated and cached</span>
        </div>
      </section>
    </main>
  )
}
