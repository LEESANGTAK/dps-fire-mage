/* 실제 게임과 시범 화면이 함께 사용하는 종이 원화 좌표. 파일 직접 실행에서도 별도 요청이 필요 없습니다. */
const PAPER_ART_FRAMES = {
  "mage": {
    "cell": 627,
    "idle": { "box": [140, 118, 447, 452], "foot": [333, 565], "tip": [538, 250] },
    "anticipation": { "box": [780, 132, 346, 438], "foot": [972, 565], "tip": [835, 283] },
    "release": { "box": [132, 715, 493, 414], "foot": [320, 1121], "tip": [576, 892] },
    "recoil": { "box": [779, 721, 372, 408], "foot": [989, 1121], "tip": [1108, 884] }
  },
  "slime": {
    "cell": 627,
    "idle": { "box": [18, 50, 590, 587], "foot": [320, 626] },
    "rest": { "box": [637, 164, 599, 473], "foot": [955, 631] },
    "hit": { "box": [25, 785, 609, 425], "foot": [343, 1203] },
    "recover": { "box": [666, 638, 573, 572], "foot": [968, 1203] }
  }
};
if (typeof module !== 'undefined') module.exports = PAPER_ART_FRAMES;


// 초반 슬라임의 원화 포즈를 기존 게임 루프에서 진행합니다.
const paperSlimeMotion = { time: 0, hit: 0, heavy: false, direction: 1, stage: 0 };
const paperSlimeSheet = typeof Image !== 'undefined' ? new Image() : null;
if (paperSlimeSheet) paperSlimeSheet.src = 'assets/art/paper-slime-poses.png';
function getPaperSlimePose(motion, reduced = false) {
  if (motion.hit > .13) return 'hit';
  if (motion.hit > 0) return 'recover';
  if (reduced) return 'idle';
  const period = motion.stage === 2 ? 5.1 : 4.3;
  const heldTime = Math.floor(motion.time * 12) / 12;
  const phase = (heldTime + (motion.stage === 2 ? 1.4 : 0)) % period / period;
  return phase >= .7 && phase < .85 ? 'rest' : 'idle';
}
function configurePaperSlime(el, size, stage) {
  let surface = el.querySelector('canvas');
  if (!surface) {
    surface = document.createElement('canvas');
    surface.width = surface.height = 640;
    surface.setAttribute('aria-hidden', 'true');
    surface.className = 'paper-slime-canvas';
    el.replaceChildren(surface);
  }
  el.dataset.paper = 'true';
  Object.assign(el.style, { width: `${size}px`, height: `${size}px`, bottom: '0px' });
  const actor = document.getElementById('dummy-avatar');
  if (actor) actor.dataset.paper = 'true';
  if (paperSlimeMotion.stage !== stage) Object.assign(paperSlimeMotion, { time: 0, hit: 0, stage });
  updatePaperSlime(0, false);
}
function beginPaperSlimeHit(heavy, direction, dot) {
  if (!paperSlimeMotion.stage || dot) return;
  paperSlimeMotion.hit = .25; paperSlimeMotion.heavy = heavy;
  paperSlimeMotion.direction = direction ? -1 : 1;
  updatePaperSlime(0, false);
}
function updatePaperSlime(dt, paused) {
  if (paused) return;
  const el = document.getElementById('dummy-emoji');
  if (!el || el.dataset.paper !== 'true') return;
  const surface = el.querySelector('canvas');
  if (!surface || !paperSlimeSheet || !paperSlimeSheet.complete || !paperSlimeSheet.naturalWidth) return;
  paperSlimeMotion.time += dt; paperSlimeMotion.hit = Math.max(0, paperSlimeMotion.hit - dt);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pose = getPaperSlimePose(paperSlimeMotion, reduced), f = PAPER_ART_FRAMES.slime[pose];
  el.dataset.pose = pose;
  const [x, y, width, height] = f.box, scale = .95;
  const angle = reduced || paperSlimeMotion.hit <= .22 ? 0 : paperSlimeMotion.direction * (paperSlimeMotion.heavy ? .045 : .02);
  const ctx = surface.getContext('2d');
  ctx.clearRect(0, 0, 640, 640); ctx.save(); ctx.translate(320, 638); ctx.rotate(angle);
  ctx.drawImage(paperSlimeSheet, x, y, width, height, (x - f.foot[0]) * scale, (y - f.foot[1]) * scale, width * scale, height * scale);
  ctx.restore();
}
if (typeof module !== 'undefined') module.exports.getPaperSlimePose = getPaperSlimePose;
