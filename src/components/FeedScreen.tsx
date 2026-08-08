import { useMemo } from 'react'
import { useApp } from '../state/AppContext'
import { buildFeed, estimateLabel } from '../data/feed'
import { drillStartPayload } from '../data/drills'
import { liveStreak, masteryPct, rankFor, rankProgress, nextRank } from '../data/rank'
import { paceBlurb, paceFor } from '../data/scheduler'
import type { FeedCard } from '../data/types'
import { useLayerBuilder } from './useLayerBuilder'

const TONE_GLYPH: Record<FeedCard['tone'], string> = {
  new: '✦',
  warm: '◈',
  cold: '❄',
  win: '★',
  quest: '⌘',
}

const KIND_LABEL: Record<FeedCard['kind'], string> = {
  unlock: 'new concept',
  study: 'study',
  review: 'retrieval',
  drill: 'drill',
  'teach-back': 'teach back',
  practice: 'deep work',
  'layer-unlock': 'depth',
  'rank-up': 'rank',
  'side-quest': 'side quest',
}

const ACTION_LABEL: Record<FeedCard['kind'], string> = {
  unlock: 'Open it',
  study: 'Study',
  review: 'Start',
  drill: 'Run drill',
  'teach-back': 'Explain it',
  practice: 'Start block',
  'layer-unlock': 'Unlock',
  'rank-up': 'Claim',
  'side-quest': 'Look at it',
}

export function FeedScreen() {
  const { state, activeDomain, dispatch } = useApp()
  const { build, loading } = useLayerBuilder()

  const cards = useMemo(() => (activeDomain ? buildFeed(activeDomain) : []), [activeDomain])

  if (!activeDomain) {
    return (
      <main className="content-pane">
        <p className="page-lead">Create a domain first.</p>
        <button type="button" className="pill primary" onClick={() => dispatch({ type: 'setView', view: 'domains' })}>
          New domain
        </button>
      </main>
    )
  }

  const domain = activeDomain

  if (!domain.pathsChosen || domain.paths.every((p) => !p.selected)) {
    return (
      <main className="content-pane">
        <header className="page-header">
          <div className="feed-kicker">domain · {domain.title}</div>
          <h1 className="feed-title">Pick your way in</h1>
          <p className="page-lead">
            This domain has {domain.paths.length} routes through it. Choose one or two and the rest
            stays collapsed until you want it.
          </p>
        </header>
        <button type="button" className="pill primary" onClick={() => dispatch({ type: 'setView', view: 'paths' })}>
          Choose paths
        </button>
      </main>
    )
  }

  const selectedPaths = domain.paths.filter((p) => p.selected)
  // With two paths running, a card has to say which one it belongs to — the
  // routes can teach ideas that read almost identically.
  const pathTitle = (pathId?: string) =>
    selectedPaths.length > 1 ? selectedPaths.find((p) => p.id === pathId)?.title : undefined

  const rank = rankFor(domain.progress.xp)
  const upcoming = nextRank(domain.progress.xp)
  const streak = liveStreak(domain.progress)
  const mastery = masteryPct(domain)
  const pace = paceFor(domain)
  const doses = domain.progress.dosesToday
  const target = state.settings.dailyDoses

  const run = (card: FeedCard) => {
    switch (card.kind) {
      case 'review':
        dispatch({
          type: 'startRetrieval',
          cardId: card.id,
          itemIds: card.refIds ?? [],
          conceptId: card.conceptId,
        })
        break
      case 'unlock':
        if (card.conceptId) dispatch({ type: 'unlockConcept', conceptId: card.conceptId })
        break
      case 'study':
        if (card.conceptId) dispatch({ type: 'openConcept', conceptId: card.conceptId })
        break
      case 'drill': {
        const drill = domain.drills.find((d) => d.id === card.refIds?.[0])
        if (drill) dispatch({ type: 'startDrill', ...drillStartPayload(drill) })
        break
      }
      case 'teach-back':
        dispatch({ type: 'setActiveSynth', id: card.refIds?.[0] ?? null })
        dispatch({ type: 'setView', view: 'retrieval' })
        break
      case 'practice':
        if (card.refIds?.[0]) dispatch({ type: 'openTask', taskId: card.refIds[0] })
        break
      case 'layer-unlock': {
        const path = domain.paths.find((p) => p.id === card.pathId)
        if (!path) return
        const index = path.layers.findIndex((l) => !l.unlocked)
        if (index >= 0) void build(path, index)
        break
      }
      case 'rank-up':
        dispatch({ type: 'acknowledgeRank' })
        dispatch({ type: 'showToast', message: `${rank.label} — ${rank.blurb}` })
        break
      case 'side-quest':
        dispatch({ type: 'setView', view: 'paths' })
        break
    }
  }

  return (
    <main className="content-pane feed-pane">
      <header className="page-header">
        <div className="feed-kicker">{domain.title} · today</div>
        <h1 className="feed-title">Your feed</h1>
        <p className="page-lead">{paceBlurb(pace)}</p>
      </header>

      <section className="card identity-strip">
        <div className="identity-rank">
          <span className="rank-badge">{rank.label}</span>
          <div className="rank-track">
            <div className="rank-fill" style={{ width: `${Math.round(rankProgress(domain.progress.xp) * 100)}%` }} />
          </div>
          <span className="rank-meta">
            {domain.progress.xp} XP
            {upcoming ? ` · ${upcoming.minXp - domain.progress.xp} to ${upcoming.label}` : ' · max rank'}
          </span>
        </div>
        <div className="identity-stats">
          <div>
            <div className="stat-num">{streak}</div>
            <div className="stat-label">day streak</div>
          </div>
          <div>
            <div className="stat-num">{mastery}%</div>
            <div className="stat-label">mastery</div>
          </div>
          <div>
            <div className="stat-num">
              {doses}/{target}
            </div>
            <div className="stat-label">doses today</div>
          </div>
        </div>
      </section>

      {cards.length === 0 ? (
        <section className="card feed-empty">
          <div className="card-title">Nothing due ✦</div>
          <p className="card-sub">
            Everything on your frontier is warm and nothing is scheduled. Open a path to unlock more
            depth, or come back when reviews land.
          </p>
          <button type="button" className="pill" onClick={() => dispatch({ type: 'setView', view: 'paths' })}>
            Open paths
          </button>
        </section>
      ) : (
        <div className="feed-list">
          {cards.map((card) => (
            <article key={card.id} className={`card feed-card feed-card--${card.tone}`}>
              <div className="feed-card-top">
                <span className="feed-card-kind">
                  <span aria-hidden>{TONE_GLYPH[card.tone]}</span> {KIND_LABEL[card.kind]}
                  {pathTitle(card.pathId) && <span className="feed-card-path">{pathTitle(card.pathId)}</span>}
                </span>
                <span className="feed-card-est">{estimateLabel(card.estSeconds)}</span>
              </div>
              <h2 className="card-title">{card.title}</h2>
              <p className="card-sub">{card.detail}</p>
              <div className="feed-card-foot">
                <span className="feed-card-reason">{card.reason}</span>
                <div className="feed-card-actions">
                  {card.xp > 0 && <span className="xp-chip">+{card.xp} XP</span>}
                  <button
                    type="button"
                    className="pill primary"
                    disabled={card.kind === 'layer-unlock' && loading !== null}
                    onClick={() => run(card)}
                  >
                    {card.kind === 'layer-unlock' && loading ? 'Opening…' : ACTION_LABEL[card.kind]}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
