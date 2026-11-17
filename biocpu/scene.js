/* Photonic Wetware Core - 3D scene.
 * Builds the concept module in millimetres (Y up, origin at the centre of the
 * electrode array's top surface) and runs a small spiking-network cartoon in
 * the tissue. Classic script: needs THREE r147 + OrbitControls as globals.
 */
(function () {
  'use strict';
  var PWC = (window.PWC = window.PWC || {});

  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var PAGE_G = 10; // holographic page drawn as a 10 x 10 grid of spots
  var PAGE_COUNT = 9; // pages drawn inside the crystal

  PWC.PAGE_G = PAGE_G;
  PWC.PAGE_COUNT = PAGE_COUNT;
  PWC.pagePattern = function (k) {
    var r = mulberry(1013 + k * 7919);
    var out = new Uint8Array(PAGE_G * PAGE_G);
    for (var i = 0; i < out.length; i++) out[i] = r() < 0.3 ? 1 : 0;
    return out;
  };

  PWC.createScene = function (container, opts) {
    opts = opts || {};
    var THREE = window.THREE;
    if (!THREE || !THREE.OrbitControls) return null;
    if (THREE.ColorManagement && 'legacyMode' in THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      return null;
    }
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 0.5, 5000);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 8;
    controls.maxDistance = 2600;
    controls.maxPolarAngle = Math.PI * 0.49; // keeps the camera above the breadboard
    controls.autoRotateSpeed = 0.55;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.8;

    // ---- colours ----------------------------------------------------------
    var COL = PWC.COLORS || {};
    function col(name, fallback) {
      return new THREE.Color(COL[name] || fallback);
    }
    var cPage = col('page', '#ff5630');
    var cFluor = col('fluor', '#3be38f');
    var cExcite = col('excite', '#3aa0ff');
    var cRecord = col('record', '#8dff5a');
    var cMedium = col('medium', '#e8527a');
    var cGold = col('gold', '#e0aa4a');
    var cAccent = col('accent', '#ff8fb5');

    // ---- lights + environment --------------------------------------------
    scene.add(new THREE.HemisphereLight(0xd6d9ff, 0x1c1420, 0.5));
    var key = new THREE.DirectionalLight(0xfff1e6, 1.2);
    key.position.set(40, 70, 55);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0xffb9d6, 0.4);
    rim.position.set(-50, 30, -60);
    scene.add(rim);
    if (THREE.RoomEnvironment && THREE.PMREMGenerator) {
      try {
        var pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
      } catch (err2) {
        /* reflections are optional */
      }
    }

    var root = new THREE.Group();
    root.name = 'PhotonicWetwareCore';
    scene.add(root);

    // ---- helpers ----------------------------------------------------------
    var parts = {};
    var anchors = {};
    var todayOn = false;
    var explode = 0;
    var beams = [];
    var glowMats = [];

    function part(id, ex) {
      var g = new THREE.Group();
      g.name = id;
      g.userData.partId = id;
      g.userData.ex = new THREE.Vector3(ex[0], ex[1], ex[2]);
      g.userData.home = new THREE.Vector3();
      root.add(g);
      parts[id] = g;
      return g;
    }
    function std(hex, o) {
      var p = { color: hex, roughness: 0.5, metalness: 0, envMapIntensity: 0.3 };
      if (o) for (var k in o) p[k] = o[k];
      return new THREE.MeshStandardMaterial(p);
    }
    function glassy(hex, opacity, o) {
      var p = { color: hex, roughness: 0.06, metalness: 0, transparent: true, opacity: opacity, depthWrite: false, envMapIntensity: 0.7 };
      if (o) for (var k in o) p[k] = o[k];
      return new THREE.MeshPhysicalMaterial(p);
    }
    function glow(color, o) {
      var p = {
        color: color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      };
      if (o) for (var k in o) p[k] = o[k];
      var m = new THREE.MeshBasicMaterial(p);
      glowMats.push(m);
      return m;
    }
    function add(parent, geo, mat, x, y, z) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      parent.add(m);
      return m;
    }
    function outline(mesh, hex, opacity) {
      var l = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, 30),
        new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: opacity == null ? 0.5 : opacity })
      );
      l.userData.noPick = true;
      mesh.add(l);
      return l;
    }
    function anchor(parent, x, y, z) {
      var o = new THREE.Object3D();
      o.position.set(x, y, z);
      parent.add(o);
      return o;
    }
    var MINOR = { thermal: 1, window: 1, perfusion: 1, relay: 1, board: 1, chamber: 1, ring: 1 };
    function label(id, parent, x, y, z, side) {
      anchors[id] = {
        obj: anchor(parent, x, y, z),
        side: side,
        when: function () {
          return !todayOn && (!MINOR[id] || explode > 0.45);
        },
      };
    }
    function box(w, h, d) {
      return new THREE.BoxGeometry(w, h, d);
    }
    function cyl(r, h, seg) {
      return new THREE.CylinderGeometry(r, r, h, seg || 24);
    }
    function tube(points, radius, segs, radial) {
      var pts = points.map(function (p) {
        return new THREE.Vector3(p[0], p[1], p[2]);
      });
      var curve = new THREE.CatmullRomCurve3(pts);
      var geo = new THREE.TubeGeometry(curve, segs || 48, radius, radial || 8, false);
      geo.userData.curve = curve;
      return geo;
    }
    // flat ribbon cable following a curve; width runs along `axis`
    function ribbon(points, width, axis) {
      var curve = new THREE.CatmullRomCurve3(
        points.map(function (p) {
          return new THREE.Vector3(p[0], p[1], p[2]);
        })
      );
      var n = 40;
      var pos = [];
      var idx = [];
      var w = new THREE.Vector3(axis[0], axis[1], axis[2]).multiplyScalar(width / 2);
      for (var i = 0; i <= n; i++) {
        var p = curve.getPoint(i / n);
        pos.push(p.x - w.x, p.y - w.y, p.z - w.z, p.x + w.x, p.y + w.y, p.z + w.z);
        if (i < n) {
          var a = i * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    }
    // square plate with a square or round hole, lying flat, thickness along +y
    function plate(outer, hole, round, thick) {
      var s = new THREE.Shape();
      var o = outer / 2;
      s.moveTo(-o, -o);
      s.lineTo(o, -o);
      s.lineTo(o, o);
      s.lineTo(-o, o);
      s.lineTo(-o, -o);
      var h = new THREE.Path();
      if (round) h.absarc(0, 0, hole, 0, Math.PI * 2, true);
      else {
        var q = hole / 2;
        h.moveTo(-q, -q);
        h.lineTo(-q, q);
        h.lineTo(q, q);
        h.lineTo(q, -q);
        h.lineTo(-q, -q);
      }
      s.holes.push(h);
      var geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 40 });
      geo.rotateX(-Math.PI / 2);
      return geo;
    }
    // four thin vanes from the cage rods in to an optic of half-extent `inner`
    var ROD = 10.2;
    function spider(parent, y, inner, mat) {
      var rodR = Math.SQRT2 * ROD;
      var len = rodR - inner;
      for (var i = 0; i < 4; i++) {
        var ang = Math.PI / 4 + (i * Math.PI) / 2;
        var mid = inner + len / 2;
        var v = add(parent, box(len, 0.45, 0.6), mat, Math.cos(ang) * mid, y, Math.sin(ang) * mid);
        v.rotation.y = -ang;
        var collar = add(parent, cyl(0.8, 0.9, 16), mat, Math.cos(ang) * rodR, y, Math.sin(ang) * rodR);
        collar.userData.noPick = true;
      }
    }
    function canvasTex(size, draw) {
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var ctx = c.getContext('2d');
      draw(ctx, size);
      var t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 4;
      return t;
    }

    function Beam(a, b, r0, r1, color, square, maxOpacity) {
      var geo = square
        ? new THREE.CylinderGeometry(r1 * Math.SQRT2, r0 * Math.SQRT2, 1, 4, 1, true)
        : new THREE.CylinderGeometry(r1, r0, 1, 28, 1, true);
      if (square) geo.rotateY(Math.PI / 4);
      geo.translate(0, 0.5, 0);
      this.mesh = new THREE.Mesh(geo, glow(color));
      this.mesh.renderOrder = 20;
      this.mesh.userData.noPick = true;
      this.mesh.userData.exportSkip = true;
      this.a = a;
      this.b = b;
      this.max = maxOpacity == null ? 0.22 : maxOpacity;
      this.level = 0;
      root.add(this.mesh);
      beams.push(this);
    }
    var _va = new THREE.Vector3();
    var _vb = new THREE.Vector3();
    var _up = new THREE.Vector3(0, 1, 0);
    Beam.prototype.update = function () {
      var m = this.mesh;
      m.visible = this.level > 0.004;
      if (!m.visible) return;
      this.a.getWorldPosition(_va);
      this.b.getWorldPosition(_vb);
      m.position.copy(_va);
      _vb.sub(_va);
      var len = _vb.length();
      m.scale.set(1, Math.max(len, 0.0001), 1);
      m.quaternion.setFromUnitVectors(_up, _vb.multiplyScalar(1 / Math.max(len, 0.0001)));
      m.material.opacity = this.max * this.level;
    };

    // ---- shared materials -------------------------------------------------
    var mAnod = std(0x1a181e, { metalness: 0.35, roughness: 0.62, envMapIntensity: 0.1 });
    var mSteel = std(0xc2c5cc, { metalness: 1, roughness: 0.25, envMapIntensity: 0.85 });
    var mGold = std(0xdba545, { metalness: 1, roughness: 0.28, envMapIntensity: 1 });
    var mSilicon = std(0x2b2e3b, { metalness: 0.65, roughness: 0.35, envMapIntensity: 0.4 });
    var mCeramic = std(0xd9d3da, { roughness: 0.85 });
    var mGlass = glassy(0xe6f0f4, 0.13);
    var mTube = std(0xf0a9bd, { roughness: 0.35, transparent: true, opacity: 0.72 });

    // =======================================================================
    // Optical breadboard (scale reference, not a part): tapped holes on a 25 mm grid
    // =======================================================================
    (function () {
      var g = new THREE.Group();
      g.name = 'breadboard';
      root.add(g);
      var slab = add(g, box(130, 4, 130), std(0x121015, { metalness: 0.25, roughness: 0.85, envMapIntensity: 0.06 }), 0, -4.4, 0);
      slab.userData.noPick = true;
      var holes = new THREE.InstancedMesh(cyl(3, 0.06, 28), std(0x050406, { roughness: 0.9 }), 25);
      var rings = new THREE.InstancedMesh(new THREE.TorusGeometry(3.05, 0.14, 8, 32), std(0x2a2630, { metalness: 0.6, roughness: 0.5, envMapIntensity: 0.15 }), 25);
      var m = new THREE.Matrix4();
      var q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
      var one = new THREE.Vector3(1, 1, 1);
      var n = 0;
      for (var i = -2; i <= 2; i++)
        for (var j = -2; j <= 2; j++) {
          m.makeTranslation(i * 25, -2.38, j * 25);
          holes.setMatrixAt(n, m);
          m.compose(new THREE.Vector3(i * 25, -2.4, j * 25), q, one);
          rings.setMatrixAt(n, m);
          n++;
        }
      holes.userData.noPick = rings.userData.noPick = true;
      g.add(holes, rings);
      // 10 mm scale bar beside the carrier
      var barMat = std(0xf3eef2, { roughness: 0.6, emissive: 0x554f55 });
      [
        [0.5, 10, 27, 1],
        [1.6, 0.25, 27, -4],
        [1.6, 0.25, 27, 6],
      ].forEach(function (b) {
        add(g, box(b[0], 0.12, b[1]), barMat, b[2], -2.3, b[3]).userData.noPick = true;
      });
      function atRest() {
        return explode < 0.05 && !todayOn;
      }
      anchors.scale = { obj: anchor(g, 29.2, -2.2, 1), side: 0, quiet: true, when: atRest };
      // what exists today, at true size: the largest electrode array in use and one organoid
      add(g, box(4.4, 0.1, 6.4), std(0xd9d3da, { roughness: 0.85 }), 27, -2.35, 12.5).userData.noPick = true;
      add(g, box(2.1, 0.06, 3.85), std(0xdba545, { metalness: 1, roughness: 0.3 }), 27, -2.27, 12.5).userData.noPick = true;
      add(g, new THREE.SphereGeometry(0.25, 16, 12), std(0xf5a7bd, { roughness: 0.6 }), 27, -2.15, 17.2).userData.noPick = true;
      anchors.ref = { obj: anchor(g, 30.2, -2.2, 13), side: 0, quiet: true, when: atRest };
    })();

    // the box that keeps a culture alive today (about 0.3 m long; exact size unpublished)
    var todayBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(box(300, 200, 200)),
      new THREE.LineBasicMaterial({ color: 0xcdbfd1, transparent: true, opacity: 0.75 })
    );
    todayBox.position.set(0, 100 - 6.4, 0);
    todayBox.visible = false;
    todayBox.userData.noPick = todayBox.userData.exportSkip = true;
    root.add(todayBox);
    anchors.today = { obj: anchor(root, -150, 193.6, 100), side: 0, quiet: true, when: function () { return todayOn; } };

    // =======================================================================
    // Carrier board + control silicon
    // =======================================================================
    var gBoard = part('board', [0, 0, 0]);
    var mTrace = std(0x8a6a2c, { metalness: 1, roughness: 0.35, emissive: cGold, emissiveIntensity: 0 });
    (function () {
      var pcb = add(gBoard, box(46, 1.2, 36), std(0x12332f, { roughness: 0.6, metalness: 0.1, envMapIntensity: 0.15 }), 0, -1.8, 0);
      outline(pcb, 0x2f6a61, 0.5);
      var cs = [
        [-21.4, -16.4],
        [21.4, -16.4],
        [-21.4, 16.4],
        [21.4, 16.4],
      ];
      cs.forEach(function (c) {
        add(gBoard, cyl(1.15, 0.55, 20), mSteel, c[0], -1.0, c[1]);
      });
      // bus traces: control silicon -> electrode array package (L-shaped, non-crossing)
      for (var i = 0; i < 9; i++) {
        var tz = -12.6 + i * 0.5;
        var tx = 1.2 + i * 0.9;
        add(gBoard, box(11.8 - tx, 0.03, 0.22), mTrace, (tx + 11.8) / 2, -1.185, tz).userData.noPick = true;
        add(gBoard, box(0.22, 0.03, -9 - tz), mTrace, tx, -1.185, (tz - 9) / 2).userData.noPick = true;
      }
      // traces toward the laser driver
      for (var j = 0; j < 4; j++) {
        var lz = -14.3 - j * 0.45;
        add(gBoard, box(26.5, 0.03, 0.22), mTrace, -0.7, -1.185, lz).userData.noPick = true;
        add(gBoard, box(0.22, 0.03, -13.7 - lz), mTrace, 12.55, -1.185, (lz - 13.7) / 2).userData.noPick = true;
      }
      label('board', gBoard, 22.6, -1.2, 12, 1);
    })();

    var gAsic = part('asic', [0, 0, 0]);
    var mAsicLid = std(0x30323d, { metalness: 0.7, roughness: 0.3, emissive: cGold, emissiveIntensity: 0 });
    (function () {
      add(gAsic, box(8, 0.5, 8), std(0x1f5a4f, { roughness: 0.6 }), 15, -0.95, -10.5);
      add(gAsic, box(6.4, 0.75, 6.4), mAsicLid, 15, -0.35, -10.5);
      for (var i = 0; i < 7; i++) {
        add(gAsic, box(0.9, 0.5, 0.5), std(0x8f7a5a, { roughness: 0.6 }), 10 + (i % 4) * 1.5, -0.95, -4.4 - Math.floor(i / 4) * 1.1).userData.noPick = true;
      }
      // laser driver near the post
      add(gAsic, box(3.2, 0.7, 3.2), mAsicLid, -15.5, -0.85, -12.5);
      label('asic', gAsic, 18.2, 0.1, -10.5, 1);
    })();

    // =======================================================================
    // Thermal stage (37 C)
    // =======================================================================
    var gThermal = part('thermal', [0, 2.5, 0]);
    (function () {
      var ringGeo = plate(22.6, 18.5, false, 0.5);
      var m = add(gThermal, ringGeo, std(0xb9703a, { metalness: 1, roughness: 0.38 }), 0, -1.2, 0);
      outline(m, 0xe8a070, 0.35);
      add(gThermal, box(1.2, 0.5, 0.8), std(0x222027, { roughness: 0.6 }), -10.2, -0.55, 6);
      label('thermal', gThermal, -11.3, -0.7, 9.5, -1);
    })();

    // =======================================================================
    // HD microelectrode array
    // =======================================================================
    var gMea = part('mea', [0, 5.5, 0]);
    var EL_G = 40;
    var EL_PITCH = 0.3;
    var electrodes;
    var elecGlow = new Float32Array(EL_G * EL_G);
    (function () {
      var pkg = add(gMea, box(18, 0.6, 18), mCeramic, 0, -0.9, 0);
      outline(pkg, 0x8e8790, 0.4);
      var die = add(gMea, box(14, 0.6, 14), mSilicon, 0, -0.3, 0);
      outline(die, 0x6d7390, 0.5);
      var area = add(gMea, box(12.3, 0.02, 12.3), std(0x1b2433, { metalness: 0.5, roughness: 0.35 }), 0, 0.005, 0);
      area.userData.noPick = true;
      electrodes = new THREE.InstancedMesh(cyl(0.085, 0.03, 10), std(0xffffff, { metalness: 1, roughness: 0.3, envMapIntensity: 1 }), EL_G * EL_G);
      var m = new THREE.Matrix4();
      var c = new THREE.Color();
      var n = 0;
      for (var i = 0; i < EL_G; i++)
        for (var j = 0; j < EL_G; j++) {
          m.makeTranslation((i - (EL_G - 1) / 2) * EL_PITCH, 0.03, (j - (EL_G - 1) / 2) * EL_PITCH);
          electrodes.setMatrixAt(n, m);
          electrodes.setColorAt(n, c.copy(cGold));
          n++;
        }
      electrodes.userData.noPick = true;
      electrodes.userData.exportName = 'electrodes';
      gMea.add(electrodes);
      // bond pads on the package rim
      var pads = new THREE.InstancedMesh(box(0.3, 0.05, 0.7), mGold, 4 * 26);
      var q = new THREE.Quaternion();
      var one = new THREE.Vector3(1, 1, 1);
      n = 0;
      for (var s = 0; s < 4; s++)
        for (var k = 0; k < 26; k++) {
          var t = (k - 12.5) * 0.52;
          var ang = (s * Math.PI) / 2;
          q.setFromAxisAngle(_up, ang);
          var p = new THREE.Vector3(t, -0.575, 8.0).applyQuaternion(q);
          m.compose(p, q, one);
          pads.setMatrixAt(n++, m);
        }
      pads.userData.noPick = true;
      gMea.add(pads);
      label('mea', gMea, 9, -0.6, 7.5, 1);
    })();

    // =======================================================================
    // Neural tissue slab: somata, neurites, glow halos
    // =======================================================================
    var gTissue = part('tissue', [0, 10, 0]);
    var SLAB = { w: 12, h: 2.0, y0: 0.06 };
    var N = opts.neurons || 2400;
    var px = new Float32Array(N);
    var py = new Float32Array(N);
    var pz = new Float32Array(N);
    var inhib = new Uint8Array(N);
    var glowN = new Float32Array(N);
    var refr = new Uint8Array(N);
    var forced = new Uint8Array(N);
    var elecOf = new Int32Array(N);
    var gridOf = new Uint16Array(N);
    var cellOf = new Int16Array(N); // page cell this soma sits under, or -1
    var HUD_G = 24;
    var activityGrid = new Float32Array(HUD_G * HUD_G);
    var outStart = new Uint32Array(N + 1);
    var eTo, eDelay, eGlow, E;
    var inbox = [new Int8Array(N), new Int8Array(N), new Int8Array(N), new Int8Array(N)];
    var head = 0;
    var somaMesh, haloPts, edgeLines, landQuad;
    var haloCol, edgeCol;
    var baseNaive = [];
    var baseExpr = [];
    (function () {
      var r = mulberry(7);
      var i, j;
      var half = SLAB.w / 2 - 0.2;
      for (i = 0; i < N; i++) {
        px[i] = (r() * 2 - 1) * half;
        pz[i] = (r() * 2 - 1) * half;
        py[i] = SLAB.y0 + 0.08 + r() * (SLAB.h - 0.2);
        inhib[i] = r() < 0.2 ? 1 : 0;
        var ei = Math.min(EL_G - 1, Math.max(0, Math.round(px[i] / EL_PITCH + (EL_G - 1) / 2)));
        var ej = Math.min(EL_G - 1, Math.max(0, Math.round(pz[i] / EL_PITCH + (EL_G - 1) / 2)));
        elecOf[i] = py[i] < 0.75 ? ei * EL_G + ej : -1;
        var gx = Math.min(HUD_G - 1, Math.floor(((px[i] + SLAB.w / 2) / SLAB.w) * HUD_G));
        var gz = Math.min(HUD_G - 1, Math.floor(((pz[i] + SLAB.w / 2) / SLAB.w) * HUD_G));
        gridOf[i] = gz * HUD_G + gx;
        var span = 11.2;
        var u = (px[i] + span / 2) / span;
        var v = (pz[i] + span / 2) / span;
        cellOf[i] = -1;
        if (u >= 0 && u < 1 && v >= 0 && v < 1) {
          var cx = Math.floor(u * PAGE_G);
          var cy = Math.floor(v * PAGE_G);
          var du = u * PAGE_G - cx - 0.5;
          var dv = v * PAGE_G - cy - 0.5;
          if (du * du + dv * dv < 0.16) cellOf[i] = cy * PAGE_G + cx;
        }
      }
      // spatial hash for local wiring
      var CS = 1.2;
      var GW = Math.ceil(SLAB.w / CS);
      var buckets = [];
      for (i = 0; i < GW * GW; i++) buckets.push([]);
      function bucket(x, z) {
        var bx = Math.min(GW - 1, Math.max(0, Math.floor((x + SLAB.w / 2) / CS)));
        var bz = Math.min(GW - 1, Math.max(0, Math.floor((z + SLAB.w / 2) / CS)));
        return bz * GW + bx;
      }
      for (i = 0; i < N; i++) buckets[bucket(px[i], pz[i])].push(i);
      var to = [];
      var delay = [];
      for (i = 0; i < N; i++) {
        outStart[i] = to.length;
        var b = bucket(px[i], pz[i]);
        var bx = b % GW;
        var bz = (b / GW) | 0;
        var cand = [];
        for (var dz = -1; dz <= 1; dz++)
          for (var dx = -1; dx <= 1; dx++) {
            var xx = bx + dx;
            var zz = bz + dz;
            if (xx < 0 || zz < 0 || xx >= GW || zz >= GW) continue;
            var list = buckets[zz * GW + xx];
            for (j = 0; j < list.length; j++) {
              var o = list[j];
              if (o === i) continue;
              var ddx = px[o] - px[i];
              var ddy = py[o] - py[i];
              var ddz = pz[o] - pz[i];
              if (ddx * ddx + ddy * ddy + ddz * ddz < 2.0) cand.push(o);
            }
          }
        var want = Math.min(3, cand.length);
        for (j = 0; j < want; j++) {
          var pick = (r() * cand.length) | 0;
          to.push(cand[pick]);
          delay.push(1 + ((r() * 2) | 0));
          cand.splice(pick, 1);
        }
        if (r() < 0.16) {
          to.push((r() * N) | 0); // long-range projection
          delay.push(3);
        }
      }
      outStart[N] = to.length;
      E = to.length;
      eTo = new Uint16Array(to);
      eDelay = new Uint8Array(delay);
      eGlow = new Float32Array(E);

      // gel body
      var gel = add(gTissue, box(SLAB.w, SLAB.h, SLAB.w), glassy(0xf5a7bd, 0.1, { roughness: 0.4 }), 0, SLAB.y0 + SLAB.h / 2, 0);
      gel.renderOrder = 1;
      outline(gel, 0xf7b7c9, 0.42);

      // somata
      var soma = new THREE.IcosahedronGeometry(0.088, 1);
      somaMesh = new THREE.InstancedMesh(soma, std(0xffffff, { roughness: 0.85, envMapIntensity: 0.08 }), N);
      var m = new THREE.Matrix4();
      var cN = new THREE.Color(0x6f6a75);
      var cE = new THREE.Color(0xc4607f);
      var cI = new THREE.Color(0x6b74d6);
      for (i = 0; i < N; i++) {
        var s = inhib[i] ? 0.85 : 1 + (r() - 0.5) * 0.3;
        m.makeScale(s, s, s);
        m.setPosition(px[i], py[i], pz[i]);
        somaMesh.setMatrixAt(i, m);
        somaMesh.setColorAt(i, cN);
        baseNaive.push(cN.r, cN.g, cN.b);
        var c = inhib[i] ? cI : cE;
        baseExpr.push(c.r, c.g, c.b);
      }
      somaMesh.userData.noPick = true;
      somaMesh.userData.exportName = 'somata';
      gTissue.add(somaMesh);

      // neurites
      var pos = new Float32Array(E * 6);
      edgeCol = new Float32Array(E * 6);
      var e = 0;
      for (i = 0; i < N; i++)
        for (j = outStart[i]; j < outStart[i + 1]; j++, e++) {
          var t = eTo[j];
          pos.set([px[i], py[i], pz[i], px[t], py[t], pz[t]], e * 6);
        }
      var eg = new THREE.BufferGeometry();
      eg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      eg.setAttribute('color', new THREE.BufferAttribute(edgeCol, 3));
      edgeLines = new THREE.LineSegments(
        eg,
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
      );
      edgeLines.renderOrder = 8;
      edgeLines.userData.noPick = true;
      edgeLines.userData.exportName = 'neurites';
      gTissue.add(edgeLines);

      // halos
      var hp = new Float32Array(N * 3);
      haloCol = new Float32Array(N * 3);
      for (i = 0; i < N; i++) hp.set([px[i], py[i], pz[i]], i * 3);
      var hg = new THREE.BufferGeometry();
      hg.setAttribute('position', new THREE.BufferAttribute(hp, 3));
      hg.setAttribute('color', new THREE.BufferAttribute(haloCol, 3));
      var disc = canvasTex(64, function (ctx, s) {
        var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      });
      haloPts = new THREE.Points(
        hg,
        new THREE.PointsMaterial({
          size: 1.05,
          map: disc,
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
          sizeAttenuation: true,
        })
      );
      haloPts.renderOrder = 9;
      haloPts.userData.noPick = true;
      haloPts.userData.exportSkip = true;
      gTissue.add(haloPts);

      // pattern landing on the tissue surface during the optical write
      landQuad = add(gTissue, new THREE.PlaneGeometry(11.2, 11.2).rotateX(-Math.PI / 2), glow(cPage), 0, SLAB.y0 + SLAB.h + 0.03, 0);
      landQuad.renderOrder = 12;
      landQuad.userData.noPick = landQuad.userData.exportSkip = true;

      label('tissue', gTissue, -6, 1.3, 6, -1);
    })();

    // =======================================================================
    // Perfusion capillaries through the slab
    // =======================================================================
    var gPerf = part('perfusion', [0, 10, 0]);
    var flowCurves = [];
    var flowDots;
    (function () {
      var zs = [-4.2, -2.1, 0, 2.1, 4.2];
      zs.forEach(function (z, k) {
        var pts = [];
        for (var i = 0; i <= 8; i++) {
          var x = -6.6 + (13.2 * i) / 8;
          pts.push([x, 1.05 + Math.sin(i * 1.3 + k) * 0.22, z + Math.cos(i * 0.9 + k * 2) * 0.28]);
        }
        var g = tube(pts, 0.11, 60, 7);
        flowCurves.push(g.userData.curve);
        add(gPerf, g, mTube);
      });
      add(gPerf, tube([[-6.6, 1.05, -4.6], [-6.6, 1.05, 4.6]], 0.2, 8, 8), mTube);
      add(gPerf, tube([[6.6, 1.05, -4.6], [6.6, 1.05, 4.6]], 0.2, 8, 8), mTube);
      add(gPerf, tube([[-7.9, 1.4, -3], [-7.1, 1.25, -3], [-6.6, 1.05, -3]], 0.2, 10, 8), mTube);
      add(gPerf, tube([[7.9, 1.4, 3], [7.1, 1.25, 3], [6.6, 1.05, 3]], 0.2, 10, 8), mTube);
      flowDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), std(0xffe3ec, { emissive: cMedium, emissiveIntensity: 0.9, roughness: 0.4 }), 30);
      flowDots.userData.noPick = flowDots.userData.exportSkip = true;
      gPerf.add(flowDots);
      label('perfusion', gPerf, 6.6, 1.05, -4.6, 1);
    })();

    // =======================================================================
    // Culture chamber + medium
    // =======================================================================
    var gChamber = part('chamber', [0, 15, 0]);
    (function () {
      var wallGeoX = box(16.4, 3.8, 0.6);
      var wallGeoZ = box(0.6, 3.8, 15.2);
      [
        [wallGeoX, 0, 1.3, 7.9],
        [wallGeoX, 0, 1.3, -7.9],
        [wallGeoZ, 7.9, 1.3, 0],
        [wallGeoZ, -7.9, 1.3, 0],
      ].forEach(function (w) {
        var m = add(gChamber, w[0], mGlass, w[1], w[2], w[3]);
        m.renderOrder = 3;
        m.userData.shell = true; // see-through: a click passes to whatever is behind
        outline(m, 0xcfe3ea, 0.35);
      });
      var med = add(gChamber, box(15.1, 3.0, 15.1), glassy(cMedium, 0.085, { roughness: 0.2 }), 0, 1.55, 0);
      med.renderOrder = 2;
      med.userData.noPick = true;
      var port = cyl(0.42, 1.6, 16);
      var p1 = add(gChamber, port, mSteel, -8.3, 1.4, -3);
      p1.rotation.z = Math.PI / 2;
      var p2 = add(gChamber, port, mSteel, 8.3, 1.4, 3);
      p2.rotation.z = Math.PI / 2;
      label('chamber', gChamber, -8.2, 3.0, -7.9, -1);
    })();

    // =======================================================================
    // Optical window (0.17 mm coverslip)
    // =======================================================================
    var gWindow = part('window', [0, 19, 0]);
    (function () {
      var w = add(gWindow, box(16.4, 0.17, 16.4), glassy(0xe9f6fb, 0.16), 0, 3.285, 0);
      w.renderOrder = 4;
      w.userData.shell = true;
      outline(w, 0xd8eef6, 0.55);
      label('window', gWindow, 8.2, 3.3, 8.2, 1);
    })();

    // =======================================================================
    // Excitation ring (indicator excitation light)
    // =======================================================================
    var gRing = part('ring', [0, 22, 0]);
    var mLed = std(0x16324f, { emissive: cExcite, emissiveIntensity: 0.15, roughness: 0.4 });
    (function () {
      var t = add(gRing, new THREE.TorusGeometry(6.9, 0.34, 10, 64), mAnod, 0, 4.5, 0);
      t.rotation.x = Math.PI / 2;
      for (var i = 0; i < 12; i++) {
        var a = (i / 12) * Math.PI * 2;
        var led = add(gRing, box(0.55, 0.22, 0.55), mLed, Math.cos(a) * 6.9, 4.18, Math.sin(a) * 6.9);
        led.rotation.y = -a;
        led.userData.noPick = true;
      }
      spider(gRing, 4.5, 7.2, mAnod);
      label('ring', gRing, -6.9, 4.5, 0, -1);
    })();

    // =======================================================================
    // Projection lens array
    // =======================================================================
    var gLens = part('lens', [0, 25, 0]);
    (function () {
      var p = add(gLens, box(13, 0.5, 13), glassy(0xe4f1ff, 0.14), 0, 6.3, 0);
      p.renderOrder = 4;
      p.userData.shell = true;
      outline(p, 0xcfe2ff, 0.5);
      var G = 18;
      var pitch = 12.4 / G;
      var lenslet = new THREE.SphereGeometry(pitch * 0.47, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      lenslet.scale(1, 0.55, 1);
      var inst = new THREE.InstancedMesh(lenslet, glassy(0xf2f8ff, 0.2, { roughness: 0.02 }), G * G);
      var m = new THREE.Matrix4();
      var n = 0;
      for (var i = 0; i < G; i++)
        for (var j = 0; j < G; j++) {
          m.makeTranslation((i - (G - 1) / 2) * pitch, 6.55, (j - (G - 1) / 2) * pitch);
          inst.setMatrixAt(n++, m);
        }
      inst.renderOrder = 5;
      inst.userData.noPick = true;
      inst.userData.exportName = 'lenslets';
      gLens.add(inst);
      var frame = add(gLens, plate(14.4, 13.05, false, 0.5), mAnod, 0, 6.05, 0);
      spider(gLens, 6.3, 10.1, mAnod);
      label('lens', gLens, 7.2, 6.3, 7.2, 1);
    })();

    // =======================================================================
    // Dichroic splitter cube
    // =======================================================================
    var gDichroic = part('dichroic', [0, 29, 0]);
    var DY = 12.5;
    (function () {
      var c = add(gDichroic, box(9, 9, 9), glassy(0xeaf4ff, 0.1), 0, DY, 0);
      c.renderOrder = 6;
      outline(c, 0xd5e6ff, 0.6);
      var g = new THREE.BufferGeometry();
      var h = 4.45;
      g.setAttribute('position', new THREE.Float32BufferAttribute([-h, -h, -h, h, h, -h, h, h, h, -h, -h, h], 3));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      var coat = add(
        gDichroic,
        g,
        new THREE.MeshPhysicalMaterial({ color: 0xff86d8, metalness: 0.55, roughness: 0.08, transparent: true, opacity: 0.46, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 0.6 }),
        0,
        DY,
        0
      );
      coat.renderOrder = 7;
      coat.userData.noPick = true;
      spider(gDichroic, DY - 4.2, 6.4, mAnod);
      spider(gDichroic, DY + 4.2, 6.4, mAnod);
      label('dichroic', gDichroic, -4.5, DY + 1.5, 4.5, -1);
    })();

    // =======================================================================
    // Read-out imager (tube lens + sensor)
    // =======================================================================
    var gSensor = part('sensor', [9, 29, 0]);
    var mSensorDie = std(0x0c1512, { roughness: 0.3, metalness: 0.4, emissive: cFluor, emissiveIntensity: 0 });
    (function () {
      var lens = add(gSensor, new THREE.SphereGeometry(3.0, 28, 18), glassy(0xe6f3ff, 0.22), 7.4, DY, 0);
      lens.scale.set(0.26, 1, 1);
      lens.renderOrder = 6;
      var r1 = add(gSensor, new THREE.TorusGeometry(3.1, 0.3, 10, 40), mAnod, 7.4, DY, 0);
      r1.rotation.y = Math.PI / 2;
      for (var i = 0; i < 4; i++) {
        var a = Math.PI / 4 + (i * Math.PI) / 2;
        var rod = add(gSensor, cyl(0.18, 6.2, 8), mSteel, 7.6, DY + Math.cos(a) * 3.1, Math.sin(a) * 3.1);
        rod.rotation.z = Math.PI / 2;
        rod.userData.noPick = true;
      }
      var body = add(gSensor, box(4.6, 8.4, 8.4), mAnod, 13, DY, 0);
      outline(body, 0x56505e, 0.6);
      var die = add(gSensor, box(0.08, 5.4, 5.4), mSensorDie, 10.66, DY, 0);
      die.userData.noPick = true;
      for (var k = 0; k < 6; k++) add(gSensor, box(0.9, 7.6, 0.35), mAnod, 15.7, DY, -3 + k * 1.2).userData.noPick = true;
      var flex = add(
        gSensor,
        ribbon(
          [
            [13, DY - 4.2, 0],
            [13.6, 4, -1],
            [14.5, 0.4, -4],
            [15, -1.1, -6.6],
          ],
          3,
          [1, 0, 0]
        ),
        std(0x7a5220, { roughness: 0.6, metalness: 0.2, envMapIntensity: 0.1, side: THREE.DoubleSide })
      );
      flex.userData.noPick = true;
      label('sensor', gSensor, 15.3, DY + 4.2, 0, 1);
    })();

    // =======================================================================
    // Relay lens
    // =======================================================================
    var gRelay = part('relay', [0, 34, 0]);
    (function () {
      var l = add(gRelay, new THREE.SphereGeometry(4.5, 36, 20), glassy(0xe6f3ff, 0.22), 0, 19.5, 0);
      l.scale.set(1, 0.26, 1);
      l.renderOrder = 6;
      var t = add(gRelay, new THREE.TorusGeometry(4.6, 0.32, 10, 48), mAnod, 0, 19.5, 0);
      t.rotation.x = Math.PI / 2;
      spider(gRelay, 19.5, 4.9, mAnod);
      label('relay', gRelay, 4.6, 19.5, 0, 1);
    })();

    // =======================================================================
    // Holographic memory crystal
    // =======================================================================
    var gCrystal = part('crystal', [0, 39, 0]);
    var CY = 26.5;
    var pageMeshes = [];
    var pageTex = [];
    var pagePatterns = [];
    var pageFan;
    (function () {
      var c = add(
        gCrystal,
        box(10, 10, 10),
        new THREE.MeshPhysicalMaterial({ color: 0xe8922a, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false }),
        0,
        CY,
        0
      );
      c.renderOrder = 6;
      outline(c, 0xffc57a, 0.75);
      pageFan = new THREE.Group();
      pageFan.position.set(0, CY, 0);
      gCrystal.add(pageFan);
      for (var k = 0; k < PAGE_COUNT; k++) {
        var pat = PWC.pagePattern(k);
        pagePatterns.push(pat);
        var tex = (function (pat) {
          return canvasTex(128, function (ctx, s) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, s, s);
            var cell = s / PAGE_G;
            ctx.fillStyle = '#fff';
            for (var y = 0; y < PAGE_G; y++)
              for (var x = 0; x < PAGE_G; x++)
                if (pat[y * PAGE_G + x]) {
                  ctx.beginPath();
                  ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, cell * 0.36, 0, Math.PI * 2);
                  ctx.fill();
                }
          });
        })(pat);
        pageTex.push(tex);
        var pm = add(pageFan, new THREE.PlaneGeometry(8.2, 8.2).rotateX(-Math.PI / 2), glow(0xffb45a, { map: tex }), 0, 0, 0);
        pm.rotation.z = ((k - (PAGE_COUNT - 1) / 2) * 5.2 * Math.PI) / 180;
        pm.renderOrder = 7;
        pm.userData.noPick = pm.userData.exportSkip = true;
        pageMeshes.push(pm);
      }
      var seat = add(gCrystal, plate(12.4, 7.4, false, 0.5), mAnod, 0, CY - 5.5, 0);
      seat.userData.noPick = true;
      spider(gCrystal, CY - 5.25, 8.7, mAnod);
      label('crystal', gCrystal, 5, CY + 2, 5, 1);
    })();

    // =======================================================================
    // Reference laser + steering mirror
    // =======================================================================
    var gLaser = part('laser', [-9, 39, 0]);
    var mirrorPivot;
    var LX = -11.5;
    (function () {
      add(gLaser, cyl(0.6, 30.4, 16), mSteel, -15, 14, 0);
      add(gLaser, cyl(2.1, 0.7, 28), mAnod, -15, -0.85, 0);
      var body = add(gLaser, cyl(1.7, 6, 28), std(0x2a2730, { metalness: 0.8, roughness: 0.35 }), LX, 18.5, 0);
      outline(body, 0x5a5560, 0.4);
      add(gLaser, cyl(1.1, 1, 24), mSteel, LX, 22, 0);
      add(gLaser, box(3.4, 1.1, 1.8), mAnod, -13.4, 18.5, 0);
      add(gLaser, box(3.4, 1.1, 1.8), mAnod, -13.4, CY + 1.2, 0);
      mirrorPivot = new THREE.Group();
      mirrorPivot.position.set(LX, CY, 0);
      gLaser.add(mirrorPivot);
      var tilt = new THREE.Group();
      tilt.rotation.z = Math.PI / 4; // local +y -> (-1, 1, 0)/sqrt2, the mirror's back normal
      mirrorPivot.add(tilt);
      add(tilt, cyl(1.55, 0.22, 32), std(0xf2f4f8, { metalness: 1, roughness: 0.04 }), 0, 0, 0);
      add(tilt, cyl(1.75, 0.5, 32), mAnod, 0, 0.36, 0);
      add(tilt, box(1.4, 1.2, 1.4), mAnod, 0, 1.1, 0);
      label('laser', gLaser, LX - 1.7, 18.5, 0, -1);
    })();

    // =======================================================================
    // Page composer (SLM write head)
    // =======================================================================
    var gSlm = part('slm', [0, 45, 0]);
    var SY = 34.6;
    var mSlmFace = glow(cRecord, { map: null });
    (function () {
      var pk = add(gSlm, box(12, 1.4, 12), std(0x24222a, { metalness: 0.5, roughness: 0.5 }), 0, SY + 0.7, 0);
      outline(pk, 0x5d5866, 0.6);
      add(gSlm, box(9.4, 0.5, 9.4), mSilicon, 0, SY - 0.25, 0);
      var face = add(gSlm, new THREE.PlaneGeometry(8.2, 8.2).rotateX(-Math.PI / 2), mSlmFace, 0, SY - 0.52, 0);
      face.userData.noPick = face.userData.exportSkip = true;
      for (var k = 0; k < 7; k++) add(gSlm, box(10.5, 0.9, 0.3), mAnod, 0, SY + 1.85, -3.6 + k * 1.2).userData.noPick = true;
      var flex = add(
        gSlm,
        ribbon(
          [
            [0, SY + 0.6, -6],
            [0, SY - 1, -11],
            [0, 20, -14.5],
            [0, 4, -16],
            [0, -1.1, -16.4],
          ],
          3,
          [1, 0, 0]
        ),
        std(0x7a5220, { roughness: 0.6, metalness: 0.2, envMapIntensity: 0.1, side: THREE.DoubleSide })
      );
      flex.userData.noPick = true;
      spider(gSlm, SY + 0.4, 8.5, mAnod);
      label('slm', gSlm, -6, SY + 0.7, 6, -1);
    })();

    // =======================================================================
    // Life-support loop: reservoir, pump, gas exchanger, tubing
    // =======================================================================
    var gLife = part('lifesupport', [-10, 0, 9]);
    var feedCurve;
    var feedDots;
    var pumpRotor;
    (function () {
      var vial = add(gLife, cyl(2.7, 8, 32), glassy(0xe6f0f4, 0.2), -17.5, 2.8, 11);
      vial.renderOrder = 3;
      outline(vial, 0xcfe3ea, 0.3);
      var fill = add(gLife, cyl(2.45, 5.2, 32), glassy(cMedium, 0.5, { roughness: 0.2 }), -17.5, 1.5, 11);
      fill.renderOrder = 2;
      fill.userData.noPick = true;
      add(gLife, cyl(2.85, 0.9, 32), mAnod, -17.5, 7.2, 11);
      var pump = add(gLife, box(5, 3.4, 5), std(0x2a2730, { metalness: 0.5, roughness: 0.5 }), -17.5, 0.5, 4.8);
      outline(pump, 0x5d5866, 0.5);
      pumpRotor = add(gLife, cyl(1.7, 0.5, 6), mSteel, -17.5, 2.45, 4.8);
      // gas exchanger: silicone coil around a core
      add(gLife, cyl(1.1, 6.4, 20), std(0x3a3640, { metalness: 0.6, roughness: 0.5 }), -17.5, 2, -4.5);
      var coil = [];
      for (var i = 0; i <= 72; i++) {
        var a = (i / 72) * Math.PI * 12;
        coil.push([-17.5 + Math.cos(a) * 1.75, -0.6 + (i / 72) * 5.2, -4.5 + Math.sin(a) * 1.75]);
      }
      add(gLife, tube(coil, 0.26, 220, 7), mTube);
      // feed: reservoir -> pump -> exchanger -> chamber inlet
      var feed = tube(
        [
          [-17.5, 7.6, 11],
          [-17.5, 9.4, 8.6],
          [-17.5, 4.4, 5.6],
          [-17.6, 2.7, 4.8],
          [-18.2, 2.2, 0.6],
          [-17.6, 4.9, -2.9],
          [-15.2, 5.3, -4.4],
          [-12, 2.6, -3.4],
          [-9.1, 1.4, -3],
        ],
        0.24,
        90,
        8
      );
      feedCurve = feed.userData.curve;
      add(gLife, feed, mTube);
      // return: chamber outlet -> around the front -> reservoir
      add(
        gLife,
        tube(
          [
            [9.1, 1.4, 3],
            [12.6, 0.2, 6],
            [12.2, -0.7, 13.6],
            [-4, -0.7, 15.4],
            [-12.5, -0.4, 14.4],
            [-15.6, 3, 12.6],
            [-16.6, 7.6, 11.6],
          ],
          0.24,
          110,
          8
        ),
        mTube
      );
      feedDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), std(0xffe3ec, { emissive: cMedium, emissiveIntensity: 0.9 }), 10);
      feedDots.userData.noPick = feedDots.userData.exportSkip = true;
      gLife.add(feedDots);
      label('lifesupport', gLife, -17.5, 7.6, 11, -1);
    })();

    // =======================================================================
    // Cage rods (structure; stretch with the exploded view)
    // =======================================================================
    var rods = [];
    (function () {
      var g = new THREE.Group();
      g.name = 'cage';
      root.add(g);
      var geo = cyl(0.42, 1, 14);
      geo.translate(0, 0.5, 0);
      [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ].forEach(function (s) {
        var r = add(g, geo, mSteel, s[0] * ROD, -1.2, s[1] * ROD);
        r.userData.noPick = true;
        rods.push(r);
      });
    })();

    // =======================================================================
    // Digital teacher model (only shown while imprinting)
    // =======================================================================
    var teacher = new THREE.Group();
    var teacherMats = [];
    (function () {
      teacher.name = 'teacher';
      teacher.position.set(20, 33, -2);
      teacher.rotation.y = -0.5;
      teacher.userData.exportSkip = true;
      root.add(teacher);
      var r = mulberry(99);
      for (var k = 0; k < 6; k++) {
        var tex = canvasTex(64, function (ctx, s) {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, s, s);
          var n = 16;
          var c = s / n;
          for (var y = 0; y < n; y++)
            for (var x = 0; x < n; x++) {
              var v = r();
              var w = Math.pow(v, 3);
              ctx.fillStyle = v > 0.5 ? 'rgba(255,170,200,' + w + ')' : 'rgba(150,170,255,' + w * 0.9 + ')';
              ctx.fillRect(x * c + 0.5, y * c + 0.5, c - 1, c - 1);
            }
        });
        var m = glow(0xffffff, { map: tex });
        teacherMats.push(m);
        var q = add(teacher, new THREE.PlaneGeometry(7, 7), m, 0, 0, (k - 2.5) * 1.5);
        q.userData.noPick = true;
      }
      anchors.teacher = { obj: anchor(teacher, 0, 4.2, 0), side: 1, quiet: true, when: function () { return teacher.visible && !todayOn; } };
    })();

    // =======================================================================
    // Light paths
    // =======================================================================
    var aLaserOut = anchor(gLaser, LX, 22.5, 0);
    var aMirror = anchor(gLaser, LX, CY, 0);
    var aRefIn = anchor(gCrystal, -5, CY, 0);
    var aRefOut = anchor(gCrystal, 5, CY, 0);
    var aCrysBot = anchor(gCrystal, 0, CY - 5, 0);
    var aCrysTop = anchor(gCrystal, 0, CY + 5, 0);
    var aSlmFace = anchor(gSlm, 0, SY - 0.5, 0);
    var aRelay = anchor(gRelay, 0, 19.5, 0);
    var aDichroic = anchor(gDichroic, 0, DY, 0);
    var aLens = anchor(gLens, 0, 6.3, 0);
    var aTissueTop = anchor(gTissue, 0, SLAB.y0 + SLAB.h, 0);
    var aRing = anchor(gRing, 0, 4.2, 0);
    var aTube = anchor(gSensor, 7.4, DY, 0);
    var aSensor = anchor(gSensor, 10.6, DY, 0);

    var bRefA = new Beam(aLaserOut, aMirror, 0.22, 0.22, cPage, false, 0.85);
    var bRefB = new Beam(aMirror, aRefIn, 0.22, 0.26, cPage, false, 0.85);
    var bRefC = new Beam(aRefIn, aRefOut, 0.26, 0.3, cPage, false, 0.4);
    var bPageA = new Beam(aCrysBot, aRelay, 3.0, 3.3, cPage, true, 0.2);
    var bPageB = new Beam(aRelay, aLens, 3.3, 4.6, cPage, true, 0.2);
    var bPageC = new Beam(aLens, aTissueTop, 4.6, 5.6, cPage, true, 0.24);
    var bFluA = new Beam(aTissueTop, aLens, 5.4, 4.4, cFluor, false, 0.16);
    var bFluB = new Beam(aLens, aDichroic, 4.4, 2.9, cFluor, false, 0.16);
    var bFluC = new Beam(aDichroic, aTube, 2.9, 2.8, cFluor, false, 0.22);
    var bFluD = new Beam(aTube, aSensor, 2.8, 1.6, cFluor, false, 0.26);
    var bExc = new Beam(aRing, aTissueTop, 6.7, 5.8, cExcite, false, 0.14);
    var bRec = new Beam(aSlmFace, aCrysTop, 4.0, 3.4, cRecord, true, 0.3);

    // travelling page (the pattern carried by the read-out beam)
    var pageQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), glow(cPage));
    pageQuad.renderOrder = 21;
    pageQuad.userData.noPick = pageQuad.userData.exportSkip = true;
    root.add(pageQuad);

    // ---- selection brackets ----------------------------------------------
    var brackets = [];
    function makeBracket() {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3 * 2 * 3), 3));
      var l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: cAccent, depthTest: false, transparent: true, opacity: 0.95, toneMapped: false }));
      l.renderOrder = 999;
      l.visible = false;
      l.frustumCulled = false;
      l.userData.noPick = l.userData.exportSkip = true;
      scene.add(l);
      return l;
    }
    for (var bi = 0; bi < 6; bi++) brackets.push(makeBracket());
    var selected = [];
    var _box = new THREE.Box3();
    function partBox(id, target) {
      target.makeEmpty();
      var g = parts[id];
      if (!g) return target;
      g.updateWorldMatrix(true, true);
      g.traverse(function (o) {
        if (!o.isMesh || o.userData.exportSkip || o.isInstancedMesh) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        var b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
        target.union(b);
      });
      return target;
    }
    function updateBrackets() {
      for (var i = 0; i < brackets.length; i++) {
        var l = brackets[i];
        var id = selected[i];
        if (!id || !parts[id]) {
          l.visible = false;
          continue;
        }
        partBox(id, _box);
        if (_box.isEmpty()) {
          l.visible = false;
          continue;
        }
        var mn = _box.min;
        var mx = _box.max;
        var pad = 0.35;
        var a = l.geometry.attributes.position.array;
        var n = 0;
        for (var cx = 0; cx < 2; cx++)
          for (var cy = 0; cy < 2; cy++)
            for (var cz = 0; cz < 2; cz++) {
              var x = cx ? mx.x + pad : mn.x - pad;
              var y = cy ? mx.y + pad : mn.y - pad;
              var z = cz ? mx.z + pad : mn.z - pad;
              var lx = Math.min(2.2, (mx.x - mn.x) * 0.3) * (cx ? -1 : 1);
              var ly = Math.min(2.2, (mx.y - mn.y) * 0.3 + 0.3) * (cy ? -1 : 1);
              var lz = Math.min(2.2, (mx.z - mn.z) * 0.3) * (cz ? -1 : 1);
              a[n++] = x; a[n++] = y; a[n++] = z; a[n++] = x + lx; a[n++] = y; a[n++] = z;
              a[n++] = x; a[n++] = y; a[n++] = z; a[n++] = x; a[n++] = y + ly; a[n++] = z;
              a[n++] = x; a[n++] = y; a[n++] = z; a[n++] = x; a[n++] = y; a[n++] = z + lz;
            }
        l.geometry.attributes.position.needsUpdate = true;
        l.visible = true;
      }
    }

    // ---- signals ----------------------------------------------------------
    var sig = {
      ref: 0, page: 0, pageQ: 0, pageT: 0, land: 0, excite: 0, fluor: 0, sensor: 0, bus: 0, asic: 0,
      rec: 0, slm: 0, teacher: 0, grow: 1, tint: 1, gain: 1, pagesFilled: PAGE_COUNT, spont: 1,
    };
    var currentPage = 0;
    var mirrorAngle = 0;
    var mirrorTarget = 0;
    var targets = [];
    function pageAngle(k) {
      return ((k - (PAGE_COUNT - 1) / 2) * 5.2 * Math.PI) / 180;
    }
    function setPage(k) {
      k = ((k % PAGE_COUNT) + PAGE_COUNT) % PAGE_COUNT;
      currentPage = k;
      mirrorTarget = pageAngle(k);
      var pat = pagePatterns[k];
      targets = [];
      for (var i = 0; i < N; i++) if (cellOf[i] >= 0 && pat[cellOf[i]]) targets.push(i);
      pageQuad.material.map = pageTex[k];
      pageQuad.material.needsUpdate = true;
      landQuad.material.map = pageTex[k];
      landQuad.material.needsUpdate = true;
      mSlmFace.map = pageTex[k];
      mSlmFace.needsUpdate = true;
    }
    setPage(0);
    mirrorAngle = mirrorTarget;

    // ---- spiking cartoon --------------------------------------------------
    var P_TRANS = 0.4;
    var activity = 0;
    var firedNow = 0;
    function fire(i) {
      glowN[i] = 1;
      refr[i] = inhib[i] ? 3 : 6;
      firedNow++;
      var sgn = inhib[i] ? -2 : 1;
      for (var e = outStart[i]; e < outStart[i + 1]; e++) {
        if (Math.random() < P_TRANS) {
          inbox[(head + eDelay[e]) & 3][eTo[e]] += sgn;
          eGlow[e] = 1;
        }
      }
    }
    function simStep() {
      firedNow = 0;
      var cur = inbox[head];
      var live = Math.floor(N * Math.min(1, Math.max(0, sig.grow)));
      var spont = 0.00035 * sig.spont;
      for (var i = 0; i < N; i++) {
        var inp = cur[i];
        cur[i] = 0;
        if (i >= live) continue;
        if (refr[i] > 0) {
          refr[i]--;
          continue;
        }
        if (forced[i]) {
          forced[i] = 0;
          fire(i);
        } else if (inp > 0 && Math.random() < (inp >= 2 ? 0.96 : 0.82)) fire(i);
        else if (Math.random() < spont) fire(i);
      }
      head = (head + 1) & 3;
      activity = activity * 0.82 + (firedNow / N) * 0.18;
    }
    function stimulate(frac) {
      if (!targets.length) return;
      var n = Math.ceil(targets.length * frac);
      for (var k = 0; k < n; k++) forced[targets[(Math.random() * targets.length) | 0]] = 1;
    }

    // ---- per-frame visual updates ----------------------------------------
    var cFire = new THREE.Color(1.9, 1.7, 1.35);
    var cHaloE = new THREE.Color(1.0, 0.72, 0.5);
    var cHaloI = new THREE.Color(0.55, 0.62, 1.0);
    var cEdge = new THREE.Color(0xff9db8);
    var cPulse = new THREE.Color(1.0, 0.85, 0.62);
    var tmpM = new THREE.Matrix4();
    var flowT = 0;
    var _p = new THREE.Vector3();
    function updateTissue(dt) {
      // glow fades only while the network runs, so a paused or primed frame stays lit
      var dN = simOn ? Math.exp(-dt * 5.5) : 1;
      var dE = simOn ? Math.exp(-dt * 8) : 1;
      var live = Math.floor(N * Math.min(1, Math.max(0, sig.grow)));
      var tint = sig.tint;
      var ic = somaMesh.instanceColor.array;
      var i, g, k;
      for (k = 0; k < elecGlow.length; k++) elecGlow[k] *= dN;
      for (k = 0; k < activityGrid.length; k++) activityGrid[k] = 0;
      for (i = 0; i < N; i++) {
        g = glowN[i] *= dN;
        var o = i * 3;
        var br = baseNaive[o] + (baseExpr[o] - baseNaive[o]) * tint;
        var bg = baseNaive[o + 1] + (baseExpr[o + 1] - baseNaive[o + 1]) * tint;
        var bb = baseNaive[o + 2] + (baseExpr[o + 2] - baseNaive[o + 2]) * tint;
        ic[o] = br + (cFire.r - br) * g;
        ic[o + 1] = bg + (cFire.g - bg) * g;
        ic[o + 2] = bb + (cFire.b - bb) * g;
        var h = inhib[i] ? cHaloI : cHaloE;
        var gg = g * g * 0.9;
        haloCol[o] = h.r * gg;
        haloCol[o + 1] = h.g * gg;
        haloCol[o + 2] = h.b * gg;
        if (g > 0.05) {
          activityGrid[gridOf[i]] += g;
          var el = elecOf[i];
          if (el >= 0 && g > elecGlow[el]) elecGlow[el] = g;
        }
      }
      somaMesh.count = live;
      somaMesh.instanceColor.needsUpdate = true;
      haloPts.geometry.attributes.color.needsUpdate = true;
      haloPts.geometry.setDrawRange(0, live);

      var base = 0.035 + 0.075 * sig.gain;
      var er = cEdge.r * base;
      var eg = cEdge.g * base;
      var eb = cEdge.b * base;
      for (var e = 0; e < E; e++) {
        g = eGlow[e] *= dE;
        var p = e * 6;
        var r1 = er + cPulse.r * g * 0.9;
        var g1 = eg + cPulse.g * g * 0.9;
        var b1 = eb + cPulse.b * g * 0.9;
        edgeCol[p] = r1; edgeCol[p + 1] = g1; edgeCol[p + 2] = b1;
        edgeCol[p + 3] = r1 * 0.55; edgeCol[p + 4] = g1 * 0.55; edgeCol[p + 5] = b1 * 0.55;
      }
      edgeLines.geometry.attributes.color.needsUpdate = true;
      edgeLines.geometry.setDrawRange(0, outStart[live] * 2);

      var ec = electrodes.instanceColor.array;
      for (k = 0; k < elecGlow.length; k++) {
        g = elecGlow[k];
        ec[k * 3] = cGold.r + (2.2 - cGold.r) * g;
        ec[k * 3 + 1] = cGold.g + (2.0 - cGold.g) * g;
        ec[k * 3 + 2] = cGold.b + (1.5 - cGold.b) * g;
      }
      electrodes.instanceColor.needsUpdate = true;
    }
    function updateFlow(dt) {
      if (simOn) flowT += dt;
      var n = 0;
      var per = flowDots.count / flowCurves.length;
      for (var c = 0; c < flowCurves.length; c++)
        for (var k = 0; k < per; k++) {
          var t = (flowT * 0.09 + k / per + c * 0.13) % 1;
          flowCurves[c].getPoint(t, _p);
          tmpM.makeTranslation(_p.x, _p.y, _p.z);
          flowDots.setMatrixAt(n++, tmpM);
        }
      flowDots.instanceMatrix.needsUpdate = true;
      for (var j = 0; j < feedDots.count; j++) {
        feedCurve.getPoint((flowT * 0.07 + j / feedDots.count) % 1, _p);
        tmpM.makeTranslation(_p.x, _p.y, _p.z);
        feedDots.setMatrixAt(j, tmpM);
      }
      feedDots.instanceMatrix.needsUpdate = true;
      pumpRotor.rotation.y = flowT * 2.2;
    }
    function updateLight(dt) {
      mirrorAngle += (mirrorTarget - mirrorAngle) * (opts.reducedMotion ? 1 : Math.min(1, dt * 9));
      mirrorPivot.rotation.z = mirrorAngle / 2;
      // reference beam walks across the crystal face as the mirror tilts
      var run = 6.5;
      aRefIn.position.set(-5, CY + Math.tan(mirrorAngle) * run, 0);
      aRefOut.position.set(5, CY + Math.tan(mirrorAngle) * (run + 10), 0);
      bRefA.level = bRefB.level = bRefC.level = Math.max(sig.ref, sig.rec * 0.9);
      // recording needs both beams at the recording wavelength, so the reference path turns green
      var refCol = sig.rec > sig.ref ? cRecord : cPage;
      bRefA.mesh.material.color.copy(refCol);
      bRefB.mesh.material.color.copy(refCol);
      bRefC.mesh.material.color.copy(refCol);
      bPageA.level = bPageB.level = bPageC.level = sig.page;
      bFluA.level = bFluB.level = bFluC.level = bFluD.level = sig.fluor * (0.35 + Math.min(1, activity * 30) * 0.65);
      bExc.level = sig.excite;
      bRec.level = sig.rec;
      for (var i = 0; i < beams.length; i++) beams[i].update();

      var filled = sig.pagesFilled;
      for (var k = 0; k < pageMeshes.length; k++) {
        var present = Math.min(1, Math.max(0, filled - k));
        var active = k === currentPage ? Math.max(sig.ref, sig.rec) : 0;
        pageMeshes[k].material.opacity = present * 0.1 + active * 0.75;
        pageMeshes[k].visible = pageMeshes[k].material.opacity > 0.004;
      }
      // travelling page
      pageQuad.visible = sig.pageQ > 0.004;
      if (pageQuad.visible) {
        aCrysBot.getWorldPosition(_va);
        aTissueTop.getWorldPosition(_vb);
        var t = sig.pageT;
        pageQuad.position.set(0, _va.y + (_vb.y - _va.y) * t, 0);
        var s = 6 + 5.2 * t;
        pageQuad.scale.set(s, 1, s);
        pageQuad.material.opacity = 0.85 * sig.pageQ;
      }
      landQuad.material.opacity = 0.5 * sig.land;
      landQuad.visible = sig.land > 0.004;
      mSlmFace.opacity = 0.9 * sig.slm;
      mLed.emissiveIntensity = 0.15 + 2.6 * sig.excite;
      mSensorDie.emissiveIntensity = 1.4 * sig.sensor;
      mTrace.emissiveIntensity = 1.6 * sig.bus;
      mAsicLid.emissiveIntensity = 0.16 * sig.asic;
      teacher.visible = sig.teacher > 0.004;
      for (var m = 0; m < teacherMats.length; m++) teacherMats[m].opacity = 0.8 * sig.teacher;
    }

    // ---- exploded view ----------------------------------------------------
    function applyExplode() {
      var e = explode * explode * (3 - 2 * explode);
      for (var id in parts) {
        var g = parts[id];
        g.position.copy(g.userData.home).addScaledVector(g.userData.ex, e);
      }
      var y0 = -1.2;
      var y1 = 37.2 + 45 * e;
      rods.forEach(function (r) {
        r.position.y = y0;
        r.scale.y = y1 - y0;
      });
    }
    applyExplode();

    // ---- camera -----------------------------------------------------------
    var viewDir = new THREE.Vector3(0.44, 0.36, 0.82).normalize();
    var tween = null;
    function fitParams() {
      var e = explode * explode * (3 - 2 * explode);
      var yMin = -4;
      var yMax = 39 + 45 * e;
      var halfH = (yMax - yMin) / 2;
      var halfW = 25;
      var tanH = Math.tan((camera.fov * Math.PI) / 360);
      var d = Math.max(halfH / tanH, halfW / (tanH * camera.aspect)) * 1.25 + 24;
      return { target: new THREE.Vector3(-1, (yMin + yMax) / 2 - 1.5, 0), dist: d };
    }
    function goTo(target, dist, ms) {
      var dir = camera.position.clone().sub(controls.target);
      if (dir.lengthSq() < 1e-6) dir.copy(viewDir);
      dir.normalize();
      var toPos = target.clone().addScaledVector(dir, dist);
      if (!ms || opts.reducedMotion) {
        controls.target.copy(target);
        camera.position.copy(toPos);
        tween = null;
        return;
      }
      tween = { t: 0, ms: ms, t0: controls.target.clone(), p0: camera.position.clone(), t1: target.clone(), p1: toPos };
    }
    function resetView(ms) {
      var f = fitParams();
      var toPos = f.target.clone().addScaledVector(viewDir, f.dist);
      if (!ms || opts.reducedMotion) {
        controls.target.copy(f.target);
        camera.position.copy(toPos);
        tween = null;
        return;
      }
      tween = { t: 0, ms: ms, t0: controls.target.clone(), p0: camera.position.clone(), t1: f.target, p1: toPos };
    }
    function focus(id, ms) {
      if (!id || !parts[id]) return;
      partBox(id, _box);
      if (_box.isEmpty()) return;
      var c = _box.getCenter(new THREE.Vector3());
      var r = _box.getSize(new THREE.Vector3()).length() / 2;
      var tanH = Math.tan((camera.fov * Math.PI) / 360);
      // a part that would need the whole-module distance gets the whole-module view, so the stack stays framed
      var f = fitParams();
      var d = Math.max(30, ((r / tanH) * 1.3) / Math.min(1, camera.aspect));
      if (d >= f.dist) goTo(f.target, f.dist, ms == null ? 650 : ms);
      else goTo(c, d, ms == null ? 650 : ms);
    }

    // ---- picking ----------------------------------------------------------
    var pickables = [];
    for (var pid in parts) {
      parts[pid].traverse(function (o) {
        if (o.isMesh && !o.userData.noPick && !o.isInstancedMesh) pickables.push(o);
      });
    }
    function partOf(o) {
      while (o) {
        if (o.userData && o.userData.partId) return o.userData.partId;
        o = o.parent;
      }
      return null;
    }
    var ray = new THREE.Raycaster();
    var ndc = new THREE.Vector2();
    function pickAt(clientX, clientY) {
      var rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects(pickables, false);
      var shell = null;
      for (var i = 0; i < hits.length; i++) {
        var id = partOf(hits[i].object);
        if (!id) continue;
        // glass walls, the coverslip and the lens plate let the pick through
        if (hits[i].object.userData.shell) {
          if (!shell) shell = id;
          continue;
        }
        return id;
      }
      return shell;
    }
    // a pick is one primary left-button or single-finger press that stays put
    var down = null;
    var hoverQueued = null;
    var dom = renderer.domElement;
    dom.addEventListener('pointerdown', function (ev) {
      down = ev.isPrimary && ev.button === 0 ? { id: ev.pointerId, x: ev.clientX, y: ev.clientY } : null;
      hoverQueued = null;
      if (opts.onHover) opts.onHover(null, 0, 0);
    });
    dom.addEventListener('pointerup', function (ev) {
      if (!down || ev.pointerId !== down.id) return;
      var moved = Math.abs(ev.clientX - down.x) + Math.abs(ev.clientY - down.y);
      down = null;
      if (moved < 6 && opts.onPick) opts.onPick(pickAt(ev.clientX, ev.clientY));
    });
    dom.addEventListener('pointercancel', function () {
      down = null;
    });
    dom.addEventListener('pointermove', function (ev) {
      if (ev.pointerType === 'touch' || ev.buttons) return;
      hoverQueued = { x: ev.clientX, y: ev.clientY };
    });
    dom.addEventListener('pointerleave', function () {
      hoverQueued = null;
      if (opts.onHover) opts.onHover(null, 0, 0);
    });
    controls.addEventListener('start', function () {
      tween = null;
      if (controls.autoRotate) {
        controls.autoRotate = false;
        if (opts.onAutoRotate) opts.onAutoRotate(false);
      }
    });

    // ---- sizing + theme ---------------------------------------------------
    function readStage() {
      var bg = getComputedStyle(container).backgroundColor || '';
      var m = bg.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
      var c = new THREE.Color();
      // the clear colour is written in linear space and encoded on output
      if (m) c.setRGB(+m[1] / 255, +m[2] / 255, +m[3] / 255, THREE.SRGBColorSpace);
      else c.setRGB(0.055, 0.035, 0.067, THREE.SRGBColorSpace);
      renderer.setClearColor(c, 1);
    }
    var firstFit = true;
    function resize() {
      var w = Math.max(1, container.clientWidth);
      var h = Math.max(1, container.clientHeight);
      // browser zoom or a move to another monitor changes the device pixel ratio
      var pr = Math.min(window.devicePixelRatio || 1, 2);
      if (pr !== renderer.getPixelRatio()) renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (firstFit) {
        firstFit = false;
        var f = fitParams();
        controls.target.copy(f.target);
        camera.position.copy(f.target).addScaledVector(viewDir, f.dist);
      }
    }
    readStage();
    resize();
    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () {
        resize();
        // setSize clears the drawing buffer and this runs after the frame's rAF, so redraw now
        if (running) {
          renderer.render(scene, camera);
          if (opts.afterFrame) opts.afterFrame(api);
        } else renderOnce();
      });
      ro.observe(container);
    } else window.addEventListener('resize', resize);

    // ---- label projection -------------------------------------------------
    var _proj = new THREE.Vector3();
    function projectAnchors(out) {
      var w = container.clientWidth;
      var h = container.clientHeight;
      var n = 0;
      for (var id in anchors) {
        var a = anchors[id];
        a.obj.getWorldPosition(_proj);
        _proj.project(camera);
        var o = out[n] || (out[n] = {});
        o.id = id;
        o.x = (_proj.x * 0.5 + 0.5) * w;
        o.y = (-_proj.y * 0.5 + 0.5) * h;
        o.z = _proj.z;
        o.side = a.side;
        o.quiet = !!a.quiet;
        o.on = _proj.z < 1 && _proj.z > -1 && (!a.when || a.when());
        n++;
      }
      out.length = n;
      return out;
    }

    // ---- loop -------------------------------------------------------------
    var running = false;
    var raf = 0;
    var last = 0;
    var simAcc = 0;
    var simOn = true;
    function frame(now) {
      raf = running ? requestAnimationFrame(frame) : 0;
      var dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      tick(dt);
    }
    function tick(dt) {
      if (opts.onFrame) opts.onFrame(dt, api);
      if (simOn) {
        simAcc += dt;
        var guard = 0;
        while (simAcc > 1 / 30 && guard++ < 3) {
          simAcc -= 1 / 30;
          simStep();
        }
      }
      updateTissue(dt);
      updateFlow(dt);
      updateLight(dt);
      if (tween) {
        tween.t = Math.min(1, tween.t + (dt * 1000) / tween.ms);
        var k = tween.t * tween.t * (3 - 2 * tween.t);
        controls.target.lerpVectors(tween.t0, tween.t1, k);
        camera.position.lerpVectors(tween.p0, tween.p1, k);
        if (tween.t >= 1) tween = null;
      }
      controls.update();
      if (hoverQueued && opts.onHover) {
        opts.onHover(pickAt(hoverQueued.x, hoverQueued.y), hoverQueued.x, hoverQueued.y);
        hoverQueued = null;
      }
      updateBrackets();
      renderer.render(scene, camera);
      if (opts.afterFrame) opts.afterFrame(api);
    }
    function renderOnce() {
      tick(0.016);
    }

    var api = {
      THREE: THREE,
      root: root,
      scene: scene,
      camera: camera,
      controls: controls,
      renderer: renderer,
      parts: parts,
      signals: sig,
      pageCount: PAGE_COUNT,
      activityGrid: activityGrid,
      hudSize: HUD_G,
      neuronCount: N,
      synapseCount: E,
      getActivity: function () {
        return activity;
      },
      getPage: function () {
        return currentPage;
      },
      pagePatternOf: function (k) {
        return pagePatterns[((k % PAGE_COUNT) + PAGE_COUNT) % PAGE_COUNT];
      },
      setPage: setPage,
      stimulate: stimulate,
      // run the network by hand: stepSim advances it, prime poses a lit still frame while the sim is off
      stepSim: function (n) {
        for (var i = 0; i < (n || 1); i++) simStep();
      },
      prime: function (frac) {
        stimulate(frac == null ? 1 : frac);
        simStep();
        simStep();
      },
      setSim: function (on) {
        simOn = !!on;
      },
      quiet: function () {
        for (var i = 0; i < N; i++) {
          glowN[i] = 0;
          forced[i] = 0;
          refr[i] = 0;
          inbox[0][i] = inbox[1][i] = inbox[2][i] = inbox[3][i] = 0;
        }
        for (var e = 0; e < E; e++) eGlow[e] = 0;
        // electrode glow no longer fades by itself while the sim is off
        for (var k = 0; k < elecGlow.length; k++) elecGlow[k] = 0;
        activity = 0;
      },
      setExplode: function (t, refit) {
        explode = Math.min(1, Math.max(0, t));
        applyExplode();
        if (refit) {
          var f = fitParams();
          goTo(f.target, f.dist, 0);
        }
      },
      getExplode: function () {
        return explode;
      },
      setSelected: function (ids) {
        selected = (ids || []).slice(0, brackets.length);
      },
      focus: focus,
      resetView: function (ms) {
        resetView(ms == null ? 700 : ms);
      },
      setAutoRotate: function (on) {
        controls.autoRotate = !!on;
      },
      // keyboard route: turn by dAz and dPolar radians about the target, scale the distance by zoom
      orbit: function (dAz, dPolar, zoom) {
        tween = null;
        var off = camera.position.clone().sub(controls.target);
        var sph = new THREE.Spherical().setFromVector3(off);
        sph.theta += dAz || 0;
        sph.phi = Math.min(controls.maxPolarAngle, Math.max(0.05, sph.phi + (dPolar || 0)));
        sph.radius = Math.min(controls.maxDistance, Math.max(controls.minDistance, sph.radius * (zoom || 1)));
        camera.position.copy(controls.target).add(off.setFromSpherical(sph));
      },
      setToday: function (on) {
        todayOn = !!on;
        todayBox.visible = todayOn;
        if (todayOn) {
          var tanH = Math.tan((camera.fov * Math.PI) / 360);
          var d = Math.max(115 / tanH, 200 / (tanH * camera.aspect)) * 1.12 + 110;
          goTo(new THREE.Vector3(0, 92, 0), d, 900);
        } else resetView(900);
      },
      isToday: function () {
        return todayOn;
      },
      projectAnchors: projectAnchors,
      partBox: partBox,
      beams: beams,
      refreshTheme: readStage,
      resize: resize,
      renderOnce: renderOnce,
      start: function () {
        if (running) return;
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      },
      stop: function () {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      },
      isRunning: function () {
        return running;
      },
    };
    return api;
  };
})();
