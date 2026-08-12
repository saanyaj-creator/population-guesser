// Serverless function backing online 2-player rooms.
// Uses Netlify Blobs as a tiny key-value store, so no external database
// or extra account is needed. Deployed automatically wherever this repo
// is deployed on Netlify.
import { getStore } from '@netlify/blobs';

const COUNTRIES = [{"name":"Abkhazia","pop":245424},{"name":"Afghanistan","pop":32890171},{"name":"Albania","pop":2829741},{"name":"Algeria","pop":45400000},{"name":"American Samoa (United States)","pop":49710},{"name":"Andorra","pop":81057},{"name":"Angola","pop":33086278},{"name":"Anguilla (United Kingdom)","pop":15701},{"name":"Antigua and Barbuda","pop":100772},{"name":"Argentina","pop":47327407},{"name":"Armenia","pop":2963900},{"name":"Artsakh","pop":148900},{"name":"Aruba (Netherlands)","pop":111050},{"name":"Australia","pop":26031842},{"name":"Austria","pop":9090868},{"name":"Azerbaijan","pop":10204774},{"name":"Bahamas","pop":393450},{"name":"Bahrain","pop":1501635},{"name":"Bangladesh","pop":165158616},{"name":"Barbados","pop":282000},{"name":"Belarus","pop":9255524},{"name":"Belgium","pop":11671737},{"name":"Belize","pop":441471},{"name":"Benin","pop":12506347},{"name":"Bermuda (United Kingdom)","pop":64055},{"name":"Bhutan","pop":763200},{"name":"Bolivia","pop":12006031},{"name":"Bosnia and Herzegovina","pop":3320954},{"name":"Botswana","pop":2410338},{"name":"Brazil","pop":215639618},{"name":"British Virgin Islands (United Kingdom)","pop":31000},{"name":"Brunei","pop":429999},{"name":"Bulgaria","pop":6520314},{"name":"Burkina Faso","pop":21510181},{"name":"Burundi","pop":12574571},{"name":"Cambodia","pop":15552211},{"name":"Cameroon","pop":24348251},{"name":"Canada","pop":39078010},{"name":"Cape Verde","pop":563198},{"name":"Cayman Islands (United Kingdom)","pop":71105},{"name":"Central African Republic","pop":5633412},{"name":"Chad","pop":16818391},{"name":"Chile","pop":19828563},{"name":"China","pop":1412600000},{"name":"Christmas Island (Australia)","pop":1692},{"name":"Cocos (Keeling) Islands (Australia)","pop":593},{"name":"Colombia","pop":51049498},{"name":"Comoros","pop":758316},{"name":"Congo (Republic of the Congo)","pop":5970000},{"name":"Cook Islands (New Zealand)","pop":15040},{"name":"Costa Rica","pop":5163038},{"name":"Croatia","pop":3871833},{"name":"Cuba","pop":11113215},{"name":"Curaçao (Netherlands)","pop":153671},{"name":"Cyprus","pop":918100},{"name":"Czech Republic","pop":10525739},{"name":"DR Congo (Democratic Republic of the Congo)","pop":99010000},{"name":"Denmark","pop":5928364},{"name":"Djibouti","pop":976107},{"name":"Dominica","pop":73000},{"name":"Dominican Republic","pop":10535535},{"name":"East Timor","pop":1317780},{"name":"Ecuador","pop":18143540},{"name":"Egypt","pop":104316399},{"name":"El Salvador","pop":6825935},{"name":"Equatorial Guinea","pop":1505588},{"name":"Eritrea","pop":3684000},{"name":"Estonia","pop":1331796},{"name":"Eswatini","pop":1202000},{"name":"Ethiopia","pop":105163988},{"name":"Falkland Islands (United Kingdom)","pop":3800},{"name":"Faroe Islands (Denmark)","pop":54227},{"name":"Fiji","pop":898402},{"name":"Finland","pop":5528796},{"name":"France","pop":67989000},{"name":"French Polynesia (France)","pop":279890},{"name":"Gabon","pop":2233272},{"name":"Gambia","pop":2706000},{"name":"Georgia (country)","pop":3688600},{"name":"Germany","pop":84270625},{"name":"Ghana","pop":30832019},{"name":"Gibraltar (United Kingdom)","pop":33000},{"name":"Greece","pop":10432481},{"name":"Greenland (Denmark)","pop":56619},{"name":"Grenada","pop":125000},{"name":"Guam (United States)","pop":153836},{"name":"Guatemala","pop":17109746},{"name":"Guernsey (British Crown Dependency)","pop":63823},{"name":"Guinea","pop":12907395},{"name":"Guinea-Bissau","pop":1646077},{"name":"Guyana","pop":743699},{"name":"Haiti","pop":11743017},{"name":"Honduras","pop":9546178},{"name":"Hong Kong (China)","pop":7403100},{"name":"Hungary","pop":9689000},{"name":"Iceland","pop":385230},{"name":"India","pop":1375586000},{"name":"Indonesia","pop":275773800},{"name":"Iran","pop":86102915},{"name":"Iraq","pop":41190700},{"name":"Ireland","pop":5123536},{"name":"Isle of Man (British Crown Dependency)","pop":84069},{"name":"Israel","pop":9662240},{"name":"Italy","pop":58887359},{"name":"Ivory Coast (Côte d'Ivoire)","pop":29389150},{"name":"Jamaica","pop":2734093},{"name":"Japan","pop":124840000},{"name":"Jersey (British Crown Dependency)","pop":107800},{"name":"Jordan","pop":11384980},{"name":"Kazakhstan","pop":19390048},{"name":"Kenya","pop":47564296},{"name":"Kiribati","pop":120740},{"name":"Kosovo","pop":1798188},{"name":"Kuwait","pop":4670713},{"name":"Kyrgyzstan","pop":7000000},{"name":"Laos","pop":7337783},{"name":"Latvia","pop":1895400},{"name":"Lebanon","pop":5490000},{"name":"Lesotho","pop":2306000},{"name":"Liberia","pop":4661010},{"name":"Libya","pop":6812000},{"name":"Liechtenstein","pop":39444},{"name":"Lithuania","pop":2839020},{"name":"Luxembourg","pop":645397},{"name":"Macau (China)","pop":683200},{"name":"Madagascar","pop":26923353},{"name":"Malawi","pop":21507723},{"name":"Malaysia","pop":32764000},{"name":"Maldives","pop":383135},{"name":"Mali","pop":22594000},{"name":"Malta","pop":519562},{"name":"Marshall Islands","pop":39262},{"name":"Mauritania","pop":4271197},{"name":"Mauritius","pop":1266334},{"name":"Mexico","pop":128533664},{"name":"Micronesia (Federated States of)","pop":105754},{"name":"Moldova","pop":2597100},{"name":"Monaco","pop":39150},{"name":"Mongolia","pop":3477113},{"name":"Montenegro","pop":621306},{"name":"Montserrat (United Kingdom)","pop":4400},{"name":"Morocco","pop":36836432},{"name":"Mozambique","pop":31616078},{"name":"Myanmar","pop":55294979},{"name":"Namibia","pop":2550226},{"name":"Nauru","pop":11832},{"name":"Nepal","pop":29192480},{"name":"Netherlands","pop":17784810},{"name":"New Caledonia (France)","pop":273674},{"name":"New Zealand","pop":5138226},{"name":"Nicaragua","pop":6595674},{"name":"Niger","pop":24112753},{"name":"Nigeria","pop":218541000},{"name":"Niue (New Zealand)","pop":1549},{"name":"Norfolk Island (Australia)","pop":2188},{"name":"North Korea","pop":25660000},{"name":"North Macedonia","pop":1832696},{"name":"Northern Cyprus","pop":382836},{"name":"Northern Mariana Islands (United States)","pop":47329},{"name":"Norway","pop":5475240},{"name":"Oman","pop":4527446},{"name":"Pakistan","pop":235825000},{"name":"Palau","pop":16733},{"name":"Palestine","pop":5227193},{"name":"Panama","pop":4278500},{"name":"Papua New Guinea","pop":9122994},{"name":"Paraguay","pop":7353038},{"name":"Peru","pop":33396698},{"name":"Philippines","pop":112948444},{"name":"Pitcairn Islands (United Kingdom)","pop":47},{"name":"Poland","pop":37796000},{"name":"Portugal","pop":10344802},{"name":"Puerto Rico (United States)","pop":3285874},{"name":"Qatar","pop":2799202},{"name":"Romania","pop":19053815},{"name":"Russia","pop":146980061},{"name":"Rwanda","pop":12955768},{"name":"Saint Barthélemy (France)","pop":10289},{"name":"Saint Helena, Ascension and Tristan da Cunha (United Kingdom)","pop":5651},{"name":"Saint Kitts and Nevis","pop":48000},{"name":"Saint Lucia","pop":178696},{"name":"Saint Martin (France)","pop":32489},{"name":"Saint Pierre and Miquelon (France)","pop":5974},{"name":"Saint Vincent and the Grenadines","pop":110696},{"name":"Samoa","pop":199853},{"name":"San Marino","pop":33785},{"name":"Saudi Arabia","pop":35013414},{"name":"Senegal","pop":17223497},{"name":"Serbia","pop":6690887},{"name":"Seychelles","pop":100447},{"name":"Sierra Leone","pop":8494260},{"name":"Singapore","pop":5453600},{"name":"Sint Maarten (Netherlands)","pop":42577},{"name":"Slovakia","pop":5431344},{"name":"Slovenia","pop":2108977},{"name":"Solomon Islands","pop":728041},{"name":"Somalia","pop":17598000},{"name":"South Africa","pop":60604992},{"name":"South Korea","pop":51638809},{"name":"South Ossetia","pop":53532},{"name":"South Sudan","pop":13249924},{"name":"Spain","pop":47615034},{"name":"Sri Lanka","pop":22181000},{"name":"Sudan","pop":45070300},{"name":"Suriname","pop":598000},{"name":"Sweden","pop":10520558},{"name":"Switzerland","pop":8789726},{"name":"Syria","pop":22125000},{"name":"São Tomé and Príncipe","pop":214610},{"name":"Taiwan","pop":23375314},{"name":"Tajikistan","pop":9506000},{"name":"Tanzania","pop":61741120},{"name":"Thailand","pop":66882305},{"name":"Togo","pop":7886000},{"name":"Tokelau (New Zealand)","pop":1647},{"name":"Tonga","pop":100179},{"name":"Transnistria","pop":306000},{"name":"Trinidad and Tobago","pop":1367558},{"name":"Tunisia","pop":11803588},{"name":"Turkey","pop":84680273},{"name":"Turkmenistan","pop":6431000},{"name":"Turks and Caicos Islands (United Kingdom)","pop":44542},{"name":"Tuvalu","pop":10679},{"name":"U.S. Virgin Islands (United States)","pop":87146},{"name":"Uganda","pop":42885900},{"name":"Ukraine","pop":41130432},{"name":"United Arab Emirates","pop":9282410},{"name":"United Kingdom","pop":67026292},{"name":"United States","pop":334233854},{"name":"Uruguay","pop":3554915},{"name":"Uzbekistan","pop":35992584},{"name":"Vanuatu","pop":301295},{"name":"Vatican City","pop":825},{"name":"Venezuela","pop":28302000},{"name":"Vietnam","pop":99460000},{"name":"Wallis and Futuna (France)","pop":11369},{"name":"Western Sahara","pop":576000},{"name":"Yemen","pop":33697000},{"name":"Zambia","pop":19610769},{"name":"Zimbabwe","pop":15178979},{"name":"Åland (Finland)","pop":30402}];

const MAX_ROUNDS = 10;
const ROUND_MS = 30000;
const REVEAL_MS = 15000;
const ROOM_TTL_MS = 1000 * 60 * 60 * 6; // rooms older than 6h are treated as gone

function scoreFor(pctOff) {
  return Math.max(0, Math.round(100 - pctOff));
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

function pickCountry(state) {
  if (state.orderIdx >= state.order.length) {
    state.order = shuffle(COUNTRIES.map((_, i) => i));
    state.orderIdx = 0;
  }
  const country = COUNTRIES[state.order[state.orderIdx]];
  state.orderIdx += 1;
  return country;
}

function startRound(state) {
  state.round += 1;
  state.current = pickCountry(state);
  state.roundAnswers = {};
  state.roundStartedAt = Date.now();
  state.roundDeadline = state.roundStartedAt + ROUND_MS;
  state.revealUntil = null;
  state.status = 'in_progress';
}

function resolveRoundIfNeeded(state) {
  if (state.status !== 'in_progress') return;
  const now = Date.now();
  const activeIds = Object.keys(state.players);
  const bothAnswered = activeIds.every(pid => pid in state.roundAnswers);
  const timedOut = now >= state.roundDeadline;
  if (!bothAnswered && !timedOut) return;

  activeIds.forEach(pid => {
    if (!(pid in state.roundAnswers)) {
      state.roundAnswers[pid] = { guess: null, pct: null, score: 0, timedOut: true };
    }
  });

  activeIds.forEach(pid => {
    const ans = state.roundAnswers[pid];
    state.players[pid].totalScore += ans.score;
    state.history.push({
      round: state.round,
      playerId: pid,
      playerName: state.players[pid].name,
      name: state.current.name,
      guess: ans.guess,
      actual: state.current.pop,
      pct: ans.pct,
      score: ans.score,
      timedOut: !!ans.timedOut
    });
  });

  state.status = 'revealing';
  // No longer auto-advances after a fixed delay — players now move on by
  // explicitly hitting "Next Round" (the 'next' action below). revealUntil
  // is kept around only in case older clients still read it for display.
  state.revealUntil = Date.now() + REVEAL_MS;
}

function advanceToNext(state) {
  if (state.status !== 'revealing') return;
  if (state.round >= MAX_ROUNDS) {
    state.status = 'ended';
  } else {
    startRound(state);
  }
}

// Strip anything a client shouldn't see before it's fair (the current
// population, and the raw shuffled order) or that they don't need.
function publicState(state) {
  const safe = {
    roomId: state.roomId,
    round: state.round,
    maxRounds: state.maxRounds,
    status: state.status,
    mode: state.mode || 'duo',
    players: state.players,
    history: state.history,
    roundDeadline: state.roundDeadline,
    revealUntil: state.revealUntil,
    current: state.current ? { name: state.current.name } : null,
    answeredFlags: {}
  };
  Object.keys(state.players).forEach(pid => {
    safe.answeredFlags[pid] = pid in (state.roundAnswers || {});
  });
  return safe;
}

function json(obj, statusCode) {
  return new Response(JSON.stringify(obj), {
    status: statusCode || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    }
  });
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') return json({});

  const store = getStore({ name: 'rooms', consistency: 'strong' });
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
      const mode = body.mode === 'solo' ? 'solo' : 'duo';
      let roomId;
      // avoid (very unlikely) collisions
      for (let attempt = 0; attempt < 5; attempt++) {
        roomId = randomRoomId();
        const existing = await store.get(roomId, { type: 'json' });
        if (!existing) break;
      }
      const state = {
        roomId: roomId,
        createdAt: Date.now(),
        mode: mode,
        order: shuffle(COUNTRIES.map((_, i) => i)),
        orderIdx: 0,
        round: 0,
        current: null,
        maxRounds: MAX_ROUNDS,
        players: { p1: { name: name, totalScore: 0 } },
        roundAnswers: {},
        history: [],
        status: 'waiting'
      };
      // Solo games have no one to wait for — start round 1 immediately.
      // The round-resolution logic below already works for any number of
      // players since it just checks every current player has answered.
      if (mode === 'solo') startRound(state);
      await store.setJSON(roomId, state);
      return json({ roomId: roomId, playerId: 'p1', state: publicState(state) });
    }

    if (action === 'join') {
      const roomId = String(body.roomId || '').toUpperCase().trim();
      const state = await store.get(roomId, { type: 'json' });
      if (!state) return json({ error: 'Room not found. Double-check the link or code.' }, 404);
      if (state.players.p2) {
        if (String(body.rejoin) === 'true') {
          return json({ roomId: roomId, playerId: 'p2', state: publicState(state) });
        }
        return json({ error: 'This room already has two players.' }, 400);
      }
      const name = String(body.name || 'Player 2').slice(0, 24) || 'Player 2';
      state.players.p2 = { name: name, totalScore: 0 };
      // Wait for an explicit "Start Game" click rather than starting the
      // instant player 2 joins, so both players get a moment to see they're
      // both in before the clock starts on round 1.
      state.status = 'ready';
      await store.setJSON(roomId, state);
      return json({ roomId: roomId, playerId: 'p2', state: publicState(state) });
    }

    if (action === 'start') {
      const roomId = String(body.roomId || '').toUpperCase().trim();
      const state = await store.get(roomId, { type: 'json' });
      if (!state) return json({ error: 'Room not found.' }, 404);
      if (state.status === 'ready') startRound(state);
      await store.setJSON(roomId, state);
      return json({ state: publicState(state) });
    }

    if (action === 'state') {
      const roomId = String(params.roomId || '').toUpperCase().trim();
      const state = await store.get(roomId, { type: 'json' });
      if (!state) return json({ error: 'Room not found.' }, 404);
      if (Date.now() - state.createdAt > ROOM_TTL_MS) return json({ error: 'This room has expired. Start a new game.' }, 410);
      resolveRoundIfNeeded(state);
      await store.setJSON(roomId, state);
      return json({ state: publicState(state) });
    }

    if (action === 'guess') {
      const roomId = String(body.roomId || '').toUpperCase().trim();
      const playerId = String(body.playerId || '');
      const guess = Number(body.guess);
      const state = await store.get(roomId, { type: 'json' });
      if (!state) return json({ error: 'Room not found.' }, 404);
      if (!(playerId in state.players)) return json({ error: 'Unknown player.' }, 400);
      if (state.status === 'in_progress' && !(playerId in state.roundAnswers) && isFinite(guess) && guess >= 0) {
        const actual = state.current.pop;
        const pct = Math.abs(guess - actual) / actual * 100;
        state.roundAnswers[playerId] = { guess: guess, pct: pct, score: scoreFor(pct), timedOut: false };
      }
      resolveRoundIfNeeded(state);
      await store.setJSON(roomId, state);
      return json({ state: publicState(state) });
    }

    // Rounds no longer advance on a timer — the player(s) explicitly click
    // "Next Round" once they're done looking at the reveal, which calls this.
    if (action === 'next') {
      const roomId = String(body.roomId || '').toUpperCase().trim();
      const state = await store.get(roomId, { type: 'json' });
      if (!state) return json({ error: 'Room not found.' }, 404);
      advanceToNext(state);
      await store.setJSON(roomId, state);
      return json({ state: publicState(state) });
    }

    if (action === 'end') {
      const roomId = String(body.roomId || '').toUpperCase().trim();
      const state = await store.get(roomId, { type: 'json' });
      if (!state) return json({ error: 'Room not found.' }, 404);
      state.status = 'ended';
      await store.setJSON(roomId, state);
      return json({ state: publicState(state) });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    return json({ error: 'Server error: ' + e.message }, 500);
  }
};
