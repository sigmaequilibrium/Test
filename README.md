# 20x20 Machine-Learning Pathfinding Simulator

This project provides a **fully customizable pathfinding simulation** on a fixed **20x20 grid**, trained using a reinforcement learning algorithm (**Q-learning**).

## What it does

- Simulates an agent navigating from a start cell (`S`) to a goal cell (`G`) on a 20x20 map.
- Supports random map generation with configurable wall density.
- Supports loading a custom 20x20 obstacle map from a file.
- Trains with Q-learning and then runs a greedy policy rollout to show the learned path.
- Exposes tuning knobs for learning parameters and simulation settings.

## Quick start

```bash
python run_sim.py --episodes 3000 --wall-density 0.18 --seed 7
```

## Customization options

### Environment

- `--start X Y` start coordinate (default: `0 0`)
- `--goal X Y` goal coordinate (default: `19 19`)
- `--wall-density FLOAT` random obstacle density for generated maps
- `--grid-file PATH` load an exact 20x20 grid using:
  - `.` for empty cell
  - `#` for wall

### Learning hyperparameters

- `--episodes INT` number of training episodes
- `--max-steps INT` max steps per episode and rollout
- `--alpha FLOAT` learning rate
- `--gamma FLOAT` discount factor
- `--epsilon FLOAT` initial exploration rate
- `--epsilon-decay FLOAT` per-episode epsilon decay
- `--min-epsilon FLOAT` lower bound for epsilon
- `--seed INT` deterministic random seed

## Example with a custom map

`my_map.txt` must contain exactly 20 lines of 20 chars each.

```bash
python run_sim.py --grid-file my_map.txt --start 0 0 --goal 19 19 --episodes 5000
```

## Running tests

```bash
python -m unittest
```
