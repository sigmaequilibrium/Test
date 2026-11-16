"""Sanity checks for the Photonic Wetware Core 3D model in biocpu/.

These run without a browser. They check that the page's files are wired
together, that CDN libraries are pinned, and that the exported glTF is a
well-formed binary with one node per part.
"""

import json
import re
import struct
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "biocpu"

PARTS = [
    "tissue", "perfusion", "chamber", "lifesupport", "thermal", "window", "ring", "lens",
    "dichroic", "sensor", "relay", "crystal", "laser", "slm", "mea", "asic", "board",
]


def read(name):
    return (ROOT / name).read_text(encoding="utf-8")


class PageWiringTests(unittest.TestCase):
    def setUp(self):
        self.html = read("index.html")

    def test_is_a_page_fragment_with_a_title(self):
        head = self.html[:400].lower()
        self.assertIn("<title>photonic wetware core</title>", head)
        wrapper = re.search(r"<!doctype|<html[\s>]|<head[\s>]|<body[\s>]", self.html, re.I)
        self.assertIsNone(wrapper, "index.html must stay a fragment")

    def test_local_scripts_exist(self):
        sources = re.findall(r'<script src="([^"]+)"', self.html)
        local = [s for s in sources if not s.startswith("http")]
        self.assertEqual(local, ["data.js", "scene.js", "app.js"])
        for name in local:
            self.assertTrue((ROOT / name).is_file(), name)

    def test_cdn_scripts_are_allowed_hosts_and_pinned(self):
        remote = [s for s in re.findall(r'<script src="([^"]+)"', self.html) if s.startswith("http")]
        self.assertTrue(remote)
        for url in remote:
            self.assertRegex(url, r"^https://(cdnjs\.cloudflare\.com/ajax/libs/|cdn\.jsdelivr\.net/npm/)")
            self.assertRegex(url, r"\d+\.\d+\.\d+", url)
        self.assertEqual(len({re.search(r"0\.\d+\.\d+", u).group(0) for u in remote}), 1, "one three.js version")

    def test_every_tab_has_a_pane(self):
        for tab in ("parts", "run", "imprint", "power", "reality"):
            self.assertIn('id="tab-%s"' % tab, self.html)
            self.assertIn('id="pane-%s"' % tab, self.html)

    def test_dark_theme_is_defined_both_ways(self):
        self.assertIn('@media (prefers-color-scheme: dark)', self.html)
        self.assertIn(':root:not([data-theme="light"])', self.html)
        self.assertIn(':root[data-theme="dark"]', self.html)


class ContentTests(unittest.TestCase):
    def setUp(self):
        self.data = read("data.js")
        self.scene = read("scene.js")

    def test_every_part_has_copy_and_geometry(self):
        for part in PARTS:
            self.assertIn("id: '%s'" % part, self.data, "copy for " + part)
            self.assertIn("part('%s'" % part, self.scene, "geometry for " + part)

    def test_status_tags_are_from_the_three_levels(self):
        tags = set(re.findall(r"status: '(\w+)'", self.data))
        self.assertTrue(tags)
        self.assertLessEqual(tags, {"demonstrated", "emerging", "speculative"})

    def test_run_steps_tile_the_cycle(self):
        steps = [(float(a), float(b)) for a, b in re.findall(r"t0: ([\d.]+), t1: ([\d.]+)", self.data)]
        period = float(re.search(r"period: ([\d.]+)", self.data).group(1))
        self.assertEqual(steps[0][0], 0.0)
        self.assertEqual(steps[-1][1], period)
        for (_, end), (start, _) in zip(steps, steps[1:]):
            self.assertEqual(end, start)

    def test_sources_are_https_links(self):
        links = re.findall(r"u: '([^']+)'", self.data)
        self.assertGreaterEqual(len(links), 15)
        for link in links:
            self.assertTrue(link.startswith("https://"), link)


class FilesFitTogetherTests(unittest.TestCase):
    """app.js, scene.js, index.html, data.js and the README are edited separately; these keep them in step."""

    def setUp(self):
        self.app = read("app.js")
        self.scene = read("scene.js")
        self.html = read("index.html")
        self.data = read("data.js")
        self.readme = " ".join(read("README.md").split())

    def test_every_api_member_app_uses_is_in_the_scene_and_in_the_stub(self):
        used = set(re.findall(r"\bapi\.([A-Za-z]+)", self.app))
        self.assertGreaterEqual(len(used), 20)
        scene_api = self.scene[self.scene.index("var api = {"):]
        stub = re.search(r"function stubScene\(\) \{.*?\n  \}\n", self.app, re.S).group(0)
        for name in sorted(used):
            self.assertRegex(scene_api, r"\b%s:" % name, "scene.js api is missing " + name)
            self.assertRegex(stub, r"\b%s:" % name, "the no-3D stub in app.js is missing " + name)

    def test_classes_app_sets_are_styled(self):
        self.assertIn("classList.add('nogl')", self.app)
        self.assertIn("' today'", self.app)
        self.assertIn("el('span', 'note'", self.app)
        for selector in (".app.nogl ", ".callout.today .tag", ".callout.quiet .tag", ".dotrow .note"):
            self.assertIn(selector, self.html, selector)

    def test_power_rows_add_up_to_the_totals_in_the_copy(self):
        rows = [(float(p), m) for p, m in re.findall(r"peak: ([\d.e-]+), mode: '(\w+)'", self.data)]
        self.assertEqual(len(rows), 12)
        self.assertAlmostEqual(sum(p for p, _ in rows), 65, delta=0.5)
        self.assertAlmostEqual(sum(p for p, m in rows if m == "const"), 47, delta=0.5)
        self.assertIn("about 65 W", self.data)
        self.assertIn("About 47 W", self.data)

    def test_imprint_note_matches_the_step_lengths(self):
        durations = [int(d) for d in re.findall(r"\bdur: (\d+)", self.data)]
        self.assertEqual(len(durations), 7)
        self.assertIn("%d to %d s" % (min(durations), max(durations)), self.data)

    def test_readme_and_data_share_the_headline_numbers(self):
        for phrase in (
            "20 to 100 times", "14 to 100", "2 to 10", "about 50 W", "about 65 W", "8 to 59", "about 400 cells",
            "40 to 87%", "14 to 26 fJ", "16 nJ", "0.01 TB/cm³", "0.2 TB/cm³", "1 to 12 TB/cm³", "10,000 years",
            "months to years", "0.3 to 0.4 mm", "about 10 million neurons", "532 nm", "5 billionths",
        ):
            self.assertIn(phrase, self.readme, "README: " + phrase)
            self.assertIn(phrase, " ".join(self.data.split()), "data.js: " + phrase)


class GlbTests(unittest.TestCase):
    def setUp(self):
        self.blob = (ROOT / "photonic-wetware-core.glb").read_bytes()

    def test_header_and_json_chunk(self):
        magic, version, length = struct.unpack_from("<4sII", self.blob, 0)
        self.assertEqual(magic, b"glTF")
        self.assertEqual(version, 2)
        self.assertEqual(length, len(self.blob))
        chunk_len, chunk_type = struct.unpack_from("<I4s", self.blob, 12)
        self.assertEqual(chunk_type, b"JSON")
        gltf = json.loads(self.blob[20:20 + chunk_len])
        self.assertEqual(gltf["asset"]["version"], "2.0")

    def test_one_node_per_part(self):
        chunk_len = struct.unpack_from("<I", self.blob, 12)[0]
        gltf = json.loads(self.blob[20:20 + chunk_len])
        names = {n.get("name") for n in gltf["nodes"]}
        for part in PARTS + ["light_paths", "PhotonicWetwareCore"]:
            self.assertIn(part, names)

    def test_model_is_true_size_in_metres(self):
        chunk_len = struct.unpack_from("<I", self.blob, 12)[0]
        gltf = json.loads(self.blob[20:20 + chunk_len])
        root = next(n for n in gltf["nodes"] if n.get("name") == "PhotonicWetwareCore")
        # millimetre geometry under a 0.001 root scale (stored as a scale or a matrix)
        scale = root.get("scale") or [root["matrix"][0], root["matrix"][5], root["matrix"][10]]
        self.assertEqual([round(v, 6) for v in scale], [0.001, 0.001, 0.001])
        spans = [a["max"][0] - a["min"][0] for a in gltf["accessors"] if "max" in a and len(a["max"]) == 3]
        self.assertTrue(any(abs(s - 46.0) < 0.01 for s in spans), "the 46 mm carrier board should be present")


if __name__ == "__main__":
    unittest.main()
