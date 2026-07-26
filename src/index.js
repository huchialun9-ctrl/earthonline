import { GameRoom } from './do/GameRoom';
export { GameRoom };

const ALLOWED_ORIGINS = [
  'https://twonline.dpdns.org',
  'http://localhost:5173',
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : 'https://twonline.dpdns.org',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const path = url.pathname;

    // Health check
    if (path === '/health') {
      return json({ status: 'ok', timestamp: Date.now() }, corsHeaders);
    }

    // Static assets
    if (!path.startsWith('/api/') && path !== '/ws') {
      return env.ASSETS.fetch(request);
    }

    // WebSocket upgrade to Durable Object
    if (path === '/ws') {
      const region = url.searchParams.get('region') || 'asia';
      const stub = env.GAME_ROOM.getByName(region);
      return stub.fetch(request);
    }

    let actionPath = '';
    try {
      if (path.startsWith('/api/')) {
        const parts = path.split('/').filter(Boolean);

        const isRegionPath = parts.length >= 3 && ['asia', 'us', 'eu'].includes(parts[1]);
        actionPath = isRegionPath ? parts.slice(2).join('/') : parts.slice(1).join('/');

        // POST /api/:region?/register or /api/register
        if ((actionPath === 'register' || actionPath.endsWith('/register')) && request.method === 'POST') {
          return handleRegister(request, env, corsHeaders);
        }

        // POST /api/:region?/login or /api/login
        if ((actionPath === 'login' || actionPath.endsWith('/login')) && request.method === 'POST') {
          return handleLogin(request, env, corsHeaders);
        }

        // GET /api/auth/discord
        if (actionPath === 'auth/discord') {
          const state = url.searchParams.get('state');
          if (!state) return json({ error: 'Missing state' }, corsHeaders, 400);
          const redirectUri = `${url.origin}/api/auth/discord/callback`;
          const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify&state=${state}`;
          return Response.redirect(discordAuthUrl, 302);
        }

        // GET /api/auth/discord/callback
        if (actionPath === 'auth/discord/callback') {
          return handleDiscordCallback(request, env, corsHeaders, url);
        }

        // GET /api/login-callback?token=xxx — stores token to localStorage and redirects to /
        if (actionPath === 'login-callback') {
          const token = url.searchParams.get('token');
          if (!token) return new Response('Missing token', { status: 400 });
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>localStorage.setItem('eo_token','${token}');window.location.href='/'</script></body></html>`;
          return new Response(html, { headers: { 'content-type': 'text/html;charset=utf-8' } });
        }

        // GET /api/debug — test HTML redirect
        if (actionPath === 'debug') {
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/?token=debug_test_token"></head><body>Redirecting...<script>localStorage.setItem('eo_token','debug_test_token');window.location.href='/?token=debug_test_token'</script></body></html>`;
          return new Response(html, { headers: { 'content-type': 'text/html;charset=utf-8' } });
        }

        // GET /api/:region?/leaderboard
        if (actionPath === 'leaderboard' || actionPath.endsWith('/leaderboard')) {
          return handleLeaderboard(request, env, corsHeaders);
        }

        // POST /api/bind-discord-manual
        if (actionPath === 'bind-discord-manual' && request.method === 'POST') {
          return handleBindDiscord(request, env, corsHeaders);
        }

        // POST /api/:region?/auth/send-verification
        if (actionPath.endsWith('/auth/send-verification') && request.method === 'POST') {
          return json({ success: false, error: 'Email verification not yet available' }, corsHeaders, 501);
        }

        // POST /api/:region?/auth/verify-email
        if (actionPath.endsWith('/auth/verify-email') && request.method === 'POST') {
          return json({ success: false, error: 'Email verification not yet available' }, corsHeaders, 501);
        }

        // GET /api/:region?/auth/me
        if (actionPath.endsWith('/auth/me') && request.method === 'GET') {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, corsHeaders, 401);
          }
          const token = authHeader.slice(7);
          const payload = verifyJWT(token, env.JWT_SECRET);
          if (!payload) return json({ error: 'Invalid token' }, corsHeaders, 401);
          const account = await env.DB.prepare('SELECT username, role, discord_username, discord_avatar, country FROM accounts WHERE username = ?').bind(payload.username).first();
          if (!account) return json({ error: 'Not found' }, corsHeaders, 404);
          return json({
            username: account.username,
            role: account.role || 'user',
            discord: account.discord_username ? { username: account.discord_username, avatar: account.discord_avatar } : null,
            country: account.country || 'TW'
          }, corsHeaders);
        }
      }
    } catch (err) {
      return json({ error: 'Internal error' }, corsHeaders, 500);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleRegister(request, env, corsHeaders) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) return json({ error: 'Missing fields' }, corsHeaders, 400);
    if (username.length < 2 || username.length > 20) return json({ error: '用戶名需 2-20 字元' }, corsHeaders, 400);
    if (password.length < 4) return json({ error: '密碼至少 4 字元' }, corsHeaders, 400);

    const existing = await env.DB.prepare('SELECT username FROM accounts WHERE username = ?').bind(username).first();
    if (existing) return json({ error: '用戶名已存在' }, corsHeaders, 409);

    const hash = await hashPassword(password);
    await env.DB.prepare(
      'INSERT INTO accounts (username, password_hash, country, created_at) VALUES (?, ?, ?, ?)'
    ).bind(username, hash, 'TW', Date.now()).run();

    const token = await createJWT({ username }, env.JWT_SECRET);
    return json({ success: true, token, username }, corsHeaders);
  } catch (err) {
    console.error('Register error:', err.message, err.stack);
    return json({ error: err.message || 'Register failed' }, corsHeaders, 500);
  }
}

async function handleLogin(request, env, corsHeaders) {
  const { username, password } = await request.json();
  if (!username || !password) return json({ error: 'Missing fields' }, corsHeaders, 400);

  const account = await env.DB.prepare('SELECT username, password_hash FROM accounts WHERE username = ?').bind(username).first();
  if (!account) return json({ error: '用戶名或密碼錯誤' }, corsHeaders, 401);

  const valid = verifyPassword(password, account.password_hash);
  if (!valid) return json({ error: '用戶名或密碼錯誤' }, corsHeaders, 401);

  const token = await createJWT({ username: account.username }, env.JWT_SECRET);
  return json({ success: true, token, user: { username: account.username } }, corsHeaders);
}

async function handleDiscordCallback(request, env, corsHeaders, url) {
  try {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    if (error || !code || !state) {
      const reason = error ? `Discord returned: ${error}` : (code ? 'Missing state' : 'Missing code');
      return new Response(`<html><body><h2>Discord Auth Failed</h2><p>${reason}</p><a href="/">Back</a></body></html>`, { status: 400, headers: { 'content-type': 'text/html;charset=utf-8' } });
    }

    const redirectUri = `${url.origin}/api/auth/discord/callback`;
    const bodyParams = new URLSearchParams();
    bodyParams.append('client_id', env.DISCORD_CLIENT_ID);
    bodyParams.append('client_secret', env.DISCORD_CLIENT_SECRET);
    bodyParams.append('code', code);
    bodyParams.append('grant_type', 'authorization_code');
    bodyParams.append('redirect_uri', redirectUri);
    bodyParams.append('scope', 'identify');

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: bodyParams.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      const errMsg = tokenData.error_description || JSON.stringify(tokenData);
      return new Response(`<html><body><h2>Discord OAuth Error</h2><p>${errMsg}</p><p>client_id: ${env.DISCORD_CLIENT_ID}</p><p>redirect_uri: ${redirectUri}</p><a href="/">Back</a></body></html>`, { status: 400, headers: { 'content-type': 'text/html;charset=utf-8' } });
    }

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `${tokenData.token_type} ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    let account = await env.DB.prepare('SELECT username FROM accounts WHERE discord_id = ?').bind(userData.id).first();
    if (!account) {
      let baseName = (userData.global_name || userData.username).replace(/\s+/g, '_');
      let finalName = baseName, counter = 1;
      while (await env.DB.prepare('SELECT username FROM accounts WHERE username = ?').bind(finalName).first()) {
        finalName = `${baseName}_${counter++}`;
      }
      await env.DB.prepare(
        'INSERT INTO accounts (username, password_hash, discord_id, discord_username, discord_avatar, country, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(finalName, '', userData.id, userData.global_name || userData.username, '', 'TW', Date.now()).run();
      account = { username: finalName };
    }
    const token = createJWT({ username: account.username }, env.JWT_SECRET);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>localStorage.setItem('eo_token','${token}');window.location.href='/'</script></body></html>`;
    return new Response(html, { headers: { 'content-type': 'text/html;charset=utf-8' } });
  } catch (err) {
    return new Response(`<html><body><h2>Callback Internal Error</h2><p>${err.message}</p><a href="/">Back</a></body></html>`, { status: 500, headers: { 'content-type': 'text/html;charset=utf-8' } });
  }
}

async function handleLeaderboard(request, env, corsHeaders) {
  const accounts = await env.DB.prepare(
    'SELECT username, discord_username, discord_avatar, country, role FROM accounts ORDER BY username LIMIT 100'
  ).all();
  return json(accounts.results || [], corsHeaders);
}

async function handleBindDiscord(request, env, corsHeaders) {
  const { token, discordId } = await request.json();
  if (!token || !discordId) return json({ error: 'Missing fields' }, corsHeaders, 400);

  let payload;
  try { payload = await verifyJWT(token, env.JWT_SECRET); } catch {
    return json({ error: 'Invalid token' }, corsHeaders, 401);
  }

  const avatar = `https://cdn.discordapp.com/embed/avatars/${(BigInt(discordId) >> 22n) % 6n}.png`;
  await env.DB.prepare(
    'UPDATE accounts SET discord_id = ?, discord_username = ?, discord_avatar = ? WHERE username = ?'
  ).bind(discordId, discordId, avatar, payload.username).run();

  return json({ success: true }, corsHeaders);
}

function json(data, headers, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'content-type': 'application/json' },
  });
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

import { createHmac } from 'node:crypto';

function base64urlFromBuf(buf) {
  return buf.toString('base64url');
}

function createJWT(payload, secret) {
  const headerB64 = base64urlFromBuf(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const bodyB64 = base64urlFromBuf(Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 86400 * 30 })));
  const sig = createHmac('sha256', secret).update(`${headerB64}.${bodyB64}`).digest('base64url');
  return `${headerB64}.${bodyB64}.${sig}`;
}

function verifyJWT(token, secret) {
  try {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [headerB64, bodyB64, sig] = parts;
  const expectedSig = createHmac('sha256', secret).update(`${headerB64}.${bodyB64}`).digest('base64url');
  if (expectedSig !== sig) return null;
  const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString());
  if (payload.exp < Date.now() / 1000) return null;
  return payload;
  } catch { return null; }
}

import { createHash } from 'node:crypto';

function hashPassword(password) {
  return createHash('sha256').update(password + ':eo2026').digest('hex');
}

function verifyPassword(password, stored) {
  return hashPassword(password) === stored;
}
