"""Interactive driving simulator."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Optional

from simulator.car import Car, CarState
from simulator.track import Track, default_track


COMMANDS = {
    "w": "accelerate",
    "s": "brake",
    "a": "left",
    "d": "right",
    " ": "coast",
    "space": "coast",
}


@dataclass
class SimulationResult:
    steps: int
    crashed: bool
    finished: bool
    history: List[CarState]


@dataclass
class SimulationSnapshot:
    steps: int
    crashed: bool
    finished: bool
    state: CarState


class DrivingSimulator:
    def __init__(
        self,
        track: Optional[Track] = None,
        timestep: float = 0.2,
    ) -> None:
        self.track = track or default_track()
        self.timestep = timestep
        self.car = Car(*self.track.start, heading_deg=0)
        self.history: List[CarState] = [self.car.snapshot()]
        self.crashed = False
        self.finished = False

    def update(self, dt: float, action: Optional[str] = None) -> SimulationSnapshot:
        resolved_action = action.strip().lower() if isinstance(action, str) else ""
        if not resolved_action:
            resolved_action = "coast"
        resolved_action = COMMANDS.get(resolved_action, resolved_action)
        state = self.car.step(resolved_action, dt)
        if self.track.is_wall(state.x, state.y):
            self.crashed = True
        if self.track.at_finish(state.x, state.y):
            self.finished = True
        self.history.append(state)
        return self.snapshot()

    def snapshot(self) -> SimulationSnapshot:
        return SimulationSnapshot(
            steps=len(self.history) - 1,
            crashed=self.crashed,
            finished=self.finished,
            state=self.history[-1],
        )

    def step(self, action: str) -> CarState:
        return self.update(self.timestep, action).state

    def run_script(self, actions: Iterable[str], max_steps: Optional[int] = None) -> SimulationResult:
        for index, action in enumerate(actions):
            if max_steps is not None and index >= max_steps:
                break
            if self.crashed or self.finished:
                break
            self.update(self.timestep, action)
        return SimulationResult(
            steps=len(self.history) - 1,
            crashed=self.crashed,
            finished=self.finished,
            history=self.history,
        )

    def render(self) -> str:
        state = self.history[-1]
        overlay = self.track.render((state.x, state.y))
        dashboard = (
            f"Speed: {state.speed:5.2f} m/s\n"
            f"Heading: {state.heading_deg:6.1f}°\n"
            f"Position: ({state.x:5.2f}, {state.y:5.2f})\n"
            f"Status: {'FINISHED' if self.finished else 'CRASHED' if self.crashed else 'DRIVING'}"
        )
        return overlay + "\n\n" + dashboard

    def reset(self) -> None:
        self.car = Car(*self.track.start, heading_deg=0)
        self.history = [self.car.snapshot()]
        self.crashed = False
        self.finished = False

    @staticmethod
    def explain_controls() -> str:
        return (
            "Controls:\n"
            "  w - accelerate\n"
            "  s - brake\n"
            "  a - steer left\n"
            "  d - steer right\n"
            "  space - coast/maintain\n"
            "  q - quit\n"
        )


def parse_actions_from_script(script: str) -> List[str]:
    parts = [part.strip().lower() for part in script.split(",") if part.strip()]
    return [COMMANDS.get(part, part) for part in parts]


def run_interactive(sim: DrivingSimulator) -> None:
    print("Starting driving simulator. Reach F without touching walls!")
    print(sim.explain_controls())
    while True:
        print(sim.render())
        if sim.crashed:
            print("You crashed! Resetting to start. Press q to quit or any key to continue.")
            choice = input().strip().lower()
            if choice == "q":
                break
            sim.reset()
            continue
        if sim.finished:
            print("Congratulations! You reached the finish line! Press q to quit or any key to drive again.")
            choice = input().strip().lower()
            if choice == "q":
                break
            sim.reset()
            continue

        command = input("Action (w/a/s/d/space or q to quit): ").strip().lower()
        if command == "q":
            break
        action = COMMANDS.get(command) or COMMANDS.get(command[:1])
        if action is None and command:
            print("Unknown command. Use w/a/s/d/space.")
            continue
        sim.update(sim.timestep, action)


def main(script: Optional[str] = None, steps: int = 100) -> None:
    sim = DrivingSimulator()
    if script:
        actions = parse_actions_from_script(script)
        result = sim.run_script(actions, max_steps=steps)
        print(sim.render())
        print(
            f"Completed in {result.steps} steps. "
            f"Status: {'finished' if result.finished else 'crashed' if result.crashed else 'running'}"
        )
    else:
        run_interactive(sim)


if __name__ == "__main__":  # pragma: no cover
    import argparse

    parser = argparse.ArgumentParser(description="Command-line driving simulator")
    parser.add_argument(
        "--script",
        help="Comma separated list of commands (w,a,s,d,space) to run without interaction.",
    )
    parser.add_argument(
        "--steps",
        type=int,
        default=100,
        help="Maximum steps to simulate in scripted mode.",
    )
    args = parser.parse_args()
    main(script=args.script, steps=args.steps)
