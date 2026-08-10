// Serverless function backing online, cross-device 2-player City Guesser
// rooms. Mirrors the pattern in netlify/functions/room.js (the Population
// Guesser game in this same repo): Netlify Blobs as a tiny key-value store,
// action-based routing, strong consistency, server-authoritative scoring so
// a client can't fake a distance/points value.
import { getStore } from '@netlify/blobs';

// Keep in sync with the CITIES array in public/city-guesser/index.html —
// this is the server's copy, used so a client can't submit an arbitrary
// "actual" location. [name, country, lat, lng]
const CITIES = [
  ['Paris', 'France', 48.8566, 2.3522],
  ['London', 'United Kingdom', 51.5074, -0.1278],
  ['New York', 'United States', 40.7128, -74.0060],
  ['Tokyo', 'Japan', 35.6762, 139.6503],
  ['Sydney', 'Australia', -33.8688, 151.2093],
  ['Cairo', 'Egypt', 30.0444, 31.2357],
  ['Rio de Janeiro', 'Brazil', -22.9068, -43.1729],
  ['Moscow', 'Russia', 55.7558, 37.6173],
  ['Beijing', 'China', 39.9042, 116.4074],
  ['Mumbai', 'India', 19.0760, 72.8777],
  ['Cape Town', 'South Africa', -33.9249, 18.4241],
  ['Toronto', 'Canada', 43.6532, -79.3832],
  ['Mexico City', 'Mexico', 19.4326, -99.1332],
  ['Buenos Aires', 'Argentina', -34.6037, -58.3816],
  ['Berlin', 'Germany', 52.5200, 13.4050],
  ['Rome', 'Italy', 41.9028, 12.4964],
  ['Bangkok', 'Thailand', 13.7563, 100.5018],
  ['Istanbul', 'Turkey', 41.0082, 28.9784],
  ['Seoul', 'South Korea', 37.5665, 126.9780],
  ['Nairobi', 'Kenya', -1.2921, 36.8219],
  ['Lagos', 'Nigeria', 6.5244, 3.3792],
  ['Jakarta', 'Indonesia', -6.2088, 106.8456],
  ['Dubai', 'United Arab Emirates', 25.2048, 55.2708],
  ['Singapore', 'Singapore', 1.3521, 103.8198],
  ['Vancouver', 'Canada', 49.2827, -123.1207],
  ['Madrid', 'Spain', 40.4168, -3.7038],
  ['Amsterdam', 'Netherlands', 52.3676, 4.9041],
  ['Vienna', 'Austria', 48.2082, 16.3738],
  ['Lima', 'Peru', -12.0464, -77.0428],
  ['Santiago', 'Chile', -33.4489, -70.6693],
  ['Reykjavik', 'Iceland', 64.1466, -21.9426],
  ['Wellington', 'New Zealand', -41.2865, 174.7762],
  ['Helsinki', 'Finland', 60.1699, 24.9384],
  ['Athens', 'Greece', 37.9838, 23.7275],
  ['Lisbon', 'Portugal', 38.7223, -9.1393],
  ['Warsaw', 'Poland', 52.2297, 21.0122],
  ['Prague', 'Czechia', 50.0755, 14.4378],
  ['Casablanca', 'Morocco', 33.5731, -7.5898],
  ['Manila', 'Philippines', 14.5995, 120.9842],
  ['Kuala Lumpur', 'Malaysia', 3.1390, 101.6869],
  ['Hanoi', 'Vietnam', 21.0278, 105.8342],
  ['Montreal', 'Canada', 45.5017, -73.5673],
  ['Chicago', 'United States', 41.8781, -87.6298],
  ['Los Angeles', 'United States', 34.0522, -118.2437],
  ['Johannesburg', 'South Africa', -26.2041, 28.0473],
  ['Dublin', 'Ireland', 53.3498, -6.2603],
  ['Stockholm', 'Sweden', 59.3293, 18.0686],
].map(([name, country, lat, lng]) => ({ name, country, lat, lng }));

const MAX_ROUNDS = 5;
const MAX_POINTS = 5000;
const EARTH_RADIUS_KM = 6371;
const ROUND_MS = 60000; // 60s to place a pin
const REVEAL_MS = 8000; // 8s to look at the result before auto-advancing
const ROOM_TTL_MS = 1000 * 60 * 60 * 6; // rooms older than 6h are treated as gone

function toRad(d) { return (d * Math.PI) / 180; }
function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function scoreForDistance(km) {
  return Math.max(0, Math.round(MAX_POINTS * Math.exp(-km / 2000)));
}

function randomRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startRound(state) {
  state.round += 1;
  state.current = CITIES[state.order[state.round - 1]];
  state.roundAnswers = {};
  state.roundStartedAt = Date.now();
  state.roundDeadline = state.roundStartedAt + ROUND_MS;
  state.revealUntil = null;
  state.lastRoundResult = null;
  state.status = 'in_progress';
}

async function recordToLeaderboard(store, state) {
  try {
    const lbStore = getStore({ name: 'city-leaderboard', consistency: 'strong' });
    const existing = (await lbStore.get('plays', { type: 'json' })) || [];
    const pids = Object.keys(state.players);
    const totals = {};
    pids.forEach((pid) => { totals[pid] = state.players[pid].totalScore; });
    const winner = pids.length === 2
      ? (totals.p1 > totals.p2 ? 'p1' : totals.p2 > totals.p1 ? 'p2' : 'tie')
      : null;
    const play = {
      id: `${state.roomId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: '2p-online',
      players: pids.map((pid) => ({ id: pid, name: state.players[pid].name })),
      rounds: state.history
        .reduce((rounds, h) => {
          let r = rounds.find((x) => x.round === h.round);
          if (!r) { r = { round: h.round, name: h.name, country: h.country, guesses: {} }; rounds.push(r); }
          r.guesses[h.playerId] = { distanceKm: h.distanceKm, points: h.score };
          return rounds;
        }, [])
        .sort((a, b) => a.round - b.round),
      totals: { p1: totals.p1 ?? null, p2: totals.p2 ?? null },
      winner,
    };
    existing.push(play);
    while (existing.length > 500) existing.shift();
    await lbStore.setJSON('plays', existing);
  } catch (e) {
    // Leaderboard recording is best-effort; never fail the game over it.
    console.error('recordToLeaderboard failed:', e);
  }
}

function resolveRoundIfNeeded(state) {
  if (state.status !== 'in_progress') return;
  const now = Date.now();
  const activeIds = Object.keys(state.players);
  const bothAnswered = activeIds.every((pid) => pid in state.roundAnswers);
  const timedOut = now >= state.roundDeadline;
  if (!bothAnswered && !timedOut) return;

  activeIds.forEach((pid) => {
    if (!(pid in state.roundAnswers)) {
      state.roundAnswers[pid] = { lat: null, lng: null, distanceKm: null, points: 0, timedOut: true };
    }
  });

  const result = {
    round: state.round,
    name: state.current.name,
    country: state.current.country,
    lat: state.current.lat,
    lng: state.current.lng,
    guesses: {},
  };

  activeIds.forEach((pid) => {
    const ans = state.roundAnswers[pid];
    state.players[pid].totalScore += ans.points;
    result.guesses[pid] = { lat: ans.lat, lng: ans.lng, distanceKm: ans.distanceKm, points: ans.points, timedOut: !!ans.timedOut };
    state.history.push({
      round: state.round,
      playerId: pid,
      playerName: state.players[pid].name,
      name: state.current.name,
      country: state.current.country,
      distanceKm: ans.distanceKm,
      score: ans.points,
      timedOut: !!ans.timedOut,
    });
  });

  state.lastRoundResult = result;
  state.status = 'revealing';
  state.revealUntil = Date.now() + REVEAL_MS;
}

async function advanceIfRevealDone(store, state) {
  if (state.status === 'revealing' && Date.now() >= state.revealUntil) {
    if (state.round >= MAX_ROUNDS) {
      state.status = 'ended';
      await recordToLeaderboard(store, state);
    } else {
      startRound(state);
    }
  }
}

// Strip the answer (lat/lng of the current city) from what's sent to
// clients while a round is still in progress.
function publicState(state) {
  const inProgress = state.status === 'in_progress';
  return {
    roomId: state.roomId,
    round: state.round,
    maxRounds: state.maxRounds,
    status: state.status,
    players: state.players,
    history: state.history,
    roundDeadline: state.roundDeadline,
    revealUntil: state.revealUntil,
    current: state.current ? { name: state.current.name, country: state.current.country, lat: inProgress ? null : state.current.lat, lng: inProgress ? null : state.current.lng } : null,
    lastRoundResult: state.lastRoundResult,
    answeredFlags: Object.fromEntries(Object.keys(state.players).map((pid) => [pid, pid in (state.roundAnswers || {})])),
  };
}

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

export default async (req, context) => {
  if (req.method === 'OPTIONS') return json({});

  const store = getStore({ name: 'city-rooms', consistency: 'strong' });
  let body = {};
  if (req.method === 'POST') {
    try { body = await req.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
  }
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams);
  const action = params.action || body.action;

  try {
    if (action === 'create') {
      const name = String(body.name || 'Player 1').slice(0, 24) || 'Player 1';
      let roomId;
      for (let attempt = 0; attempt < 5; attempt++) {
        roomId = randomRoomId();
        const existing = await store.get(roomId, { type: 'json' });
        if (!existing) break;
      }
      const state = {
        roomId,
        createdAt: Date.now(),
        order: shuffle(CITIES.map((_, i) => i)),
        round: 0,
        current: null,
        maxRounds: MAX_ROUNDS,
        players: { p1: { name, totalScore: 0 } },
        roundAnswers: {},
        history: [],
        status: 'waiting',
      };
      await store.setJSON(roomId, state);
      return json({ roomId, playerId: 'p1', state: publicState(state) });
    }

    if (action === 'join') {
      const roomId = String(body.roomId || '').toUpperCase().trim();
      const state = await store.get(roomId, { type: 'json' });
      if (!state) return json({ error: 'Room not found. Double-check the code.' }, 404);
      if (state.players.p2) {
        if (String(body.rejoin) === 'true') return json({ roomId, playerId: 'p2', state: publicState(state) });
        return json({ error: 'This room already has two players.' }, 400);
      }
      const name = String(body.name || 'Player 2').slice(0, 24) || 'Player 2';
      state.players.p2 = { name, totalScore: 0 };
      startRound(state);
      await store.setJSON(roomId, state);
      return json({ roomId, playerId: 'p2', state: publicState(state) });
    }

    if (action === 'state') {
      const roomId = String(params.roomId || '').toUpperCase().trim();
      const state = await store.get(roomId, { type: 'json' });
      if (!state) return json({ error: 'Room not found.' }, 404);
      if (Date.now() - state.createdAt > ROOM_TTL_MS) return json({ error: 'This room has expired. Start a new game.' }, 410);
      resolveRoundIfNeeded(state);
      await advanceIfRevealDone(store, state);
      await store.setJSON(roomId, state);
      return json({ state: publicState(state) });
    }

    if (action === 'guess') {
      const roomId = String(body.roomId || '').toUpperCase().trim();
      const playerId = String(body.playerId || '');
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      const state = await store.get(roomId, { type: 'json' });
      if (!state) return json({ error: 'Room not found.' }, 404);
      if (!(playerId in state.players)) return json({ error: 'Unknown player.' }, 400);
      if (state.status === 'in_progress' && !(playerId in state.roundAnswers) && isFinite(lat) && isFinite(lng)) {
        const normLng = ((lng + 180) % 360 + 360) % 360 - 180;
        const clampedLat = Math.max(-90, Math.min(90, lat));
        const distanceKm = haversineKm(clampedLat, normLng, state.current.lat, state.current.lng);
        state.roundAnswers[playerId] = { lat: clampedLat, lng: normLng, distanceKm, points: scoreForDistance(distanceKm), timedOut: false };
      }
      resolveRoundIfNeeded(state);
      await advanceIfRevealDone(store, state);
      await store.setJSON(roomId, state);
      return json({ state: publicState(state) });
    }

    if (action === 'end') {
      const roomId = String(body.roomId || '').toUpperCase().trim();
      const state = await store.get(roomId, { type: 'json' });
      if (!state) return json({ error: 'Room not found.' }, 404);
      if (state.status !== 'ended') {
        state.status = 'ended';
        await recordToLeaderboard(store, state);
      }
      await store.setJSON(roomId, state);
      return json({ state: publicState(state) });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    return json({ error: 'Server error: ' + e.message }, 500);
  }
};
