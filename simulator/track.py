"""Track layout and collision detection."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Tuple


@dataclass
class Track:
    layout: List[str]
    start: Tuple[int, int]
    finish: Tuple[int, int]

    @classmethod
    def from_ascii(cls, lines: Iterable[str]) -> "Track":
        layout = [line.rstrip("\n") for line in lines if line.strip("\n")]
        start = finish = None

        for y, row in enumerate(layout):
            for x, char in enumerate(row):
                if char == "S":
                    start = (x, y)
                elif char == "F":
                    finish = (x, y)

        if start is None:
            raise ValueError("Track must include a start (S) tile")
        if finish is None:
            raise ValueError("Track must include a finish (F) tile")

        width = max(len(row) for row in layout)
        normalized = [row.ljust(width, "#") for row in layout]

        return cls(layout=normalized, start=start, finish=finish)

    @property
    def width(self) -> int:
        return len(self.layout[0])

    @property
    def height(self) -> int:
        return len(self.layout)

    def is_wall(self, x: float, y: float) -> bool:
        grid_x = int(x)
        grid_y = int(y)
        if grid_x < 0 or grid_y < 0 or grid_x >= self.width or grid_y >= self.height:
            return True
        return self.layout[grid_y][grid_x] == "#"

    def at_finish(self, x: float, y: float) -> bool:
        return int(x) == self.finish[0] and int(y) == self.finish[1]

    def render(self, car_position: Tuple[float, float]) -> str:
        grid = [list(row) for row in self.layout]
        car_x = min(max(int(car_position[0]), 0), self.width - 1)
        car_y = min(max(int(car_position[1]), 0), self.height - 1)
        grid[car_y][car_x] = "C"
        return "\n".join("".join(row) for row in grid)


def default_track() -> Track:
    layout = [
        "####################",
        "#S......#..........#",
        "#......#.#.#####...#",
        "#.##..#...#...#...#",
        "#..#..###.#.#.#.#..#",
        "#..#......#.#.#.#F.#",
        "#..########.#.#.#..#",
        "#............#....##",
        "####################",
    ]
    return Track.from_ascii(layout)
