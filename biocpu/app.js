/* Photonic Wetware Core - panel, timeline and wiring between the data and the 3D scene. */
(function () {
  'use strict';
  var D = window.PWC;

  function $(s, r) {
    return (r || document).querySelector(s);
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function remember(k, v) {
    try {
      if (v === undefined) return window.localStorage.getItem('pwc:' + k);
      window.localStorage.setItem('pwc:' + k, v);
    } catch (e) {
      /* storage is optional */
    }
    return null;
  }
  function ss(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function env(t, a, b, f) {
    f = f || 0.25;
    return ss(a, a + f, t) * (1 - ss(b - f, b, t));
  }
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function fmtW(v) {
    if (v >= 1) return (v >= 10 ? v.toFixed(0) : v.toFixed(1)) + ' W';
    if (v >= 1e-3) return (v * 1e3 >= 10 ? (v * 1e3).toFixed(0) : (v * 1e3).toFixed(1)) + ' mW';
    if (v >= 1e-6) return (v * 1e6 >= 10 ? (v * 1e6).toFixed(0) : (v * 1e6).toFixed(1)) + ' µW';
    return (v * 1e9).toFixed(0) + ' nW';
  }
  function statusChip(status) {
    var s = el('span', 'st st-' + status);
    s.appendChild(el('i'));
    s.appendChild(document.createTextNode(D.STATUS[status].label));
    return s;
  }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var partsById = {};
  D.PARTS.forEach(function (p) {
    partsById[p.id] = p;
  });
  var RUN = D.RUN;
  var T = {};
  RUN.steps.forEach(function (s) {
    T[s.id] = [s.t0, s.t1];
  });
  var IMP = D.IMPRINT;

  var stageEl = $('#stage');
  var state = {
    tab: 'parts',
    selected: null,
    mode: 'run',
    playing: !reduced,
    t: reduced ? (T.write[0] + T.write[1]) / 2 : 0,
    cycle: 0,
    runStep: -1,
    imprintStep: 0,
    imprintT: 0,
    imprintAll: false,
    // true freezes the imprint animation on its current frame: the reduced-motion default, and after Stop
    imprintHold: reduced,
    labels: stageEl.clientWidth >= 620,
    spin: false,
    tokensShown: -1,
  };
  var savedLabels = remember('labels');
  if (savedLabels === '1' || savedLabels === '0') state.labels = savedLabels === '1';

  // ---------------------------------------------------------------- scene
  var api = D.createScene
    ? D.createScene(stageEl, {
        reducedMotion: reduced,
        onPick: function (id) {
          select(id, true);
        },
        onHover: onHover,
        onFrame: onFrame,
        afterFrame: placeLabels,
        onAutoRotate: function (on) {
          state.spin = on;
          $('#btn-spin').setAttribute('aria-pressed', String(on));
        },
      })
    : null;
  var hasScene = !!api;
  if (!api) {
    $('#fallback').hidden = false;
    $('.controls').hidden = true;
    $('.app').classList.add('nogl');
    api = stubScene();
  }

  function stubScene() {
    var noop = function () {};
    var page = 0;
    return {
      signals: {},
      pageCount: D.PAGE_COUNT || 9,
      activityGrid: new Float32Array(24 * 24),
      hudSize: 24,
      getActivity: function () {
        return 0;
      },
      getPage: function () {
        return page;
      },
      pagePatternOf: function (k) {
        return D.pagePattern ? D.pagePattern(((k % 9) + 9) % 9) : new Uint8Array(100);
      },
      setPage: function (k) {
        page = ((k % 9) + 9) % 9;
      },
      stimulate: noop, prime: noop, stepSim: noop, orbit: noop, setSim: noop, quiet: noop, setExplode: noop, setSelected: noop, focus: noop,
      resetView: noop, setAutoRotate: noop, setToday: noop, getExplode: function () { return 0; }, projectAnchors: function () { return []; }, refreshTheme: noop,
      start: function () {
        var last = performance.now();
        (function loop(now) {
          requestAnimationFrame(loop);
          onFrame(Math.max(0, Math.min(0.05, (now - last) / 1000)), api);
          last = now;
        })(last);
      },
      stop: noop,
    };
  }

  // ------------------------------------------------------------- timeline
  function clearLight(s) {
    s.ref = s.page = s.pageQ = s.pageT = s.land = s.excite = s.fluor = s.sensor = s.bus = s.asic = s.rec = s.slm = s.teacher = 0;
  }
  function runSignals(t, dt, live) {
    var s = api.signals;
    clearLight(s);
    s.grow = 1; s.tint = 1; s.gain = 1; s.pagesFilled = api.pageCount; s.spont = 1;
    var A = T.address, R = T.read, W = T.write, C = T.compute, O = T.readout, Dc = T.decode;
    s.asic = Math.max(env(t, A[0], A[1], 0.2), env(t, Dc[0], Dc[1], 0.2));
    s.bus = Math.max(env(t, A[0] + 0.1, A[1], 0.2), env(t, Dc[0] + 0.1, Dc[1], 0.2)) * (0.6 + 0.4 * Math.sin(t * 26));
    s.ref = env(t, R[0], W[1], 0.2);
    s.page = env(t, R[0] + 0.4, W[1], 0.3);
    s.pageT = ss(R[0] + 0.4, R[1], t);
    s.pageQ = env(t, R[0] + 0.4, R[1] + 0.15, 0.15);
    s.land = env(t, W[0] - 0.05, W[1] + 0.1, 0.2);
    s.excite = env(t, O[0], O[1] + 0.2, 0.3);
    s.fluor = env(t, O[0] + 0.1, O[1] + 0.2, 0.3);
    s.sensor = env(t, O[0] + 0.2, Dc[0] + 0.4, 0.3);
    if (live) {
      if (t > W[0] && t < W[1]) api.stimulate(dt * 2.2);
      else if (t >= C[0] && t < O[1]) api.stimulate(dt * 0.4 * (1 - ss(O[0], O[1], t)));
    }
  }
  // The network runs whenever motion is allowed. Under reduced motion it runs only while the
  // timeline on show is playing, so a paused frame is a true still.
  function syncSim() {
    // a held imprint frame (Stop, or reduced motion) is a still, so the network holds with it
    api.setSim(state.mode === 'imprint' ? !state.imprintHold : !reduced || state.playing);
  }
  // Reduced motion, paused: the network is off, so pose the tissue by hand for the frame on show.
  function poseTissue() {
    if (!reduced || state.playing) return;
    api.quiet();
    runSignals(state.t, 0, false);
    if (state.t > T.write[0] && state.t < T.readout[1]) api.prime(state.t < T.compute[0] ? 1 : 0.4);
  }
  var trainClock = 0;
  var trainPage = 0;
  function imprintSignals(step, u, dt) {
    var s = api.signals;
    clearLight(s);
    s.grow = 1; s.tint = 1; s.gain = 1; s.pagesFilled = api.pageCount; s.spont = 1;
    var pulse = 0.6 + 0.4 * Math.sin(state.imprintT * 9);
    switch (step.fx) {
      case 'distill':
        s.grow = 0; s.tint = 0; s.gain = 0.2; s.pagesFilled = 0;
        s.teacher = 0.55 + 0.45 * Math.sin(state.imprintT * 2.4);
        s.asic = 1; s.bus = pulse;
        break;
      case 'record': {
        s.grow = 0; s.tint = 0; s.gain = 0.2;
        s.teacher = 0.8;
        var x = Math.min(0.9999, u) * api.pageCount;
        var k = Math.floor(x);
        var f = x - k;
        if (k !== api.getPage()) api.setPage(k);
        s.slm = s.rec = env(f, 0.08, 0.92, 0.18);
        s.pagesFilled = k + ss(0.55, 0.95, f);
        s.asic = 0.6; s.bus = pulse * 0.6;
        break;
      }
      case 'grow':
        s.grow = ss(0, 0.85, u); s.tint = ss(0.8, 1, u); s.gain = 0.2; s.spont = 7;
        break;
      case 'probe':
      case 'train':
      case 'calibrate': {
        var period = step.fx === 'train' ? 1.7 : step.fx === 'probe' ? 0.9 : 1.2;
        trainClock += dt;
        if (trainClock >= period) {
          trainClock -= period;
          trainPage = (trainPage + 1) % api.pageCount;
          api.setPage(trainPage);
        }
        var tt = trainClock / period;
        s.gain = step.fx === 'train' ? 0.2 + 0.8 * u : 0.2;
        s.ref = env(tt, 0, 0.5, 0.1);
        s.page = env(tt, 0.04, 0.5, 0.1);
        s.land = env(tt, 0.08, 0.55, 0.1);
        if (tt > 0.1 && tt < 0.45) api.stimulate(dt * 2.4);
        s.excite = step.fx === 'train' ? env(tt, 0.4, 0.98, 0.1) : 0.8;
        s.fluor = step.fx === 'train' ? env(tt, 0.42, 0.98, 0.1) : 0.8;
        s.sensor = s.fluor;
        s.asic = step.fx === 'train' ? env(tt, 0.7, 1, 0.08) : step.fx === 'probe' ? 0.4 : 1;
        s.bus = s.asic * pulse;
        break;
      }
      default:
        runSignals(((state.imprintT * 1.0) % RUN.period), dt, true);
    }
  }

  var hudAcc = 0;
  var powAcc = 0;
  function onFrame(dt) {
    if (state.mode === 'run') {
      if (state.playing) {
        state.t += dt;
        if (state.t >= RUN.period) {
          state.t -= RUN.period;
          state.cycle++;
          api.setPage(state.cycle % api.pageCount);
        }
      }
      // paused frames still drive the tissue while the network runs (it is off when paused under reduced motion)
      runSignals(state.t, dt, state.playing || !reduced);
      syncRunUI();
    } else {
      var step = IMP.steps[state.imprintStep];
      var dur = step.dur || 7;
      if (!state.imprintHold) {
        state.imprintT += dt;
        if (state.imprintT >= dur) {
          if (state.imprintAll && state.imprintStep < IMP.steps.length - 1) {
            setImprintStep(state.imprintStep + 1);
            step = IMP.steps[state.imprintStep];
            dur = step.dur || 7;
          } else if (state.imprintAll) {
            state.imprintAll = false;
            state.imprintHold = reduced;
            $('#imprint-play').textContent = 'Play all';
            syncSim();
            // reduced motion rests on the last step's still; otherwise the last step goes on looping
            if (reduced) setImprintStep(state.imprintStep, true);
            else state.imprintT = dur;
          } else if (step.loop === false) state.imprintT = dur;
          else state.imprintT = 0;
        }
      }
      // a held frame gets dt 0, which also stops the pulse clock and the stimulation
      imprintSignals(step, Math.min(1, state.imprintT / dur), state.imprintHold ? 0 : dt);
    }
    hudAcc += dt;
    if (hudAcc > 0.066) {
      hudAcc = 0;
      if (state.tab === 'run') drawHuds();
    }
    powAcc += dt;
    if (powAcc > 0.2) {
      powAcc = 0;
      if (state.tab === 'power') updatePower();
    }
  }

  // --------------------------------------------------------------- labels
  var labelsEl = $('#labels');
  var callouts = {};
  var projected = [];
  function buildLabels() {
    if (!hasScene) return;
    api.projectAnchors(projected).forEach(function (a) {
      var c = el('div', 'callout' + (a.quiet ? ' quiet' : '') + (a.id === 'today' ? ' today' : ''));
      c.appendChild(el('span', 'dot'));
      var text = a.id === 'scale' ? '10 mm' : a.id === 'teacher' ? D.TEACHER_LABEL : a.id === 'today' ? D.TODAY_LABEL : a.id === 'ref' ? D.REF_LABEL : partsById[a.id] ? partsById[a.id].short : a.id;
      var tag = el(a.quiet ? 'span' : 'button', 'tag', text);
      if (!a.quiet) {
        tag.type = 'button';
        tag.addEventListener('click', function () {
          select(a.id, true);
        });
      }
      c.appendChild(tag);
      c.hidden = true;
      labelsEl.appendChild(c);
      // w: the tag's unwrapped width, measured when first shown. Captions (quiet tags) also keep
      // mw, the max-width last written (0 for none), and h, their height at that width.
      callouts[a.id] = { root: c, tag: tag, w: 0, mw: 0, h: 0 };
    });
  }
  function resetTagWidths() {
    for (var id in callouts) callouts[id].w = 0;
    ctlBox = null;
    headBox = null;
  }
  // The control pills as one box in stage coordinates, measured once per layout. A part tag that would land on it is left out.
  var ctlBox = null;
  var headBox = null; // the title's text box, for the same purpose
  function controlBox() {
    var s = stageEl.getBoundingClientRect();
    var b = { x0: 1e9, x1: -1e9, y0: 1e9 };
    var pills = document.querySelectorAll('.controls .ctl');
    for (var i = 0; i < pills.length; i++) {
      var r = pills[i].getBoundingClientRect();
      if (!r.width) continue;
      b.x0 = Math.min(b.x0, r.left - s.left);
      b.x1 = Math.max(b.x1, r.right - s.left);
      b.y0 = Math.min(b.y0, r.top - s.top);
    }
    return b;
  }
  function setHidden(c, hide) {
    if (c.root.hidden !== hide) c.root.hidden = hide;
  }
  // sizes are measured in whatever font is up at the time, so measure again once the web fonts land
  if (document.fonts) {
    if (document.fonts.ready) document.fonts.ready.then(resetTagWidths);
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', resetTagWidths);
  }
  window.addEventListener('resize', resetTagWidths);
  var TAG_LEAD = 22; // px from the anchor dot to a tag, matching `.callout .tag { left: 22px }`
  function placeLabels() {
    if (!hasScene) return;
    var w = stageEl.clientWidth;
    var h = stageEl.clientHeight;
    var list = api.projectAnchors(projected);
    var cx = w / 2;
    var tags = [];
    var caps = [];
    if (!ctlBox) ctlBox = controlBox();
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var c = callouts[a.id];
      if (!c) continue;
      var show = (state.labels || a.id === 'today') && a.on && a.x > 4 && a.x < w - 4 && a.y > 70 && a.y < h - 46;
      if (!show) {
        setHidden(c, true);
        continue;
      }
      var left = a.side === 0 ? false : a.x < cx;
      var dx = 0;
      if (a.quiet) {
        // captions sit just right of their anchor and wrap in the room left before the stage edge
        setHidden(c, false);
        if (!c.w) {
          c.tag.style.maxWidth = '';
          c.mw = c.h = 0;
          c.w = c.tag.offsetWidth;
        }
        var mw = Math.max(90, Math.round(w - a.x - 14));
        // the max-width is written only while the caption has to wrap, so turning the model does not touch layout otherwise
        var cap = c.w > mw ? mw : 0;
        if (cap !== c.mw) {
          c.mw = cap;
          c.h = 0;
          c.tag.style.maxWidth = cap ? cap + 'px' : '';
        }
        if (!c.h) c.h = c.tag.offsetHeight;
        dx = Math.min(0, w - 8 - (a.x + 6 + Math.min(c.w, mw)));
        var capX = a.x + 6 + dx;
        caps.push({ y: a.y, c: c, dx: dx, x0: capX, x1: capX + Math.min(c.w, mw), up: a.id !== 'today', top: 0, bot: 0 });
      } else {
        // part tags: flip to the other side when this one would cross the stage edge, then shift by what is left over.
        // Whether one is shown is settled in spread(); it is unhidden here only to be measured.
        if (!c.w) {
          setHidden(c, false);
          c.w = c.tag.offsetWidth;
        }
        var roomL = a.x - TAG_LEAD - c.w - 4;
        var roomR = w - 4 - (a.x + TAG_LEAD + c.w);
        if (left && roomL < 0) left = false;
        else if (!left && roomR < 0 && roomL >= 0) left = true;
        dx = left ? Math.max(0, -roomL) : Math.min(0, roomR);
      }
      c.root.style.transform = 'translate(' + a.x.toFixed(1) + 'px,' + a.y.toFixed(1) + 'px)';
      c.root.classList.toggle('left', left);
      c.root.classList.toggle('sel', state.selected === a.id);
      if (!a.quiet) {
        var x0 = (left ? a.x - TAG_LEAD - c.w : a.x + TAG_LEAD) + dx;
        tags.push({ y: a.y, c: c, dx: dx, left: left, x0: x0, x1: x0 + c.w, py: 0 });
      }
    }
    settle(caps);
    spread(tags, h);
    // an upward caption that meets the title or a shown part tag is left out
    if (!headBox) {
      var hr = document.createRange();
      hr.selectNodeContents($('.masthead h1'));
      var hb = hr.getBoundingClientRect();
      var sb = stageEl.getBoundingClientRect();
      headBox = { x0: hb.left - sb.left, x1: hb.right - sb.left, y1: hb.bottom - sb.top };
    }
    for (var ci = 0; ci < caps.length; ci++) {
      var k = caps[ci];
      if (!k.up) continue;
      var clash = k.top < headBox.y1 && k.x0 < headBox.x1 && headBox.x0 < k.x1;
      for (var ti = 0; !clash && ti < tags.length; ti++) {
        var t = tags[ti];
        clash = !t.c.root.hidden && k.x0 < t.x1 && t.x0 < k.x1 && k.top < t.py + 11 && t.py - 11 < k.bot;
      }
      if (clash) setHidden(k.c, true);
    }
  }
  // Captions are not part of the 25px spread below. One that would overlap a caption anchored above it moves down clear of it.
  function settle(caps) {
    caps.sort(function (p, q) {
      return p.y - q.y;
    });
    for (var i = 0; i < caps.length; i++) {
      var k = caps[i];
      // a caption's box grows upward from 11px under its anchor; the real-size caption hangs down from 11px above it
      k.top = k.up ? k.y + 11 - k.c.h : k.y - 11;
      var dy = 0;
      for (var j = 0; j < i; j++) {
        var p = caps[j];
        if (k.x0 < p.x1 && p.x0 < k.x1 && k.top + dy < p.bot + 2 && k.top + dy + k.c.h > p.top) dy = p.bot + 2 - k.top;
      }
      // keep an upward caption clear of the control pills
      if (k.up && ctlBox && k.x0 < ctlBox.x1 && ctlBox.x0 < k.x1 && k.top + dy + k.c.h > ctlBox.y0 - 2) dy = ctlBox.y0 - 2 - k.c.h - k.top;
      k.top += dy;
      k.bot = k.top + k.c.h;
      k.c.tag.style.transform = k.dx || dy ? 'translate(' + k.dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)' : '';
    }
  }
  // Tags keep 25px apart down each side. One that was flipped or shifted at a stage edge can also
  // land on a tag from the other side; it then drops below that one too. A tag whose text would
  // end up on the control pills, or that would be cut by the bottom of the stage, is left out.
  function spread(items, stageH) {
    items.sort(function (p, q) {
      return p.y - q.y;
    });
    var prevL = -1e9;
    var prevR = -1e9;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var y = Math.max(it.y, (it.left ? prevL : prevR) + 25);
      // each pass can only move the tag further down; the pass limit is a backstop
      for (var pass = 0, moved = true; moved && pass < items.length; pass++) {
        moved = false;
        for (var j = 0; j < i; j++) {
          var p = items[j];
          var below = p.py + 25;
          if (p.left !== it.left && it.x0 < p.x1 + 4 && p.x0 < it.x1 + 4 && y > p.py - 25 && below - y > 0.01) {
            y = below;
            moved = true;
          }
        }
      }
      it.py = y;
      if (it.left) prevL = y;
      else prevR = y;
      it.c.tag.style.transform = 'translate(' + it.dx.toFixed(1) + 'px,' + (y - it.y).toFixed(1) + 'px)';
      // the tag box is 22px tall around y and its text ends about 6px under y
      setHidden(it.c, y + 11 > stageH || (y + 6 > ctlBox.y0 && it.x0 < ctlBox.x1 && ctlBox.x0 < it.x1));
    }
  }
  var tipEl = $('#tip');
  function onHover(id, x, y) {
    if (!id || !partsById[id]) {
      tipEl.hidden = true;
      return;
    }
    var r = stageEl.getBoundingClientRect();
    tipEl.textContent = partsById[id].name;
    tipEl.appendChild(el('small', null, D.STATUS[partsById[id].status].label));
    // shown before it is measured (a hidden tip is 0 wide); 20 and 18 are the tip's 12px, 14px offset plus a margin
    tipEl.hidden = false;
    tipEl.style.left = Math.max(0, Math.min(x - r.left, r.width - tipEl.offsetWidth - 20)) + 'px';
    tipEl.style.top = Math.max(0, Math.min(y - r.top, r.height - tipEl.offsetHeight - 18)) + 'px';
  }

  // ---------------------------------------------------------------- parts
  var detailEl = $('#detail');
  function renderDetail() {
    detailEl.textContent = '';
    var p = state.selected && partsById[state.selected];
    var card = el('div', 'card');
    if (!p) {
      card.appendChild(el('h2', null, D.INTRO.title));
      D.INTRO.body.forEach(function (t) {
        card.appendChild(el('p', null, t));
      });
      var key = el('ul', 'key');
      ['demonstrated', 'emerging', 'speculative'].forEach(function (s) {
        var li = el('li');
        li.appendChild(statusChip(s));
        li.appendChild(el('span', null, D.STATUS[s].gloss));
        key.appendChild(li);
      });
      card.appendChild(key);
      // the hint is about handling the model, so it is left out when there is none
      if (hasScene) card.appendChild(el('p', 'noteline', D.INTRO.hint));
    } else {
      var head = el('div', 'head');
      head.appendChild(el('h2', null, p.name));
      var close = el('button', 'linkbtn', 'Show all');
      close.type = 'button';
      close.addEventListener('click', function (ev) {
        // this button is rebuilt away with the card; a keyboard press (detail 0) hands focus back to the part's row
        var id = p.id;
        select(null);
        var row = ev.detail === 0 && document.querySelector('.partrow[data-id="' + id + '"]');
        if (row) row.focus();
      });
      head.appendChild(close);
      card.appendChild(head);
      card.appendChild(statusChip(p.status));
      card.appendChild(el('p', null, p.what));
      if (p.role) card.appendChild(el('p', 'muted', p.role));
      if (p.facts && p.facts.length) {
        var dl = el('dl', 'facts');
        p.facts.forEach(function (f) {
          dl.appendChild(el('dt', null, f[0]));
          dl.appendChild(el('dd', null, f[1]));
        });
        card.appendChild(dl);
      }
      if (p.scale) card.appendChild(el('p', 'noteline', p.scale));
    }
    detailEl.appendChild(card);
  }
  function renderParts() {
    var host = $('#partgroups');
    host.textContent = '';
    D.GROUPS.forEach(function (g) {
      var wrap = el('div', 'stack');
      wrap.appendChild(el('h3', null, g.title));
      var ul = el('ul', 'partlist');
      D.PARTS.filter(function (p) {
        return p.group === g.id;
      }).forEach(function (p) {
        var li = el('li');
        var b = el('button', 'partrow');
        b.type = 'button';
        b.dataset.id = p.id;
        var sw = el('span', 'sw');
        sw.style.setProperty('--sw', p.sw || '');
        b.appendChild(sw);
        b.appendChild(el('span', 'nm', p.name));
        b.appendChild(statusChip(p.status));
        b.addEventListener('click', function (ev) {
          select(state.selected === p.id ? null : p.id);
          // selecting scrolls the pane to the card, so a keyboard press (detail 0) takes focus there too
          if (ev.detail === 0 && state.selected) {
            var h = $('h2', detailEl);
            h.tabIndex = -1;
            h.focus();
          }
        });
        li.appendChild(b);
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
      host.appendChild(wrap);
    });
  }
  function select(id, fromScene) {
    if (id && !partsById[id]) id = null;
    if (fromScene && id === null && state.selected === null) return;
    state.selected = id;
    renderDetail();
    var rows = document.querySelectorAll('.partrow');
    for (var i = 0; i < rows.length; i++) rows[i].setAttribute('aria-current', String(rows[i].dataset.id === id));
    if (id) {
      if ($('#btn-today').getAttribute('aria-pressed') === 'true') {
        $('#btn-today').setAttribute('aria-pressed', 'false');
        api.setToday(false);
      }
      api.setSelected([id]);
      api.focus(id);
      if (state.tab !== 'parts') setTab('parts');
      $('#pane-parts').scrollTop = 0;
    } else {
      applyFocus();
      api.resetView();
    }
  }
  function applyFocus() {
    if (state.selected) return;
    var f = [];
    if (state.tab === 'run' && state.runStep >= 0) f = RUN.steps[state.runStep].focus || [];
    else if (state.tab === 'imprint') f = IMP.steps[state.imprintStep].focus || [];
    api.setSelected(f);
  }

  // ------------------------------------------------------------------ run
  var runBtns = [];
  var scrub = $('#run-scrub');
  var scrubbing = false;
  function renderRun() {
    $('#run-intro').textContent = RUN.intro;
    var ol = $('#run-steps');
    RUN.steps.forEach(function (s, i) {
      var li = el('li');
      var b = el('button', 'step');
      b.type = 'button';
      b.appendChild(el('span', 'ttl', s.title));
      b.appendChild(el('span', 'body', s.body));
      if (s.power) b.appendChild(el('span', 'pw', s.power));
      b.addEventListener('click', function () {
        // paused: park mid-step, where the step's light is fully on, not on its dark first frame
        state.t = state.playing ? s.t0 + 0.02 : (s.t0 + s.t1) / 2;
        if (reduced && !state.playing) poseTissue();
        else {
          api.quiet();
          if (i > T_INDEX.write || (!state.playing && i === T_INDEX.write)) api.stimulate(1);
        }
        syncRunUI(true);
      });
      li.appendChild(b);
      ol.appendChild(li);
      runBtns.push(b);
    });
    $('#run-play').textContent = state.playing ? 'Pause' : 'Play';
    $('#run-play').addEventListener('click', function () {
      state.playing = !state.playing;
      this.textContent = state.playing ? 'Pause' : 'Play';
      syncSim();
    });
    scrub.addEventListener('input', function () {
      // the slider's maximum would be t = period, which belongs to no step
      state.t = Math.min(RUN.period - 0.001, (scrub.value / 1000) * RUN.period);
      scrubbing = true;
      poseTissue();
      syncRunUI(true);
    });
    // 'change' does not fire when a drag ends on the value it started from, so the release also ends a scrub
    function endScrub() {
      scrubbing = false;
    }
    scrub.addEventListener('change', endScrub);
    scrub.addEventListener('blur', endScrub);
    window.addEventListener('pointerup', endScrub);
    window.addEventListener('pointercancel', endScrub);
  }
  var T_INDEX = {};
  RUN.steps.forEach(function (s, i) {
    T_INDEX[s.id] = i;
  });
  var lastClock = '';
  var lastValueText = '';
  var capPage = -1;
  function syncRunUI(force) {
    var idx = -1;
    for (var i = 0; i < RUN.steps.length; i++) if (state.t >= RUN.steps[i].t0 && state.t < RUN.steps[i].t1) idx = i;
    if (idx !== state.runStep || force) {
      state.runStep = idx;
      for (var j = 0; j < runBtns.length; j++) {
        if (j === idx) runBtns[j].setAttribute('aria-current', 'step');
        else runBtns[j].removeAttribute('aria-current');
      }
      applyFocus();
    }
    if (state.tab !== 'run') return;
    if (!scrubbing) scrub.value = String(Math.round((state.t / RUN.period) * 1000));
    var clock = state.t.toFixed(1) + ' s';
    if (clock !== lastClock) {
      lastClock = clock;
      $('#run-clock').textContent = clock;
    }
    // what a screen reader hears for the slider, in place of its raw 0 to 1000 value
    var valueText = clock + ' of ' + RUN.period + ' s' + (idx >= 0 ? ', ' + RUN.steps[idx].title : '');
    if (valueText !== lastValueText) {
      lastValueText = valueText;
      scrub.setAttribute('aria-valuetext', valueText);
    }
    var page = api.getPage();
    var n = page + (state.t >= T.decode[0] + 0.5 ? 1 : 0);
    if (n !== state.tokensShown) {
      state.tokensShown = n;
      var box = $('#tokens');
      box.textContent = '';
      box.appendChild(el('span', 'prompt', RUN.prompt));
      for (var k = 0; k < n; k++) box.appendChild(el('span', 'tok' + (k === n - 1 ? ' new' : ''), RUN.tokens[k % RUN.tokens.length]));
    }
    // when the cycle wraps the page number goes up but the token count above does not, so the caption has its own cache
    if (page !== capPage) {
      capPage = page;
      $('#hud-page-cap').textContent = 'Page ' + (page + 1) + ' of ' + api.pageCount + ' leaving the crystal';
    }
  }
  var hudPage = $('#hud-page');
  var hudAct = $('#hud-act');
  var hudColors = null;
  function drawHuds() {
    if (!hudColors) hudColors = { bg: cssVar('--stage'), page: cssVar('--w-page'), fluor: cssVar('--w-fluor'), line: cssVar('--stage-line') };
    var G = D.PAGE_G || 10;
    var ctx = hudPage.getContext('2d');
    if (!ctx) return;
    var S = hudPage.width;
    ctx.fillStyle = hudColors.bg;
    ctx.fillRect(0, 0, S, S);
    var pat = api.pagePatternOf(api.getPage());
    var lit = Math.max(api.signals.page || 0, api.signals.rec || 0);
    var cell = S / G;
    for (var y = 0; y < G; y++)
      for (var x = 0; x < G; x++) {
        ctx.beginPath();
        ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, cell * 0.3, 0, Math.PI * 2);
        if (pat[y * G + x]) {
          ctx.globalAlpha = 0.22 + 0.78 * lit;
          ctx.fillStyle = hudColors.page;
          ctx.fill();
        } else {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = hudColors.line;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    ctx.globalAlpha = 1;
    var H = api.hudSize;
    var a = api.activityGrid;
    ctx = hudAct.getContext('2d');
    S = hudAct.width;
    ctx.fillStyle = hudColors.bg;
    ctx.fillRect(0, 0, S, S);
    cell = S / H;
    ctx.fillStyle = hudColors.fluor;
    var seen = Math.max(0.12, api.signals.fluor || 0);
    for (var gy = 0; gy < H; gy++)
      for (var gx = 0; gx < H; gx++) {
        var v = a[gy * H + gx];
        if (v < 0.05) continue;
        ctx.globalAlpha = Math.min(1, v * 0.7) * seen;
        ctx.fillRect(gx * cell + 1, gy * cell + 1, cell - 2, cell - 2);
      }
    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------- imprint
  var impBtns = [];
  function renderImprint() {
    $('#imprint-intro').textContent = IMP.intro;
    $('#imprint-note').textContent = IMP.note;
    var ol = $('#imprint-steps');
    IMP.steps.forEach(function (s, i) {
      var li = el('li');
      var b = el('button', 'step');
      b.type = 'button';
      var ttl = el('span', 'ttl', s.title);
      ttl.appendChild(statusChip(s.status));
      b.appendChild(ttl);
      b.appendChild(el('span', 'body', s.body));
      if (s.gap) b.appendChild(el('span', 'pw', s.gap));
      b.addEventListener('click', function () {
        state.imprintAll = false;
        state.imprintHold = reduced;
        $('#imprint-play').textContent = 'Play all';
        syncSim();
        setImprintStep(i);
      });
      li.appendChild(b);
      ol.appendChild(li);
      impBtns.push(b);
    });
    $('#imprint-play').addEventListener('click', function () {
      // Play all runs the whole sequence from step 1; Stop freezes the frame on show
      state.imprintAll = !state.imprintAll;
      state.imprintHold = !state.imprintAll;
      this.textContent = state.imprintAll ? 'Stop' : 'Play all';
      syncSim();
      if (state.imprintAll) setImprintStep(0);
    });
  }
  var IMP_POSED = { probe: 1, calibrate: 1, train: 1, run: 1 }; // effects whose still frame shows the tissue responding
  function setImprintStep(i, keepScroll) {
    var step = IMP.steps[i];
    var hold = state.imprintHold;
    state.imprintStep = i;
    // held (reduced motion): a representative still, 60% through the step and mid-pulse, not its dark first frame
    state.imprintT = hold ? 0.6 * (step.dur || 7) : 0;
    trainClock = hold ? 0.3 : 0;
    api.quiet();
    if (hold) {
      imprintSignals(step, 0.6, 0); // sets how much tissue is grown before it is posed
      if (IMP_POSED[step.fx]) api.prime(1);
    }
    for (var j = 0; j < impBtns.length; j++) {
      if (j === i) impBtns[j].setAttribute('aria-current', 'step');
      else impBtns[j].removeAttribute('aria-current');
    }
    if (!keepScroll && impBtns[i] && impBtns[i].scrollIntoView) impBtns[i].scrollIntoView({ block: 'nearest' });
    applyFocus();
  }

  // ---------------------------------------------------------------- power
  var P = D.POWER;
  var decades = Math.round(Math.log10(P.max) - Math.log10(P.min));
  var dotRows = [];
  function powerNow(item) {
    var s = api.signals;
    switch (item.mode) {
      case 'fire':
        return item.peak * Math.min(1, api.getActivity() / P.actRef);
      case 'ref':
        return item.peak * Math.max(s.ref || 0, s.rec || 0);
      case 'excite':
        return item.peak * (s.excite || 0);
      case 'imager':
        return item.peak * (s.sensor || 0);
      case 'slm':
        return item.peak * (s.slm || 0);
      case 'control':
        return item.idle + (item.peak - item.idle) * (s.asic || 0);
      default:
        return item.peak;
    }
  }
  function xOf(v) {
    return Math.min(1, Math.max(0, (Math.log10(v) - Math.log10(P.min)) / decades));
  }
  function renderPower() {
    $('#power-title').textContent = P.title;
    $('#power-intro').textContent = P.intro;
    $('#power-key').textContent = P.key;
    var host = $('#power-dots');
    P.items.forEach(function (it) {
      var row = el('div', 'dotrow' + (it.group === 'tissue' ? ' hot' : ''));
      row.setAttribute('role', 'listitem');
      row.appendChild(el('span', 'nm', it.name));
      var tr = el('div', 'track');
      tr.style.setProperty('--decades', decades);
      var pk = el('span', 'peak');
      pk.style.left = xOf(it.peak) * 100 + '%';
      var dot = el('span', 'dot');
      tr.appendChild(pk);
      tr.appendChild(dot);
      row.appendChild(tr);
      var val = el('span', 'val');
      row.appendChild(val);
      // visible text, not a title tooltip: touch and keyboard users can read it too
      if (it.note) row.appendChild(el('span', 'note', it.note));
      host.appendChild(row);
      dotRows.push({ it: it, row: row, dot: dot, val: val });
    });
    var ticks = $('#power-ticks');
    P.ticks.forEach(function (v) {
      var sp = el('span', null, fmtW(v).replace('.0 ', ' '));
      sp.style.left = xOf(v) * 100 + '%';
      ticks.appendChild(sp);
    });
    var claims = $('#power-claims');
    P.claims.forEach(function (c) {
      var box = el('div', 'claim');
      box.appendChild(el('p', 'q', c.q));
      var v = el('span', 'verdict');
      var bar = el('i');
      bar.style.setProperty('--fill', c.fill + '%');
      v.appendChild(bar);
      v.appendChild(document.createTextNode(c.verdict));
      box.appendChild(v);
      c.a.forEach(function (t) {
        box.appendChild(el('p', 'muted', t));
      });
      claims.appendChild(box);
    });
    var tbl = $('#power-compare');
    var thead = el('tr');
    P.compare.head.forEach(function (h) {
      thead.appendChild(el('th', null, h));
    });
    tbl.appendChild(thead);
    P.compare.rows.forEach(function (r) {
      var tr = el('tr');
      r.forEach(function (c, i) {
        tr.appendChild(el('td', i ? 'num' : null, c));
      });
      tbl.appendChild(tr);
    });
    if (P.compareNote) tbl.parentNode.parentNode.appendChild(el('p', 'noteline', P.compareNote));
    updatePower();
  }
  function updatePower() {
    dotRows.forEach(function (r) {
      // without the 3D scene no network is running, so the firing row shows its on-value and tick with no live dot
      var fixed = !hasScene && r.it.mode === 'fire';
      var v = fixed ? r.it.peak : powerNow(r.it);
      var off = v < P.min;
      r.row.classList.toggle('off', off);
      r.dot.hidden = fixed;
      r.dot.style.left = (off ? 0 : xOf(v) * 100) + '%';
      r.val.textContent = off ? 'off' : fmtW(v);
      r.row.setAttribute(
        'aria-label',
        r.it.name + ': ' + (fixed ? '' : (off ? 'off' : fmtW(v)) + ' now, ') + fmtW(r.it.peak) + ' when on' + (r.it.note ? '. ' + r.it.note : '')
      );
    });
  }

  // -------------------------------------------------------------- reality
  function renderReality() {
    var R = D.REALITY;
    $('#reality-intro').textContent = R.intro;
    var host = $('#reality-body');
    R.sections.forEach(function (sec) {
      var wrap = el('div', 'stack');
      var h = el('h3', null, sec.title);
      wrap.appendChild(h);
      if (sec.status) wrap.appendChild(statusChip(sec.status));
      var ul = el('ul', 'bullets');
      sec.items.forEach(function (t) {
        ul.appendChild(el('li', null, t));
      });
      wrap.appendChild(ul);
      host.appendChild(wrap);
    });
    var src = el('div', 'stack');
    src.appendChild(el('h3', null, 'Sources'));
    var ol = el('ul', 'sources');
    R.sources.forEach(function (s) {
      var li = el('li');
      if (s.u) {
        var a = el('a', null, s.t);
        a.href = s.u;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        li.appendChild(a);
      } else li.textContent = s.t;
      ol.appendChild(li);
    });
    src.appendChild(ol);
    host.appendChild(src);
  }

  // ----------------------------------------------------------------- tabs
  var TABS = ['parts', 'run', 'imprint', 'power', 'reality'];
  function setTab(name) {
    if (TABS.indexOf(name) < 0) name = 'parts';
    var prev = state.tab;
    state.tab = name;
    TABS.forEach(function (t) {
      var on = t === name;
      var b = $('#tab-' + t);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      $('#pane-' + t).hidden = !on;
    });
    var wantMode = name === 'imprint' ? 'imprint' : 'run';
    if (wantMode !== state.mode) {
      state.mode = wantMode;
      api.quiet();
      if (wantMode === 'imprint') {
        syncSim();
        setImprintStep(state.imprintStep, true);
      } else {
        state.imprintAll = false;
        state.imprintHold = reduced;
        $('#imprint-play').textContent = 'Play all';
        api.setPage(state.cycle % api.pageCount);
        syncSim();
        poseTissue();
      }
    }
    if (name !== 'parts' && state.selected && prev === 'parts') {
      state.selected = null;
      renderDetail();
      var rows = document.querySelectorAll('.partrow');
      for (var i = 0; i < rows.length; i++) rows[i].setAttribute('aria-current', 'false');
      api.resetView();
    }
    state.tokensShown = -1;
    applyFocus();
    if (name === 'run') {
      syncRunUI(true);
      drawHuds();
    }
    if (name === 'power') updatePower();
    remember('tab', name);
  }
  TABS.forEach(function (t, i) {
    var b = $('#tab-' + t);
    b.addEventListener('click', function () {
      setTab(t);
    });
    b.addEventListener('keydown', function (ev) {
      var d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      var n = TABS[(i + d + TABS.length) % TABS.length];
      setTab(n);
      $('#tab-' + n).focus();
    });
  });

  // ------------------------------------------------------------- controls
  $('#explode').addEventListener('input', function () {
    // exploding refits the camera to the module, so leave the real-size view first
    if ($('#btn-today').getAttribute('aria-pressed') === 'true') setToday(false);
    api.setExplode(this.value / 100, true);
  });
  $('#btn-labels').setAttribute('aria-pressed', String(state.labels));
  $('#btn-labels').addEventListener('click', function () {
    state.labels = !state.labels;
    this.setAttribute('aria-pressed', String(state.labels));
    remember('labels', state.labels ? '1' : '0');
  });
  $('#btn-spin').addEventListener('click', function () {
    state.spin = !state.spin;
    this.setAttribute('aria-pressed', String(state.spin));
    api.setAutoRotate(state.spin);
  });
  function setToday(on) {
    $('#btn-today').setAttribute('aria-pressed', String(on));
    if (on) {
      $('#explode').value = 0;
      api.setExplode(0, false);
      // select(null) also clears the highlighted row; the camera move it starts is replaced by setToday's below
      if (state.selected) select(null);
    }
    api.setToday(on);
  }
  $('#btn-today').addEventListener('click', function () {
    setToday(this.getAttribute('aria-pressed') !== 'true');
  });
  $('#btn-reset').addEventListener('click', function () {
    $('#explode').value = 0;
    api.setExplode(0, false);
    $('#btn-today').setAttribute('aria-pressed', 'false');
    api.setToday(false);
    select(null);
    api.resetView();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape' || !state.selected) return;
    // the card is rebuilt, so focus inside it goes back to the part's row
    var id = state.selected;
    var inCard = detailEl.contains(document.activeElement);
    select(null);
    var row = inCard && document.querySelector('.partrow[data-id="' + id + '"]');
    if (row) row.focus();
  });
  if (hasScene) {
    // keyboard route to what dragging and the wheel do
    stageEl.tabIndex = 0;
    stageEl.setAttribute('aria-label', '3D model of the concept module. Arrow keys turn it, plus and minus zoom.');
    stageEl.addEventListener('keydown', function (ev) {
      if (ev.target !== stageEl || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      // a held key repeats many times a second, so repeats take a smaller step
      var a = ev.repeat ? Math.PI / 60 : Math.PI / 18;
      if (ev.key === 'ArrowLeft') api.orbit(-a, 0, 1);
      else if (ev.key === 'ArrowRight') api.orbit(a, 0, 1);
      else if (ev.key === 'ArrowUp') api.orbit(0, -a / 2, 1);
      else if (ev.key === 'ArrowDown') api.orbit(0, a / 2, 1);
      else if (ev.key === '+' || ev.key === '=') api.orbit(0, 0, 0.85);
      else if (ev.key === '-' || ev.key === '_') api.orbit(0, 0, 1 / 0.85);
      else return;
      ev.preventDefault();
      onHover(null); // whatever was under the pointer has turned away
    });
  }

  function themeChanged() {
    hudColors = null;
    api.refreshTheme();
    if (state.tab === 'run') drawHuds();
  }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', themeChanged);
  }
  if (window.MutationObserver) new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', function () {
    if (!hasScene) return;
    if (document.hidden) api.stop();
    else api.start();
  });

  // ----------------------------------------------------------------- boot
  $('#lede').textContent = D.LEDE;
  var legend = $('#legend');
  D.LEGEND.forEach(function (l) {
    var li = el('li');
    var sw = el('i');
    sw.style.background = 'var(--w-' + l.color + ')';
    li.appendChild(sw);
    li.appendChild(document.createTextNode(l.text));
    legend.appendChild(li);
  });
  legend.appendChild(el('li', 'note', D.SCALE_NOTE));

  renderDetail();
  renderParts();
  renderRun();
  renderImprint();
  renderPower();
  renderReality();
  buildLabels();
  api.setPage(0);
  syncSim();
  poseTissue();
  var startTab = remember('tab');
  setTab(startTab && TABS.indexOf(startTab) >= 0 ? startTab : 'parts');
  api.start();
  window.PWC.api = api;
  window.PWC.state = state;
})();
