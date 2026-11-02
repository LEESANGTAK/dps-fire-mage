/* 배경 소품 확장: 폐광 랜턴·광차, 화산 깃발·용암, 공허 부유물·수정, 초원 반딧불·아치 속 눈.
 *
 * arena-props.js(수정·화로)와 같은 규칙을 따릅니다.
 * - 움직이는 소품은 원화에서 잘라 낸 조각만 씁니다(scripts/build-arena-props.py). 조각이 움직이면 드러나는 자리는
 *   밑판(주변 배경으로 메운 판)이 가립니다. 움직임 폭을 작게 둬 밑판은 가장자리 몇 px만 보입니다.
 * - 새로 그리는 것은 반딧불·눈·불티·빛처럼 작은 반응 효과뿐입니다.
 * - 보상은 연출뿐이고, 큰 반응이 끝나면 확률로 '행운 불씨'(다음 화염구 하나의 색만 바뀜)를 줍니다.
 * 레퍼런스(2026-11-02): 매달린 랜턴은 고리를 축으로 한 진자, 깃발은 장대에서 멀수록 큰 물결,
 * 반딧불은 수풀 근처의 드문드문 깜빡이는 노란 점, 어둠 속 눈은 노란 아몬드 한 쌍이 위아래로 감기며 깜빡임.
 */
const ARENA_EXTRA_RULES = {
  lanternHits: 6,      // 이만큼 연달아 치면 불이 꺼졌다가 다시 붙음
  cartHits: 8,         // 이만큼 치면 광석이 쏟아짐
  bannerHits: 7,       // 이만큼 치면 깃발에 불이 붙음
  bannerBurnSec: 3.2,
  chimeChain: 6,       // 두 수정을 번갈아 이만큼 치면 멜로디 완성
  archHits: 5,         // 이만큼 치면 새끼 슬라임이 튀어나옴
  comboDecaySec: 4,    // 이 시간 동안 안 누르면 누른 횟수가 처음부터
  luckyChance: .5      // 큰 반응 뒤 행운 불씨 확률
};
// 공허 수정 음계(5음계, 음높이 배율). 번갈아 칠수록 한 칸씩 올라갑니다.
const VOID_CHIME_SCALE = [1, 1.122, 1.26, 1.498, 1.682, 2];

function createArenaPropExtras(kit) {
  const { ctx, data, image, ready, rng, onSound, pushParticle, inBox } = kit;
  const R = ARENA_EXTRA_RULES;
  const props = [];
  // 같은 물체를 연달아 누른 횟수: 한동안 안 누르면 처음부터 셉니다.
  function combo() {
    return { n: 0, idle: 0, hit() { this.n += 1; this.idle = 0; return this.n; }, step(dt) { this.idle += dt; if (this.idle > R.comboDecaySec) this.n = 0; }, reset() { this.n = 0; this.idle = 0; } };
  }
  // 조각 하나 그리기: 축(px,py, 원화 좌표) 기준으로 회전·이동합니다.
  function drawPiece(atlas, f, sx, sy, o = {}) {
    const [x, y, w, h] = f.box, [ux, uy, uw, uh] = f.src;
    const px = (o.px != null ? o.px : x + w / 2), py = (o.py != null ? o.py : y + h);
    ctx.save();
    ctx.translate((px + (o.dx || 0)) * sx, (py + (o.dy || 0)) * sy);
    if (o.rot) ctx.rotate(o.rot);
    if (o.sx || o.sy) ctx.scale(o.sx || 1, o.sy || 1);
    if (o.filter) ctx.filter = o.filter;
    ctx.drawImage(atlas, ux, uy, uw, uh, (x - px) * sx, (y - py) * sy, w * sx, h * sy);
    ctx.restore();
  }
  function drawUnder(atlas, f, sx, sy) {
    if (!f.underSrc) return;
    const [x, y, w, h] = f.underBox, [ux, uy, uw, uh] = f.underSrc;
    ctx.drawImage(atlas, ux, uy, uw, uh, x * sx, y * sy, w * sx, h * sy);
  }
  // 원화 조각을 삼각형으로 잘라 파편(광석 등)으로 날립니다.
  function pieceParticle(atlasName, f, cx, cy, r, vx, vy, floor) {
    const tri = [0, 1, 2].map((k) => { const a = k * 2.1 + rng() * .8; return [Math.cos(a) * r, Math.sin(a) * r]; });
    pushParticle({ kind: 'piece', atlas: atlasName, frame: f, ox: cx, oy: cy, x: cx, y: cy, tri, vx, vy, life: 1.3, max: 1.3, size: r, rot: 0, floor });
  }
  // 큰 반응이 끝났을 때: 확률로 행운 불씨.
  function bigReaction(name) {
    if (rng() < R.luckyChance) kit.onLucky(name);
    return name;
  }
  const pendulum = (k, damp) => ({ a: 0, v: 0, step(dt, drive) { const acc = -k * (this.a - drive) - damp * this.v; this.v += acc * dt; this.a += this.v * dt; }, reset() { this.a = 0; this.v = 0; } });

  // ── 폐광 랜턴: 늘 아주 작게 흔들리고, 치면 크게 흔들림. 연달아 치면 불이 꺼졌다가 불씨로 다시 붙음.
  if (data.mine) {
    const f = data.mine.find((x) => x.id === 'lantern');
    const swing = pendulum(9, 1.6), hits = combo();
    let out = 0, relight = 0, phase = rng() * 6;
    props.push({
      theme: 'mine', id: 'lantern',
      box: f.box,
      reset() { swing.reset(); hits.reset(); out = 0; relight = 0; },
      hit(p, reduced) {
        if (out > 0) return null;
        const dir = p.x < f.pivot[0] ? 1 : -1;
        if (!reduced) swing.v += dir * (.5 + rng() * .15);
        onSound('prop_lantern', 1 + rng() * .15);
        if (hits.hit() >= R.lanternHits) {
          hits.reset(); out = 1.3;
          return 'lantern-out';
        }
        return 'lantern-swing';
      },
      step(dt, reduced, time) {
        hits.step(dt);
        swing.step(dt, reduced ? 0 : Math.sin(time * 1.3 + phase) * .035);
        if (reduced) swing.reset();
        if (out > 0) {
          out -= dt;
          if (out <= 0) {
            relight = .5;
            onSound('prop_relight', 1.2);
            const cx = f.box[0] + f.box[2] / 2, cy = f.box[1] + f.box[3] * .6;
            if (!reduced) for (let i = 0; i < 10; i++) pushParticle({ kind: 'ember', x: cx, y: cy, vx: (rng() - .5) * 120, vy: -60 - rng() * 120, life: .8, max: .8, size: 2 + rng() * 2, rot: 0 });
            kit.event(bigReaction('lantern-relight'));
          }
        }
        relight = Math.max(0, relight - dt);
      },
      draw(sx, sy, time, reduced) {
        const atlas = image('mine-extra');
        if (!ready(atlas)) return;
        drawUnder(atlas, f, sx, sy);
        // 꺼진 동안은 원화 픽셀을 어둡게, 다시 붙는 순간은 밝게 번쩍. 평소엔 유리 빛만 아주 약하게 숨 쉼.
        const glow = reduced ? 1 : 1 + Math.sin(time * 5.1 + phase) * .04 + Math.sin(time * 11.3) * .02;
        const filter = out > 0 ? 'brightness(.42) saturate(.55)' : `brightness(${(glow + relight * .9).toFixed(3)})`;
        // 사슬에 매달린 무게감: 최대 약 12도까지만 기울입니다.
        drawPiece(atlas, f, sx, sy, { px: f.pivot[0], py: f.pivot[1], rot: Math.max(-.21, Math.min(.21, swing.a)), filter });
      },
      snap: () => ({ angle: swing.a, out: out > 0, hits: hits.n })
    });
  }

  // ── 폐광 광차: 치면 덜컹(축: 바퀴 아래 레일). 연달아 치면 광석이 쏟아짐.
  if (data.mine) {
    const f = data.mine.find((x) => x.id === 'cart');
    const rock = pendulum(60, 9), hits = combo();
    let hop = 0, cooldown = 0;
    props.push({
      theme: 'mine', id: 'cart', box: f.box,
      reset() { rock.reset(); hits.reset(); hop = 0; cooldown = 0; },
      hit(p, reduced) {
        if (cooldown > 0) return null;
        const dir = p.x < f.pivot[0] ? 1 : -1;
        if (!reduced) { rock.v += dir * 1.3; hop = .18; }
        const oreY = f.box[1] + 14;
        if (!reduced) for (let i = 0; i < 2; i++) pieceParticle('mine-extra', f, f.box[0] + 30 + rng() * (f.box[2] - 60), oreY + rng() * 10, 5 + rng() * 3, (rng() - .5) * 140, -160 - rng() * 120, f.pivot[1]);
        onSound('prop_cart', .9 + rng() * .15);
        if (hits.hit() >= R.cartHits) {
          hits.reset(); cooldown = 2.5;
          if (!reduced) {
            rock.v += dir * 2.4; hop = .3;
            for (let i = 0; i < 12; i++) pieceParticle('mine-extra', f, f.box[0] + 25 + rng() * (f.box[2] - 50), oreY + rng() * 14, 5 + rng() * 5, (rng() - .3) * 260, -220 - rng() * 220, f.pivot[1]);
          }
          onSound('prop_cart_spill', .7);
          return bigReaction('cart-spill');
        }
        return 'cart-jolt';
      },
      step(dt, reduced) {
        hits.step(dt); cooldown = Math.max(0, cooldown - dt);
        rock.step(dt, 0); hop = Math.max(0, hop - dt);
        if (reduced) { rock.reset(); hop = 0; }
      },
      draw(sx, sy) {
        const atlas = image('mine-extra');
        if (!ready(atlas)) return;
        drawUnder(atlas, f, sx, sy);
        const lift = hop > 0 ? -Math.sin((1 - hop / .3) * Math.PI) * 4 : 0;
        drawPiece(atlas, f, sx, sy, { px: f.pivot[0], py: f.pivot[1], rot: Math.max(-.07, Math.min(.07, rock.a * .08)), dy: lift });
      },
      snap: () => ({ hits: hits.n, cooldown })
    });
  }

  // ── 화산 유적 깃발: 장대에서 멀수록 크게 물결. 치면 돌풍, 연달아 치면 불이 붙어 아래부터 그을림.
  if (data.ruins && data.ruins.banner) {
    const f = data.ruins.banner, hits = combo();
    let gust = 0, gustDir = 1, burn = 0, burnt = false, phase = rng() * 6;
    props.push({
      theme: 'ruins', id: 'banner', box: f.box,
      reset() { hits.reset(); gust = 0; burn = 0; burnt = false; },
      hit(p, reduced) {
        if (burn > 0 || burnt) return null;
        gust = reduced ? 0 : 1.5; gustDir = p.x < f.box[0] + f.box[2] / 2 ? 1 : -1;
        onSound('prop_banner', 1 + rng() * .1);
        if (hits.hit() >= R.bannerHits) {
          hits.reset(); burn = R.bannerBurnSec;
          onSound('prop_brazier', .7);
          return 'banner-ignite';
        }
        return 'banner-flap';
      },
      step(dt, reduced) {
        hits.step(dt); gust = Math.max(0, gust - dt);
        if (burn > 0) {
          burn = reduced ? 0 : Math.max(0, burn - dt);
          if (!reduced) {
            const line = burnLine();
            for (let i = 0; i < 2; i++) pushParticle({ kind: 'ember', x: f.box[0] + 20 + rng() * (f.box[2] - 40), y: line, vx: (rng() - .5) * 40, vy: -70 - rng() * 90, life: .9, max: .9, size: 2 + rng() * 2.5, rot: 0 });
          }
          if (burn === 0) { burnt = true; kit.event(bigReaction('banner-burnt')); }
        }
      },
      draw(sx, sy, time, reduced) {
        const atlas = image('ruins');
        if (!ready(atlas)) return;
        drawUnder(atlas, f, sx, sy);
        const [x, y, w, h] = f.box, [ux, uy] = f.src;
        const top = f.pivot[1];
        const amp = reduced ? 0 : 2.6 + gust / 1.5 * 13;
        const line = burnt ? y : burn > 0 ? burnLine() : y + h + 1;
        // 가로 띠로 잘라 띠마다 옆으로 밀어 물결을 만듭니다(장대 쪽은 고정).
        const band = 4;
        const bands = (filter, composite, alpha) => {
          for (let by = 0; by < h; by += band) {
            const ay = y + by, d = Math.max(0, (ay - top) / (y + h - top));
            const off = amp * Math.pow(d, 1.25) * (Math.sin(time * 2.3 - d * 4.2 + phase) + (gust > 0 ? gustDir * .8 : 0));
            const bh = Math.min(band, h - by);
            ctx.save();
            if (filter) ctx.filter = filter;
            if (composite) ctx.globalCompositeOperation = composite;
            if (alpha) ctx.globalAlpha *= alpha;
            ctx.drawImage(atlas, ux, uy + by, w, bh, (x + off) * sx, ay * sy, w * sx, bh * sy + .6);
            ctx.restore();
          }
        };
        bands();
        if (line > y + h) return;
        // 타들어 간 경계는 종이가 타듯 울퉁불퉁합니다(자로 그은 직선은 어색했음).
        const edge = (shift) => {
          ctx.beginPath(); ctx.moveTo((x - 30) * sx, (y + h + 40) * sy);
          for (let ex = x - 30; ex <= x + w + 30; ex += 6) {
            const ey = line + shift + Math.sin(ex * .09 + phase) * 7 + Math.sin(ex * .23 + phase * 2) * 3.5;
            ctx.lineTo(ex * sx, ey * sy);
          }
          ctx.lineTo((x + w + 30) * sx, (y + h + 40) * sy); ctx.closePath();
        };
        // 경계 아래: 그을려 검게.
        ctx.save(); edge(0); ctx.clip(); bands('brightness(.26) saturate(.35)'); ctx.restore();
        // 경계 띠: 원화 조각을 주황빛으로 한 번 더 겹쳐 불붙은 가장자리를 만듭니다.
        if (burn > 0) {
          ctx.save(); edge(-5); ctx.clip();
          bands('sepia(1) saturate(6) hue-rotate(-15deg) brightness(1.5)', 'lighter', .75);
          ctx.restore();
          // 경계 바로 아래(이미 탄 쪽)는 다시 어둡게 덮어 띠가 얇게 남게 합니다.
          ctx.save(); edge(2); ctx.clip(); bands('brightness(.26) saturate(.35)'); ctx.restore();
        }
      },
      snap: () => ({ hits: hits.n, burning: burn > 0, burnt })
    });
    function burnLine() { const [, y, , h] = f.box; return y + h - (1 - burn / R.bannerBurnSec) * h; }
  }

  // ── 화산 유적 용암: 원화 용암 줄기 위로 밝은 띠가 아래로 흐르고, 줄기 아래 끝에서 가끔 불똥이 튐.
  if (data.ruins && data.ruins.lava) {
    const L = data.ruins.lava;
    let layer = null, stripes = null, sparkIn = .5;
    props.push({
      theme: 'ruins', id: 'lava', box: null,
      reset() {},
      step(dt, reduced) {
        if (reduced) return;
        sparkIn -= dt;
        if (sparkIn <= 0 && L.vents.length) {
          const [vx, vy] = L.vents[Math.floor(rng() * L.vents.length)];
          pushParticle({ kind: 'ember', x: vx + (rng() - .5) * 10, y: vy - 4, vx: (rng() - .5) * 50, vy: -90 - rng() * 80, life: .9, max: .9, size: 1.6 + rng() * 1.6, rot: 0 });
          sparkIn = .35 + rng() * .6;
        }
      },
      draw(sx, sy, time, reduced) {
        const mask = image('ruins-lava-mask');
        if (reduced || !ready(mask) || typeof document === 'undefined') return;
        const [x, y, w, h] = L.box;
        if (!layer) {
          layer = document.createElement('canvas'); layer.width = Math.ceil(w / 2); layer.height = Math.ceil(h / 2);
          stripes = document.createElement('canvas'); stripes.width = 4; stripes.height = 48;
          const s = stripes.getContext('2d'), g = s.createLinearGradient(0, 0, 0, 48);
          g.addColorStop(0, 'rgba(255,220,130,0)'); g.addColorStop(.5, 'rgba(255,224,140,1)'); g.addColorStop(1, 'rgba(255,220,130,0)');
          s.fillStyle = g; s.fillRect(0, 0, 4, 48);
        }
        // 절반 해상도로 합성해 프레임 비용을 줄입니다.
        const c = layer.getContext('2d');
        c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, layer.width, layer.height);
        c.save(); c.translate(0, (time * 26) % 48); c.fillStyle = c.createPattern(stripes, 'repeat'); c.fillRect(0, -48, layer.width, layer.height + 96); c.restore();
        c.globalCompositeOperation = 'destination-in'; c.drawImage(mask, 0, 0, layer.width, layer.height);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .38;
        ctx.drawImage(layer, x * sx, y * sy, w * sx, h * sy);
        ctx.restore();
      }
    });
  }

  // ── 공허 부유물: 섬과 파편이 저마다 다른 박자로 위아래로 떠다님(클릭 없음).
  if (data.void && data.void.floating) {
    const pieces = data.void.floating.map((f) => ({ f, phase: rng() * 6.28, speed: .45 + rng() * .35, amp: f.id.startsWith('island') ? 2.6 : 2.2 + rng() * 1.2, tilt: f.id.startsWith('island') ? .004 : .012 }));
    // 움직임 폭이 크면 밑판(메운 자리)이 드러나 하늘 띠 경계에서 연한 테두리로 보였습니다. 2~3px로 둡니다.
    props.push({
      theme: 'void', id: 'floating', box: null,
      reset() {},
      draw(sx, sy, time, reduced) {
        const atlas = image('void');
        if (!ready(atlas)) return;
        for (const p of pieces) drawUnder(atlas, p.f, sx, sy);
        for (const p of pieces) {
          const t = reduced ? 0 : time * p.speed + p.phase;
          const [x, y, w, h] = p.f.box;
          drawPiece(atlas, p.f, sx, sy, { px: x + w / 2, py: y + h / 2, dy: Math.sin(t) * p.amp, rot: Math.sin(t * .7) * p.tilt });
        }
      }
    });
  }

  // ── 공허 수정 두 개: 치면 빛나며 음이 남. 번갈아 칠수록 음이 올라가고, 끝까지 가면 함께 빛남.
  if (data.void && data.void.crystals) {
    const cs = data.void.crystals.map((f) => ({ f, glow: 0 }));
    let last = null, chain = 0, finale = 0;
    props.push({
      theme: 'void', id: 'chime', boxes: cs.map((c) => c.f.box),
      reset() { last = null; chain = 0; finale = 0; cs.forEach((c) => { c.glow = 0; }); },
      hit(p, reduced) {
        const c = cs.find((x) => inBox(p, x.f.box));
        if (!c || finale > 0) return null;
        chain = last && last !== c ? chain + 1 : 1;
        last = c; c.glow = .7;
        const note = VOID_CHIME_SCALE[Math.min(VOID_CHIME_SCALE.length - 1, chain - 1)] * (c.f.id === 'crystal-violet' ? .84 : 1);
        onSound('prop_chime', note);
        const [x, y, w, h] = c.f.box;
        if (!reduced) for (let i = 0; i < 4; i++) pushParticle({ kind: 'glint', x: x + w * (.2 + rng() * .6), y: y + h * (.1 + rng() * .5), vx: (rng() - .5) * 60, vy: -30 - rng() * 60, life: .6, max: .6, size: 2 + rng() * 2, rot: 0, grav: 40 });
        if (chain >= R.chimeChain) {
          chain = 0; last = null; finale = 1.4; cs.forEach((x) => { x.glow = 1.4; });
          onSound('prop_sigil', 1.25);
          return bigReaction('void-melody');
        }
        return 'void-chime';
      },
      step(dt) { cs.forEach((c) => { c.glow = Math.max(0, c.glow - dt); }); finale = Math.max(0, finale - dt); },
      draw(sx, sy) {
        const atlas = image('void-crystals');
        if (!ready(atlas)) return;
        for (const c of cs) {
          if (c.glow <= 0) continue;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, c.glow) * .75;
          drawPiece(atlas, c.f, sx, sy, {});
          ctx.restore();
        }
      },
      snap: () => ({ chain, finale: finale > 0 })
    });
  }

  // ── 초원: 반딧불(수풀 근처), 아치 속 어둠의 눈 → 새끼 슬라임.
  if (data.meadow) {
    const M = data.meadow;
    const flies = [];
    for (let i = 0; i < 11; i++) {
      const z = M.fireflyZones[i % M.fireflyZones.length];
      flies.push({ z, x: z[0] + rng() * z[2], y: z[1] + rng() * z[3], a: rng() * 6.28, phase: rng() * 6.28, speed: .7 + rng() * .8 });
    }
    props.push({
      theme: 'meadow', id: 'fireflies', box: null,
      reset() {},
      step(dt, reduced) {
        if (reduced) return;
        for (const f of flies) {
          f.a += (rng() - .5) * 2.4 * dt;
          f.x += Math.cos(f.a) * 14 * dt; f.y += Math.sin(f.a) * 9 * dt;
          const [zx, zy, zw, zh] = f.z;
          if (f.x < zx || f.x > zx + zw) f.a = Math.PI - f.a;
          if (f.y < zy || f.y > zy + zh) f.a = -f.a;
          f.x = Math.max(zx, Math.min(zx + zw, f.x)); f.y = Math.max(zy, Math.min(zy + zh, f.y));
        }
      },
      draw(sx, sy, time, reduced) {
        if (reduced) return;
        const s = Math.min(sx, sy);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const f of flies) {
          const on = Math.pow(Math.max(0, Math.sin(time * f.speed + f.phase)), 3);
          if (on < .02) continue;
          const x = f.x * sx, y = f.y * sy, r = 9 * s * 1.4;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(255,246,160,${.9 * on})`); g.addColorStop(.25, `rgba(230,240,110,${.4 * on})`); g.addColorStop(1, 'rgba(200,230,90,0)');
          ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        ctx.restore();
      }
    });

    const hits = combo();
    let eyes = 0, blink = 0, startle = 0, eyeAt = null, slime = 0, cooldown = 0;
    const SLIME_SEC = 1.9;
    props.push({
      theme: 'meadow', id: 'arch', box: M.archDark,
      reset() { hits.reset(); eyes = 0; blink = 0; startle = 0; slime = 0; cooldown = 0; },
      hit(p, reduced) {
        if (slime > 0 || cooldown > 0) return null;
        const [x, y, w, h] = M.archDark;
        if (eyes <= 0) eyeAt = [x + w * (.3 + rng() * .4), y + h * (.3 + rng() * .35)];
        eyes = 2.4; blink = .16; startle = .3;
        onSound('prop_peek', .85 + hits.n * .06);
        if (hits.hit() >= R.archHits) {
          hits.reset(); slime = reduced ? .01 : SLIME_SEC; cooldown = SLIME_SEC + 3;
          onSound('prop_slime', 1.2);
          return bigReaction('slime-pop');
        }
        return 'arch-peek';
      },
      step(dt) {
        hits.step(dt); cooldown = Math.max(0, cooldown - dt);
        eyes = Math.max(0, eyes - dt); blink = Math.max(0, blink - dt); startle = Math.max(0, startle - dt);
        // 눈이 떠 있는 동안 가끔 저절로 깜빡입니다.
        if (eyes > .3 && blink === 0 && rng() < dt * .6) blink = .16;
        if (slime > 0) { slime = Math.max(0, slime - dt); if (slime === 0) eyes = 0; }
      },
      draw(sx, sy) {
        if (eyes > 0 && eyeAt && slime === 0) {
          const open = Math.min(1, eyes / .25) * (blink > 0 ? Math.abs(blink - .08) / .08 : 1);
          const big = 1 + startle * 1.2;
          for (const dx of [-11, 11]) {
            const cx = (eyeAt[0] + dx) * sx, cy = eyeAt[1] * sy, w = 7 * sx * big, h = Math.max(.6, 4.2 * open * big) * sy;
            ctx.save(); ctx.translate(cx, cy);
            ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#2b2138'; ctx.lineWidth = Math.max(1, 1.4 * sx);
            ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#2b2138'; ctx.beginPath(); ctx.ellipse(dx > 0 ? -1 * sx : 1 * sx, 0, 1.6 * sx, h * .9, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
        }
        if (slime > 0) drawSlime(sx, sy, 1 - slime / SLIME_SEC);
      },
      snap: () => ({ hits: hits.n, eyes: eyes > 0, slime: slime > 0 })
    });
    // 새끼 슬라임: 기존 슬라임 원화(paper-slime-poses)를 작게. 아치에서 튀어나와 세 번 통통 튀며 오른쪽 밖으로.
    function drawSlime(sx, sy, t) {
      const sheet = image('assets/art/paper-slime-poses.png');
      const frames = typeof PAPER_ART_FRAMES !== 'undefined' ? PAPER_ART_FRAMES.slime : null;
      if (!ready(sheet) || !frames) return;
      const hop = (t * 3) % 1, n = Math.floor(t * 3);
      const x0 = M.archFloor[0], x = x0 + t * 260, ground = M.archFloor[1];
      const air = Math.sin(hop * Math.PI);
      const y = ground - air * (46 - n * 8);
      // 착지 때 납작, 떠오를 때 길쭉(스쿼시·스트레치).
      const land = hop < .15 ? 1 - hop / .15 : 0;
      const scX = 1 + land * .25 - air * .08, scY = 1 - land * .2 + air * .1;
      const pose = air > .2 ? frames.idle : frames.rest, [bx, by, bw, bh] = pose.box;
      const size = 62;
      ctx.save(); ctx.translate(x * sx, y * sy); ctx.scale(scX, scY);
      ctx.drawImage(sheet, bx, by, bw, bh, -size / 2 * sx, -size * (bh / bw) * sy, size * sx, size * (bh / bw) * sy);
      ctx.restore();
    }
  }

  return props;
}
if (typeof module !== 'undefined') module.exports = { ARENA_EXTRA_RULES, VOID_CHIME_SCALE, createArenaPropExtras };
