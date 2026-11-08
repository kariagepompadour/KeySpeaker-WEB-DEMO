"use strict";
/* ================= 240x135 frame buffer and the Cardputer's 6x8 font ================= */
const W = 240, H = 135;
const fb = new Uint32Array(W * H);
const rgb = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const BLACK = rgb(0, 0, 0);
const COL_BG = BLACK, COL_FG = rgb(255, 255, 255), COL_DIM = rgb(132, 130, 132), COL_OK = rgb(0, 255, 0),
      COL_WARN = rgb(255, 255, 0), COL_BAD = rgb(255, 0, 0), COL_AMBER = rgb(255, 165, 0);
const BUILD_TAG = "WEB-2";

function px(x, y, c) { if (x >= 0 && x < W && y >= 0 && y < H) fb[y * W + x] = c; }
function fillRect(x, y, w, h, c) {
  x |= 0; y |= 0;
  for (let j = Math.max(0, y); j < Math.min(H, y + h); j++)
    for (let i = Math.max(0, x); i < Math.min(W, x + w); i++) fb[j * W + i] = c;
}
function dot(x, y, c) { fillRect(x, y, 3, 3, c); }

// 5x7 glyphs for ASCII 0x20..0x7E, five columns each, bit 0 is the top row.
const FONT = ("0000000000,00005F0000,0007000700,147F147F14,242A7F2A12,2313086462,3649562050,0005030000,001C224100,0041221C00,"
 + "2A1C7F1C2A,08083E0808,0050300000,0808080808,0060600000,2010080402,3E5149453E,00427F4000,4261514946,2141454B31,"
 + "1814127F10,2745454539,3C4A494930,0171090503,3649494936,064949291E,0036360000,0056360000,0814224100,1414141414,"
 + "0041221408,0201510906,32497941 3E,7E1111117E,7F49494936,3E41414122,7F4141221C,7F49494941,7F09090901,3E41495 17A,"
 + "7F0808087F,00417F4100,2040413F01,7F08142241,7F40404040,7F020C027F,7F040810 7F,3E4141413E,7F09090906,3E4151215E,"
 + "7F09192946,4649494931,01017F0101,3F4040403F,1F2040201F,3F4038403F,6314081463,0708700807,6151494543,007F414100,"
 + "0204081020,0041417F00,0402010204,4040404040,0001020400,2054545478,7F48444438,3844444420,38444448 7F,3854545418,"
 + "087E090102,0C5252523E,7F08040478,00447D4000,2040443D00,7F10284400,00417F4000,7C04180478,7C08040478,3844444438,"
 + "7C14141408,08141418 7C,7C08040408,4854545420,043F444020,3C4040207C,1C2040201C,3C4030403C,4428102844,0C5050503C,"
 + "4464544C44,0008364100,00007F0000,0041360800,08082A1C08").replace(/ /g, "").split(",").map(h => {
   const a = []; for (let i = 0; i < 10; i += 2) a.push(parseInt(h.substr(i, 2), 16)); return a; });

function drawChar(ch, x, y, size, c) {
  const g = FONT[ch.charCodeAt(0) - 32]; if (!g) return;
  for (let col = 0; col < 5; col++)
    for (let row = 0; row < 7; row++)
      if (g[col] & (1 << row)) fillRect(x + col * size, y + row * size, size, size, c);
}
function drawString(str, x, y, c, size = 1) { for (let i = 0; i < str.length; i++) drawChar(str[i], x + i * 6 * size, y, size, c); }
const textWidth = (s, size = 1) => s.length * 6 * size;

/* ================= FlightViz (ported from FlightViz.h) ================= */
const FV = (() => {
  const BAR_W = 6, PITCH = 8, COLS = W / PITCH + 2, COL_MS = 267, SEG_H = 3, SEG_PITCH = 4;
  const SCROLL_PX_S = PITCH * 1000 / COL_MS, TOP = 12, NSEG = 20, MAX_BAR = NSEG * SEG_PITCH, GROUND = SEG_PITCH;
  const SPAN_DB = 8, MID = 0.45, AVG_RATE = 0.08, DB_SILENT = -60;
  const DOT = 3, SHIP_DW = 9, SHIP_DH = 4, SHIP_W = SHIP_DW * DOT, SHIP_H = SHIP_DH * DOT;
  const SHIP_X_MID = 40, SHIP_X_SWING = 24, SHIP_EASE_S = 0.9, SHIP_CLEAR = 26;
  const FIRE_MS_MIN = 2400, FIRE_MS_MAX = 4000;
  const LASER_PX_S = 900, LASER_HOLD_S = 0.12, LASER_TAIL_PX_S = 650, LASER_H = 2;
  const BOMB_MS_MIN = 3500, BOMB_MS_MAX = 6000, BOMB_VX = 50, BOMB_G = 140;
  const MAX_MISSILES = 6, MAX_BOMBS = 4, MAX_BURSTS = 6, BURST_S = 0.45, POP_S = 1.1, POP_SPARKS = 16, NSTARS = 40;
  const STAR_FAR_PX_S = 5, STAR_NEAR_PX_S = 11;
  const FFT_N = 512, FFT_LOG2 = 9, EQ_BANDS = W / PITCH, EQ_BIN_LO = 1;
  const EQ_SPAN_DB = 12, EQ_MID = 0.4, EQ_AVG_S = 2.5, EQ_NSEG = NSEG / 2;
  const EQ_FALL_SEG_S = 28, PEAK_HOLD_S = 0.5, PEAK_FALL_SEG_S = 9, EQ_SILENT_RMS = 33;
  const MODE_MS = 60000, MODE_MIN_MS = 15000, GAP_MS = 1500, FADE_S = 0.45, CRATER_SEG = 3;
  const BEAT_DB = 1.5, BEAT_RISE_DB = 1.0, SPAWN_MS_MIN = 1600, SPAWN_MS_MAX = 4500, SPAWN_MS_QUIET = 6000;
  const MAT_S = 0.7, MAT_R = 46, MAX_TARGETS = 3, MAX_ENEMIES = 6, SWARM_N = 3, MINE_MS = 800, MINE_S = 3.0, MAX_MINES = 8;
  const EFIRE_MS_MIN = 2200, EFIRE_MS_MAX = 4000, EBULLET_PX_S = 65, MAX_EBULLETS = 6;
  const DODGE_GAP = 3, DODGE_LOOK_S = 0.9, DODGE_EASE_S = 0.18, SHIELD_MS = 350;
  const CHASE_EASE_S = 0.35, CHASE_CLEAR = 6, LUNGE_PX = 18, LUNGE_EASE_S = 0.6, AIM_FIRE_MS = 450, ENGAGE_X = W - 80;
  let EQ_BIN_HI = 170;

  const SHIP = ["M........", "MWWCC....", "WWWWWWWWW", ".BMMMMB.."];
  const WALKER = 0, SAUCER = 1, MUTANT = 2, BOMBER = 3, POD = 4, SWARMER = 5;
  const KINDS = [
    { dw: 5, dh: 3, pxS: 18, wave: 5, waveHz: 2.2, art: [[".PPP.", "PEPEP", "G.G.G"], [".PPP.", "PEPEP", ".G.G."]] },
    { dw: 7, dh: 2, pxS: 42, wave: 2, waveHz: 5.0, art: [["..CCC..", "OYOOOYO"], ["..CCC..", "OOOYOOO"]] },
    { dw: 5, dh: 4, pxS: 30, wave: 10, waveHz: 3.0, art: [["R...R", ".RRR.", "RYRYR", ".M.M."], [".R.R.", ".RRR.", "RYRYR", "M.M.M"]] },
    { dw: 3, dh: 3, pxS: 12, wave: 8, waveHz: 1.2, art: [["QQQ", "QYQ", "QQQ"], ["QQQ", "QWQ", "QQQ"]] },
    { dw: 3, dh: 3, pxS: 15, wave: 4, waveHz: 1.5, art: [[".S.", "SVS", ".S."], ["S.S", ".V.", "S.S"]] },
    { dw: 2, dh: 1, pxS: 55, wave: 4, waveHz: 8.0, art: [["OR"], ["RO"]] },
  ];
  const enemyW = e => KINDS[e.kind].dw * DOT, enemyH = e => KINDS[e.kind].dh * DOT;
  const formed = e => e.born >= MAT_S;

  /* ---- KONG (trial): a half-screen ape behind the terrain. It walks in from the right with the terrain, reaches for
     the fighter, misses (the fighter slips away) and throws a tantrum. Feet on the bottom edge, behind everything. ---- */
  const KONG_W = 23, KONG_H = 30, KW = KONG_W * DOT, KH = KONG_H * DOT;   // 69 x 90 px: the head clears all but the loudest bars
  const K_IDLE = 0, K_WALK = 1, K_REACH = 2, K_GRAB = 3, K_MISS = 4, K_FAIL = 5, K_LEAVE = 6, K_THREAT = 7;
  const K_DUR = { [K_THREAT]: 1.3, [K_REACH]: 0.8, [K_GRAB]: 0.22, [K_MISS]: 0.45, [K_FAIL]: 2.6 };
  const K_SPEED = { [K_THREAT]: 0.4, [K_WALK]: 1, [K_REACH]: 0.6, [K_GRAB]: 0.3, [K_MISS]: 0.3, [K_FAIL]: 0.12, [K_LEAVE]: 1 };
  const K_ARM = 26, K_START_DX = 44, K_CHASE_DX = 36, K_GAP_MIN = 1.0, K_GAP_VAR = 1.2, K_RETRY_R = 55, K_NOTICE_DX = 84, K_EVADE_PX = 17, K_HANG = 44;
  const KONG_MS_MIN = 24000, KONG_MS_MAX = 56000;   // between two visits: about half as often as before, so it stays a treat
  const kongFirstMs = () => (typeof location !== "undefined" && /kong=now|squid=/.test(location.search)) ? 1500 : 10000;
  const forcedKind = s => { const q = typeof location !== "undefined" ? location.search : ""; return /squid=1/.test(q) ? 1 : /squid=0/.test(q) ? 0 : nextRandom(s) % 100 < 50 ? 1 : 0; };   // each visit: the ape or the squid, by lot (?squid=1 / ?squid=0 force one)
  // The monster from the Space Invaders cabinet art: a black, hairy beast with horn-like ears, shoulders hunched up around a
  // small head, glowing yellow eyes (no pupils) and a red rim light on its left edge. Drawn from a silhouette (spans per row).
  const SPANS = [
    [[6, 6], [16, 16]], [[6, 7], [15, 16]], [[6, 16]], [[7, 15]], [[7, 15]],                                          // small horn ears, head
    [[2, 20]], [[1, 21]], [[0, 22]], [[0, 22]], [[0, 22]], [[0, 22]], [[1, 21]], [[1, 21]], [[2, 20]], [[3, 19]], [[4, 18]],   // shoulders, chest
    [[5, 17]], [[5, 17]], [[5, 17]],                                                                                  // waist
    [[5, 17]], [[4, 10], [12, 18]], [[3, 10], [12, 19]], [[2, 9], [13, 20]], [[2, 9], [13, 20]], [[2, 9], [13, 20]],   // bow legs: thick thighs, the knees point out,
    [[3, 9], [13, 19]], [[3, 9], [13, 19]], [[3, 9], [13, 19]], [[2, 9], [13, 20]], [[1, 9], [13, 21]],                   // the shins come back in, the big feet point out
  ];
  // face: 7 wide x 4 tall at columns 8-14, rows 3-6. D dark face, E glowing yellow slanted eye. No mouth, as in the original art.
  const FACES = {
    calm:  ["DDDDDDD", "EDDDDDE", "DEEDEED", "DDDDDDD"],
    reach: ["DDDDDDD", "EDDDDDE", "DEEDEED", "DDDDDDD"],
    angry: ["DDDDDDD", "EEDDDEE", "DEEDEED", "DDDDDDD"],
  };
  // Lit from the left, as in the original: each part has a band of red along its left edge (wide on the shoulders and chest,
  // thin on the waist), everything else is dark. Edges toward the right and the bottom are the darkest.
  const KONG_BASE = (() => {
    const seg = (r, c) => r < 0 || r >= KONG_H || c < 0 || c >= KONG_W ? -1 : SPANS[r].findIndex(([a, z]) => c >= a && c <= z);
    return Array.from({ length: KONG_H }, (_, r) => Array.from({ length: KONG_W }, (_, c) => {
      const i = seg(r, c); if (i < 0) return ".";
      const start = SPANS[r][i][0], w = r <= 1 ? 1 : r <= 15 ? 3 : r <= 18 ? 1 : i === 1 ? (r >= 27 ? 4 : 2) : 1;
      if (c - start < w) return "B";
      if (seg(r, c + 1) < 0 || seg(r + 1, c) < 0 || seg(r - 1, c) < 0) return "K";
      return "R";
    }));
  })();
  let KC = { B: rgb(212, 38, 46), K: rgb(40, 20, 24), R: rgb(40, 20, 24), T: rgb(40, 20, 24), D: rgb(40, 20, 24), E: rgb(255, 226, 64), W: rgb(255, 255, 255),
               arm: rgb(40, 20, 24), armEdge: rgb(212, 38, 46), armShade: rgb(40, 20, 24), hand: rgb(40, 20, 24), rim: rgb(190, 34, 42), mark: rgb(255, 60, 40), spark: rgb(255, 255, 255) };
  // Colour variants (S9-3): the same monster in six colours. Each visit draws one by lot (weights below); a palette is only three
  // colours, the lit edge, the dark body and the eyes, so the arms follow too. Eyes are chosen to stand out from the body.
  const PALS = [
    { lit: rgb(212, 38, 46), dark: rgb(40, 20, 24), eye: rgb(255, 226, 64) },    // 0 red, the original
    { lit: rgb(70, 120, 235), dark: rgb(16, 22, 46), eye: rgb(120, 255, 255) },  // 1 blue
    { lit: rgb(60, 190, 84), dark: rgb(14, 34, 20), eye: rgb(255, 90, 60) },     // 2 green
    { lit: rgb(176, 76, 224), dark: rgb(34, 16, 44), eye: rgb(120, 255, 160) },  // 3 purple
    { lit: rgb(240, 192, 56), dark: rgb(54, 38, 10), eye: rgb(255, 255, 255) },  // 4 gold, rare
    { lit: rgb(222, 232, 255), dark: rgb(38, 42, 62), eye: rgb(255, 60, 90) },   // 5 ghost white
  ];
  const PAL_PERCENT = [30, 16, 16, 16, 10, 12];   // how often each comes (sums to 100)
  const KCS = PALS.map(p => ({ ...KC, B: p.lit, K: p.dark, R: p.dark, T: p.dark, D: p.dark, E: p.eye, arm: p.dark, armEdge: p.lit, armShade: p.dark, hand: p.dark }));
  const pickPal = s => { let r = nextRandom(s) % 100, i = 0; while (i < PAL_PERCENT.length - 1 && r >= PAL_PERCENT[i]) r -= PAL_PERCENT[i++]; return i; };

  const newKong = () => ({ kind: 0, pal: 0, noReach: false, nextAct: 0, nextAt: 0, doThreat: false, threatDone: false, threat: 0, tries: 0, maxTries: 1, arm: 0, chase: false, style: 0, ph: K_IDLE, t: 0, x: W, nextMs: 0, tx: 0, ty: 0, face: "calm", sx: 0, sy: 0, hand: [0, 0], hand2: [0, 0] });
  const kongShoulder = k => [Math.round(k.x) + 7, H - KH + 7 * DOT + 2];       // arm toward the fighter (left)
  const kongShoulder2 = k => [Math.round(k.x) + 19 * DOT + 1, H - KH + 8 * DOT + 3];     // the other arm
  const clampReach = (sx, sy, tx, ty, r) => { const d = Math.hypot(tx - sx, ty - sy); return d <= r ? [tx, ty] : [sx + (tx - sx) * r / d, sy + (ty - sy) * r / d]; };
  const ease3 = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };

  function updateKong(s, now, dt, shipCx, shipCy) {
    const k = s.k; k.shipCx = shipCx;
    if (k.nextMs === 0) k.nextMs = now + kongFirstMs();
    k.t += dt;
    let evadeTgt = 0;
    // it appears only while music is playing (3 s of sound; a gap of up to 2 s between notes or songs does not count as silence)
    if (s.prevDb > DB_SILENT) { if (!k.musicSince) k.musicSince = now; k.lastMusic = now; }
    else if (now - (k.lastMusic || 0) > 2000) k.musicSince = 0;
    const musicOk = !!k.musicSince && now - k.musicSince >= 3000;
    if (k.ph === K_IDLE) {
      if (musicOk && now - k.nextMs >= 0) { k.ph = K_WALK; k.t = 0; k.x = W + 4; k.face = "calm"; k.chase = nextRandom(s) % 100 < 40; k.pal = pickPal(s); k.tries = 0; k.nextAct = 0; k.threatDone = false;
        // Every visit plays out differently: how many times it may reach (1 to 3), whether it first makes itself big, and now and then
        // it only bluffs (the display, no reach at all).
        { const r = nextRandom(s) % 100; k.maxTries = r < 35 ? 1 : r < 75 ? 2 : 3; }
        k.doThreat = nextRandom(s) % 100 < 55; k.noReach = nextRandom(s) % 100 < 12;
        k.kind = forcedKind(s);
        if (k.kind === 1) { k.doThreat = false; k.chase = false; k.noReach = false; k.pal = pickSquidPal(s); k.doPre = nextRandom(s) % 100 < 60; k.doPost = nextRandom(s) % 100 < 50; k.maxTries = 2; k.sc = 0; k.legs = [0, 0]; k.rise = 0; k.preDone = k.postDone = false; } }   // each visit, by lot: a reach before the fighter passes (6 in 10) and another after it has passed (5 in 10), alone or together
      return evadeTgt;
    }
    if (k.kind === 1) return updateSquid(s, now, dt, shipCx, shipCy);
    k.x -= SCROLL_PX_S * (K_SPEED[k.ph] || 1) * dt;
    const [shx, shy] = kongShoulder(k);
    if (k.ph === K_WALK) {
      const [s2x, s2y] = kongShoulder2(k);
      if (k.doThreat && !k.threatDone && k.x < W - KW - 6 && shx - shipCx <= K_NOTICE_DX && shx - shipCx > -10) {
        // It has noticed the fighter: before anything else it makes itself look big (arms up, or one up and one down), once a visit.
        k.ph = K_THREAT; k.t = 0; k.threatDone = true; k.threat = nextRandom(s) % 3; k.face = "angry";
      } else if (!k.noReach && k.tries < k.maxTries && !k.chase && k.x < W - KW - 6 && shx - shipCx <= K_START_DX && shx - shipCx > -10 && Math.hypot(shx - shipCx, shy - shipCy) <= 2 * K_ARM * 1.25) {   // close enough: lock on to where the fighter is and reach
        k.ph = K_REACH; k.t = 0; k.tx = shipCx; k.ty = shipCy; k.face = "reach"; k.style = nextRandom(s) % 4; k.arm = 0; k.tries++;
      } else if (!k.noReach && k.tries < k.maxTries && k.chase && s2x - shipCx <= 4 && s2x - shipCx >= -K_CHASE_DX && Math.hypot(s2x - shipCx, s2y - shipCy) <= 2 * K_ARM - 1) {   // it let the fighter pass: now it reaches back after it
        k.ph = K_REACH; k.t = 0; k.tx = shipCx; k.ty = shipCy; k.face = "reach"; k.style = nextRandom(s) % 4; k.arm = 1; k.tries++;
      }
    } else if (k.ph === K_THREAT) {
      if (k.t >= K_DUR[K_THREAT]) { k.ph = K_WALK; k.t = 0; k.face = "calm"; }
    } else if (k.ph === K_REACH && k.t >= K_DUR[K_REACH]) { k.ph = K_GRAB; k.t = 0; }
    else if (k.ph === K_GRAB) {
      evadeTgt = shipCy > 52 ? -K_EVADE_PX : K_EVADE_PX;                    // the fighter slips away as the fist closes
      if (k.t >= K_DUR[K_GRAB]) { k.ph = K_MISS; k.t = 0; }
    } else if (k.ph === K_MISS) {
      evadeTgt = shipCy > 52 ? -K_EVADE_PX : K_EVADE_PX;
      if (k.t >= K_DUR[K_MISS]) {
        k.ph = K_LEAVE; k.t = 0; k.face = "calm";   // no tantrum: it just draws its arm back
        const r = nextRandom(s) % 100;                // and then, maybe: 45 % reach again, 20 % make itself big, 35 % walk on
        k.nextAct = k.tries >= k.maxTries ? (r < 20 ? 2 : 0) : r < 45 ? 1 : r < 65 ? 2 : 0;
        k.nextAt = K_GAP_MIN + (nextRandom(s) % 1000) / 1000 * K_GAP_VAR;
      }   // no tantrum: it just draws its arm back and walks on
    } else if (k.ph === K_LEAVE && k.nextAct && k.t >= k.nextAt) {
      // After a miss it waits a moment (a second or more, never in a hurry) and then, only sometimes, does something more: reaches
      // again if the fighter is still close (with the nearer arm: the far one if the fighter has slipped past on its right), or
      // makes itself big once more. Often it does neither and just walks on.
      const [s2x, s2y] = kongShoulder2(k), d1 = Math.hypot(shx - shipCx, shy - shipCy), d2 = Math.hypot(s2x - shipCx, s2y - shipCy);
      const act = k.nextAct; k.nextAct = 0;
      if (act === 1 && Math.min(d1, d2) <= K_RETRY_R && k.x < W - KW - 6) {
        k.ph = K_REACH; k.t = 0; k.tx = shipCx; k.ty = shipCy; k.face = "reach"; k.style = nextRandom(s) % 4; k.arm = d2 < d1 ? 1 : 0; k.tries++;
      } else if (act === 2) {
        k.ph = K_THREAT; k.t = 0; k.threat = nextRandom(s) % 3; k.face = "angry";
      }
    } else if (k.ph === K_FAIL && k.t >= K_DUR[K_FAIL]) { k.ph = K_LEAVE; k.t = 0; }
    if (k.x < -KW - 4) { k.ph = K_IDLE; k.nextMs = now + KONG_MS_MIN + nextRandom(s) % (KONG_MS_MAX - KONG_MS_MIN); }
    return evadeTgt;
  }

  // Two-link arm from the shoulder to the hand, the elbow bent downward. Drawn in the same 3 x 3 px dots as the body and the other
  // characters, on the body's own dot grid (gx, gy is where the body's grid starts), so nothing is finer than a dot.
  function drawArm(sx, sy, hx, hy, side, gx, gy) {
    [hx, hy] = clampReach(sx, sy, hx, hy, 2 * K_ARM - 1);
    const d = Math.max(1, Math.hypot(hx - sx, hy - sy)), ux = (hx - sx) / d, uy = (hy - sy) / d, h = Math.sqrt(Math.max(0, K_ARM * K_ARM - d * d / 4));
    let nx = -uy, ny = ux; if (nx * side * 0.7 + ny * 0.7 < 0) { nx = -nx; ny = -ny; }   // elbow out and down, never toward the body
    const ex = sx + ux * d / 2 + nx * h, ey = sy + uy * d / 2 + ny * h;
    const blk = (x, y, n, c, dx = 0) => {   // n x n dots whose middle dot sits on the grid point nearest to x, y
      const o = DOT * (n >> 1);
      fillRect(gx + DOT * Math.round((x - gx) / DOT) - o + dx * DOT, gy + DOT * Math.round((y - gy) / DOT) - o, n * DOT, n * DOT, c);
    };
    const limb = (x0, y0, x1, y1, c, n, dx = 0) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / DOT));
      for (let i = 0; i <= steps; i++) blk(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, n, c, dx);
    };
    // red (the lit edge) first, then the dark core on top, shifted right so the red shows on the left; the far shoulder stays dark
    limb(sx, sy, ex, ey, side > 0 ? KC.armShade : KC.armEdge, 3); limb(ex, ey, hx, hy, KC.armEdge, 4);   // the forearm is the thicker one
    limb(sx, sy, ex, ey, KC.arm, 2, 1); limb(ex, ey, hx, hy, KC.arm, 3);
    return [Math.round(hx), Math.round(hy), ux, uy, blk];
  }
  function drawHand(x, y, ux, uy, open, lit, blk) {
    blk(x, y, 3, KC.armShade);   // the palm: 3 x 3 dots in the arm's own dark colour
    // claws: three curved spikes of one or two dots along the arm's direction (spread wide when the hand is open)
    const spread = open ? 0.8 : 0.42, a0 = Math.atan2(uy, ux);
    for (const f of [-1, 0, 1]) {
      const a = a0 + f * spread;
      for (const t of open ? [7, 10] : [7]) {
        const bend = f * 0.05 * (t - 4);
        blk(x + Math.cos(a + bend) * t, y + Math.sin(a + bend) * t, 1, lit ? KC.armEdge : KC.armShade);
      }
    }
  }

  function renderKong(s, now, front) {   // front = false: the body (behind the terrain); front = true: both arms (in front of everything)
    const k = s.k;
    KC = KCS[k.pal] || KCS[0];
    if (k.ph === K_IDLE) return;
    if (k.kind === 1) return renderSquid(s, now, front);
    const fail = k.ph === K_FAIL, tr = Math.floor(now / 70) & 1;
    // stomping tantrum: the whole body hops and shakes
    const stomp = fail ? Math.abs(Math.sin(now * 0.012)) : 0;
    const bx = Math.round(k.x) + (fail ? (tr ? 1 : -1) : 0), by = H - KH - Math.round(stomp * 4);
    const frame = Math.floor(now / 330) & 1, walking = k.ph === K_WALK || k.ph === K_LEAVE;
    const [s1x, s1y] = [bx + 7, by + 7 * DOT + 2], [s2x, s2y] = [bx + 21 * DOT, by + 7 * DOT + 2];
    // while it waits (walking in, or walking off) the arms just hang, still
    const air = [[s1x - 4, s1y + K_HANG], [s2x + 4, s2y + K_HANG]], sh = [[s1x, s1y], [s2x, s2y]], ds = [-1, 1];
    // Each time the monster reaches, one arm (k.arm: 0 the near one, 1 the far one, which catches the fighter as the monster walks
    // past it) comes at the fighter from a different side (k.style, drawn by lot when it starts):
    //   0 from the right, straight in   1 from above, an overhand smash   2 from below, an underhand scoop
    //   3 from the left, swinging past the fighter and hooking back
    // and the other arm helps with a pose of its own (st): 1 claws too, 2 pounds its chest, 4 stays down, 3 goes high and smashes down.
    const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    const reaching = k.ph === K_REACH || k.ph === K_GRAB || k.ph === K_MISS, pound = (Math.sin(now * 0.02) + 1) / 2, st = [1, 2, 4, 3][k.style];
    const at = [k.tx, k.ty], wp = [null, [k.tx + 6, k.ty - 36], [k.tx + 4, k.ty + 36], [k.tx - 8, k.ty - 6]][k.style];
    const uR = k.ph === K_REACH ? ease3(k.t / K_DUR[K_REACH]) : 1, snap = k.ph === K_GRAB ? ease3(k.t / K_DUR[K_GRAB]) : k.ph === K_MISS ? 1 : 0;
    const fistOpen = k.ph === K_REACH || (k.ph === K_GRAB && k.t < K_DUR[K_GRAB] * 0.5);   // the fingers snap shut
    const pose = [null, null];                                                               // [hand x, y, open] for each arm
    for (let i = 0; i < 2; i++) {
      const [sx, sy] = sh[i], hang = air[i], d = ds[i];
      if (k.ph === K_THREAT) {   // making itself big: 0 both arms up, 1 the near arm up and the far one down, 2 the far arm up and the near one down
        const T = K_DUR[K_THREAT], e = ease3(Math.min(1, k.t / 0.3, (T - k.t) / 0.3)), up = k.threat === 0 || (k.threat === 1 ? i === 0 : i === 1);
        const goal = up ? [sx + 10 * d, sy - 46] : [sx + 16 * d, sy + 34], sway = 2.5 * Math.sin(now * 0.012 + i * 1.7);
        const h = mix(hang, [goal[0], goal[1] + sway], e);
        pose[i] = [h[0], h[1], true]; continue;
      }
      if (fail) { const u = (Math.sin(now * 0.016 + (i ? 1.6 : 0)) + 1) / 2; pose[i] = [sx + 10 * d - 26 * d * u, sy - 30 + 40 * u, false]; continue; }   // pounding the chest / fists in the air
      if (i === k.arm) {                                                                     // the arm that goes for the fighter
        if (reaching) {
          const h = k.ph === K_REACH ? (wp ? mix(hang, wp, uR) : mix([sx, sy], at, uR)) : (k.ph === K_GRAB && wp ? mix(wp, at, snap) : at);
          pose[i] = [h[0], h[1], fistOpen];
        } else if (k.ph === K_LEAVE && k.t < 0.5 && k.tx) pose[i] = [...mix(at, hang, ease3(k.t / 0.5)), false];   // the arm is drawn back
        else pose[i] = [hang[0], hang[1], false];
      } else {                                                                               // the other arm
        const fx = [k.tx + 10 * d, k.ty - 8], up = [sx + 2 * d, sy - 34];
        if (reaching) {
          let h = hang, open = false;
          if (st === 1) { h = k.ph === K_REACH ? mix(hang, fx, ease3((k.t - 0.12) / (K_DUR[K_REACH] - 0.12))) : fx; open = fistOpen; }
          else if (st === 2) { h = [sx - d * (16 + 6 * pound), sy + 12 + 5 * pound]; if (uR < 1) h = mix(hang, h, uR); }
          else if (st === 3) { h = k.ph === K_REACH ? mix(hang, up, uR) : mix(up, fx, snap); open = k.ph === K_REACH; }
          pose[i] = [h[0], h[1], open];
        } else if (k.ph === K_LEAVE && k.t < 0.5 && k.tx && st !== 4) {
          const h = mix(st === 1 || st === 3 ? fx : [sx - d * 19, sy + 14], hang, ease3(k.t / 0.5));
          pose[i] = [h[0], h[1], false];
        } else pose[i] = [hang[0], hang[1], false];
      }
    }
    // body
    const face = FACES[k.face];
    for (let r = 0; r < KONG_H && !front; r++) {
      for (let c = 0; c < KONG_W; c++) {
        let ch = KONG_BASE[r][c]; if (ch === '.') continue;
        if (r >= 3 && r <= 6 && c >= 8 && c <= 14) ch = face[r - 3][c - 8];
        if (r === KONG_H - 1 && walking && (frame ? c >= 11 : c <= 10)) continue;   // the lifted foot of the walk
        dot(bx + c * DOT, by + r * DOT, KC[ch]);
      }
    }
    // both arms are drawn in the front pass
    if (front) for (const i of [1, 0]) { const [hx, hy, open] = pose[i], a = drawArm(sh[i][0], sh[i][1], hx, hy, ds[i], bx, by); drawHand(a[0], a[1], a[2], a[3], !fail && open, true, a[4]); }
    if (fail && !front) {                                                    // anger marks and sparks over the head
      const mx = bx + 18 * DOT, my = by - 8;
      if (tr) { fillRect(mx, my + 2, 7, 3, KC.mark); fillRect(mx + 2, my, 3, 7, KC.mark); }
      if (!tr) { px(bx + 2 * DOT, by + 4, KC.spark); px(bx + 21 * DOT, by + 8, KC.spark); px(bx + 11 * DOT, by - 5, KC.spark); }
    }
  }


  /* ---- SQUID (trial): the second big monster, a Space Invaders squid. A pointed bell of a head over one narrow neck, from which five
     tentacles fan out. It floats in with the terrain, and two of its tentacles stretch out together for the fighter (over its head, ahead
     of it or behind it), curl into a ring around it, and miss as the fighter slips away. 23 x 30 dots, like the ape. ---- */
  const SQ_WID = [0, 0, 3, 5, 7, 9, 11, 13, 15, 17, 19, 19, 17, 13, 11];     // the head and the wide base under it: width of each row, centred
  const SQ_EYES = { 9: [7, 15], 10: [8, 9, 13, 14] };   // slanted, the inner ends lower
  const SQ_MOUTH = !(typeof location !== "undefined" && /mouth=0/.test(location.search));   // ?mouth=0 shows it without
  const SQ_BASE = SQ_WID.map((w, r) => Array.from({ length: KONG_W }, (_, c) => {
    const m = (KONG_W - w) / 2; if (c < m || c >= m + w) return ".";
    if (SQ_EYES[r] && SQ_EYES[r].includes(c)) return "E";
    if (SQ_MOUTH && ((r === 12 && c >= 9 && c <= 13) || (r === 13 && (c === 8 || c === 14)))) return "M";   // a flat, grumpy mouth under the eyes, its corners turned down 
    const a = SQ_WID[r] ? (c - m < 2 ? "B" : "K") : "K"; return a;   // a lit band two dots wide along the left edge
  }));
  const SQ_NECK = [11, 15], SQ_ROOT = [-3, -2, -1, 0, 1, 2, 3], SQ_FLARE = [15, 11, 7, 3, 7, 11, 15], SQ_ENDX = [-14, -10, -6, 2, 6, 10, 14], SQ_ENDY = [-1, 2, -2, 2, -2, 2, -1];   // seen from above the tentacles lie out around the monster, like rays; seen from the side that is a spread to the left and right, with the ones that point toward us ending lower and the ones that point away ending higher (in dots, from the knee)
  const SQ_UNUSED = 0;   // seven roots along a 6 dot base; at rest the tentacles hang down, only slightly apart. When it reaches, the outer two on each side stretch and the middle three still hold it up
    // how the two reaching tentacles go, for the fighter over its head / ahead of it / behind it: per tentacle the first control point's
  // offset from the neck (d1), the second one's offset from the tip (d2) and where on the ring the tip lands (o), all in dots
  // Four tentacles reach, never a pair that meets: the two on the fighter's side go to it, and the two on the other side stretch the same
  // way, their tips lower than the others' so no ring is ever closed (the middle one just hangs).
  const SQ_SC = [
    {   // fighter above it, on its left: the left pair goes up the left side, the right pair up the right side, a little lower
      0: { d1: [-20, -2], d2: [-6, 4], o: [-6, -3] }, 1: { d1: [-16, 2], d2: [-6, 5], o: [-5, 3] },
      6: { d1: [20, -2], d2: [6, 4], o: [7, 2] }, 5: { d1: [16, 2], d2: [6, 5], o: [6, 8] } },
    {   // ahead (left): the left pair reaches for the fighter, the right pair stretches the same way, beneath
      0: { d1: [-8, 5], d2: [6, 0], o: [-2, 0] }, 1: { d1: [-8, 9], d2: [6, -2], o: [-3, 3] },
      6: { d1: [2, 12], d2: [8, 2], o: [-1, 6] }, 5: { d1: [0, 14], d2: [8, 4], o: [-2, 9] } },
    {   // behind (right)
      6: { d1: [8, 5], d2: [-6, 0], o: [2, 0] }, 5: { d1: [8, 9], d2: [-6, -2], o: [3, 3] },
      0: { d1: [-2, 12], d2: [-8, 2], o: [1, 6] }, 1: { d1: [0, 14], d2: [-8, 4], o: [2, 9] } },
  ];
  const SQ_OVER_FLIP = {   // fighter above it, on its right
    6: { d1: [20, -2], d2: [6, 4], o: [6, -3] }, 5: { d1: [16, 2], d2: [6, 5], o: [5, 3] },
    0: { d1: [-20, -2], d2: [-6, 4], o: [-7, 2] }, 1: { d1: [-16, 2], d2: [-6, 5], o: [-6, 8] } };
  const SQUID_PAL_PERCENT = [10, 10, 25, 10, 35, 10];   // yellow and green most often (sums to 100)
  const pickSquidPal = s => { let r = nextRandom(s) % 100, i = 0; while (i < 5 && r >= SQUID_PAL_PERCENT[i]) r -= SQUID_PAL_PERCENT[i++]; return i; };
  const SQ_RISE_PX = 6;   // two dots
  const squidTop = (k, now) => H - KH - 2 - Math.round(SQ_RISE_PX * (k.rise || 0));   // it floats: it rises while the fighter is ahead of it (to its left), and sinks back once the fighter has passed
  const squidNeck = (k, now) => [Math.round(k.x) + SQ_NECK[0] * DOT + 1, squidTop(k, now) + SQ_NECK[1] * DOT];
  const SQ_REACH_DOTS = 34;   // it goes for the fighter when it is this close (dots) to the neck
  const squidPick = (dxd, dyd) => (dyd < -13 && Math.abs(dxd) <= 12 ? 0 : dxd < 0 ? 1 : 2);
  const squidNear = (dxd, dyd, k) => Math.hypot(dxd, dyd) <= SQ_REACH_DOTS && Math.abs(dxd) <= SQ_REACH_DOTS && k.x < W - KW - 6;
  function squidStart(s, k, shipCx, shipCy, nx, ny) {
    k.ph = K_REACH; k.t = 0; k.tx = shipCx; k.ty = shipCy; k.face = "reach"; k.tries++;
    k.sc = squidPick((shipCx - nx) / DOT, (shipCy - ny) / DOT);
    const dxd = (shipCx - nx) / DOT;
    k.flip = Math.abs(dxd) < 4 ? nextRandom(s) % 2 : dxd < 0 ? 0 : 1;   // fighter above: the tentacles go up the side it is on
    const aimLeft = k.sc === 1 || (k.sc === 0 && !k.flip);   // the fighter's side: the left pair or the right pair
    k.legs = nextRandom(s) % 100 < 50 ? (aimLeft ? [0, 1, 6, 5] : [6, 5, 0, 1]) : (aimLeft ? [0, 1] : [6, 5]);   // half of the reaches use both sides, half only the fighter's side
  }
  function updateSquid(s, now, dt, shipCx, shipCy) {
    const k = s.k; let evade = 0;
    k.x -= SCROLL_PX_S * (K_SPEED[k.ph] || 1) * dt;
    k.rise += ((shipCx < Math.round(k.x) + SQ_NECK[0] * DOT ? 1 : 0) - k.rise) * (1 - Math.exp(-dt / 1.0));   // slowly up while the fighter is to its left, slowly down once it has passed
    const [nx, ny] = squidNeck(k, now), dxd = (shipCx - nx) / DOT, dyd = (shipCy - ny) / DOT;
    if (k.ph === K_WALK || (k.ph === K_LEAVE && k.t >= 0.6)) {   // (once the tentacles are back from a reach, it may reach again)
      if (squidNear(dxd, dyd, k)) {
        if (dxd < 4 && k.doPre && !k.preDone) { k.preDone = true; squidStart(s, k, shipCx, shipCy, nx, ny); }       // the fighter is still ahead of it
        else if (dxd >= 4 && k.doPost && !k.postDone) { k.postDone = true; squidStart(s, k, shipCx, shipCy, nx, ny); }   // the fighter has passed
      }
    } else if (k.ph === K_REACH) { if (k.t >= K_DUR[K_REACH]) { k.ph = K_GRAB; k.t = 0; } }
    else if (k.ph === K_GRAB) {
      evade = shipCy > 52 ? -K_EVADE_PX : K_EVADE_PX;                    // the fighter slips out of the closing ring
      if (k.t >= K_DUR[K_GRAB]) { k.ph = K_MISS; k.t = 0; }
    } else if (k.ph === K_MISS) {
      evade = shipCy > 52 ? -K_EVADE_PX : K_EVADE_PX;
      if (k.t >= K_DUR[K_MISS]) {
        k.ph = K_LEAVE; k.t = 0; k.face = "calm";                         // the tentacles are drawn back
      }
    }
    if (k.x < -KW - 4) { k.ph = K_IDLE; k.nextMs = now + (/squid=/.test(location.search) ? 2500 : KONG_MS_MIN + nextRandom(s) % (KONG_MS_MAX - KONG_MS_MIN)); }   // ?squid=1 for a quick look: one visit after another
    return evade;
  }
  const bez3 = (p, u) => { const a = (1 - u) ** 3, b = 3 * u * (1 - u) ** 2, c = 3 * u * u * (1 - u), d = u ** 3; return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]]; };
  // one tentacle: 4 dots thick, then 3, then a 2 dot tip; the lit edge on its left; drawn on the body's own dot grid (gx, gy)
  const mixc = (a, b, t) => rgb(Math.round((a & 255) * (1 - t) + (b & 255) * t), Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t), Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t));
  function drawSquidLeg(p, gx, gy, rest) {
    const lit = KC.armEdge, dark = KC.arm, mid = mixc(lit, dark, 0.55);   // three tones: a lit edge, a half tone, and the dark; now and then a dot falls into shadow
    const len = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) + Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]) + Math.hypot(p[3][0] - p[2][0], p[3][1] - p[2][1]);
    const steps = Math.max(8, Math.ceil(len / DOT * 1.6));
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, [x, y] = bez3(p, u), w = rest ? (u < 0.88 ? 3 : u < 0.96 ? 2 : 1) : u < 0.3 ? 4 : u < 0.5 ? 3 : u < 0.8 ? 2 : 1;   // resting tentacles: three dots where they hang (packed together, no gaps), two along the ground
      const [x1, y1] = bez3(p, Math.min(1, u + 0.02)), [x0, y0] = bez3(p, Math.max(0, u - 0.02)), flat = Math.abs(x1 - x0) > Math.abs(y1 - y0);   // going sideways: the thickness is across, in y
      const cx = gx + DOT * Math.round((x - gx) / DOT), cy = gy + DOT * Math.round((y - gy) / DOT);
      for (let j = w - 1; j >= 0; j--) {
        const o = (j - (w >> 1)) * DOT, px_ = flat ? cx : cx + o, py_ = flat ? cy + o : cy;
        let col = j === 0 ? lit : j === 1 && w > 2 ? mid : dark;
        const cc = Math.round((px_ - gx) / DOT), h = (Math.imul(cc, 73856093) ^ Math.imul(Math.round((py_ - gy) / DOT), 19349663)) >>> 0;
        if (rest && !flat) { const m = ((cc - SQ_NECK[0]) % 3 + 3) % 3; col = m === 0 ? dark : m === 1 ? mid : lit; }   // hanging, side by side: shadow in straight vertical lines, one every third column
        else if (h % 5 === 0 && col !== dark) col = col === lit ? mid : dark;   // a fleck of shadow here and there
        dot(px_, py_, col);
      }
    }
  }
  function renderSquid(s, now, front) {   // the body and the resting tentacles behind the terrain; only the tentacles that move, in front of everything
    const k = s.k, bx = Math.round(k.x), by = squidTop(k, now);
    if (!front) for (let r = 0; r < SQ_BASE.length; r++) for (let c = 0; c < KONG_W; c++) { const ch = SQ_BASE[r][c]; if (ch !== ".") dot(bx + c * DOT, by + r * DOT, ch === "M" ? mixc(KC.E, KC.K, 0.4) : KC[ch]); }
    const [nx, ny] = [bx + SQ_NECK[0] * DOT + 1, by + SQ_NECK[1] * DOT];
    const reaching = k.ph === K_REACH || k.ph === K_GRAB || k.ph === K_MISS;
    const w = k.ph === K_REACH ? ease3(k.t / K_DUR[K_REACH]) : reaching ? 1 : k.ph === K_LEAVE && k.tx ? 1 - ease3(k.t / 0.5) : 0;   // 0 at rest ... 1 stretched out
        for (let i = 0; i < 7; i++) {
      const moving = w > 0 && k.legs.includes(i);
      if (moving !== front) continue;   // resting legs are drawn with the body (behind), moving ones in front
      const R0 = [nx + SQ_ROOT[i] * DOT, ny], gy = H - 8;
      // at rest: hanging straight down to the ground, where it is bent like a knee and lies along it (the tips stay on the ground when the body rises)
      let p = [R0, [R0[0], gy - SQ_FLARE[i]], [R0[0] + SQ_ENDX[i] * 0.2 * DOT, gy], [R0[0] + SQ_ENDX[i] * DOT, gy + SQ_ENDY[i] * DOT]];   // a packed bundle, flaring out like a trumpet (the outer ones start higher) and lying on the ground   // straight down, then a sharp knee (both middle points on the corner), then flat along the ground
      if (moving) {
        const sc = (k.sc === 0 && k.flip ? SQ_OVER_FLIP : SQ_SC[k.sc])[i], T = [k.tx, k.ty], q2 = [T[0] + sc.o[0] * DOT, T[1] + sc.o[1] * DOT], wob = Math.sin(now * 0.009 + i) * 0.8 * DOT * w;
        const r = [R0, [nx + sc.d1[0] * DOT, ny + sc.d1[1] * DOT], [q2[0] + sc.d2[0] * DOT + wob, q2[1] + sc.d2[1] * DOT], q2];
        p = p.map((v, n) => [v[0] + (r[n][0] - v[0]) * w, v[1] + (r[n][1] - v[1]) * w]);
      }
      drawSquidLeg(p, bx, by, !moving);
    }
  }

  /* ---- SEARCHLIGHTS (trial): a city on alert. Searchlights stand on the ground, hidden behind the terrain bars, and flow from right to left
     with the terrain (30 px/s), each sweeping the sky with a slim beam that widens and fades toward the top. A few at a time, only while
     music plays (the ones already there carry on). Drawn behind the monsters and the terrain, added to the stars' light. ---- */
  const LIGHTS_FRONT = !(typeof location !== "undefined" && /layer=1/.test(location.search));   // the searchlights are in front of the monsters and the terrain, behind the equalizer (?layer=1: behind them)
  const MAX_LIGHTS = 3, LIGHT_MS_MIN = 10000, LIGHT_MS_MAX = 35000, LIGHT_LEN = 150;
  const lightsNow = () => typeof location !== "undefined" && /lights=now/.test(location.search);   // ?lights=now: one at once, music or not
  function updateLights(s, now, dt) {
    if (s.nextLightMs === 0) s.nextLightMs = now + (lightsNow() ? 300 : 6000);
    for (const l of s.lights) {
      l.x -= SCROLL_PX_S * dt;
      l.a = l.base + l.amp * Math.sin(now * 0.001 * l.w + l.ph);
    }
    s.lights = s.lights.filter(l => l.x > -LIGHT_LEN);
    if (!s.mz.ph && (s.prevDb > DB_SILENT || lightsNow()) && s.lights.length < MAX_LIGHTS && now - s.nextLightMs >= 0) {
      const d = Math.PI / 180;
      s.lights.push({ x: W + 24, base: ((nextRandom(s) % 21) - 10) * d, amp: (20 + nextRandom(s) % 22) * d, w: 0.45 + (nextRandom(s) % 40) / 100, ph: (nextRandom(s) % 628) / 100, a: 0 });
      s.nextLightMs = now + LIGHT_MS_MIN + nextRandom(s) % (LIGHT_MS_MAX - LIGHT_MS_MIN);
    }
  }
  function addDot(x, y, r, g, b) {   // a 3 x 3 dot, its light added to what is behind it (the stars show through)
    for (let dy = 0; dy < DOT; dy++) for (let dx = 0; dx < DOT; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
      const i = yy * W + xx, c = fb[i];
      fb[i] = ((255 << 24) | (Math.min(255, ((c >> 16) & 255) + b) << 16) | (Math.min(255, ((c >> 8) & 255) + g) << 8) | Math.min(255, (c & 255) + r)) >>> 0;
    }
  }
  // The searchlight's base: a 3 x 3 dot square of light grey with a blue window in the middle, standing on the ground where the beam starts
  // (in front of the terrain and the equalizer, so it is always seen).
  function renderLightBases(s) {
    const grey = rgb(206, 208, 214), shade = rgb(168, 170, 178), win = rgb(70, 140, 255);
    for (const l of s.lights) {
      const gx = Math.round(l.x) - 4, gy = H - 3 * DOT;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) dot(gx + i * DOT, gy + j * DOT, i === 1 && j === 1 ? win : j === 2 || i === 2 ? shade : grey);
    }
  }
  // Is there a part of the monster at the screen point x, y? The ape's silhouette or the squid's head (the tentacles let light through).
  function monsterAt(k, now, x, y) {
    if (k.ph === K_IDLE) return false;
    const bx = Math.round(k.x), by = k.kind === 1 ? squidTop(k, now) : H - KH, c = Math.floor((x - bx) / DOT), r = Math.floor((y - by) / DOT);
    const rows = k.kind === 1 ? SQ_BASE : KONG_BASE;
    return r >= 0 && r < rows.length && c >= 0 && c < KONG_W && rows[r][c] !== ".";
  }
  function renderLights(s, now) {
    const kk = s.k, midX = Math.round(kk.x) + KONG_W * DOT / 2;   // the monster's centre line
    const fx = shipX(now) + Math.round(s.lunge), fy = Math.round(s.shipY + bobY(now) + s.evadeCur);   // where the fighter is drawn
    for (const l of s.lights) {
      const a = l.a, sn = Math.sin(a), cs = Math.cos(a), side = l.x < midX ? -1 : 1;   // which side of the monster the light stands on
      
      for (let t = 0; t < LIGHT_LEN; t += DOT) {
        const fade = 1 - t / LIGHT_LEN, cx = l.x + sn * t, y = H - 1 - cs * t, hw = 1 + ((t / 42) | 0);   // the beam widens: dots either side of its middle
        if (monsterAt(kk, now, cx, y) && (cx - midX) * side <= 0) break;   // the light runs on over the monster up to its centre line, and stops there
        if (cx >= fx && cx < fx + SHIP_W && y >= fy && y < fy + SHIP_H) break;   // it stops on the fighter too
        for (let j = -hw; j <= hw; j++) {
          const k = Math.pow(Math.max(0, fade), 0.6) * (Math.abs(j) === hw ? 0.5 : 1) * 0.95;
          addDot(DOT * Math.round((cx + j * DOT) / DOT), DOT * Math.round(y / DOT), Math.round(150 * k), Math.round(190 * k), Math.round(255 * k));
        }
      }
    }
  }

  /* ---- METEOR ZONE (trial): now and then the targets, the monsters and the searchlights fall behind, the terrain sinks low, and meteors stream
     from right to left while the fighter weaves through them without firing. The louder the music, the more meteors; a beat brings a big one. A
     meteor is placed so that it misses the fighter's path, so the fighter always slips past. ?meteor=now: one soon after start, then every 8 s. ---- */
  const MZ_IN_S = 1.5, MZ_RUN_S = 17, MZ_OUT_S = 2, MZ_FIRST_MS = 90000, MZ_MS_MIN = 120000, MZ_MS_MAX = 240000, MZ_SEG = 7, MZ_WARP_PX_S = 260;
  const MZ_MAX = 40, MZ_DUST_MAX = 18, MZ_RATE_MIN = 3, MZ_RATE_MAX = 12, MZ_DUST_RATE = 14, MZ_GAP = 8;
  const MZ_SIZE = [{ r: 2, vMin: 170, vMax: 240, tail: 6 }, { r: 4, vMin: 220, vMax: 300, tail: 10 }, { r: 6, vMin: 280, vMax: 360, tail: 15 }];
  const meteorNow = () => typeof location !== "undefined" && /meteor=now/.test(location.search);
  const mzTop = () => TOP + 6, mzBottom = () => H - MZ_SEG * SEG_PITCH - SHIP_H - 6;
  const mzPath = (s, ms) => { const t = ms * 0.001 + s.mz.ph0, mid = (mzTop() + mzBottom()) / 2, a = (mzBottom() - mzTop()) / 2;
    return mid + a * (0.62 * Math.sin(t * 1.1) + 0.38 * Math.sin(t * 2.3 + 1)); };
  const mzHeight = (s, h) => s.mz.u > 0 ? Math.max(GROUND, Math.round(h * (1 - s.mz.u * (1 - MZ_SEG / NSEG)) / SEG_PITCH) * SEG_PITCH) : h;
  function spawnMeteor(s, now, sx, size) {
    if (s.met.length >= MZ_MAX) return;
    const z = MZ_SIZE[size], v = z.vMin + nextRandom(s) % (z.vMax - z.vMin), vy = v * (0.04 + (nextRandom(s) % 12) / 100), tail = z.tail * DOT;
    const arrive = (W + z.r - sx - SHIP_W) / v, leave = (W + z.r + tail - sx) / v, clear = SHIP_H / 2 + z.r + MZ_GAP;
    for (let tries = 0; tries < 8; tries++) {
      const y = TOP + nextRandom(s) % (H - MZ_SEG * SEG_PITCH - TOP - 6);
      let ok = true;
      for (let i = 0; i <= 5 && ok; i++) {
        const t = arrive + (leave - arrive) * i / 5;
        ok = Math.abs(y + vy * t - (mzPath(s, now + t * 1000) + SHIP_H / 2)) >= clear;
      }
      if (ok) { s.met.push({ x: W + z.r, y, v, vy, size, warm: size === 2 || nextRandom(s) % 100 < 55 }); return; }
    }
  }
  function updateMeteorZone(s, now, dt, sx) {
    const z = s.mz, k = s.k;
    if (z.nextMs === 0) z.nextMs = now + (meteorNow() ? 1500 : MZ_FIRST_MS);
    if (z.ph === 0) {
      if (now - z.nextMs >= 0 && k.ph === K_IDLE && (meteorNow() || (k.musicSince && now - k.musicSince >= 3000))) {
        z.ph = 1; z.t = 0; z.acc = 0; z.dustAcc = 0; z.ph0 = (nextRandom(s) % 628) / 100;
        k.nextMs = Math.max(k.nextMs, now + (MZ_IN_S + MZ_RUN_S + MZ_OUT_S) * 1000 + 8000);
      }
    }
    if (z.ph === 0) return;
    z.t += dt;
    if (z.ph === 1) { z.u = Math.min(1, z.t / MZ_IN_S); if (z.t >= MZ_IN_S) { z.ph = 2; z.t = 0; } }
    else if (z.ph === 2 && z.t >= MZ_RUN_S) { z.ph = 3; z.t = 0; }
    else if (z.ph === 3) {
      z.u = Math.max(0, 1 - z.t / MZ_OUT_S);
      if (z.t >= MZ_OUT_S && s.met.length === 0) {
        z.ph = 0; z.u = 0; s.nextLightMs = Math.max(s.nextLightMs, now + 6000);
        z.nextMs = now + (meteorNow() ? 8000 : MZ_MS_MIN + nextRandom(s) % (MZ_MS_MAX - MZ_MS_MIN));
      }
    }
    if (z.ph === 2) {
      const level = s.prevDb <= DB_SILENT ? 0 : Math.min(1, Math.max(0, (s.prevDb - s.avgDb) / SPAN_DB + 0.5));
      z.acc += dt * (MZ_RATE_MIN + (MZ_RATE_MAX - MZ_RATE_MIN) * level);
      while (z.acc >= 1) { z.acc -= 1; spawnMeteor(s, now, sx, nextRandom(s) % 100 < 65 ? 0 : 1); }
      if (s.beat) spawnMeteor(s, now, sx, 2);
    }
    s.beat = false;
    z.dustAcc += dt * (z.ph === 3 ? 0 : MZ_DUST_RATE * z.u);
    while (z.dustAcc >= 1) {
      z.dustAcc -= 1;
      if (s.dust.length < MZ_DUST_MAX) s.dust.push({ x: W + 8, y: TOP + nextRandom(s) % (H - TOP - MZ_SEG * SEG_PITCH), v: 340 + nextRandom(s) % 200, len: 10 + nextRandom(s) % 18 });
    }
    for (const m of s.met) { m.x -= m.v * dt; m.y += m.vy * dt; }
    for (const d of s.dust) d.x -= d.v * dt;
    s.met = s.met.filter(m => m.x > -MZ_SIZE[m.size].tail * DOT - 8);
    s.dust = s.dust.filter(d => d.x > -d.len);
    const w = MZ_WARP_PX_S * z.u * dt;   // whatever was on screen falls behind
    for (const e of s.e) if (e.on) e.x -= w;
    for (const b of s.eb) if (b.on) b.x -= w;
    for (const m of s.mine) if (m.on) m.x -= w;
    for (const l of s.lights) l.x -= w;
  }
  function renderMeteors(s) {
    for (const d of s.dust) {
      const x = Math.round(d.x), y = Math.round(d.y);
      for (let i = 0; i < d.len; i += 2) { const f = 1 - i / d.len; px(x + i, y, rgb(Math.round(90 * f), Math.round(110 * f), Math.round(150 * f))); }
    }
    for (const m of s.met) {
      const z = MZ_SIZE[m.size], gx = DOT * Math.round(m.x / DOT), gy = DOT * Math.round(m.y / DOT);
      for (let i = z.tail; i >= 1; i--) {
        const f = 1 - i / (z.tail + 1), slope = Math.round(-m.vy / m.v * i);
        const rr = m.warm ? 255 : 70, gg = m.warm ? 70 + 150 * f : 150 + 80 * f, bb = m.warm ? 10 + 40 * f : 255;
        addDot(gx + i * DOT, gy + slope * DOT, Math.round(rr * f), Math.round(gg * f), Math.round(bb * f));
        if (m.size === 2 && i < z.tail * 0.6) { addDot(gx + i * DOT, gy + (slope - 1) * DOT, Math.round(rr * f * 0.5), Math.round(gg * f * 0.5), Math.round(bb * f * 0.5)); addDot(gx + i * DOT, gy + (slope + 1) * DOT, Math.round(rr * f * 0.5), Math.round(gg * f * 0.5), Math.round(bb * f * 0.5)); }
      }
      const hot = m.warm ? rgb(255, 214, 110) : rgb(150, 220, 255), core = rgb(255, 255, 235);
      if (m.size === 0) dot(gx, gy, core);
      else if (m.size === 1) { dot(gx, gy, core); dot(gx + DOT, gy, hot); dot(gx, gy - DOT, hot); dot(gx, gy + DOT, hot); }
      else for (const [ox, oy, c] of [[0, 0, core], [-1, 0, core], [1, 0, core], [0, -1, core], [0, 1, core], [-1, -1, hot], [1, -1, hot], [-1, 1, hot], [1, 1, hot], [-2, 0, hot], [2, 0, hot], [0, -2, hot], [0, 2, hot]]) dot(gx + ox * DOT, gy + oy * DOT, c);
    }
  }

  /* ---- CITY (trial): now and then three buildings of different heights flow by with the terrain (they do not react to the sound), and
     small people wait on their roofs and in their windows, waving for help. The fighter flies to the nearest one waiting ahead, and
     when it overlaps a person that person is saved: a small light, and gone. No score. Not in the meteor zone. ---- */
  const CITY_W = 9, CITY_GAP = 2, CITY_FLOORS = [2, 3, 4];   // a building is 9 dots wide; floors 2, 3 or 4 (a floor is 3 dots of window and 1 of wall)
  const CITY_MS_MIN = 30000, CITY_MS_MAX = 60000, CITY_FIRST_MS = 8000;
  const cityNow = () => typeof location !== "undefined" && /city=now/.test(location.search);   // ?city=now: one at once, music or not
  const SHIRTS = [rgb(255, 255, 255), rgb(255, 96, 96), rgb(96, 205, 255), rgb(255, 232, 96)];
  const SKIN = rgb(255, 206, 150), LEGS = rgb(40, 40, 70);
  // The roof person, 3 x 4 dots: A arm, H head, B body, L legs; two frames, arms up and arms out
  const PERSON = [["AHA", ".B.", ".B.", "L.L"], [".H.", "ABA", ".B.", "L.L"]];
  const WIN_PERSON = [[".HA", ".B.", ".B."], [".H.", ".BA", ".B."]];   // in a window, 3 x 3 dots
  function newCity(s) {
    const floors = [0, 1, 2].map(i => CITY_FLOORS[i]);
    for (let i = 2; i > 0; i--) { const j = nextRandom(s) % (i + 1); [floors[i], floors[j]] = [floors[j], floors[i]]; }
    const g = { x: W + 4, b: [], p: [] };
    floors.forEach((f, i) => {
      const hDots = 4 * f + 1, b = { ox: i * (CITY_W + CITY_GAP) * DOT, f, h: hDots * DOT, lit: [] };
      for (let r = 0; r < f * 2; r++) b.lit.push(nextRandom(s) % 100 < 35);   // which windows are lit (two columns a floor)
      g.b.push(b);
      if (nextRandom(s) % 100 < 70) g.p.push({ roof: true, bi: i, ox: (1 + nextRandom(s) % (CITY_W - 4)) * DOT, shirt: nextRandom(s) % SHIRTS.length, ph: nextRandom(s) % 7, saved: false });
      for (let fl = 0; fl < f; fl++) for (let c = 0; c < 2; c++) if (nextRandom(s) % 100 < 22) g.p.push({ roof: false, bi: i, fl, c, shirt: nextRandom(s) % SHIRTS.length, ph: nextRandom(s) % 7, saved: false });
    });
    return g;
  }
  // where a person stands, on the screen (px): x, y of the top left, and its size
  function personRect(g, p) {
    const b = g.b[p.bi], bx = Math.round(g.x) + b.ox, by = H - b.h;
    if (p.roof) return { x: bx + p.ox, y: by - 4 * DOT, w: 3 * DOT, h: 4 * DOT };
    return { x: bx + (1 + p.c * 4) * DOT, y: by + DOT * (1 + p.fl * 4), w: 3 * DOT, h: 3 * DOT };
  }
  function nearestWaiting(s, sx) {
    const g = s.city; if (!g) return null;
    let best = null;
    for (const p of g.p) {
      if (p.saved) continue;
      const r = personRect(g, p);
      if (r.x > sx + SHIP_W + 6 && r.x < W - 30 && (!best || r.x < best.x)) best = r;
    }
    return best;
  }
  function updateCity(s, now, dt, sx, sy) {
    if (s.nextCityMs === 0) s.nextCityMs = now + (cityNow() ? 300 : CITY_FIRST_MS);
    const g = s.city;
    if (g) {
      g.x -= SCROLL_PX_S * dt;
      for (const p of g.p) {
        if (p.saved) continue;
        const r = personRect(g, p);
        if (Math.abs(r.x + r.w / 2 - (sx + SHIP_W / 2)) < (SHIP_W + r.w) / 2 && Math.abs(r.y + r.h / 2 - (sy + SHIP_H / 2)) < (SHIP_H + r.h) / 2) {
          p.saved = true; s.sparks.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, t: 0 });   // saved: a small light
        }
      }
      if (g.x < -(3 * (CITY_W + CITY_GAP)) * DOT) { s.city = null; s.nextCityMs = now + CITY_MS_MIN + nextRandom(s) % (CITY_MS_MAX - CITY_MS_MIN); }
    } else if (!s.mz.ph && (s.prevDb > DB_SILENT || cityNow()) && now - s.nextCityMs >= 0) s.city = newCity(s);
    for (const k of s.sparks) k.t += dt;
    s.sparks = s.sparks.filter(k => k.t < 0.5);
  }
  function renderCity(s, now) {
    const g = s.city, body = rgb(52, 62, 94), edge = rgb(116, 134, 186), roof = rgb(158, 172, 210), off = rgb(16, 20, 34), on = rgb(255, 214, 110);
    if (g) {
      g.b.forEach(b => {
        const bx = Math.round(g.x) + b.ox, by = H - b.h;
        for (let r = 0; r < b.h / DOT; r++) for (let c = 0; c < CITY_W; c++) {
          let col = body;
          if (r === 0) col = roof; else if (c === 0) col = edge;
          else if (r > 0) {   // windows: two columns of 3 x 3 dots, a floor every 4 dots, from the roof down
            const fl = Math.floor((r - 1) / 4), wr = (r - 1) % 4, wc = c === 1 || c === 2 || c === 3 ? 0 : c === 5 || c === 6 || c === 7 ? 1 : -1;
            if (wr < 3 && wc >= 0 && fl < b.f) col = b.lit[fl * 2 + wc] ? on : off;
          }
          dot(bx + c * DOT, by + r * DOT, col);
        }
      });
      const fr = Math.floor(now / 300) & 1;
      for (const p of g.p) {
        if (p.saved) continue;
        const rc = personRect(g, p), f = (fr + p.ph) & 1, shirt = SHIRTS[p.shirt];
        const art = p.roof ? PERSON[f] : WIN_PERSON[f];
        if (!p.roof) for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) dot(rc.x + x * DOT, rc.y + y * DOT, on);   // the window lights up behind them
        art.forEach((row, y) => [...row].forEach((ch, x) => {
          if (ch === ".") return;
          dot(rc.x + x * DOT, rc.y + y * DOT, ch === "H" ? SKIN : ch === "L" ? LEGS : shirt);
        }));
      }
    }
    for (const k of s.sparks) {   // a small light where somebody was saved: a plus that opens, then fades
      const u = k.t / 0.5, r = 1 + Math.round(u * 2), a = 1 - u, c = rgb(Math.round(255 * a + 40), Math.round(255 * a + 40), Math.round(180 * a + 20));
      for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) dot(Math.round(k.x - 1) + dx * DOT, Math.round(k.y - 1) + dy * DOT, c);
    }
  }

  const newEnemy = () => ({ x: 0, y: 0, baseY: 0, phase: 0, mineMs: 0, kind: WALKER, on: false, fireMs: 0, born: MAT_S });
  const newState = () => ({
    h: new Uint8Array(COLS), lastColMs: 0, lastFrameMs: 0, nextFireMs: 0, nextBombMs: 0, rng: 1,
    shipY: H - GROUND - SHIP_H - SHIP_CLEAR, avgDb: 0, prevDb: DB_SILENT, avgSet: false, beat: false,
    nextSpawnMs: 0, nextAimMs: 0, lunge: 0, k: newKong(), evadeCur: 0, lights: [], nextLightMs: 0, city: null, nextCityMs: 0, sparks: [],
    mz: { ph: 0, t: 0, u: 0, nextMs: 0, acc: 0, dustAcc: 0, ph0: 0 }, met: [], dust: [],
    e:Array.from({ length: MAX_ENEMIES }, newEnemy),
    mine: Array.from({ length: MAX_MINES }, () => ({ x: 0, y: 0, age: 0, on: false })),
    eb: Array.from({ length: MAX_EBULLETS }, () => ({ x: 0, y: 0, vx: 0, vy: 0, on: false })),
    shieldUntil: 0, dodging: false, dodgeTo: 0,
    m: Array.from({ length: MAX_MISSILES }, () => ({ x: 0, y: 0, on: false, head: 0, age: 0, stopped: false })),
    b: Array.from({ length: MAX_BOMBS }, () => ({ x: 0, y: 0, vx: 0, vy: 0, on: false })),
    x: Array.from({ length: MAX_BURSTS }, () => ({ x: 0, y: 0, age: 0, on: false, pop: false })),
    star: Array.from({ length: NSTARS }, () => ({ x: 0, y: 0, kind: 0, near: false })),
    eq: false, scale: 1, fade: 0, modeSinceMs: 0, silentSinceMs: 0, wasSilent: false,
    eqDb: new Float32Array(EQ_BANDS), eqFresh: false, eqSilent: true,
    eqH: new Float32Array(EQ_BANDS), eqPeak: new Float32Array(EQ_BANDS), eqHold: new Float32Array(EQ_BANDS),
    eqAvg: new Float32Array(EQ_BANDS), eqAvgSet: false,
    lit: new Uint32Array(MAX_BAR), eqCol: [new Uint32Array(EQ_BANDS), new Uint32Array(EQ_BANDS)],
    pattern: 0, next: 0, ready: false,
  });

  function nextRandom(s) {
    let r = s.rng;
    r = (r ^ (r << 13)) >>> 0; r = (r ^ (r >>> 17)) >>> 0; r = (r ^ (r << 5)) >>> 0;
    return (s.rng = r);
  }
  function placeStar(s, st, x) {
    const r = nextRandom(s);
    st.x = x; st.y = TOP + r % (H - TOP - GROUND);
    const k = (r >>> 8) % 10;
    st.kind = k < 4 ? 0 : k < 7 ? 1 : k < 9 ? 2 : 3;
    if ((r >>> 16) % 10 === 0) st.kind = 3;
    st.near = (r >>> 20) % 4 === 0;
  }

  function init(s, nowMs, sampleRate) {
    EQ_BIN_HI = Math.round(170 * 48000 / sampleRate);  // same frequency range at any sample rate
    fftReady = false;
    const STOP = [0, 0.3, 0.6, 0.8, 1.0];
    const COLOR = [[40, 100, 255], [40, 235, 90], [245, 230, 40], [255, 140, 0], [255, 36, 30]];
    for (let y = 0; y < MAX_BAR; y++) {
      const t = Math.floor(y / SEG_PITCH) / (NSEG - 1);
      let i = 0; while (i < 3 && t > STOP[i + 1]) i++;
      const u = (t - STOP[i]) / (STOP[i + 1] - STOP[i]);
      const c = k => Math.trunc(COLOR[i][k] + (COLOR[i + 1][k] - COLOR[i][k]) * u);
      s.lit[y] = (y % SEG_PITCH >= SEG_H) ? BLACK : rgb(c(0), c(1), c(2));
    }
    const KP = [[0, 0, 255], [0, 255, 255], [0, 255, 0], [173, 255, 41], [255, 255, 0], [255, 165, 0], [255, 0, 0], [255, 0, 255]];
    for (let j = 0; j < EQ_BANDS; j++) {
      const t = j * 7 / (EQ_BANDS - 1), a = t >= 7 ? 6 : Math.floor(t), u = t - a;
      s.eqCol[0][j] = rgb(60, 255, 210);
      const m = k => Math.trunc(KP[a][k] + (KP[a + 1][k] - KP[a][k]) * u);
      s.eqCol[1][j] = rgb(m(0), m(1), m(2));
    }
    s.h.fill(GROUND);
    s.lastColMs = s.lastFrameMs = nowMs;
    s.rng = (nowMs | 1) >>> 0;
    s.nextFireMs = nowMs + FIRE_MS_MIN; s.avgSet = false; s.nextBombMs = nowMs + BOMB_MS_MIN / 2;
    for (const a of [s.m, s.b, s.x, s.e, s.mine, s.eb]) for (const o of a) o.on = false;
    s.shieldUntil = nowMs; s.dodging = false; s.beat = false; s.lunge = 0;
    s.nextSpawnMs = s.nextAimMs = nowMs; s.k = newKong(); s.evadeCur = 0; s.lights = []; s.nextLightMs = 0; s.city = null; s.nextCityMs = 0; s.sparks = [];
    s.eq = false; s.pattern = s.next = 0; s.scale = 0; s.fade = 0;
    s.modeSinceMs = s.silentSinceMs = nowMs; s.wasSilent = false; s.eqFresh = false; s.eqAvgSet = false;
    s.eqH.fill(0); s.eqPeak.fill(0); s.eqHold.fill(0);
    for (const st of s.star) placeStar(s, st, nextRandom(s) % W);
    s.ready = true;
  }

  function push(s, rms) {
    for (let i = COLS - 1; i > 0; i--) s.h[i] = s.h[i - 1];
    const db = rms > 1 ? 20 * Math.log10(rms / 32767) : DB_SILENT;
    if (db <= DB_SILENT) { s.h[0] = GROUND; s.prevDb = DB_SILENT; return; }
    if (!s.avgSet) { s.avgDb = db; s.avgSet = true; }
    if (db - s.avgDb > BEAT_DB && db - s.prevDb > BEAT_RISE_DB) s.beat = true;
    s.prevDb = db;
    let t = MID + (db - s.avgDb) / SPAN_DB;
    s.avgDb += (db - s.avgDb) * AVG_RATE;
    t = Math.min(1, Math.max(0, t));
    s.h[0] = (1 + Math.round(t * (NSEG - 1))) * SEG_PITCH;
  }

  const colX = (i, off) => W - off - i * PITCH;
  const scrollOffset = (s, now) => Math.floor(Math.min(now - s.lastColMs, COL_MS) * PITCH / COL_MS);
  const colAt = (x, off) => { const d = W - off - x; return d < 0 ? -1 : Math.floor((d + PITCH - 1) / PITCH); };
  const eqHeight = (s, j) => s.eq ? mzHeight(s, Math.round(s.eqH[j] * s.scale) * SEG_PITCH) : 0;
  function heightAt(s, x, off) {
    const i = colAt(x, off);
    let h = i < 0 ? 0 : i < COLS ? mzHeight(s, s.h[i]) : GROUND;
    if (s.eq && x >= 0 && x < EQ_BANDS * PITCH) h = Math.max(h, eqHeight(s, Math.floor(x / PITCH)));
    return h;
  }
  function carve(s, i, n) { if (i < 0 || i >= COLS) return; s.h[i] = Math.max(GROUND, s.h[i] - n * SEG_PITCH); }

  // 512-point FFT of the newest samples (Float32Array, scaled to +-32767), summed into 30 log-spaced bands.
  const fftRe = new Float32Array(FFT_N), fftIm = new Float32Array(FFT_N), hann = new Float32Array(FFT_N);
  const twC = new Float32Array(FFT_N / 2), twS = new Float32Array(FFT_N / 2), rev = new Uint16Array(FFT_N);
  const bandBin = new Uint16Array(EQ_BANDS + 1);
  let fftReady = false;
  function analyze(s, smp) {
    if (!fftReady) {
      for (let i = 0; i < FFT_N; i++) {
        hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / FFT_N);
        let r = 0; for (let b = 0; b < FFT_LOG2; b++) r |= ((i >> b) & 1) << (FFT_LOG2 - 1 - b);
        rev[i] = r;
      }
      for (let i = 0; i < FFT_N / 2; i++) { twC[i] = Math.cos(2 * Math.PI * i / FFT_N); twS[i] = -Math.sin(2 * Math.PI * i / FFT_N); }
      let last = EQ_BIN_LO - 1;
      for (let j = 0; j <= EQ_BANDS; j++) {
        let b = Math.round(EQ_BIN_LO * Math.pow(EQ_BIN_HI / EQ_BIN_LO, j / EQ_BANDS));
        if (b <= last) b = last + 1;
        bandBin[j] = b; last = b;
      }
      fftReady = true;
    }
    let sq = 0;
    for (let i = 0; i < FFT_N; i++) { const v = smp[i]; sq += v * v; fftRe[rev[i]] = v * hann[i]; fftIm[rev[i]] = 0; }
    s.eqSilent = Math.sqrt(sq / FFT_N) < EQ_SILENT_RMS;
    for (let len = 2; len <= FFT_N; len <<= 1) {
      const half = len >> 1, step = FFT_N / len;
      for (let i = 0; i < FFT_N; i += len)
        for (let k = 0; k < half; k++) {
          const c = twC[k * step], sn = twS[k * step], a = i + k, b = a + half;
          const xr = fftRe[b] * c - fftIm[b] * sn, xi = fftRe[b] * sn + fftIm[b] * c;
          fftRe[b] = fftRe[a] - xr; fftIm[b] = fftIm[a] - xi; fftRe[a] += xr; fftIm[a] += xi;
        }
    }
    for (let j = 0; j < EQ_BANDS; j++) {
      let p = 1e-3;
      for (let k = bandBin[j]; k < bandBin[j + 1]; k++) p += fftRe[k] * fftRe[k] + fftIm[k] * fftIm[k];
      s.eqDb[j] = 10 * Math.log10(p);
    }
    s.eqFresh = true;
  }

  function updateEq(s, dt) {
    if (s.eqFresh) {
      s.eqFresh = false;
      if (!s.eqSilent && !s.eqAvgSet) { s.eqAvg.set(s.eqDb); s.eqAvgSet = true; }
      const k = 1 - Math.exp(-dt / EQ_AVG_S);
      for (let j = 0; j < EQ_BANDS; j++) {
        let t = 0;
        if (!s.eqSilent) { t = EQ_MID + (s.eqDb[j] - s.eqAvg[j]) / EQ_SPAN_DB; s.eqAvg[j] += (s.eqDb[j] - s.eqAvg[j]) * k; }
        t = Math.min(1, Math.max(0, t));
        const n = t * EQ_NSEG; if (n > s.eqH[j]) s.eqH[j] = n;
      }
    }
    for (let j = 0; j < EQ_BANDS; j++) {
      s.eqH[j] = Math.max(0, s.eqH[j] - EQ_FALL_SEG_S * dt);
      if (s.eqH[j] >= s.eqPeak[j]) { s.eqPeak[j] = s.eqH[j]; s.eqHold[j] = PEAK_HOLD_S; }
      else if ((s.eqHold[j] -= dt) < 0) { s.eqPeak[j] = Math.max(s.eqH[j], s.eqPeak[j] - PEAK_FALL_SEG_S * dt); }
    }
  }

  function updateTurns(s, now, dt) {
    const silent = s.prevDb <= DB_SILENT;
    let turn = now - s.modeSinceMs >= MODE_MS, rise = false;
    if (silent && !s.wasSilent) s.silentSinceMs = now;
    if (!silent && s.wasSilent && now - s.silentSinceMs >= GAP_MS && now - s.modeSinceMs >= MODE_MIN_MS) turn = true;
    s.wasSilent = silent;
    if (turn && s.fade === 0) {
      s.modeSinceMs = now; s.next = (s.pattern + 1) % 3;
      if (s.eq) s.fade = -1; else rise = true;
    }
    if (s.fade < 0 && (s.scale -= dt / FADE_S) <= 0) { s.scale = 0; s.eq = false; s.fade = 0; rise = true; }
    if (rise) {
      s.pattern = s.next;
      if (s.pattern) { s.eq = true; s.fade = 1; s.scale = 0; s.eqAvgSet = false; s.eqH.fill(0); s.eqPeak.fill(0); s.eqHold.fill(0); }
    } else if (s.fade > 0 && (s.scale += dt / FADE_S) >= 1) { s.scale = 1; s.fade = 0; }
  }

  const interval = (s, lo, hi) => lo + nextRandom(s) % (hi - lo + 1);
  const shipX = now => { const t = now * 0.001 * 2 * Math.PI;
    return Math.round(SHIP_X_MID + SHIP_X_SWING * (0.7 * Math.sin(t / 17) + 0.3 * Math.sin(t / 6.3))); };
  const bobY = now => 1.5 * Math.sin(now * (2 * Math.PI / 3200));
  function fireLaser(s, sx, sy) {
    for (const m of s.m) {
      if (m.on) continue;
      Object.assign(m, { x: sx + SHIP_W, y: sy + 2 * DOT + Math.trunc((DOT - LASER_H) / 2), on: true, age: 0, stopped: false });
      m.head = m.x; break;
    }
  }
  const freeBurst = (s, x, y, pop) => { for (const b of s.x) if (!b.on) { Object.assign(b, { x, y, age: 0, on: true, pop }); return; } };

  function update(s, now) {
    let dt = (now - s.lastFrameMs) * 0.001; if (dt > 0.2) dt = 0.2;
    s.lastFrameMs = now;
    const off = scrollOffset(s, now);

    let aim = null;
    const baseX = shipX(now);
    for (const e of s.e) if (e.on && e.x > baseX + s.lunge + SHIP_W && e.x < W && (!aim || e.x < aim.x)) aim = e;
    s.lunge += ((aim ? LUNGE_PX : 0) - s.lunge) * (1 - Math.exp(-dt / LUNGE_EASE_S));
    const sx = baseX + Math.round(s.lunge);

    updateTurns(s, now, dt);
    if (s.eq) updateEq(s, dt);
    updateMeteorZone(s, now, dt, sx);

    let tallest = GROUND;
    for (let x = sx; x < sx + SHIP_W + 60; x += 2) tallest = Math.max(tallest, heightAt(s, x, off));
    let target = H - tallest - SHIP_H - SHIP_CLEAR;
    target = Math.min(target, H - GROUND - SHIP_H - SHIP_CLEAR);
    let ease = SHIP_EASE_S;
    if (aim) {
      target = aim.y + enemyH(aim) / 2 - (2 * DOT + Math.trunc(DOT / 2));
      target = Math.min(target, H - tallest - SHIP_H - CHASE_CLEAR);
      ease = CHASE_EASE_S;
    }
    let threat = false;
    for (const b of s.eb) {
      if (!b.on || b.vx >= 0) continue;
      const t = (sx + SHIP_W - b.x) / b.vx;
      if ((sx - DOT - b.x) / b.vx < 0 || t > DODGE_LOOK_S) continue;
      const y = b.y + b.vy * (t > 0 ? t : 0);
      if (!s.dodging && (y + DOT + 2 <= s.shipY || y - 2 >= s.shipY + SHIP_H)) continue;
      if (!s.dodging) {
        const low = H - tallest - SHIP_H - CHASE_CLEAR, above = y - SHIP_H - DODGE_GAP, below = y + DOT + DODGE_GAP;
        const upOk = above >= TOP + 4, downOk = below <= low;
        const down = downOk && (!upOk || below - s.shipY < s.shipY - above);
        s.dodgeTo = down ? below : upOk ? above : s.shipY;
        s.dodging = true;
      }
      target = s.dodgeTo; ease = DODGE_EASE_S; threat = true; break;
    }
    if (!threat) s.dodging = false;
    const wait = !s.mz.ph && !threat ? nearestWaiting(s, sx) : null;   // somebody waits ahead: the fighter flies to them
    if (wait) { target = wait.y + wait.h / 2 - SHIP_H / 2; ease = CHASE_EASE_S; }
    if (target < TOP + 4) target = TOP + 4;
    if (s.mz.u > 0) { target += (mzPath(s, now) - target) * s.mz.u; ease = 0.05 + (ease - 0.05) * (1 - s.mz.u); }
    s.shipY += (target - s.shipY) * (1 - Math.exp(-dt / ease));
    updateLights(s, now, dt);
    const evadeTgt = updateKong(s, now, dt, sx + SHIP_W / 2, s.shipY + bobY(now) + SHIP_H / 2);
    s.evadeCur += (evadeTgt - s.evadeCur) * (1 - Math.exp(-dt / (evadeTgt ? 0.07 : 0.5)));
    const sy = Math.round(s.shipY + bobY(now) + s.evadeCur);
    updateCity(s, now, dt, sx, sy);

    for (const m of s.m) {
      if (!m.on) continue;
      m.age += dt;
      const from = m.head;
      if (!m.stopped && (m.head += LASER_PX_S * dt) >= W) { m.head = W; m.stopped = true; }
      const tail = m.x + (m.age > LASER_HOLD_S ? (m.age - LASER_HOLD_S) * LASER_TAIL_PX_S : 0);
      if (tail >= m.head) { m.on = false; continue; }
      if (m.stopped && from >= m.head) continue;
      let hit = null;
      for (const e of s.e) {
        if (!e.on || !formed(e) || e.x + enemyW(e) <= from || e.x >= m.head) continue;
        if (m.y + LASER_H <= e.y || m.y >= e.y + enemyH(e)) continue;
        if (!hit || e.x < hit.x) hit = e;
      }
      if (hit) {
        const e = { ...hit };
        hit.on = false;
        m.head = e.x > m.x ? e.x : m.x + 1; m.stopped = true;
        freeBurst(s, e.x + enemyW(e) / 2, e.y + enemyH(e) / 2, true);
        if (e.kind === POD) {
          let k = 0;
          for (const w of s.e) {
            if (w.on || k === SWARM_N) continue;
            Object.assign(w, { x: e.x, y: 0, baseY: e.y + (k - 1) * 12, phase: k * 0.7, mineMs: 0, kind: SWARMER, on: true, fireMs: 0, born: MAT_S });
            w.y = w.baseY; k++;
          }
        }
      }
    }
    for (const e of s.e) {
      if (!e.on) continue;
      if (!formed(e)) { e.born += dt; continue; }
      const k = KINDS[e.kind];
      e.x -= k.pxS * dt; e.phase += dt;
      let w = Math.sin(e.phase * k.waveHz);
      if (e.kind === MUTANT) w = Math.asin(w) * (2 / Math.PI);
      e.y = e.baseY + k.wave * w;
      if (e.kind === BOMBER && (e.mineMs += dt * 1000) >= MINE_MS) {
        e.mineMs = 0;
        for (const m of s.mine) if (!m.on) { Object.assign(m, { x: e.x + enemyW(e) / 2 - Math.trunc(DOT / 2), y: e.y + enemyH(e), age: 0, on: true }); break; }
      }
      const ground = H - heightAt(s, Math.trunc(e.x) + Math.trunc(enemyW(e) / 2), off);
      if (e.y + enemyH(e) + 4 > ground) { e.baseY -= e.y + enemyH(e) + 4 - ground; e.y = ground - enemyH(e) - 4; }
      if (e.x < -enemyW(e)) e.on = false;
    }
    for (const e of s.e) {
      if (!e.on || !formed(e) || e.kind === POD || e.kind === SWARMER || e.x > W - enemyW(e) || e.x < sx + SHIP_W + 30) continue;
      if ((e.fireMs -= dt * 1000) > 0) continue;
      e.fireMs = interval(s, EFIRE_MS_MIN, EFIRE_MS_MAX);
      const bx = e.x, by = e.y + enemyH(e) / 2;
      const dx = sx + SHIP_W / 2 - bx, dy = sy + SHIP_H / 2 - by, d = Math.hypot(dx, dy);
      if (d < 1) continue;
      for (const b of s.eb) if (!b.on) { Object.assign(b, { x: bx, y: by, vx: EBULLET_PX_S * dx / d, vy: EBULLET_PX_S * dy / d, on: true }); break; }
    }
    for (const b of s.eb) {
      if (!b.on) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -DOT || b.x >= W || b.y < TOP || b.y + DOT >= H - heightAt(s, Math.trunc(b.x), off)) b.on = false;
      else if (b.x + DOT > sx && b.x < sx + SHIP_W && b.y + DOT > sy && b.y < sy + SHIP_H) { b.on = false; s.shieldUntil = now + SHIELD_MS; }
    }
    for (const m of s.mine) {
      if (!m.on) continue;
      m.age += dt; m.x -= SCROLL_PX_S * dt;
      if (m.age >= MINE_S || m.x < -DOT) m.on = false;
    }
    const music = s.prevDb > DB_SILENT;
    if (!s.mz.ph && (s.beat || now - s.nextSpawnMs >= (music ? SPAWN_MS_MAX : SPAWN_MS_QUIET) - SPAWN_MS_MIN)) {
      s.beat = false;
      let targets = 0; for (const e of s.e) targets += e.on && e.kind !== SWARMER ? 1 : 0;
      if (targets < MAX_TARGETS && now - s.nextSpawnMs >= 0) {
        for (const e of s.e) {
          if (e.on) continue;
          const r = nextRandom(s), k = r % 20;
          e.kind = k < 7 ? WALKER : k < 11 ? SAUCER : k < 14 ? MUTANT : k < 17 ? BOMBER : POD;
          e.mineMs = 0; e.baseY = e.y = TOP + 4 + ((r >>> 8) % 48);
          if (e.kind === WALKER) { e.x = W - 30 - enemyW(e) - ((r >>> 14) % 60); e.born = 0; }
          else { e.x = W; e.born = MAT_S; }
          e.phase = 0; e.fireMs = interval(s, 400, 1200); e.on = true;
          s.nextSpawnMs = now + SPAWN_MS_MIN; break;
        }
      }
    }
    for (const b of s.b) {
      if (!b.on) continue;
      b.x += b.vx * dt; b.y += b.vy * dt + 0.5 * BOMB_G * dt * dt; b.vy += BOMB_G * dt;
      const bx = Math.trunc(b.x), ground = H - heightAt(s, bx, off);
      if (b.y + DOT - 1 >= ground) {
        b.on = false;
        const i = colAt(bx + Math.trunc(DOT / 2), off);
        carve(s, i, CRATER_SEG); carve(s, i - 1, 1); carve(s, i + 1, 1);
        freeBurst(s, bx, ground - 1, false);
      } else if (bx >= W) b.on = false;
    }
    for (const x of s.x) {
      if (!x.on) continue;
      x.age += dt;
      if (!x.pop) x.x -= SCROLL_PX_S * dt;
      if (x.age >= (x.pop ? POP_S : BURST_S) || x.x < -8) x.on = false;
    }
    for (const st of s.star) {
      st.x -= (st.near ? STAR_NEAR_PX_S : STAR_FAR_PX_S) * (1 + 9 * s.mz.u) * dt;
      if (st.x < -2) placeStar(s, st, W + 1);
    }
    if (s.mz.ph) {   // the fighter only weaves through
    } else if (aim) {
      const nose = sy + 2 * DOT + Math.trunc(DOT / 2), mid = Math.trunc(aim.y) + Math.trunc(enemyH(aim) / 2);
      if (Math.abs(nose - mid) <= DOT && aim.x < ENGAGE_X && formed(aim) && now - s.nextAimMs >= 0) {
        s.nextAimMs = now + AIM_FIRE_MS; s.nextFireMs = now + interval(s, FIRE_MS_MIN, FIRE_MS_MAX);
        fireLaser(s, sx, sy);
      }
    } else if (now - s.nextFireMs >= 0) {
      s.nextFireMs = now + interval(s, FIRE_MS_MIN, FIRE_MS_MAX);
      fireLaser(s, sx, sy);
    }
    if (!s.mz.ph && now - s.nextBombMs >= 0) {
      s.nextBombMs = now + interval(s, BOMB_MS_MIN, BOMB_MS_MAX);
      for (const b of s.b) if (!b.on) { Object.assign(b, { x: sx + 3 * DOT, y: sy + SHIP_H, vx: BOMB_VX, vy: 0, on: true }); break; }
    }
  }

  const C = {
    white: rgb(255, 255, 255), yellow: rgb(255, 230, 64), orange: rgb(255, 140, 0), red: rgb(220, 40, 24),
    spark: [rgb(0, 224, 255), rgb(255, 80, 200), rgb(255, 230, 64), rgb(120, 255, 120)],
    star: [rgb(110, 110, 130), rgb(235, 235, 255), rgb(255, 220, 60), rgb(255, 110, 200)],
    EP: rgb(255, 96, 200), EE: rgb(255, 255, 255), EG: rgb(60, 220, 90), EC: rgb(0, 224, 255), EO: rgb(255, 150, 30),
    EY: rgb(255, 250, 170), ER: rgb(255, 50, 40), EM: rgb(224, 48, 200), EQ: rgb(70, 100, 255), ES: rgb(255, 220, 40), EV: rgb(170, 80, 255),
    EB_A: rgb(255, 120, 40), EB_B: rgb(255, 255, 200),
    beam: [rgb(255, 255, 255), rgb(0, 224, 255), rgb(255, 80, 200), rgb(255, 230, 64), rgb(120, 255, 120)],
    Wh: rgb(236, 236, 236), B: rgb(120, 128, 160), M: rgb(224, 48, 200), Cy: rgb(0, 224, 255), F1: rgb(255, 120, 0), F2: rgb(255, 240, 96),
    SH: rgb(120, 240, 255), peak: rgb(255, 255, 255),
  };

  function drawPop(x) {
    const cx = Math.round(x.x), cy = Math.round(x.y);
    if (x.age < 0.12) {
      for (const [ox, oy] of [[0, 0], [-DOT, 0], [DOT, 0], [0, -DOT], [0, DOT]]) dot(cx - 1 + ox, cy - 1 + oy, C.white);
    }
    const shift = Math.floor(x.age * 10);
    for (let i = 0; i < POP_SPARKS; i++) {
      const a = i * (2 * Math.PI / POP_SPARKS) + ((i & 1) ? 0.2 : 0);
      const r = DOT + x.age * ((i & 1) ? 230 : 150);
      const px0 = cx + Math.trunc(Math.cos(a) * r), py0 = cy + Math.trunc(Math.sin(a) * r), c = C.spark[(i + shift) & 3];
      if (x.age < 0.35) dot(px0 - 1, py0 - 1, c); else fillRect(px0, py0, 2, 2, c);
    }
  }
  function drawBurst(x) {
    if (x.pop) return drawPop(x);
    const DIR = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0]];
    const cx = Math.round(x.x) - 1, cy = Math.round(x.y) - DOT + 1, t = x.age / BURST_S;
    if (t < 0.25) { dot(cx, cy, C.white); dot(cx - DOT, cy, C.yellow); dot(cx + DOT, cy, C.yellow); dot(cx, cy - DOT, C.yellow); }
    const c = t < 0.35 ? C.yellow : t < 0.7 ? C.orange : C.red, r = DOT + Math.trunc(x.age * 30);
    for (const d of DIR) dot(cx + d[0] * r, cy + d[1] * r, c);
  }

  function render(s, now) {
    fb.fill(BLACK);
    const off = scrollOffset(s, now);
    for (let i = 0; i < NSTARS; i++) {
      const st = s.star[i];
      if (st.kind === 1 && (Math.floor(now / 150) + i * 7) % 23 === 0) continue;
      const x = Math.trunc(st.x), y = st.y, c = C.star[st.kind];
      px(x, y, c);
      if (st.near) { px(x + 1, y, c); px(x, y + 1, c); px(x + 1, y + 1, c); }
      for (let t = Math.round(s.mz.u * (st.near ? 10 : 4)); t > 0; t--) px(x + 1 + t, y, c);
    }
    if (!LIGHTS_FRONT) renderLights(s, now);               // the searchlights: behind the monsters and the terrain
    renderKong(s, now, false);                             // the body: behind the terrain
    for (let i = 0; i < COLS; i++) {
      const x0 = colX(i, off), h = mzHeight(s, s.h[i]);
      for (let dx = 0; dx < BAR_W; dx++) {
        const x = x0 + dx; if (x < 0 || x >= W) continue;
        for (let k = 0; k < h; k++) fb[(H - 1 - k) * W + x] = s.lit[k];
      }
    }
    if (LIGHTS_FRONT) renderLights(s, now);                // the searchlights: in front of the monsters and the terrain, behind the equalizer
    if (s.eq) {
      for (let j = 0; j < EQ_BANDS; j++) {
        const x0 = j * PITCH + (PITCH - BAR_W) / 2, h = eqHeight(s, j);
        let peak = s.scale >= 1 && !s.mz.u ? (Math.round(s.eqPeak[j]) - 1) * SEG_PITCH : -1;
        if (peak < h) peak = -1;
        for (let dx = 0; dx < BAR_W; dx++) {
          const x = x0 + dx;
          for (let k = 0; k < h; k++) fb[(H - 1 - k) * W + x] = k % SEG_PITCH < SEG_H ? s.eqCol[s.pattern - 1][j] : BLACK;
          if (peak >= 0) for (let k = peak; k < peak + SEG_H; k++) fb[(H - 1 - k) * W + x] = C.peak;
        }
      }
    }
    renderCity(s, now);                                    // the city: in front of the terrain and the equalizer, behind everything that flies
    for (const x of s.x) if (x.on) drawBurst(x);

    const frame = Math.floor(now / 250) & 1;
    const colOf = { P: C.EP, E: C.EE, W: C.EE, G: C.EG, C: C.EC, O: C.EO, R: C.ER, M: C.EM, Q: C.EQ, S: C.ES, V: C.EV, Y: C.EY };
    s.e.forEach((e, idx) => {
      if (!e.on) return;
      const k = KINDS[e.kind], u = formed(e) ? 1 : e.born / MAT_S, spread = MAT_R * (1 - u) * (1 - u);
      for (let y = 0; y < k.dh; y++)
        for (let x = 0; x < k.dw; x++) {
          const ch = k.art[frame][y][x]; if (ch === '.') continue;
          let ox = 0, oy = 0;
          if (spread > 0) {
            const hh = Math.imul(idx * 97 + y * 31 + x * 17, 2654435761) >>> 0;
            const a = (hh >>> 8) * (2 * Math.PI / 16777216);
            ox = Math.trunc(Math.cos(a) * spread); oy = Math.trunc(Math.sin(a) * spread);
          }
          dot(Math.trunc(e.x) + x * DOT + ox, Math.trunc(e.y) + y * DOT + oy, colOf[ch] || C.EY);
        }
    });
    s.mine.forEach((m, i) => { if (m.on) dot(Math.trunc(m.x), Math.trunc(m.y), ((Math.floor(now / 120) + i) & 1) ? C.ER : C.EE); });
    s.eb.forEach((b, i) => { if (b.on) dot(Math.trunc(b.x), Math.trunc(b.y), ((Math.floor(now / 80) + i) & 1) ? C.EB_A : C.EB_B); });
    renderMeteors(s);

    for (const m of s.m) {
      if (!m.on) continue;
      const tail = Math.trunc(m.x + (m.age > LASER_HOLD_S ? (m.age - LASER_HOLD_S) * LASER_TAIL_PX_S : 0));
      const head = Math.trunc(m.head), len = head - tail;
      for (let x = tail; x < head; x++) {
        if (x - tail < len / 3 && ((x >> 2) & 1)) continue;
        const c = head - x < 6 ? C.beam[0] : C.beam[1 + ((Math.floor((x - Math.trunc(m.x)) / 8) + Math.trunc(m.age * 30)) & 3)];
        for (let y = 0; y < LASER_H; y++) px(x, m.y + y, c);
      }
    }
    for (const b of s.b) if (b.on) dot(Math.trunc(b.x), Math.trunc(b.y), C.white);

    const sx = shipX(now) + Math.round(s.lunge), sy = Math.round(s.shipY + bobY(now) + s.evadeCur);
    for (let y = 0; y < SHIP_DH; y++)
      for (let x = 0; x < SHIP_DW; x++) {
        const c = SHIP[y][x]; if (c === '.') continue;
        dot(sx + x * DOT, sy + y * DOT, c === 'W' ? C.Wh : c === 'B' ? C.B : c === 'M' ? C.M : C.Cy);
      }
    if (s.shieldUntil - now > 0 && (Math.floor(now / 50) & 1)) {
      const fx = sx + SHIP_W + DOT;
      for (let y = -1; y <= SHIP_DH; y++) dot(fx + (y < 0 || y === SHIP_DH ? -DOT : 0), sy + y * DOT, C.SH);
      dot(sx + Math.trunc(SHIP_W / 2), sy - 2 * DOT, C.SH);
      dot(sx + Math.trunc(SHIP_W / 2), sy + SHIP_H + DOT, C.SH);
    }
    dot(sx - DOT, sy + 2 * DOT, C.F2);
    if ((Math.floor(now / 90)) & 1) dot(sx - 2 * DOT, sy + 2 * DOT, C.F1);
    if (s.mz.u > 0.5) { dot(sx - 2 * DOT, sy + 2 * DOT, C.F1); if ((Math.floor(now / 60)) & 1) dot(sx - 3 * DOT, sy + 2 * DOT, C.F2); }
    renderLightBases(s);                                   // the searchlights' bases, on the ground
    renderKong(s, now, true);                              // both arms: in front of the terrain, the equalizer and the fighter
  }

  return { newState, init, push, analyze, update, render, COL_MS, DB_SILENT, MODE_MS, EQ_BANDS };
})();

/* ================= KeyEarth (ported from KeyEarth.h): the spinning Earth of the keyboard screen ================= */
const Earth = (() => {
  const NX = 12, NY = 24, PX = 8, PY = 4, BW = 6, BH = 3, OX = 2, OY = 2, CX = 50, CY = 50;
  const TILT_DEG = 20, TURN_MS = 60000, LON_START = 135, NSTARS = 16;
  const DIM = [
    { x0: CX - 21, y0: CY - 20, x1: CX + 21, y1: CY, roundTop: true, roundBottom: false, mouse: false },
    { x0: CX - 33, y0: CY, x1: CX + 32, y1: CY + 20, roundTop: false, roundBottom: true, mouse: false },
    { x0: CX - 33, y0: CY - 11, x1: CX + 32, y1: CY + 9, roundTop: true, roundBottom: true, mouse: true },
  ];
  const LAND = [
    [85, -60, -20],
    [75, -120, -70], [75, -60, -20], [75, 15, 25], [75, 50, 60], [75, 80, 140],
    [65, -168, -60], [65, -50, -25], [65, -22, -14], [65, 5, 180],
    [55, -135, -95], [55, -80, -58], [55, -8, -2], [55, 8, 140], [55, 155, 162],
    [45, -125, -60], [45, -5, 145],
    [35, -120, -77], [35, -10, 10], [35, 35, 122], [35, 130, 140],
    [25, -110, -97], [25, -15, 57], [25, 68, 120],
    [15, -92, -84], [15, -17, 50], [15, 74, 80], [15, 98, 108],
    [5, -77, -50], [5, -8, 48], [5, 100, 118],
    [-5, -80, -35], [-5, 10, 40], [-5, 105, 115], [-5, 120, 125], [-5, 135, 150],
    [-15, -75, -40], [-15, 12, 40], [-15, 44, 50], [-15, 125, 145],
    [-25, -70, -48], [-25, 15, 33], [-25, 44, 47], [-25, 114, 153],
    [-35, -72, -57], [-35, 18, 25], [-35, 116, 140], [-35, 172, 178],
    [-45, -75, -65], [-45, 167, 172],
    [-55, -72, -66],
    [-65, -70, -55], [-65, 40, 160],
    [-75, -150, -60], [-75, -30, 180],
    [-85, -180, 180],
  ];
  const isLand = (band, lon) => LAND.some(r => r[0] === band && r[1] <= lon && lon <= r[2]);
  const cell = Array.from({ length: NY }, () => Array.from({ length: NX }, () => ({ on: false, polar: false, band: 0, lon: 0, shade: 0, dim: false, dimM: false })));
  const stars = [];
  const STAR_C = [rgb(110, 110, 130), rgb(235, 235, 255), rgb(255, 220, 60), rgb(255, 110, 200)];

  (function begin() {
    const c = Math.cos(TILT_DEG * Math.PI / 180), s = Math.sin(TILT_DEG * Math.PI / 180);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x = (i + 0.5 - NX / 2) / (NX / 2), y = (NY / 2 - j - 0.5) / (NY / 2), d = x * x + y * y, e = cell[j][i];
      if (d > 1) continue;
      const z = Math.sqrt(1 - d), yy = y * c + z * s, zz = -y * s + z * c, lat = Math.asin(yy) * 180 / Math.PI;
      const band = Math.floor(lat / 10) * 10 + 5;
      e.on = true; e.polar = Math.abs(lat) > 68;
      e.band = band > 85 ? 85 : band < -85 ? -85 : band;
      e.lon = Math.round(Math.atan2(x, zz) * 180 / Math.PI);
      e.shade = Math.trunc((0.45 + 0.55 * z) * 255);
    }
    for (const d of DIM) {
      let jTop = NY, jBottom = -1, iMin = NX, iMax = -1;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const x0 = OX + i * PX, y0 = OY + j * PY;
        if (x0 + BW <= d.x0 || x0 >= d.x1 || y0 + BH <= d.y0 || y0 >= d.y1) continue;
        cell[j][i][d.mouse ? 'dimM' : 'dim'] = true;
        jTop = Math.min(jTop, j); jBottom = Math.max(jBottom, j); iMin = Math.min(iMin, i); iMax = Math.max(iMax, i);
      }
      if (iMax < 0) continue;
      for (const j of [d.roundTop ? jTop : -1, d.roundBottom ? jBottom : -1]) {
        if (j < 0) continue;
        cell[j][iMin][d.mouse ? 'dimM' : 'dim'] = false; cell[j][iMax][d.mouse ? 'dimM' : 'dim'] = false;
      }
    }
    let rng = 3;
    for (let tries = 0; tries < 400 && stars.length < NSTARS; tries++) {
      rng = (rng ^ (rng << 13)) >>> 0; rng = (rng ^ (rng >>> 17)) >>> 0; rng = (rng ^ (rng << 5)) >>> 0;
      const x = rng % 101, y = (rng >>> 8) % 97, k = (rng >>> 16) % 10, near = (rng >>> 20) % 4 === 0;
      if ((x - CX) ** 2 + (y - CY) ** 2 < 52 * 52) continue;
      stars.push({ x, y, near, kind: k < 4 ? 0 : k < 7 ? 1 : k < 9 ? 2 : 3 });
    }
  })();

  function draw(now, letters, mouse) {
    stars.forEach((st, n) => {
      if (st.kind === 1 && (Math.floor(now / 250) + n * 7) % 23 === 0) return;
      fillRect(st.x, st.y, st.near ? 2 : 1, st.near ? 2 : 1, STAR_C[st.kind]);
    });
    const lon0 = LON_START - Math.floor((now % TURN_MS) * 360 / TURN_MS);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const e = cell[j][i]; if (!e.on) continue;
      const lon = (((e.lon + lon0) % 360) + 540) % 360 - 180;
      let r, g, b;
      if (e.polar) [r, g, b] = [230, 240, 255]; else if (isLand(e.band, lon)) [r, g, b] = [40, 230, 70]; else [r, g, b] = [20, 90, 255];
      r = Math.trunc(r * e.shade / 255); g = Math.trunc(g * e.shade / 255); b = Math.trunc(b * e.shade / 255);
      if (mouse ? e.dimM : e.dim) { r = Math.trunc(r / 3); g = Math.trunc(g / 3); b = Math.trunc(b / 3); }
      fillRect(OX + i * PX, OY + j * PY, BW, BH, rgb(r, g, b));
    }
    if (mouse) drawString("MOUSE", CX - 30, CY - 8, letters, 2);
    else { drawString("KEY", CX - 18, CY - 17, letters, 2); drawString("BOARD", CX - 30, CY + 1, letters, 2); }
  }
  return { draw };
})();

/* ================= Screens: keyboard (text input) mode, help, start ================= */
const KANA_A = [0x020, 0x0FC, 0x024, 0x07E, 0x0A9, 0x131, 0x121, 0x0C6];
function drawKanaA(x, y, c) {
  for (let r = 0; r < 8; r++) for (let col = 0; col < 9; col++) if (KANA_A[r] & (0x100 >> col)) px(x + col, y + r, c);
}
const ICON_CMD = [0x22, 0x55, 0x3E, 0x14, 0x3E, 0x55, 0x22], ICON_OPT = [0x67, 0x10, 0x10, 0x08, 0x08, 0x07, 0x00],
      ICON_WIN = [0x77, 0x77, 0x77, 0x00, 0x77, 0x77, 0x77];
function drawIcon(icon, x, y, c) {
  for (let r = 0; r < 7; r++) for (let col = 0; col < 7; col++) if (icon[r] & (0x40 >> col)) px(x + col, y + r, c);
}
function drawHelp(key, meaning, x, y, meaningX) {
  drawString(key, x, y, COL_AMBER); drawString(meaning, meaningX, y, COL_FG);
}
function drawKeys(now) {
  fb.fill(COL_BG);
  Earth.draw(now, COL_FG, ui.airOn);
  let x = 4;
  drawString("USB", x, 99, COL_OK);
  if (A.src === "mic") drawString("MIC", x, 90, COL_OK);   // the microphone is the input (the device: bottom left corner, above the connection)
  x += textWidth("USB") + 6;
  drawString(ui.osWin ? "Win" : "Mac", x, 99, COL_FG);
  x += 24;
  drawString("A", x, 99, ui.inputKana === 0 ? COL_AMBER : COL_FG);
  drawString("/", x + 6, 99, COL_FG);
  drawKanaA(x + 12, 99, ui.inputKana === 1 ? COL_AMBER : COL_FG);
  drawHelp("Fn+O", "Mac/Win", 4, 108, 46);
  drawHelp("Fn+[ ]", "A/", 4, 117, 46);
  drawKanaA(46 + 12, 117, COL_FG);

  const SHEET = [["Fn+;,./", "Arrows"], ["Fn+Sh+", "PgUp/End"], ["Fn+`", "Esc"], ["Fn+1..=", "F1-F12"], ["Fn+Del", "Delete"]];
  const MAC = [["alt", "Command", ICON_CMD], ["opt", "Option", ICON_OPT], ["alt+C/V", "copy/paste"]];
  const WIN = [["alt", "Alt"], ["opt", "Win", ICON_WIN], ["ctrl+C/V", "copy/paste"]];
  const sx = 108, mx = 164;
  let y = 2;
  if (ui.airOn) {
    const cross = (key, meaning, cx, yy) => {
      drawString(key, cx - Math.trunc(textWidth(key) / 2), yy, COL_AMBER);
      drawString(meaning, cx - Math.trunc(textWidth(meaning) / 2), yy + 10, COL_FG);
    };
    const cl = 128, cm = 172, cr = 216;
    drawHelp("tilt", "Move", 110, 3, 140);
    cross("E ;", "Up", cm, 20); cross("A ,", "Click", cl, 52); cross("S", "Enter", cm, 52);
    cross("D /", "R-click", cr, 52); cross("Z .", "Down", cm, 84);
    drawHelp("A+tilt", "Drag", 110, 112, 152);
    drawString("let go of G0: keys", 110, 125, COL_DIM);
  } else {
    drawHelp("Fn+M", "mode", sx, y, mx);
    y += 9;
    drawHelp("Fn+I", "USB/MIC", sx, y, mx);
    y += 12;
    for (const h of SHEET) { drawHelp(h[0], h[1], sx, y, mx); y += 9; }
    y += 3;
    for (const h of ui.osWin ? WIN : MAC) {
      drawHelp(h[0], h[1], sx, y, mx);
      if (h[2]) drawIcon(h[2], mx + textWidth(h[1]) + 4, y, COL_FG);
      y += 9;
    }
    drawHelp("G0+tilt", "Move", sx, y + 3, mx);
  }
}

/* ================= Measure, help and the emblem screen (ported from KeySpeaker_S0.ino) ================= */
const MODE_DATA = 0, MODE_GAME = 1, MODE_KEYS = 2, MODE_NAME = ["measure", "flight", "keyboard"];
const SPLASH_MS = 2000, IDLE_MS = 60000, BOOST_MAX_DB = 18, BOOST_STEP_DB = 3, RING_MS = 500, START_FILL_MS = 100, VOL_MIN_DB = -50;
const ui = { mode: MODE_GAME, splashOn: true, splashIdle: false, splashStartMs: 0, splashDrawn: false, helpOn: false,
  osWin: false, inputKana: -1, airOn: false, volDb: -10, muted: false, boostDb: 9, bassCut: false, groveAux: false,
  lastKeyMs: 0, lastSoundMs: 0, lastScreen: 0, fillMin: Infinity, fillMax: 0, playMs: 0, since: 0 };
try { const m = parseInt(localStorage.getItem("ks_mode"), 10); if (m >= 0 && m < 3) ui.mode = m; } catch (e) {}
const lcd = document.getElementById("lcd"), lctx = lcd.getContext("2d");
const img = new ImageData(new Uint8ClampedArray(fb.buffer), W, H);
const flight = FV.newState();
const meter = { inPk: 0, outPk: 0 };

function drawRect(x, y, w, h, c) {
  for (let i = 0; i < w; i++) { px(x + i, y, c); px(x + i, y + h - 1, c); }
  for (let j = 0; j < h; j++) { px(x, y + j, c); px(x + w - 1, y + j, c); }
}
function drawMeasure(now) {
  fb.fill(COL_BG);
  drawString("KeySpeaker", 4, 2, COL_AMBER, 2);
  drawString(BUILD_TAG, 206, 2, COL_DIM);
  const sounding = isSounding(), mounted = A.src !== "none" || ui.groveAux;
  drawString("USB " + (sounding ? "STREAMING" : mounted ? "MOUNTED (no stream)" : "NOT CONNECTED") + "  SOF" + (sounding ? "+" : "-"), 4, 24,
    sounding ? COL_OK : mounted ? COL_WARN : COL_BAD);
  // The buffer: a demo value around the firmware's 100 ms start level.
  const fillMs = sounding ? Math.round(START_FILL_MS + 9 * Math.sin(now / 900) + 4 * Math.sin(now / 230)) : 0;
  if (sounding) { ui.fillMin = Math.min(ui.fillMin, fillMs); ui.fillMax = Math.max(ui.fillMax, fillMs); }
  drawRect(4, 38, 232, 10, COL_DIM);
  fillRect(4, 38, Math.trunc(fillMs * 232 / RING_MS), 10, fillMs < 30 ? COL_BAD : fillMs > 400 ? COL_WARN : COL_OK);
  fillRect(4 + Math.trunc(START_FILL_MS * 232 / RING_MS), 36, 1, 14, COL_FG);
  const p3 = (n, w) => String(n).padStart(w, " ");
  drawString("buffer " + p3(fillMs, 3) + " ms  (min " + (ui.fillMin === Infinity ? 0 : ui.fillMin) + " / max " + ui.fillMax + ")", 4, 52, COL_FG);
  drawString("underrun 0  overrun 0", 4, 64, COL_FG);
  const playS = Math.floor(ui.playMs / 1000), mm = Math.floor(playS / 60), ss = String(playS % 60).padStart(2, "0");
  drawString("adj +0 ppm  trend " + (playS >= 30 ? "+0" : "--") + "  (" + mm + ":" + ss + ")", 4, 76, COL_FG);
  const el = Math.floor((now - ui.since) / 1000);
  drawString("since " + Math.floor(el / 3600) + ":" + String(Math.floor(el / 60) % 60).padStart(2, "0") + ":" + String(el % 60).padStart(2, "0") + "  boot 1 web", 4, 88, COL_FG);
  drawString("PC vol " + ui.volDb + " dB" + (ui.muted ? " MUTE" : "") + "  L" + ui.volDb + " R" + ui.volDb + (ui.groveAux ? "  +AUX" : ""), 4, 100, COL_FG);
  // Level meters: in (after the host volume) and out (after boost and the limiter), the peak since the last redraw.
  const gain = ui.muted ? 0 : Math.pow(10, ui.volDb / 20), pkIn = Math.min(32767, meter.inPk * 32768 * gain);
  const pkOut = Math.min(0.89 * 32767, pkIn * Math.pow(10, ui.boostDb / 20));
  meter.inPk = 0;
  drawRect(4, 112, 60, 8, COL_DIM); fillRect(4, 112, Math.trunc(pkIn * 60 / 32768), 8, COL_OK);
  drawRect(68, 112, 60, 8, COL_DIM); fillRect(68, 112, Math.trunc(pkOut * 60 / 32768), 8, pkOut >= 0.89 * 32767 * 0.98 ? COL_WARN : COL_OK);
  drawString("+" + ui.boostDb + "dB " + (ui.bassCut ? "cut" : "full"), 134, 112, COL_FG);
  drawString("[ ]\\ vol  spc play  v view  h help", 4, 125, COL_DIM);
}

function drawSpeakerHelp() {
  fb.fill(COL_BG);
  drawString("HELP", 6, 4, COL_AMBER, 2);
  drawString(ui.mode === MODE_GAME ? "flight mode" : "measure mode", 60, 10, COL_DIM);
  drawString(BUILD_TAG, 236 - textWidth(BUILD_TAG), 4, COL_DIM);
  const LEFT = [["[ ]", "volume"], ["\\", "mute"], ["space", "play/pause"], [", /", "prev/next"], ["- =", "boost"], ["b", "bass cut"]];
  const RIGHT = [["v", "measure/flight"], ["r", "reset counts"], ["h", "close help"], ["Fn+M", "next mode"], ["Fn+O", "Mac/Win"],
                 ["Fn+A", ui.groveAux ? "AUX on" : "AUX off"]];
  let y = 30;
  for (const h of LEFT) { drawHelp(h[0], h[1], 6, y, 44); y += 15; }
  y = 30;
  for (const h of RIGHT) { drawHelp(h[0], h[1], 124, y, 156); y += 15; }
  drawString("+" + ui.boostDb + "dB " + (ui.bassCut ? "cut" : "full") + "  " + (ui.muted ? "MUTE" : ""), 124, 30 + 6 * 15, COL_DIM);
}

// The emblem screen, from the firmware's own images (Splash.h): at start with the name, at rest with the hint line.
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const SP = (() => {
  const g = b64(SPLASH.grille), e = b64(SPLASH.emblem);
  const u16 = (a, n) => Uint16Array.from({ length: n }, (_, i) => a[2 * i] | (a[2 * i + 1] << 8));
  return { grille: u16(g, W * H), emblem: u16(e, SPLASH.emblemW * SPLASH.emblemH), alpha: b64(SPLASH.alpha) };
})();
function c565(v) {
  const r = (v >> 11) & 31, g = (v >> 5) & 63, b = v & 31;
  return rgb((r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2));
}
const shake = { dx: 0, dy: 0, step: 0, x: 0, y: 0, level: 0, peak: 0 };
function shakeService() {                       // the emblem jumps 1 or 2 px on loud beats and settles back
  const p = shake.peak; shake.peak = 0;
  let x = 0, y = 0;
  if (shake.step === 0 && p >= 2000 && p > shake.level * 1.4) {
    const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], d = DIRS[Math.floor(Math.random() * 8)];
    const amp = p > 8000 && p > shake.level * 2.2 ? 2 : 1;
    shake.dx = d[0]; shake.dy = d[1]; x = d[0] * amp; y = d[1] * amp; shake.step = 1;
  } else if (shake.step === 1) { x = -shake.dx; y = -shake.dy; shake.step = 2; }
  else shake.step = 0;
  shake.level += (p - shake.level) * 0.1;
  const moved = x !== shake.x || y !== shake.y;
  shake.x = x; shake.y = y;
  return moved;
}
function showSplash(idle, now) {
  ui.splashOn = true; ui.splashDrawn = false; ui.splashIdle = idle; ui.splashStartMs = now;
  shake.peak = 0; shake.level = 0; shake.step = shake.x = shake.y = 0;
}
function drawHintLine(pairs, y) {
  const gap = textWidth("  ");
  let w = -gap;
  for (let i = 0; i < pairs.length; i += 2) w += textWidth(pairs[i]) + textWidth(" ") + textWidth(pairs[i + 1]) + gap;
  let x = 120 - Math.trunc(w / 2);
  for (let i = 0; i < pairs.length; i += 2) {
    drawString(pairs[i], x, y, COL_AMBER); x += textWidth(pairs[i]) + textWidth(" ");
    drawString(pairs[i + 1], x, y, c565(0xD69A)); x += textWidth(pairs[i + 1]) + gap;
  }
}
function drawSplash() {
  const s = Uint16Array.from(SP.grille), EW = SPLASH.emblemW, EH = SPLASH.emblemH;
  for (let y = 0; y < EH; y++) for (let x = 0; x < EW; x++) {
    const a = SP.alpha[y * EW + x]; if (!a) continue;
    const e = SP.emblem[y * EW + x], i = (SPLASH.emblemY + shake.y + y) * W + SPLASH.emblemX + shake.x + x;
    if (i < 0 || i >= W * H) continue;
    if (a === 255) { s[i] = e; continue; }
    const d = s[i], r = ((d >> 11) * (255 - a) + (e >> 11) * a) / 255 | 0, g = (((d >> 5) & 63) * (255 - a) + ((e >> 5) & 63) * a) / 255 | 0,
          b = ((d & 31) * (255 - a) + (e & 31) * a) / 255 | 0;
    s[i] = (r << 11) | (g << 5) | b;
  }
  if (ui.splashIdle) for (let i = W * 121; i < W * H; i++) {   // at rest the grille's bottom darkens to about 40 %
    const c = s[i]; s[i] = ((((c >> 11) * 2 / 5) | 0) << 11) | (((((c >> 5) & 63) * 2 / 5) | 0) << 5) | (((c & 31) * 2 / 5) | 0);
  }
  for (let i = 0; i < W * H; i++) fb[i] = c565(s[i]);
  if (ui.splashIdle) drawHintLine(["h", "HELP", "Fn+M", "KEYBOARD"], 125);
  else { drawString("KeySpeaker", 61, 108, COL_BG, 2); drawString("KeySpeaker", 60, 107, COL_FG, 2); }
}

/* ================= audio: the sound this computer is playing (screen / tab sharing) ================= */
const A = { ac: null, analyser: null, sink: null, src: "none", node: null, stream: null, sr: 48000, gen: 0, pend: null };
const td = new Float32Array(2048), smp = new Float32Array(512);
const $ = id => document.getElementById(id);
// Page language: English (main) or Japanese (sub). The screen itself is always English, like the device.
let lang = "en";                                      // English is the main language; Japanese is the sub, chosen with the switch
try { if (localStorage.getItem("ks_lang") === "ja") lang = "ja"; } catch (e) {}
let msgPair = ["", ""];
const showMsg = () => { $("msg").textContent = msgPair[lang === "ja" ? 0 : 1]; };
const say = (ja, en) => { msgPair = [ja, en]; showMsg(); };
function setLang(l) {
  lang = l; document.documentElement.dataset.lang = l; document.documentElement.lang = l;
  try { localStorage.setItem("ks_lang", l); } catch (e) {}
  document.querySelectorAll("[data-setlang]").forEach(b => b.classList.toggle("act", b.dataset.setlang === l));
  showMsg(); syncUi();
}
const canCapture = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
const canMic = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);   // needs HTTPS (or localhost)
// Every user action on a source takes a new number. A request that is still waiting (a permission prompt, a sharing dialog)
// compares its own number with A.gen when it comes back, and drops its result if another source was chosen meanwhile.
const claim = () => { A.pend = null; A.gen++; syncUi(); return A.gen; };

function ensureAudio() {
  if (!A.ac) {
    const ac = A.ac = new (window.AudioContext || window.webkitAudioContext)();
    A.analyser = ac.createAnalyser(); A.analyser.fftSize = 2048; A.analyser.smoothingTimeConstant = 0;
    A.sink = ac.createGain(); A.sink.gain.value = 0; A.analyser.connect(A.sink); A.sink.connect(ac.destination);
    A.sr = ac.sampleRate;
    ac.addEventListener("statechange", micCheck);   // does nothing unless the microphone is the source
    FV.init(flight, performance.now() | 0, A.sr);
  }
  if (A.ac.state !== "running") A.ac.resume().catch(() => {});   // Safari also has "interrupted" (after a call, say), not only "suspended"
  return A.ac;
}
function syncUi() {
  $("bTest").style.opacity = A.src === "test" ? "1" : "";
  $("bShare").setAttribute("aria-pressed", A.src === "capture" ? "true" : "false");
  $("shareLabel").textContent = A.src === "capture" ? (lang === "ja" ? "STOP(取り込みを止める)" : "STOP (stop capturing)") : (lang === "ja" ? "START(PCの音を取り込む)" : "START (capture the PC's sound)");
  const ja = lang === "ja";
  $("bMic").setAttribute("aria-pressed", A.src === "mic" ? "true" : "false");
  $("bMic").setAttribute("aria-busy", A.pend === "mic" ? "true" : "false");
  $("micLabel").textContent = A.src === "mic" ? (ja ? "MIC STOP(マイクを止める)" : "MIC STOP (stop the microphone)")
    : A.pend === "mic" ? (ja ? "MIC(許可を待っています…)" : "MIC (waiting for permission…)")
    : (ja ? "MIC START(マイクで音を取り込む)" : "MIC START (use the microphone)");
}
function stopSource() {
    if (A.node) { try { A.node.stop && A.node.stop(); } catch (e) {} try { A.node.disconnect(); } catch (e) {} A.node = null; }
  if (A.el) { try { A.el.srcObject = null; } catch (e) {} A.el = null; }
  if (A.stream) { A.stream.getTracks().forEach(t => t.stop()); A.stream = null; }
  A.src = "none"; syncUi();
}
async function startCapture() {
  if (!canCapture) { say("このブラウザは音の取り込みに対応していません。", "This browser cannot capture audio."); return; }
  const gen = claim();
  const ac = ensureAudio();
  try {
    // Browsers insist on asking for video as well; it is thrown away below.
    // Choosing a tab normally brings that tab to the front, hiding this page. CaptureController keeps the focus here.
    const opts = { video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
                   selfBrowserSurface: "exclude", systemAudio: "include", surfaceSwitching: "exclude" };
    let controller = null;
    if (typeof CaptureController !== "undefined") { try { controller = new CaptureController(); opts.controller = controller; } catch (e) {} }
    const st = await navigator.mediaDevices.getDisplayMedia(opts);
    if (gen !== A.gen) { st.getTracks().forEach(t => t.stop()); return; }   // another source was chosen while the dialog was open
    if (controller && controller.setFocusBehavior) { try { controller.setFocusBehavior("no-focus-change"); } catch (e) {} }
    window.focus();
    st.getVideoTracks().forEach(t => t.stop());
    if (!st.getAudioTracks().length) { st.getTracks().forEach(t => t.stop()); say("音声が共有されませんでした。共有ダイアログで「音声を共有」にチェックしてください。", "No audio was shared. Tick \"Share audio\" in the sharing dialog."); return; }
    stopSource();
    A.stream = new MediaStream(st.getAudioTracks());
    A.stream.getAudioTracks()[0].addEventListener("ended", () => { stopSource(); say("共有が終わりました。もう一度 START を押してください。", "Sharing ended. Press START again."); });
    try { A.el = new Audio(); A.el.muted = true; A.el.srcObject = A.stream; A.el.play().catch(() => {}); } catch (e) {}
    A.node = ac.createMediaStreamSource(A.stream); A.node.connect(A.analyser);   // not to the speakers: it is already playing
    A.src = "capture"; syncUi(); say("PCの音を取り込み中。音を鳴らすと地形ができます。", "Capturing the PC's sound. Play something and the terrain grows.");
  } catch (e) {
    if (gen !== A.gen) return;
    e.name === "NotAllowedError" ? say("共有がキャンセルされました。", "Sharing was cancelled.") : say("取り込めませんでした: " + e.message, "Could not capture: " + e.message);
  }
}
/* ---- microphone: the phone's main source, and a choice on a computer. Permission is asked only when the button is pressed.
   The sound goes into the analyser only, never to the speakers (no feedback), and is not recorded or sent anywhere. ---- */
function micFail(e) {
  const n = e && e.name, m = (e && e.message) || n || "unknown";
  if (n === "NotAllowedError" || n === "SecurityError") return ["マイクの使用が許可されていません。ブラウザのサイト設定でマイクを許可してから、もう一度 MIC START を押してください。",
    "Microphone access was not allowed. Allow the microphone in the browser's site settings, then press MIC START again."];
  if (n === "NotFoundError" || n === "OverconstrainedError") return ["マイクが見つかりません。マイクが接続・有効になっているか確認してください。", "No microphone was found. Check that one is connected and enabled."];
  if (n === "NotReadableError" || n === "AbortError") return ["マイクを使えませんでした。ほかのアプリがマイクを使っているかもしれません。", "The microphone could not be used. Another app may be using it."];
  return ["マイクを開始できませんでした: " + m, "Could not start the microphone: " + m];
}
async function startMic() {
  if (!canMic) { say("このブラウザではマイクを使えません(HTTPS で開く必要があります)。", "The microphone is not available here (the page must be opened over HTTPS)."); return; }
  const gen = claim();
  A.pend = "mic"; syncUi(); say("マイクの許可を待っています…", "Waiting for microphone permission…");
  let st = null, node = null, committed = false;
  try {
    const ac = ensureAudio();                  // still inside the tap, before any await: iOS Safari starts an AudioContext only from a user gesture
    // Echo cancellation, noise suppression and auto gain are asked off: they would flatten the terrain. Some phones ignore this.
    st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    if (gen !== A.gen) { st.getTracks().forEach(t => t.stop()); return; }   // another source was chosen while the prompt was open
    const tr = st.getAudioTracks()[0];
    if (!tr) { const e = new Error("no audio track"); e.name = "NotFoundError"; throw e; }
    // Build everything first, without touching A: if any of this throws, the source that was running before is left as it was.
    node = ac.createMediaStreamSource(st); node.connect(A.analyser);   // analyser only: its output gain is 0
    // From here on nothing can throw: the old source is replaced in one step.
    committed = true;
    stopSource(); clearTimeout(micWatch); micPaused = false; A.pend = null;
    A.stream = st; A.node = node; A.src = "mic";
    tr.addEventListener("ended", () => { if (A.stream === st) micLost(); });
    tr.addEventListener("mute", micCheck); tr.addEventListener("unmute", micCheck);
    if (ac.state !== "running") ac.resume().catch(() => {});
    syncUi(); micListening();
  } catch (e) {
    if (!committed) {                          // nothing was handed over to A: release what this attempt opened
      try { if (node) node.disconnect(); } catch (_) {}
      if (st) st.getTracks().forEach(t => t.stop());
    }
    if (gen !== A.gen) return;
    A.pend = null; syncUi(); say(...micFail(e));
  }
}
/* ---- keeping the microphone alive: a lock screen, a call or another app can mute the track, suspend the AudioContext or end the track.
   Browsers (iOS Safari above all) do not promise to bring these back by themselves, so a pause that lasts more than a few seconds
   stops the source and asks for MIC START. That tap also gives iOS the user gesture it needs to restart the AudioContext. ---- */
let micWatch = 0, micPaused = false;
const micListening = () => say("マイクの音を取り込み中。音を鳴らすと地形ができます。", "Listening to the microphone. Make some sound and the terrain grows.");
function micLost() {
  clearTimeout(micWatch); micWatch = 0; micPaused = false;
  stopSource();
  say("マイクの入力が止まりました(画面ロック・通話・ほかのアプリの使用など)。MIC START を押して再開してください。",
      "The microphone stopped (screen lock, a call or another app, for example). Press MIC START to restart it.");
}
function micCheck() {                          // called on mute / unmute / AudioContext state change / the page coming back
  clearTimeout(micWatch); micWatch = 0;
  if (A.src !== "mic") { micPaused = false; return; }
  const tr = A.stream && A.stream.getAudioTracks()[0];
  if (!tr || tr.readyState === "ended") { micLost(); return; }
  if (A.ac.state !== "running") A.ac.resume().catch(() => {});
  const bad = () => tr.muted || A.ac.state !== "running";
  if (!bad()) { if (micPaused) { micPaused = false; micListening(); } return; }
  if (!micPaused) { micPaused = true; say("マイクの入力が一時停止しています…", "The microphone input is paused…"); }
  // Not while the page is hidden (a locked phone): the check runs again when it comes back (visibilitychange).
  micWatch = setTimeout(() => { micWatch = 0; if (A.src !== "mic" || document.hidden) return; bad() ? micLost() : micCheck(); }, 3000);
}
const toggleMic = () => (A.src === "mic" ? (claim(), stopSource(), say("マイクを止めました。", "Microphone stopped.")) : A.pend === "mic" ? null : startMic());
/* ---- trial: a synthetic song (kick, snare, hats, bass, arpeggio; loud and quiet bars), so the terrain, the equalizer and Kong
   can be watched without sharing any sound. It goes only into the analyser, never to the speakers. ---- */
function makeTestSong(sr) {
  const bpm = 124, beat = 60 / bpm, bars = 4, n = Math.round(sr * beat * 4 * bars), data = new Float32Array(n);
  const SCALE = [0, 3, 5, 7, 10, 12, 15, 17], ROOT = 55, lvl = [1, 1, 0.55, 0.9];  // bar loudness: a swell and a drop
  let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  let kp = 0, bp = 0, lp = 0, hn = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, b = t / beat, bi = Math.floor(b), tb = (b - bi) * beat, bar = Math.floor(bi / 4) % bars, g = lvl[bar];
    let v = 0;
    if (bar !== 2 || (bi % 4 === 0)) { kp += 2 * Math.PI * (45 + 110 * Math.exp(-tb * 28)) / sr; v += Math.sin(kp) * Math.exp(-tb * 7) * 0.9; }   // kick
    if (bi % 4 === 1 || bi % 4 === 3) v += rnd() * Math.exp(-tb * 16) * 0.35;                                                                        // snare
    const th = (b * 2 % 1) * beat / 2, nz = rnd(); v += (nz - hn) * Math.exp(-th * 70) * 0.12; hn = nz;                                           // hats
    const note = [0, 0, 7, 5][bi % 4], f = ROOT * Math.pow(2, note / 12);                                                                           // bass
    bp += f / sr; v += ((bp % 1) * 2 - 1) * 0.18 * Math.exp(-tb * 2.2) * g;
    const e8 = Math.floor(b * 2), te = ((b * 2) % 1) * beat / 2, lf = ROOT * 4 * Math.pow(2, SCALE[(e8 * 3 + bar * 2) % SCALE.length] / 12);         // arpeggio
    lp += lf / sr; v += (Math.sin(2 * Math.PI * lp) + 0.4 * Math.sin(4 * Math.PI * lp)) * 0.10 * Math.exp(-te * 9) * (bar === 1 ? 1.4 : 1);
    data[i] = v * (0.45 + 0.55 * g);
  }
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(data[i]));
  for (let i = 0; i < n; i++) data[i] *= 0.8 / pk;
  return data;
}
function startTest() {
  claim(); const ac = ensureAudio(); stopSource();
  const buf = ac.createBuffer(1, Math.round(ac.sampleRate * (60 / 124) * 16), ac.sampleRate); buf.copyToChannel(makeTestSong(ac.sampleRate), 0);
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(A.analyser); src.start();
  A.node = src; A.src = "test"; syncUi();
  say("テスト音を再生中(スピーカーからは鳴りません)。", "Playing the test song (not through the speakers).");
}
const toggleTest = () => (A.src === "test" ? (claim(), stopSource(), say("テスト音を止めました。", "Test sound stopped.")) : startTest());
const isSounding = () => !!A.ac && A.src !== "none" && A.ac.state === "running";
const toggleShare = () => (A.src === "capture" ? (claim(), stopSource(), say("取り込みを止めました。", "Capture stopped.")) : startCapture());
const toggleFull = () => { document.fullscreenElement ? document.exitFullscreen() : lcd.requestFullscreen && lcd.requestFullscreen(); };

/* ================= keys: exactly the device's own (Fn = Shift on a computer) ================= */
const LABEL = { BracketLeft: "[", BracketRight: "]", Backslash: "\\", Space: " ", Comma: ",", Slash: "/", Minus: "-", Equal: "=",
                KeyB: "b", KeyR: "r", KeyV: "v", KeyH: "h", KeyM: "m", KeyO: "o", KeyA: "a", KeyI: "i" };
function setMode(m) {
  ui.mode = m; ui.helpOn = false; ui.airOn = false; ui.lastScreen = 0;
  try { localStorage.setItem("ks_mode", String(m)); } catch (e) {}
}
function onKey(code, fn) {
  ui.lastKeyMs = performance.now();
  const c = LABEL[code] || "", keysMode = ui.mode === MODE_KEYS;
  if (ui.splashOn && ui.splashIdle && !keysMode) { ui.splashOn = false; return; }   // the key that wakes the emblem only closes it
  let acted = false, noJob = false;
  if (fn) {
    if (c === "m") { setMode((ui.mode + 1) % 3); acted = true; }
    else if (keysMode && (c === "[" || c === "]")) ui.inputKana = c === "]" ? 1 : 0;
    else if (c === "o") { ui.osWin = !ui.osWin; acted = true; }
    else if (c === "a") { ui.groveAux = !ui.groveAux; acted = true; }
    else if (c === "i") { toggleMic(); acted = true; }   // the device: USB sound <-> the built-in microphone (here: MIC START)
  } else if (keysMode) acted = true;                   // on the device these go to the computer
  else switch (c) {
    case "[": ui.volDb = Math.max(VOL_MIN_DB, ui.volDb - 2); ui.muted = false; acted = true; break;
    case "]": ui.volDb = Math.min(0, ui.volDb + 2); ui.muted = false; acted = true; break;
    case "\\": ui.muted = !ui.muted; acted = true; break;
    case " ": case ",": case "/": acted = true; break;   // play/pause, previous, next: media keys to the computer
    case "-": case "=": ui.boostDb = Math.min(BOOST_MAX_DB, Math.max(0, ui.boostDb + (c === "=" ? BOOST_STEP_DB : -BOOST_STEP_DB))); acted = true; break;
    case "b": ui.bassCut = !ui.bassCut; acted = true; break;
    case "r": ui.fillMin = Infinity; ui.fillMax = 0; ui.playMs = 0; acted = true; break;
    case "v": setMode(ui.splashOn || ui.mode === MODE_GAME ? MODE_DATA : MODE_GAME); acted = true; break;
    case "h": ui.helpOn = ui.splashOn || !ui.helpOn; acted = true; break;
    default: noJob = true;                               // letters, Enter, Del, Tab, ...
  }
  if (noJob && !keysMode) ui.helpOn = ui.splashOn || !ui.helpOn;
  if (acted || noJob) ui.splashOn = false;
  ui.lastScreen = 0;
}
const btnsFor = (code, fn) => document.querySelectorAll('button[data-code="' + code + '"]' + (fn ? '[data-fn="1"]' : ":not([data-fn])"));
const lit = (bs, on) => bs.forEach(b => b.classList.toggle("on", on));
const SKIP = /^(Tab|Escape|F\d+|Arrow.*|Home|End|Page.*|Meta.*|Control.*|Alt.*|Shift.*|CapsLock|ContextMenu)$/;
addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || SKIP.test(e.code) || e.repeat) return;
  if (e.code === "Enter" && e.target.tagName === "BUTTON") return;
  lit(btnsFor(e.code, e.shiftKey), true);
  onKey(e.code, e.shiftKey);
  if (e.code in LABEL) e.preventDefault();
});
addEventListener("keyup", e => {
  document.querySelectorAll("button.on[data-code]").forEach(b => { if (b.dataset.code === e.code) b.classList.remove("on"); });
});
for (const box of document.querySelectorAll(".keys, .quick")) box.addEventListener("click", e => {
  const b = e.target.closest("button[data-code]"); if (!b) return;
  onKey(b.dataset.code, !!b.dataset.fn); b.blur();
});
// G0 is a button on the device, not a key: hold it here too.
const g0 = document.querySelector('[data-hold="g0"]');
for (const [ev, v] of [["pointerdown", true], ["pointerup", false], ["pointerleave", false], ["pointercancel", false]])
  g0.addEventListener(ev, () => {
    if (v && ui.mode !== MODE_KEYS) { say("G0(MOUSE画面)はキーボードモードで使います。Fn+M で切り替えてください。", "G0 (the MOUSE screen) is for keyboard mode. Switch with Fn+M."); return; }
    ui.airOn = v; ui.lastScreen = 0;
  });
$("bShare").onclick = toggleShare; $("bMic").onclick = toggleMic; $("bTest").onclick = toggleTest; $("bFull").onclick = toggleFull;
lcd.addEventListener("click", () => { if (ui.splashOn) ui.splashOn = false; });
// Where the PC's sound cannot be captured (phones), START is hidden and MIC START is the main button.
if (!canCapture) { $("bShare").disabled = true; $("bShare").hidden = true; }
if (!canMic) $("bMic").disabled = true;
// A phone may suspend the AudioContext or mute the microphone while the page is hidden or interrupted (lock screen, a call).
// When the page is back, check; if the microphone did not come back by itself, ask for MIC START (see micCheck).
document.addEventListener("visibilitychange", () => { if (!document.hidden) micCheck(); });
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});

if (canCapture) say("START(PCの音)または MIC START(マイク)を押すと、音の取り込みを始めます。", "Press START (the PC's sound) or MIC START (the microphone) to begin.");
else if (canMic) say("MIC START を押すと、マイクで音の取り込みを始めます。", "Press MIC START to listen with the microphone.");
else say("このブラウザでは音を取り込めません。" + (window.isSecureContext === false ? "HTTPS で開いてください。" : ""),
         "This browser cannot capture sound." + (window.isSecureContext === false ? " Open the page over HTTPS." : ""));
document.querySelectorAll("[data-setlang]").forEach(b => b.addEventListener("click", () => setLang(b.dataset.setlang)));
setLang(lang);

/* ================= the loop: about 30 frames a second, like the device ================= */
let rmsAcc = 0, rmsN = 0, last = 0;
FV.init(flight, performance.now() | 0, 48000);
function frame(t) {
  requestAnimationFrame(frame);
  if (t - last < 33) return;
  last = t;
  const now = Math.floor(t);
  if (!ui.since) { ui.since = ui.lastKeyMs = ui.lastSoundMs = now; showSplash(false, now); }

  // Audio side: the level of the last stretch, its peak, and the newest 512 samples for the equalizer.
  let peak = 0;
  if (isSounding()) {
    A.analyser.getFloatTimeDomainData(td);
    let sq = 0; for (let i = 0; i < td.length; i++) { sq += td[i] * td[i]; const a = Math.abs(td[i]); if (a > peak) peak = a; }
    rmsAcc += sq / td.length; rmsN++; ui.playMs += 33;
    for (let i = 0; i < 512; i++) smp[i] = td[td.length - 512 + i] * 32767;
  } else { rmsN++; smp.fill(0); }
  if (peak > 0.003) ui.lastSoundMs = now;
  meter.inPk = Math.max(meter.inPk, peak);
  if (now - (ui.dbgAt || 0) > 250) {                                  // trial: a diagnostics line under the buttons
    ui.dbgAt = now; const tr = A.stream && A.stream.getAudioTracks()[0], el = $("dbg");
    if (el) el.textContent = "src=" + A.src + "  ctx=" + (A.ac ? A.ac.state : "none") + "  track=" + (tr ? tr.readyState + (tr.muted ? "/muted" : "") : "-") + "  level=" + (peak > 0 ? (20 * Math.log10(peak)).toFixed(0) + " dB" : "silent");
  }
  shake.peak = Math.max(shake.peak, peak * 32768);

  if (ui.splashOn && !ui.splashIdle && now - ui.splashStartMs >= SPLASH_MS) ui.splashOn = false;
  if (ui.mode === MODE_KEYS) ui.helpOn = false;
  if (!ui.splashOn && ui.mode === MODE_DATA && now - Math.max(ui.lastKeyMs, ui.lastSoundMs) >= IDLE_MS) { ui.helpOn = false; showSplash(true, now); }

  if (ui.splashOn) {
    if (shakeService()) ui.splashDrawn = false;
    if (!ui.splashDrawn) { drawSplash(); ui.splashDrawn = true; }
  } else if (ui.mode === MODE_KEYS) {
    if (now - ui.lastScreen >= 250) { ui.lastScreen = now; drawKeys(now); }
  } else if (ui.helpOn) {
    if (now - ui.lastScreen >= 250) { ui.lastScreen = now; drawSpeakerHelp(); }
  } else if (ui.mode === MODE_GAME) {
    if (!flight.ready || now - flight.lastColMs > 1000) { FV.init(flight, now, A.sr); rmsAcc = 0; rmsN = 0; }   // back from another screen
    while (now - flight.lastColMs >= FV.COL_MS) {
      flight.lastColMs += FV.COL_MS;
      FV.push(flight, rmsN && rmsAcc > 0 ? Math.sqrt(rmsAcc / rmsN) * 32767 : 0);
      rmsAcc = 0; rmsN = 0;
    }
    if (flight.eq) FV.analyze(flight, smp);
    FV.update(flight, now); FV.render(flight, now);
    // The status line shows only when something is wrong (S5-13).
    if (ui.groveAux) drawString("AUX", 4, 2, COL_DIM);
    else if (A.src === "none") drawString("not connected", 4, 2, COL_BAD);
    if (ui.muted) { const l = "MUTE U0 O0"; drawString(l, 236 - textWidth(l), 2, COL_WARN); }
  } else if (now - ui.lastScreen >= 250) { ui.lastScreen = now; drawMeasure(now); }
  lctx.putImageData(img, 0, 0);
}
requestAnimationFrame(frame);
