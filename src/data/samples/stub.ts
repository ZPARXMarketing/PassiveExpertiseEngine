import type { Subject } from '../types'
import { emptyMetrics } from '../types'

/** Generic blueprint so any typed goal still creates a usable project */
export function createStubSubject(goal: string): Subject {
  const title =
    goal.trim().length > 48 ? `${goal.trim().slice(0, 45).trim()}…` : goal.trim() || 'Untitled project'
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'
  const root = 'core'
  return {
    id: `sub-${slug}-${Date.now()}`,
    goal: goal.trim() || 'Untitled project',
    title,
    createdAt: new Date().toISOString(),
    blueprint: {
      overview: `A starter skill path for “${title}”: name the outcome, learn the fundamentals, practice deliberately, then retrieve under pressure.`,
      goals: [
        'Name the 20% that drives 80% of the result',
        'Ship one concrete practice artifact',
        'Explain the core idea without notes',
      ],
      nodes: [
        {
          id: root,
          label: 'core outcome',
          x: 120,
          y: 50,
          labelDx: -28,
          labelDy: 28,
          status: 'learning',
          is8020: true,
          retention: 40,
          taskId: 'task-stub-practice',
          summary: 'What “done” looks like for this project',
          overview: `Clarify the single outcome that would make progress on “${title}” obvious — not a vague wish list.`,
          learnAbout: [
            'Outcome vs activity',
            'Success criteria you can check today',
            'Scope cuts that protect focus',
          ],
        },
        {
          id: 'fundamentals',
          label: 'fundamentals',
          x: 50,
          y: 140,
          labelDx: -30,
          labelDy: 28,
          status: 'available',
          retention: 25,
          taskId: 'task-stub-practice',
          summary: 'Minimum concepts before serious practice',
          overview:
            'The small set of ideas and vocabulary you need so practice is deliberate instead of random thrashing.',
          learnAbout: [
            'Core vocabulary of the domain',
            'Dependencies between basics',
            'What you can safely skip at first',
          ],
        },
        {
          id: 'practice',
          label: 'deliberate practice',
          x: 190,
          y: 140,
          labelDx: -36,
          labelDy: 28,
          status: 'available',
          is8020: true,
          retention: 20,
          taskId: 'task-stub-practice',
          summary: 'Timed work with a clear artifact',
          overview:
            'Design a block with inputs, output, and a done-when test — then execute without multitasking.',
          learnAbout: [
            'Task design (inputs → artifact)',
            'Time-boxing and distraction control',
            'How to know the block actually moved the goal',
          ],
        },
        {
          id: 'retrieval',
          label: 'retrieval',
          x: 120,
          y: 230,
          labelDx: -20,
          labelDy: 28,
          status: 'available',
          retention: 15,
          summary: 'Prove it sticks without the notes',
          overview:
            'Explain and quiz yourself from memory. Retrieval is where fragile familiarity becomes usable skill.',
          learnAbout: [
            'Feynman-style explain-back',
            'Spaced review of weak spots',
            'When to re-practice vs re-read',
          ],
        },
      ],
      edges: [
        { from: root, to: 'fundamentals' },
        { from: root, to: 'practice' },
        { from: 'fundamentals', to: 'retrieval' },
        { from: 'practice', to: 'retrieval' },
      ],
    },
    tasks: [
      {
        id: 'task-stub-practice',
        conceptId: 'practice',
        title: 'First practice block',
        prompt: `Define a 45-minute deep-work task that would move "${title}" forward today. Be concrete: inputs, output artifact, and how you'll know it's done.`,
        kind: 'text',
        starterText: 'Artifact I will produce:\n\nDone when:\n',
        evalNote: 'Stub curriculum — any focused write-up counts as practice in the prototype.',
      },
    ],
    synthPrompts: [
      {
        id: 'synth-stub',
        conceptId: root,
        prompt: `Explain the 20% of "${title}" that would produce 80% of the result — as if teaching a smart beginner in 2 minutes.`,
        rubricKeywords: ['important', 'first', 'practice', 'core', 'focus', 'why', 'skill'],
        passFeedback: 'Captured. Atomized into a starter review card.',
        failFeedback: 'Name the core skill, why it matters, and one practice move. Avoid vague inspiration.',
        cardsOnPass: [
          {
            id: `card-stub-${Date.now()}`,
            conceptId: root,
            front: `80/20 of: ${title}`,
            back: '(Fill from your Feynman answer — prototype seeds a blank you can refine later.)',
          },
        ],
      },
    ],
    srs: [],
    drills: [
      {
        id: 'drill-stub-mcq',
        conceptId: 'retrieval',
        title: 'Metalearning check',
        kind: 'mcq',
        spec: {
          question: 'Best next move after drafting a skill blueprint?',
          options: [
            'Consume more overview videos passively',
            'Schedule a timed practice block on a core node',
            'Wait until you feel ready',
          ],
          correctIndex: 1,
          explanation:
            'Metalearning exists to aim direct practice. Core nodes should become timed sessions, not more browsing.',
        },
      },
    ],
    metrics: emptyMetrics(),
  }
}
