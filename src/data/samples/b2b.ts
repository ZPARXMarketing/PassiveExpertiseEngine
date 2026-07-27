import type { Subject } from '../types'
import { emptyMetrics } from '../types'

const now = () => new Date().toISOString()

/** Second sample subject — proves multi-subject switcher + independent saves */
export function createB2bSubject(goal = 'B2B lead generation'): Subject {
  return {
    id: `sub-b2b-${Date.now()}`,
    goal,
    title: 'B2B lead generation',
    createdAt: now(),
    blueprint: {
      overview:
        'From who you sell to how you buy meetings: define the ICP, sharpen the offer, pick channels, then prove unit economics before scaling pipeline.',
      goals: [
        'Write an ICP a rep can use tomorrow morning',
        'Ship an offer wedge that names pain, outcome, and CTA',
        'Do the CPC/CPL math that keeps paid spend honest',
      ],
      nodes: [
        {
          id: 'icp',
          label: 'ICP definition',
          x: 80,
          y: 50,
          labelDx: -30,
          labelDy: 28,
          status: 'mastered',
          is8020: true,
          retention: 90,
          summary: 'Who is worth talking to — and who is not',
          overview:
            'Ideal customer profile: firmographics, pains, and buying triggers. Everything downstream (offer, channels, copy) inherits this filter.',
          learnAbout: [
            'Firmographic + pain-based ICP',
            'Disqualifiers that save outbound time',
            'Signals that someone is “in market”',
          ],
        },
        {
          id: 'offer',
          label: 'offer wedge',
          x: 180,
          y: 70,
          labelDx: -18,
          labelDy: 28,
          status: 'learning',
          is8020: true,
          retention: 58,
          taskId: 'task-offer-page',
          summary: 'The sharp promise that opens a conversation',
          overview:
            'A wedge is not a full product pitch — it is pain → outcome → low-friction CTA in a tight block a stranger will finish reading.',
          learnAbout: [
            'Pain / promise / proof structure',
            'Cold-outbound length discipline',
            'CTA that asks for a small next step',
          ],
        },
        {
          id: 'channels',
          label: 'channel mix',
          x: 70,
          y: 150,
          labelDx: -28,
          labelDy: 28,
          status: 'available',
          retention: 45,
          taskId: 'task-channel-plan',
          summary: 'Where meetings come from at your volume target',
          overview:
            'Split effort across outbound, paid, and partners against a meetings goal. Each channel needs one metric you refuse to ignore.',
          learnAbout: [
            'Volume math from goal → activity',
            'LinkedIn, paid search, and partner roles',
            'Leading vs lagging channel metrics',
          ],
        },
        {
          id: 'cpc',
          label: 'CPC / CPL math',
          x: 190,
          y: 160,
          labelDx: -20,
          labelDy: 28,
          status: 'available',
          is8020: true,
          retention: 38,
          summary: 'What a lead is allowed to cost',
          overview:
            'Connect ad spend to cost-per-click and cost-per-lead so “we need more leads” has a budget attached — not hope.',
          learnAbout: [
            'CPC and CPL definitions',
            'Backsolving budget from target meetings',
            'When paid is broken vs when offer is broken',
          ],
        },
        {
          id: 'pipeline',
          label: 'pipeline stages',
          x: 130,
          y: 240,
          labelDx: -30,
          labelDy: 28,
          status: 'locked',
          retention: 0,
          summary: 'Stages from first touch to closed-won',
          overview:
            'Named stages and conversion rates turn activity into a forecast. Locked until unit economics (CPC/CPL) are clear enough to trust volume.',
          learnAbout: [
            'Stage definitions that sales and marketing share',
            'Conversion rate discipline',
            'Where deals die — and what to fix first',
          ],
        },
      ],
      edges: [
        { from: 'icp', to: 'offer' },
        { from: 'icp', to: 'channels' },
        { from: 'offer', to: 'cpc' },
        { from: 'channels', to: 'cpc' },
        { from: 'cpc', to: 'pipeline', locked: true },
      ],
    },
    tasks: [
      {
        id: 'task-offer-page',
        conceptId: 'offer',
        title: 'Write the offer wedge',
        prompt:
          'In ≤150 words, write a cold-outbound offer wedge for a B2B SaaS that sells inventory forecasting to mid-market retailers. Name the ICP pain, the promised outcome, and the low-friction CTA.',
        kind: 'text',
        starterText: 'For inventory leads at 20–200 store retailers…\n',
        evalNote: 'Prototype accepts any serious write-up (≥ 100 chars).',
      },
      {
        id: 'task-channel-plan',
        conceptId: 'channels',
        title: 'Channel mix for 30 leads/mo',
        prompt:
          'Sketch a channel mix to hit ~30 qualified meetings/month: % split across LinkedIn outbound, paid search, and partner referrals. Note one metric you’d watch per channel.',
        kind: 'editor',
        starterText: 'Target: 30 qualified meetings / month\n\n1. LinkedIn outbound —\n2. Paid search —\n3. Partners —\n',
        evalNote: 'Offline acceptance: non-empty plan with all three channels mentioned.',
      },
    ],
    synthPrompts: [
      {
        id: 'synth-cpl',
        conceptId: 'cpc',
        prompt:
          'Explain CPL vs CAC to a founder who confuses “cheap leads” with “cheap customers.” When is a $40 CPL a disaster?',
        rubricKeywords: ['cpl', 'cac', 'close', 'conversion', 'lead', 'quality', 'pipeline'],
        passFeedback: 'You connected lead cost to close rate and CAC. Review cards are live.',
        failFeedback:
          'Mention both CPL (cost per lead) and how conversion to revenue turns it into CAC. Cheap junk leads can make a “low CPL” expensive.',
        cardsOnPass: [
          {
            id: 'card-cpl-1',
            conceptId: 'cpc',
            front: 'When is a low CPL still bad?',
            back: 'When lead-to-close conversion is terrible — CAC = CPL / conversion. Cheap unqualified leads inflate pipeline noise and sales cost.',
          },
        ],
      },
    ],
    srs: [
      {
        id: 'card-seed-icp',
        conceptId: 'icp',
        front: 'What makes an ICP useful (not a persona poster)?',
        back: 'A buying context you can target: industry, size, trigger event, and who feels the pain enough to take a meeting.',
        ease: 2.5,
        intervalDays: 1,
        dueAt: new Date(Date.now() - 7200_000).toISOString(),
        reps: 0,
      },
    ],
    drills: [
      {
        id: 'drill-cpc',
        conceptId: 'cpc',
        title: 'CPC arithmetic — rapid fire',
        kind: 'rapid-calc',
        spec: { formula: 'cpc', rounds: 5, timeLimitSec: 40 },
      },
      {
        id: 'drill-icp-mcq',
        conceptId: 'icp',
        title: 'ICP sharpness',
        kind: 'mcq',
        spec: {
          question: 'Which ICP is sharp enough to write outbound copy against?',
          options: [
            '“SMB decision makers who care about growth”',
            '“Ops directors at 20–200 store US retailers after a stockout quarter”',
            '“Anyone who might need our software”',
          ],
          correctIndex: 1,
          explanation:
            'Sharp ICPs name role, segment, geography, and a trigger. Vague “SMB growth” ICPs produce mushy messaging.',
        },
      },
    ],
    metrics: emptyMetrics(),
  }
}
