# Driving Simulator

This repository contains a lightweight, text-based driving simulator written in Python plus a mobile-friendly web simulator. The simulator models basic vehicle physics and lets you navigate a maze-like track from the start tile (`S`) to the finish tile (`F`) without hitting walls.

## Features

- 2D top-down track with walls, a start point, and a finish line.
- Car physics: acceleration, braking, frictional coasting, and steering with configurable parameters.
- Interactive mode with simple keyboard controls.
- Scripted mode for replaying predefined command sequences.
- Mobile-ready browser simulator with touch controls.

## Getting Started (Python Simulator)

1. Ensure Python 3.11+ is available.
2. Run the simulator in interactive mode:

   ```bash
   python run_sim.py
   ```

3. Use the controls to drive:
   - `w`: accelerate
   - `s`: brake
   - `a`: steer left
   - `d`: steer right
   - `space`: coast / maintain
   - `q`: quit

## Mobile Browser Simulator

1. Download or clone this repository from GitHub.
2. Open `mobile/index.html` in a mobile browser (or use a local web server).
3. Drive using the on-screen buttons or keyboard arrows/WASD.

If you want to run a local web server:

```bash
python -m http.server
```

Then visit `http://localhost:8000/mobile/` on your phone.

## Scripted Runs

Provide a comma-separated list of commands to test movement without interactivity:

```bash
python run_sim.py --script "w,w,w,a,a,w,w" --steps 25
```

The command prints the final track state along with the car's speed, heading, and position.

## Project Layout

- `simulator/car.py` — vehicle physics and state updates.
- `simulator/track.py` — track representation, collision detection, and rendering.
- `simulator/simulator.py` — simulation loop, controls, and rendering helpers.
- `run_sim.py` — entry point for running the simulator.
- `mobile/index.html` — mobile-friendly driving simulator UI.
- `mobile/simulator.js` — browser-based physics loop and input handling.
- `mobile/style.css` — styling for the mobile simulator.

## Tests

A small unit test suite validates the physics and track logic:

```bash
python -m unittest
```
