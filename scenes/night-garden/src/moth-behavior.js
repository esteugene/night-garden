// Moths: two or three small cream moths that mostly sit on the branch and now and then
// fly a short erratic loop before settling on a free perch again.
//
// Behaviour only, in source-image pixels, so it runs headless in the tests. The view in
// main.js turns each moth's heading, tilt, bank and wing lift into the rotations of a
// body plane and two hinged wing planes.
//
// States: rest (wings held together above the back, an occasional slow fan), takeoff
// (half a second of lifting off), fly (a wandering course with sudden flicks, the way a
// moth flies), approach (a curve toward a staging point above the perch, then a slow
// descent onto it), land (the last few pixels, the wings folding up). Never more than two
// in the air, and usually none.
import { randomGenerator } from "./random.js";

export const MOTH = Object.freeze({
  flapHz: 8,
  cruise: [36, 78], // px/s
  rest: [50, 180], // s on the branch between flights
  firstRest: [8, 22], // s before the first flight, so a viewer sees one soon
  flight: [6, 16], // s in the air before looking for a perch
  approachLimit: 30, // s: an approach that has not landed by then is given up
  fanEvery: [14, 45], // s between slow wing fans while resting
  fanTime: 3.4,
  restWing: 0.72, // rad: wings raised in an open V above the back, as in the concept
  fanWing: 0.72,
  flyWing: [-0.28, 1.0], // rad: downstroke to upstroke
  takeoff: 0.55,
  landing: 0.9,
  airborneLimit: 2,
  turn: 1.7,
  flickRate: 0.45, // sudden heading changes per second in free flight
  edge: 70, // px inside the airspace where steering back begins
});

const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
const lerpAngle = (a, b, k) => a + wrap(b - a) * k;

export function createMothFlock({
  perches, airspace, haunt = null, sizes = [52, 44, 38], seed = 5117, config = {},
} = {}) {
  const cfg = { ...MOTH, ...config };
  const random = randomGenerator(seed);
  const range = ([a, b]) => a + (b - a) * random();
  const exponential = (mean) => -mean * Math.log(1 - random());
  const taken = perches.map(() => -1);
  const events = { takeoffs: 0, landings: 0, abandoned: 0 };
  let time = 0;

  const moths = sizes.map((size, id) => {
    const perch = id < perches.length ? id : -1;
    const m = {
      id, size, perch, state: perch >= 0 ? "rest" : "fly",
      x: 0, y: 0, heading: 0, speed: 0,
      cruise: range(cfg.cruise) * (0.85 + 0.3 * (size / 44)),
      timer: 0, flap: random() * TAU, wing: cfg.restWing, roll: 0, air: 0, bob: 0,
      bank: 0, tilt: 0, phase: 0, transition: null,
      fan: 0, fanTimer: range(cfg.fanEvery), goal: null, goalTimer: 0,
      flickTimer: exponential(1 / cfg.flickRate),
      s1: 1.1 + random() * 1.2, s2: 0.5 + random() * 0.9, s3: 0.4 + random() * 0.5,
      p1: random() * TAU, p2: random() * TAU, p3: random() * TAU,
      // The thorax sits this far above the feet.
      lift: size * 0.1,
    };
    if (perch >= 0) {
      taken[perch] = id;
      m.x = perches[perch].x;
      m.y = perches[perch].y - m.lift;
      m.heading = perches[perch].facing;
      m.timer = range(id === 0 ? cfg.firstRest : cfg.rest);
    } else {
      m.x = (airspace.x0 + airspace.x1) / 2;
      m.y = (airspace.y0 + airspace.y1) / 2;
      m.heading = -Math.PI / 2;
      m.timer = range(cfg.flight);
      m.air = 1;
      m.speed = m.cruise;
    }
    return m;
  });

  const airborne = () => moths.filter((m) => m.state !== "rest").length;

  function sampleGoal() {
    const pad = cfg.edge + 10;
    const box = haunt && random() < 0.6 ? haunt : airspace;
    return {
      x: box.x0 + pad + random() * (box.x1 - box.x0 - 2 * pad),
      y: box.y0 + pad + random() * (box.y1 - box.y0 - 2 * pad),
    };
  }

  function edgeSteer(m) {
    const e = cfg.edge;
    let ex = 0, ey = 0;
    if (m.x < airspace.x0 + e) ex += (airspace.x0 + e - m.x) / e;
    if (m.x > airspace.x1 - e) ex -= (m.x - (airspace.x1 - e)) / e;
    if (m.y < airspace.y0 + e) ey += (airspace.y0 + e - m.y) / e;
    if (m.y > airspace.y1 - e) ey -= (m.y - (airspace.y1 - e)) / e;
    if (!ex && !ey) return 0;
    return wrap(Math.atan2(ey, ex) - m.heading) * 3 * Math.min(1, Math.hypot(ex, ey));
  }

  function steer(m, dt, target, gain, noise, edges) {
    const desired = Math.atan2(target.y - m.y, target.x - m.x);
    let rate = wrap(desired - m.heading) * gain + edges * edgeSteer(m);
    rate += noise * 2.2 * Math.sin(time * m.s1 + m.p1) * Math.sin(time * m.s2 + m.p2);
    m.flickTimer -= dt;
    if (m.flickTimer <= 0) {
      m.heading += (random() - 0.5) * 2.2 * noise;
      m.flickTimer = exponential(1 / cfg.flickRate);
    }
    rate = clamp(rate, -3.4, 3.4);
    m.heading = wrap(m.heading + rate * dt);
    m.roll += (clamp(-rate * 0.16, -0.5, 0.5) - m.roll) * Math.min(1, dt * 5);
  }

  function move(m, dt) {
    m.x = clamp(m.x + Math.cos(m.heading) * m.speed * dt, airspace.x0, airspace.x1);
    m.y = clamp(m.y + Math.sin(m.heading) * m.speed * dt, airspace.y0, airspace.y1);
  }

  function flapStep(m, dt, slow = 1) {
    m.flap += TAU * cfg.flapHz * slow * dt;
    return lerp(cfg.flyWing[0], cfg.flyWing[1], 0.5 + 0.5 * Math.sin(m.flap));
  }

  function rest(m, dt) {
    m.fanTimer -= dt;
    if (m.fan > 0) {
      m.fan += dt / cfg.fanTime;
      if (m.fan >= 1) { m.fan = 0; m.fanTimer = range(cfg.fanEvery); }
    } else if (m.fanTimer <= 0) m.fan = 1e-6;
    const fan = m.fan > 0 ? Math.sin(Math.PI * m.fan) ** 1.5 : 0;
    m.wing = cfg.restWing - (cfg.restWing - cfg.fanWing) * fan;
    m.air = 0; m.bob = 0; m.roll = 0; m.speed = 0;
    m.timer -= dt;
    if (m.timer > 0) return;
    if (airborne() >= cfg.airborneLimit) { m.timer = 4 + random() * 6; return; }
    taken[m.perch] = -1;
    m.perch = -1;
    m.state = "takeoff";
    m.transition = {
      t: 0, x0: m.x, y0: m.y, h0: m.heading, h1: -Math.PI / 2 + (random() - 0.5) * 1.6,
    };
    events.takeoffs++;
  }

  function takeoff(m, dt) {
    const tr = m.transition;
    tr.t += dt;
    const k = smooth(Math.min(1, tr.t / cfg.takeoff));
    m.air = k;
    m.wing = flapStep(m, dt, 0.6 + 0.4 * k);
    m.heading = lerpAngle(tr.h0, tr.h1, k);
    m.x = tr.x0 + Math.cos(tr.h1) * 10 * k;
    m.y = tr.y0 - 24 * k;
    m.speed = m.cruise * 0.55 * k;
    m.bob = Math.sin(m.flap) * m.size * 0.009 * k;
    if (tr.t < cfg.takeoff) return;
    m.state = "fly";
    m.timer = range(cfg.flight);
    m.goal = sampleGoal();
    m.goalTimer = 2.5 + random() * 3.5;
    m.transition = null;
  }

  function fly(m, dt) {
    m.goalTimer -= dt;
    if (!m.goal || m.goalTimer <= 0 || Math.hypot(m.goal.x - m.x, m.goal.y - m.y) < 45) {
      m.goal = sampleGoal();
      m.goalTimer = 2.5 + random() * 3.5;
    }
    steer(m, dt, m.goal, cfg.turn, .18, 1);
    const want = m.cruise * (0.82 + 0.22 * Math.sin(time * m.s3 + m.p3));
    m.speed += (want - m.speed) * Math.min(1, dt * 2);
    move(m, dt);
    m.wing = flapStep(m, dt);
    m.bob = Math.sin(m.flap) * m.size * 0.009;
    m.air = 1;
    m.timer -= dt;
    if (m.timer > 0) return;
    const free = perches.map((_, i) => i).filter((i) => taken[i] < 0);
    if (free.length === 0) { m.timer = 5; return; }
    const perch = free[Math.floor(random() * free.length)];
    taken[perch] = m.id;
    m.perch = perch;
    m.state = "approach";
    m.phase = 0;
    m.timer = cfg.approachLimit;
  }

  function approach(m, dt) {
    const p = perches[m.perch];
    const target = m.phase === 0
      ? { x: p.x - Math.cos(p.facing) * 10, y: p.y - 60 }
      : { x: p.x, y: p.y - m.lift };
    let d = Math.hypot(target.x - m.x, target.y - m.y);
    if (m.phase === 0 && d < 26) { m.phase = 1; d = Math.hypot(p.x - m.x, p.y - m.lift - m.y); }
    if (m.phase === 0) steer(m, dt, target, 2.6, 0.5, 1);
    else steer(m, dt, target, 3.4, 0.15, 0);
    const want = m.phase === 0 ? m.cruise * 0.75 : clamp(d * 1.5, 12, m.cruise * 0.55);
    m.speed += (want - m.speed) * Math.min(1, dt * 3);
    move(m, dt);
    m.wing = flapStep(m, dt);
    m.bob = Math.sin(m.flap) * m.size * 0.009;
    m.air = 1;
    if (m.phase === 1 && d < 6) {
      m.state = "land";
      m.transition = { t: 0, x0: m.x, y0: m.y, h0: m.heading };
      return;
    }
    m.timer -= dt;
    if (m.timer > 0) return;
    taken[m.perch] = -1;
    m.perch = -1;
    m.state = "fly";
    m.timer = 6;
    events.abandoned++;
  }

  function land(m, dt) {
    const p = perches[m.perch];
    const tr = m.transition;
    tr.t += dt;
    const k = smooth(Math.min(1, tr.t / cfg.landing));
    m.x = lerp(tr.x0, p.x, k);
    m.y = lerp(tr.y0, p.y - m.lift, k);
    m.heading = lerpAngle(tr.h0, p.facing, k);
    m.wing = lerp(flapStep(m, dt, 1 - 0.75 * k), cfg.restWing, k);
    m.air = 1 - k;
    m.bob = Math.sin(m.flap) * m.size * 0.009 * (1 - k);
    m.roll *= 1 - k;
    m.speed *= 1 - k;
    if (tr.t < cfg.landing) return;
    m.state = "rest";
    m.timer = range(cfg.rest);
    m.fanTimer = range(cfg.fanEvery);
    m.fan = 0;
    m.transition = null;
    m.wing = cfg.restWing;
    m.x = p.x;
    m.y = p.y - m.lift;
    m.heading = p.facing;
    events.landings++;
  }

  const behave = { rest, takeoff, fly, approach, land };

  function step(dt) {
    if (!(dt > 0)) return;
    time += dt;
    for (const m of moths) {
      behave[m.state](m, dt);
      // Seen from a little above: at rest a side view with the wings up; in flight the
      // back tilts toward the viewer according to the heading, plus the roll of a turn.
      const c = Math.cos(m.heading), s = Math.sin(m.heading);
      const restBank = c >= 0 ? -0.55 : 0.55;
      m.bank = lerp(restBank, -c + m.roll, m.air);
      m.tilt = lerp(-0.12, -0.45 * s, m.air);
    }
  }

  return {
    moths, perches, step, events,
    get airborne() { return airborne(); },
    get time() { return time; },
    config: cfg,
  };
}
