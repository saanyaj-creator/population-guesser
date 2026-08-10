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
    ['Delhi', 'India', 28.6139, 77.2090],
    ['Shanghai', 'China', 31.2304, 121.4737],
    ['Dhaka', 'Bangladesh', 23.8103, 90.4125],
    ['Sao Paulo', 'Brazil', -23.5505, -46.6333],
    ['Osaka', 'Japan', 34.6937, 135.5023],
    ['Chongqing', 'China', 29.4316, 106.9123],
    ['Karachi', 'Pakistan', 24.8607, 67.0011],
    ['Kinshasa', 'DR Congo', -4.4419, 15.2663],
    ['Guangzhou', 'China', 23.1291, 113.2644],
    ['Tianjin', 'China', 39.3434, 117.3616],
    ['Lahore', 'Pakistan', 31.5497, 74.3436],
    ['Bangalore', 'India', 12.9716, 77.5946],
    ['Shenzhen', 'China', 22.5431, 114.0579],
    ['Chennai', 'India', 13.0827, 80.2707],
    ['Bogota', 'Colombia', 4.7110, -74.0721],
    ['Hyderabad', 'India', 17.3850, 78.4867],
    ['Nagoya', 'Japan', 35.1815, 136.9066],
    ['Chengdu', 'China', 30.5728, 104.0668],
    ['Nanjing', 'China', 32.0603, 118.7969],
    ['Tehran', 'Iran', 35.6892, 51.3890],
    ['Ho Chi Minh City', 'Vietnam', 10.8231, 106.6297],
    ['Luanda', 'Angola', -8.8390, 13.2894],
    ["Xi'an", 'China', 34.3416, 108.9398],
    ['Wuhan', 'China', 30.5928, 114.3055],
    ['Ahmedabad', 'India', 23.0225, 72.5714],
    ['Hangzhou', 'China', 30.2741, 120.1551],
    ['Suzhou', 'China', 31.2989, 120.5853],
    ['Hong Kong', 'China', 22.3193, 114.1694],
    ['Baghdad', 'Iraq', 33.3152, 44.3661],
    ['Riyadh', 'Saudi Arabia', 24.7136, 46.6753],
    ['Surat', 'India', 21.1702, 72.8311],
    ['Pune', 'India', 18.5204, 73.8567],
    ['Yangon', 'Myanmar', 16.8409, 96.1735],
    ['Alexandria', 'Egypt', 31.2001, 29.9187],
    ['Abidjan', "Cote d'Ivoire", 5.3600, -4.0083],
    ['Fukuoka', 'Japan', 33.5904, 130.4017],
    ['Melbourne', 'Australia', -37.8136, 144.9631],
    ['Ankara', 'Turkey', 39.9334, 32.8597],
    ['Kabul', 'Afghanistan', 34.5553, 69.2075],
    ['Chittagong', 'Bangladesh', 22.3569, 91.7832],
    ['Tel Aviv', 'Israel', 32.0853, 34.7818],
    ['Kolkata', 'India', 22.5726, 88.3639],
    ['Guadalajara', 'Mexico', 20.6597, -103.3496],
    ['Monterrey', 'Mexico', 25.6866, -100.3161],
    ['Medellin', 'Colombia', 6.2442, -75.5812],
    ['Saint Petersburg', 'Russia', 59.9311, 30.3609],
    ['Kyiv', 'Ukraine', 50.4501, 30.5234],
    ['Budapest', 'Hungary', 47.4979, 19.0402],
    ['Bucharest', 'Romania', 44.4268, 26.1025],
    ['Minsk', 'Belarus', 53.9006, 27.5590],
    ['Baku', 'Azerbaijan', 40.4093, 49.8671],
    ['Tashkent', 'Uzbekistan', 41.2995, 69.2401],
    ['Almaty', 'Kazakhstan', 43.2220, 76.8512],
    ['Yerevan', 'Armenia', 40.1792, 44.4991],
    ['Tbilisi', 'Georgia', 41.7151, 44.8271],
    ['Amman', 'Jordan', 31.9454, 35.9284],
    ['Beirut', 'Lebanon', 33.8938, 35.5018],
    ['Damascus', 'Syria', 33.5138, 36.2765],
    ['Doha', 'Qatar', 25.2854, 51.5310],
    ['Kuwait City', 'Kuwait', 29.3759, 47.9774],
    ['Muscat', 'Oman', 23.5880, 58.3829],
    ['Abu Dhabi', 'United Arab Emirates', 24.4539, 54.3773],
    ['Manama', 'Bahrain', 26.2285, 50.5860],
    ['Colombo', 'Sri Lanka', 6.9271, 79.8612],
    ['Kathmandu', 'Nepal', 27.7172, 85.3240],
    ['Phnom Penh', 'Cambodia', 11.5564, 104.9282],
    ['Vientiane', 'Laos', 17.9757, 102.6331],
    ['Taipei', 'Taiwan', 25.0330, 121.5654],
    ['Surabaya', 'Indonesia', -7.2575, 112.7521],
    ['Bandung', 'Indonesia', -6.9175, 107.6191],
    ['Ulaanbaatar', 'Mongolia', 47.8864, 106.9057],
    ['Pyongyang', 'North Korea', 39.0392, 125.7625],
    ['Busan', 'South Korea', 35.1796, 129.0756],
    ['Sapporo', 'Japan', 43.0618, 141.3545],
    ['Yokohama', 'Japan', 35.4437, 139.6380],
    ['Auckland', 'New Zealand', -36.8485, 174.7633],
    ['Brisbane', 'Australia', -27.4698, 153.0251],
    ['Perth', 'Australia', -31.9505, 115.8605],
    ['Adelaide', 'Australia', -34.9285, 138.6007],
    ['Ottawa', 'Canada', 45.4215, -75.6972],
    ['Calgary', 'Canada', 51.0447, -114.0719],
    ['Houston', 'United States', 29.7604, -95.3698],
    ['Phoenix', 'United States', 33.4484, -112.0740],
    ['San Francisco', 'United States', 37.7749, -122.4194],
    ['Boston', 'United States', 42.3601, -71.0589],
    ['Miami', 'United States', 25.7617, -80.1918],
    ['Washington', 'United States', 38.9072, -77.0369],
    ['Atlanta', 'United States', 33.7490, -84.3880],
    ['Dallas', 'United States', 32.7767, -96.7970],
    ['Philadelphia', 'United States', 39.9526, -75.1652],
    ['Barcelona', 'Spain', 41.3874, 2.1686],
    ['Milan', 'Italy', 45.4642, 9.1900],
    ['Naples', 'Italy', 40.8518, 14.2681],
    ['Munich', 'Germany', 48.1351, 11.5820],
    ['Hamburg', 'Germany', 53.5511, 9.9937],
    ['Marseille', 'France', 43.2965, 5.3698],
    ['Krakow', 'Poland', 50.0647, 19.9450],
    ['Zagreb', 'Croatia', 45.8150, 15.9819],
    ['Belgrade', 'Serbia', 44.7866, 20.4489],
    ['Sofia', 'Bulgaria', 42.6977, 23.3219],
    ['Copenhagen', 'Denmark', 55.6761, 12.5683],
    ['Oslo', 'Norway', 59.9139, 10.7522],
    ['Brussels', 'Belgium', 50.8503, 4.3517],
    ['Zurich', 'Switzerland', 47.3769, 8.5417],
    ['Addis Ababa', 'Ethiopia', 9.0300, 38.7400],
    ['Dar es Salaam', 'Tanzania', -6.7924, 39.2083],
    ['Accra', 'Ghana', 5.6037, -0.1870],
    ['Dakar', 'Senegal', 14.7167, -17.4677],
    ['Khartoum', 'Sudan', 15.5007, 32.5599],
    ['Algiers', 'Algeria', 36.7538, 3.0588],
    ['Tunis', 'Tunisia', 36.8065, 10.1815],
    ['Tripoli', 'Libya', 32.8872, 13.1913],
    ['Kampala', 'Uganda', 0.3476, 32.5825],
    ['Kigali', 'Rwanda', -1.9441, 30.0619],
    ['Harare', 'Zimbabwe', -17.8252, 31.0335],
    ['Lusaka', 'Zambia', -15.3875, 28.3228],
    ['Maputo', 'Mozambique', -25.9692, 32.5732],
    ['Antananarivo', 'Madagascar', -18.8792, 47.5079],
    ['Windhoek', 'Namibia', -22.5609, 17.0658],
    ['Caracas', 'Venezuela', 10.4806, -66.9036],
    ['Quito', 'Ecuador', -0.1807, -78.4678],
    ['La Paz', 'Bolivia', -16.4897, -68.1193],
    ['Montevideo', 'Uruguay', -34.9011, -56.1645],
    ['Asuncion', 'Paraguay', -25.2637, -57.5759],
    ['Havana', 'Cuba', 23.1136, -82.3666],
    ['San Jose', 'Costa Rica', 9.9281, -84.0907],
    ['Panama City', 'Panama', 8.9824, -79.5199],
    ['Guatemala City', 'Guatemala', 14.6349, -90.5069],
    ['Kingston', 'Jamaica', 17.9714, -76.7936],
    ['Santo Domingo', 'Dominican Republic', 18.4861, -69.9312],
    ['San Salvador', 'El Salvador', 13.6929, -89.2182],
    ['Tegucigalpa', 'Honduras', 14.0723, -87.1921],
    ['Managua', 'Nicaragua', 12.1364, -86.2514],
    ['Salvador', 'Brazil', -12.9777, -38.5016],
    ['Brasilia', 'Brazil', -15.7975, -47.8919],
    ['Porto Alegre', 'Brazil', -30.0346, -51.2177],
    ['Recife', 'Brazil', -8.0476, -34.8770],
    ['Fortaleza', 'Brazil', -3.7172, -38.5433],
    ['Belo Horizonte', 'Brazil', -19.9167, -43.9345],
    ['Curitiba', 'Brazil', -25.4284, -49.2733],
    ['Manaus', 'Brazil', -3.1190, -60.0217],
    ['Cordoba', 'Argentina', -31.4201, -64.1888],
    ['Guayaquil', 'Ecuador', -2.1894, -79.8891],
    ['Barranquilla', 'Colombia', 10.9639, -74.7964],
    ['Cali', 'Colombia', 3.4516, -76.5320],
    ['Port-au-Prince', 'Haiti', 18.5944, -72.3074],
    ['Nassau', 'Bahamas', 25.0343, -77.3963],
    ['Suva', 'Fiji', -18.1416, 178.4419],
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
