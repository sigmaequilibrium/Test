"""20x20 grid world for pathfinding."""

from __future__ import annotations

from dataclasses import dataclass
import random
from typing import Iterable, List, Sequence, Tuple

Position = Tuple[int, int]


@dataclass
class GridWorld:
    """Configurable 20x20 pathfinding environment."""

    width: int = 20
    height: int = 20
    start: Position = (0, 0)
    goal: Position = (19, 19)
    walls: set[Position] | None = None

    def __post_init__(self) -> None:
        if self.width != 20 or self.height != 20:
            raise ValueError("GridWorld is fixed to 20x20")
        if not self._in_bounds(self.start) or not self._in_bounds(self.goal):
            raise ValueError("start and goal must be within the 20x20 grid")
        self.walls = set(self.walls or set())
        self.walls.discard(self.start)
        self.walls.discard(self.goal)

    @classmethod
    def from_rows(
        cls,
        rows: Sequence[str],
        start: Position = (0, 0),
        goal: Position = (19, 19),
    ) -> "GridWorld":
        if len(rows) != 20 or any(len(row) != 20 for row in rows):
            raise ValueError("rows must define a 20x20 grid")
        walls = {(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch == "#"}
        return cls(start=start, goal=goal, walls=walls)

    @classmethod
    def random(
        cls,
        wall_density: float = 0.2,
        start: Position = (0, 0),
        goal: Position = (19, 19),
        seed: int | None = None,
    ) -> "GridWorld":
        if wall_density < 0 or wall_density >= 0.6:
            raise ValueError("wall_density must be in range [0.0, 0.6)")
        rng = random.Random(seed)
        walls = {
            (x, y)
            for y in range(20)
            for x in range(20)
            if rng.random() < wall_density and (x, y) not in (start, goal)
        }
        return cls(start=start, goal=goal, walls=walls)

    def _in_bounds(self, position: Position) -> bool:
        x, y = position
        return 0 <= x < self.width and 0 <= y < self.height

    def transition(self, position: Position, action: int) -> Tuple[Position, float, bool]:
        """Return (next_state, reward, done) for action index.

        Actions: 0=up, 1=down, 2=left, 3=right.
        """
        x, y = position
        moves = {0: (0, -1), 1: (0, 1), 2: (-1, 0), 3: (1, 0)}
        if action not in moves:
            raise ValueError(f"Invalid action index: {action}")

        dx, dy = moves[action]
        next_pos = (x + dx, y + dy)

        if not self._in_bounds(next_pos) or next_pos in self.walls:
            return position, -5.0, False
        if next_pos == self.goal:
            return next_pos, 50.0, True
        return next_pos, -1.0, False

    def render(self, path: Iterable[Position] | None = None, agent: Position | None = None) -> str:
        path_set = set(path or [])
        rows: List[str] = []
        for y in range(self.height):
            chars: List[str] = []
            for x in range(self.width):
                pos = (x, y)
                if pos == self.start:
                    chars.append("S")
                elif pos == self.goal:
                    chars.append("G")
                elif agent is not None and pos == agent:
                    chars.append("A")
                elif pos in path_set:
                    chars.append("*")
                elif pos in self.walls:
                    chars.append("#")
                else:
                    chars.append(".")
            rows.append("".join(chars))
        return "\n".join(rows)
