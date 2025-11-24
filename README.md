# Driving Simulator

This repository contains a lightweight, text-based driving simulator written in Python. The simulator models basic vehicle physics and lets you navigate a maze-like track from the start tile (`S`) to the finish tile (`F`) without hitting walls.

## Features

- 2D top-down track with walls, a start point, and a finish line.
- Car physics: acceleration, braking, frictional coasting, and steering with configurable parameters.
- Interactive mode with simple keyboard controls.
- Scripted mode for replaying predefined command sequences.

## Getting Started

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

## Tests

A small unit test suite validates the physics and track logic:

```bash
python -m unittest
```
