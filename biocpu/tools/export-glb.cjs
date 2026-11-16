#!/usr/bin/env node
/* Bake the live scene into a static binary glTF (photonic-wetware-core.glb).
 * Runs the page in headless Chromium, flattens instanced geometry, drops the
 * animated glow layers and writes true-size geometry in metres.
 * Usage: node tools/export-glb.cjs   (needs Playwright with Chromium, and network for the three.js CDN)
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 8791;
const OUT = path.resolve(__dirname, '..', 'photonic-wetware-core.glb');
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/';

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve.cjs'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    page.on('pageerror', (e) => console.error('page error:', e.message));
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.PWC && window.PWC.api && window.PWC.api.root);
    await page.addScriptTag({ url: CDN + 'utils/BufferGeometryUtils.js' });
    await page.addScriptTag({ url: CDN + 'exporters/GLTFExporter.js' });

    const result = await page.evaluate(async () => {
      const { api } = window.PWC;
      const THREE = api.THREE;
      const BGU = THREE.BufferGeometryUtils;
      // settle into a quiet, assembled state
      window.PWC.state.playing = false;
      api.stop();
      api.setExplode(0);
      api.quiet();
      const s = api.signals;
      for (const k of ['ref', 'page', 'pageQ', 'land', 'excite', 'fluor', 'sensor', 'bus', 'asic', 'rec', 'slm', 'teacher']) s[k] = 0;
      s.grow = 1; s.tint = 1; s.gain = 1;
      api.setSim(false);
      window.PWC.state.t = 9.5; // rest step: every light envelope is 0, onFrame recomputes signals from t
      api.renderOnce();
      api.root.updateMatrixWorld(true);

      const out = new THREE.Group();
      out.name = 'PhotonicWetwareCore';
      const groups = {};
      const groupFor = (name) => {
        if (!groups[name]) { groups[name] = new THREE.Group(); groups[name].name = name; out.add(groups[name]); }
        return groups[name];
      };
      const ownerName = (o) => {
        for (let p = o; p; p = p.parent) {
          if (p.userData && p.userData.partId) return p.userData.partId;
          if (p.parent === api.root && p.name) return p.name;
        }
        return 'misc';
      };
      const skipped = (o) => {
        for (let p = o; p; p = p.parent) if (p.userData && p.userData.exportSkip) return true;
        return false;
      };
      const lowPoly = {
        somata: () => {
          let g = new THREE.IcosahedronGeometry(0.088, 0);
          g.deleteAttribute('uv');
          g.deleteAttribute('normal');
          g = BGU.mergeVertices(g, 1e-5);
          g.computeVertexNormals();
          return g;
        },
        electrodes: () => new THREE.CircleGeometry(0.085, 6).rotateX(-Math.PI / 2),
        lenslets: () => { const g = new THREE.SphereGeometry(0.32, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.55, 1); return g; },
      };
      // no textures are exported, so UVs are dead weight; weld duplicate vertices
      const slim = (g) => {
        g.deleteAttribute('uv');
        return BGU.mergeVertices(g, 1e-4);
      };
      const bake = (im) => {
        const make = lowPoly[im.userData.exportName];
        const base = make ? make() : im.geometry.clone();
        const m = new THREE.Matrix4();
        const c = new THREE.Color();
        const geos = [];
        for (let i = 0; i < im.count; i++) {
          im.getMatrixAt(i, m);
          const g = base.clone();
          g.applyMatrix4(m);
          if (im.instanceColor) {
            im.getColorAt(i, c);
            const n = g.attributes.position.count;
            const col = new Float32Array(n * 3);
            for (let k = 0; k < n; k++) { col[k * 3] = Math.min(1, c.r); col[k * 3 + 1] = Math.min(1, c.g); col[k * 3 + 2] = Math.min(1, c.b); }
            g.setAttribute('color', new THREE.BufferAttribute(col, 3));
          }
          geos.push(g);
        }
        let merged = BGU.mergeBufferGeometries(geos, false);
        merged.applyMatrix4(im.matrixWorld);
        let mat = im.material;
        if (im.instanceColor) { mat = im.material.clone(); mat.vertexColors = true; }
        return new THREE.Mesh(slim(merged), mat);
      };

      const stats = {};
      const count = (name, g) => { stats[name] = (stats[name] || 0) + g.attributes.position.count; };
      let meshes = 0, lines = 0, tris = 0;
      api.root.traverse((o) => {
        if (!o.visible || skipped(o)) return;
        const name = ownerName(o);
        if (o.isInstancedMesh) {
          const mesh = bake(o);
          mesh.name = name + '_' + (o.userData.exportName || 'instances');
          groupFor(name).add(mesh);
          count(name, mesh.geometry);
          meshes++; tris += (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3;
        } else if (o.isMesh) {
          const g = slim(o.geometry.clone().applyMatrix4(o.matrixWorld));
          const mesh = new THREE.Mesh(g, o.material);
          mesh.name = name + '_' + meshes;
          groupFor(name).add(mesh);
          count(name, g);
          meshes++; tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
        } else if (o.isLineSegments && o.userData.exportName === 'neurites') {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', o.geometry.attributes.position.clone());
          g.applyMatrix4(o.matrixWorld);
          const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd98aa5 }));
          l.name = 'tissue_neurites';
          groupFor(name).add(l);
          lines++;
        }
      });
      // light paths as plain translucent solids, in their own node so they are easy to hide
      const lp = groupFor('light_paths');
      api.beams.forEach((b, i) => {
        b.level = 1; b.update();
        b.mesh.updateMatrixWorld(true);
        const g = b.mesh.geometry.clone();
        g.applyMatrix4(b.mesh.matrixWorld);
        const mat = new THREE.MeshBasicMaterial({ color: b.mesh.material.color.clone(), transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
        const mesh = new THREE.Mesh(g, mat);
        mesh.name = 'beam_' + i;
        lp.add(mesh);
        b.level = 0; b.update();
        meshes++;
      });
      out.scale.setScalar(0.001); // model units are millimetres; glTF is metres
      out.updateMatrixWorld(true);

      const buf = await new Promise((resolve, reject) => new THREE.GLTFExporter().parse(out, resolve, reject, { binary: true }));
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return { b64: btoa(bin), meshes, lines, tris: Math.round(tris), nodes: Object.keys(groups), stats };
    });

    const data = Buffer.from(result.b64, 'base64');
    if (data.toString('ascii', 0, 4) !== 'glTF') throw new Error('export did not produce a GLB');
    const jsonLen = data.readUInt32LE(12);
    const gltf = JSON.parse(data.toString('utf8', 20, 20 + jsonLen));
    fs.writeFileSync(OUT, data);
    console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${(data.length / 1e6).toFixed(2)} MB, glTF ${data.readUInt32LE(4)}, ` +
      `${result.meshes} meshes, ${result.lines} line sets, ${result.tris} triangles, ${gltf.materials.length} materials`);
    console.log('nodes: ' + result.nodes.join(', '));
    if (process.argv.includes('--stats')) console.log('vertices per node:', JSON.stringify(result.stats));
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });
