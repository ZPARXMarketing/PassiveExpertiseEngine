/**
 * Password gate in front of the whole site: pages, the app bundle and the AI endpoints
 * (so nobody can spend the OpenRouter credit without it). Runs first; see netlify.toml.
 *
 * The password is the APP_PASSWORD environment variable. A device that enters it gets
 * a long-lived HttpOnly cookie holding an HMAC of the password, so changing the
 * password signs every device out. With APP_PASSWORD unset the site stays open.
 */

import type { Context } from '@netlify/edge-functions'

const COOKIE = 'xe_auth'
const YEAR = 60 * 60 * 24 * 365

async function token(password: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('expertise-engine-auth-v1'))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** compare without stopping at the first difference */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const cookieOf = (req: Request) =>
  req.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1) ?? ''

export default async (req: Request, context: Context) => {
  const password = Netlify.env.get('APP_PASSWORD')
  if (!password) return context.next()

  const url = new URL(req.url)
  const expected = await token(password)

  if (url.pathname === '/__logout') {
    return new Response(null, {
      status: 303,
      headers: { location: '/', 'set-cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` },
    })
  }

  if (url.pathname === '/__login' && req.method === 'POST') {
    const form = await req.formData().catch(() => null)
    const given = String(form?.get('password') ?? '')
    if (same(await token(given), expected)) {
      return new Response(null, {
        status: 303,
        headers: {
          location: '/',
          'set-cookie': `${COOKIE}=${expected}; Path=/; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Lax`,
        },
      })
    }
    // slow down guessing
    await new Promise((r) => setTimeout(r, 1000))
    return loginPage(true)
  }

  if (same(cookieOf(req), expected)) return context.next()

  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Locked. Reload the page and enter the password.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  return loginPage(false)
}

function loginPage(wrong: boolean): Response {
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#07080d" /><meta name="robots" content="noindex" />
<title>Expertise Engine</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 16px;
    background: radial-gradient(50% 40% at 10% 0%, rgba(42,255,163,.07), transparent 70%), #07080d;
    color: #eef1f8; font: 16px/1.5 system-ui, -apple-system, sans-serif; }
  form { width: min(360px, 100%); padding: 28px 24px; border-radius: 16px; background: #10131c;
    border: 1px solid rgba(255,255,255,.12); box-shadow: 0 4px 24px rgba(0,0,0,.45); }
  h1 { margin: 0 0 4px; font-size: 22px; } h1 span { color: #2affa3; }
  p { margin: 0 0 20px; color: #9aa3b8; font-size: 14px; }
  input { width: 100%; height: 48px; padding: 0 16px; border-radius: 12px; font-size: 16px;
    border: 1px solid rgba(255,255,255,.16); background: #171b28; color: #eef1f8; outline: none; }
  input:focus { border-color: #2affa3; box-shadow: 0 0 0 3px rgba(42,255,163,.14); }
  button { margin-top: 12px; width: 100%; height: 48px; border: 0; border-radius: 999px; font-size: 16px;
    font-weight: 600; background: #2affa3; color: #04130c; cursor: pointer; }
  .err { margin: 10px 0 0; color: #ff5c7a; font-size: 14px; }
</style></head>
<body>
<form method="post" action="/__login">
  <h1><span>◆</span> Expertise Engine</h1>
  <p>Enter the password to continue. This device will stay signed in.</p>
  <input type="password" name="password" placeholder="Password" autocomplete="current-password" autofocus required />
  ${wrong ? '<div class="err">Wrong password.</div>' : ''}
  <button type="submit">Unlock</button>
</form>
</body></html>`
  return new Response(html, {
    status: wrong ? 401 : 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
