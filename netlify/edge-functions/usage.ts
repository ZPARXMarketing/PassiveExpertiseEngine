/**
 * Spend on the OpenRouter key this site uses: all time, this week, today (USD).
 * Reads OpenRouter's GET /key, which reports usage, usage_weekly and usage_daily.
 */

import type { Config } from '@netlify/edge-functions'
import { OPENROUTER_BASE_URL } from '../../src/app/prompts.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

export default async () => {
  const apiKey = Netlify.env.get('OPENROUTER_API_KEY')
  if (!apiKey) return json({ error: 'No OpenRouter key.' }, 501)
  const res = await fetch(`${OPENROUTER_BASE_URL}/key`, { headers: { authorization: `Bearer ${apiKey}` } }).catch(
    () => null,
  )
  if (!res?.ok) return json({ error: `OpenRouter returned ${res?.status ?? 'nothing'}.` }, 502)
  const { data } = (await res.json()) as { data?: Record<string, unknown> }
  const num = (v: unknown) => (typeof v === 'number' ? v : null)
  return json({ total: num(data?.usage), week: num(data?.usage_weekly), day: num(data?.usage_daily) })
}

export const config: Config = { path: '/api/usage', method: 'GET' }
