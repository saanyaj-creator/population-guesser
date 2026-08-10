// Global, cross-device leaderboard/history for City Guesser.
//
// Backed by the same Netlify Blobs store ('city-leaderboard', key 'plays')
// that netlify/functions/city-room.js writes to when an online 2-player
// game ends. This function additionally lets clients record locally-played
// games (1 player, or 2 players sharing one screen/device) so every mode
// ends up in the same global history — and lets any client read it back.
//
// The client (public/city-guesser/index.html) falls back to localStorage
// automatically if this endpoint is unreachable (e.g. when the file is
// opened directly from disk rather than served by Netlify), so this is an
// enhancement, not a hard dependency.
import { getStore } from '@netlify/blobs';

const MAX_ENTRIES = 500;
const MAX_ROUNDS = 5;
const MAX_POINTS = 5000;

function json(obj, statusCode) {
  return new Response(JSON.stringify(obj), {
    status: statusCode || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}

function isValidScore(n) {
  return typeof n === 'number' && isFinite(n) && n >= 0 && n <= MAX_POINTS * MAX_ROUNDS;
}

// Light validation — this is a casual local-history feature, not a
// security boundary, but we don't want garbage breaking the leaderboard
// table or percentile math for everyone else.
function sanitizePlay(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const mode = raw.mode === '2p' || raw.mode === '2p-online' ? raw.mode : '1p';
  const players = Array.isArray(raw.players) ? raw.players.slice(0, 2).map((p) => ({
    id: p && p.id === 'p2' ? 'p2' : 'p1',
    name: String((p && p.name) || 'Player').slice(0, 24),
  })) : [{ id: 'p1', name: 'Player 1' }];
  const totals = raw.totals && typeof raw.totals === 'object' ? raw.totals : {};
  if (!isValidScore(totals.p1)) return null;
  if (mode !== '1p' && !isValidScore(totals.p2)) return null;

  const rounds = Array.isArray(raw.rounds) ? raw.rounds.slice(0, MAX_ROUNDS).map((r) => ({
    round: typeof r.round === 'number' ? r.round : undefined,
    name: String((r && r.name) || '').slice(0, 60),
    country: String((r && r.country) || '').slice(0, 60),
    guesses: r && typeof r.guesses === 'object' ? r.guesses : {},
  })) : [];

  return {
    id: String(raw.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 80),
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : new Date().toISOString(),
    mode,
    players,
    rounds,
    totals: { p1: totals.p1, p2: mode === '1p' ? null : totals.p2 },
    winner: raw.winner === 'p1' || raw.winner === 'p2' || raw.winner === 'tie' ? raw.winner : null,
  };
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') return json({});

  const store = getStore({ name: 'city-leaderboard', consistency: 'strong' });

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 100));
      const plays = (await store.get('plays', { type: 'json' })) || [];
      return json({ plays: plays.slice(-limit) });
    }

    if (req.method === 'POST') {
      let body = {};
      try { body = await req.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
      const play = sanitizePlay(body.play);
      if (!play) return json({ error: 'Invalid play record.' }, 400);

      const existing = (await store.get('plays', { type: 'json' })) || [];
      existing.push(play);
      while (existing.length > MAX_ENTRIES) existing.shift();
      await store.setJSON('plays', existing);
      return json({ ok: true, count: existing.length });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (e) {
    return json({ error: 'Server error: ' + e.message }, 500);
  }
};
