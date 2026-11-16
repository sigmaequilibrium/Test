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
      stimulate: noop, setSim: noop, quiet: noop, setExplode: noop, setSelected: noop, focus: noop,
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
        s.grow = ss(0, 0.85, u); s.tint = 0; s.gain = 0.2; s.spont = 7;
        break;
      case 'express':
        s.tint = ss(0.1, 0.9, u); s.gain = 0.2; s.spont = 4;
        s.excite = 0.25 * ss(0.5, 0.9, u);
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
        s.gain = step.fx === 'train' ? 0.2 + 0.8 * u : 1;
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
      runSignals(state.t, dt, state.playing);
      syncRunUI();
    } else {
      var step = IMP.steps[state.imprintStep];
      var dur = step.dur || 7;
      state.imprintT += dt;
      if (state.imprintT >= dur) {
        if (state.imprintAll && state.imprintStep < IMP.steps.length - 1) {
          setImprintStep(state.imprintStep + 1, true);
          step = IMP.steps[state.imprintStep];
        } else if (state.imprintAll) {
          state.imprintAll = false;
          $('#imprint-play').textContent = 'Play all';
          state.imprintT = dur;
        } else if (step.loop === false) state.imprintT = dur;
        else state.imprintT = 0;
      }
      imprintSignals(step, Math.min(1, state.imprintT / dur), dt);
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
      var c = el('div', 'callout' + (a.quiet ? ' quiet' : ''));
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
      callouts[a.id] = { root: c, tag: tag };
    });
  }
  function placeLabels() {
    if (!hasScene) return;
    var w = stageEl.clientWidth;
    var h = stageEl.clientHeight;
    var list = api.projectAnchors(projected);
    var cx = w / 2;
    var sides = { l: [], r: [] };
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var c = callouts[a.id];
      if (!c) continue;
      var show = (state.labels || a.id === 'today') && a.on && a.x > 4 && a.x < w - 4 && a.y > 70 && a.y < h - 46;
      c.root.hidden = !show;
      if (!show) continue;
      var left = a.side === 0 ? false : a.x < cx;
      c.root.style.transform = 'translate(' + a.x.toFixed(1) + 'px,' + a.y.toFixed(1) + 'px)';
      c.root.classList.toggle('left', left);
      c.root.classList.toggle('sel', state.selected === a.id);
      if (!a.quiet) (left ? sides.l : sides.r).push({ y: a.y, c: c });
    }
    spread(sides.l);
    spread(sides.r);
  }
  function spread(items) {
    items.sort(function (p, q) {
      return p.y - q.y;
    });
    var prev = -1e9;
    for (var i = 0; i < items.length; i++) {
      var y = Math.max(items[i].y, prev + 25);
      items[i].c.tag.style.transform = 'translateY(' + (y - items[i].y).toFixed(1) + 'px)';
      prev = y;
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
    tipEl.style.left = Math.min(x - r.left, r.width - 190) + 'px';
    tipEl.style.top = y - r.top + 'px';
    tipEl.hidden = false;
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
      card.appendChild(el('p', 'noteline', D.INTRO.hint));
    } else {
      var head = el('div', 'head');
      head.appendChild(el('h2', null, p.name));
      var close = el('button', 'linkbtn', 'Show all');
      close.type = 'button';
      close.addEventListener('click', function () {
        select(null);
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
        b.addEventListener('click', function () {
          select(state.selected === p.id ? null : p.id);
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
        state.t = s.t0 + 0.02;
        api.quiet();
        if (i > T_INDEX.write) api.stimulate(1);
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
      api.setSim(state.playing || !reduced);
    });
    scrub.addEventListener('input', function () {
      state.t = (scrub.value / 1000) * RUN.period;
      scrubbing = true;
      syncRunUI(true);
    });
    scrub.addEventListener('change', function () {
      scrubbing = false;
    });
  }
  var T_INDEX = {};
  RUN.steps.forEach(function (s, i) {
    T_INDEX[s.id] = i;
  });
  var lastClock = '';
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
    var page = api.getPage();
    var n = page + (state.t >= T.decode[0] + 0.5 ? 1 : 0);
    if (n !== state.tokensShown) {
      state.tokensShown = n;
      var box = $('#tokens');
      box.textContent = '';
      box.appendChild(el('span', 'prompt', RUN.prompt));
      for (var k = 0; k < n; k++) box.appendChild(el('span', 'tok' + (k === n - 1 ? ' new' : ''), RUN.tokens[k % RUN.tokens.length]));
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
        $('#imprint-play').textContent = 'Play all';
        setImprintStep(i);
      });
      li.appendChild(b);
      ol.appendChild(li);
      impBtns.push(b);
    });
    $('#imprint-play').addEventListener('click', function () {
      state.imprintAll = !state.imprintAll;
      this.textContent = state.imprintAll ? 'Stop' : 'Play all';
      if (state.imprintAll) setImprintStep(state.imprintStep >= IMP.steps.length - 1 ? 0 : state.imprintStep);
    });
  }
  function setImprintStep(i, keepScroll) {
    state.imprintStep = i;
    state.imprintT = 0;
    trainClock = 0;
    api.quiet();
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
      row.title = it.note || '';
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
      var v = powerNow(r.it);
      var off = v < P.min;
      r.row.classList.toggle('off', off);
      r.dot.style.left = (off ? 0 : xOf(v) * 100) + '%';
      r.val.textContent = off ? 'off' : fmtW(v);
      r.row.setAttribute('aria-label', r.it.name + ': ' + (off ? 'off' : fmtW(v)) + ' now, ' + fmtW(r.it.peak) + ' when on');
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
      if (wantMode === 'imprint') setImprintStep(state.imprintStep, true);
      else {
        state.imprintAll = false;
        $('#imprint-play').textContent = 'Play all';
        api.setPage(state.cycle % api.pageCount);
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
      if (state.selected) {
        state.selected = null;
        renderDetail();
        applyFocus();
      }
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
    if (ev.key === 'Escape' && state.selected) select(null);
  });

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
  api.setSim(state.playing || !reduced);
  if (reduced) api.stimulate(1);
  var startTab = remember('tab');
  setTab(startTab && TABS.indexOf(startTab) >= 0 ? startTab : 'parts');
  api.start();
  window.PWC.api = api;
  window.PWC.state = state;
})();
