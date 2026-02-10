"""CLI simulation runner for ML pathfinding."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from simulator.grid import GridWorld
from simulator.qlearning import QLearningPathfinder, TrainingStats


@dataclass
class PathfindingResult:
    stats: TrainingStats
    solved: bool
    path_length: int
    rendered_grid: str


def load_grid_file(path: str) -> List[str]:
    rows = [line.strip() for line in Path(path).read_text().splitlines() if line.strip()]
    if len(rows) != 20 or any(len(row) != 20 for row in rows):
        raise ValueError("Grid file must contain exactly 20 rows with 20 characters each")
    allowed = {".", "#"}
    for row in rows:
        if any(ch not in allowed for ch in row):
            raise ValueError("Grid file must only use '.' for empty cells and '#' for walls")
    return rows


def run_simulation(
    episodes: int = 2500,
    max_steps: int = 400,
    wall_density: float = 0.2,
    seed: int | None = None,
    start: tuple[int, int] = (0, 0),
    goal: tuple[int, int] = (19, 19),
    alpha: float = 0.1,
    gamma: float = 0.95,
    epsilon: float = 1.0,
    epsilon_decay: float = 0.995,
    min_epsilon: float = 0.05,
    grid_file: Optional[str] = None,
) -> PathfindingResult:
    env = (
        GridWorld.from_rows(load_grid_file(grid_file), start=start, goal=goal)
        if grid_file
        else GridWorld.random(wall_density=wall_density, start=start, goal=goal, seed=seed)
    )

    agent = QLearningPathfinder(
        env,
        alpha=alpha,
        gamma=gamma,
        epsilon=epsilon,
        epsilon_decay=epsilon_decay,
        min_epsilon=min_epsilon,
        seed=seed,
    )

    stats = agent.train(episodes=episodes, max_steps_per_episode=max_steps)
    path, solved = agent.greedy_path(max_steps=max_steps)
    rendered = env.render(path=path if solved else None, agent=path[-1])

    return PathfindingResult(
        stats=stats,
        solved=solved,
        path_length=len(path) - 1,
        rendered_grid=rendered,
    )


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="20x20 ML pathfinding simulator (Q-learning)")
    parser.add_argument("--episodes", type=int, default=2500)
    parser.add_argument("--max-steps", type=int, default=400)
    parser.add_argument("--wall-density", type=float, default=0.2)
    parser.add_argument("--seed", type=int)
    parser.add_argument("--start", type=int, nargs=2, metavar=("X", "Y"), default=(0, 0))
    parser.add_argument("--goal", type=int, nargs=2, metavar=("X", "Y"), default=(19, 19))
    parser.add_argument("--alpha", type=float, default=0.1)
    parser.add_argument("--gamma", type=float, default=0.95)
    parser.add_argument("--epsilon", type=float, default=1.0)
    parser.add_argument("--epsilon-decay", type=float, default=0.995)
    parser.add_argument("--min-epsilon", type=float, default=0.05)
    parser.add_argument("--grid-file", help="Path to a 20x20 grid file using '.' and '#' characters")

    args = parser.parse_args()

    result = run_simulation(
        episodes=args.episodes,
        max_steps=args.max_steps,
        wall_density=args.wall_density,
        seed=args.seed,
        start=tuple(args.start),
        goal=tuple(args.goal),
        alpha=args.alpha,
        gamma=args.gamma,
        epsilon=args.epsilon,
        epsilon_decay=args.epsilon_decay,
        min_epsilon=args.min_epsilon,
        grid_file=args.grid_file,
    )

    print(result.rendered_grid)
    print()
    print(f"Solved: {result.solved}")
    print(f"Path length: {result.path_length}")
    print(
        f"Training: episodes={result.stats.episodes}, solved_episodes={result.stats.solved_episodes}, "
        f"best_steps={result.stats.best_steps}"
    )


if __name__ == "__main__":
    main()
