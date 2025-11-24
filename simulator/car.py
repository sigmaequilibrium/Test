"""Car physics and control logic."""

from dataclasses import dataclass
from math import cos, radians, sin


@dataclass
class CarState:
    x: float
    y: float
    heading_deg: float
    speed: float


class Car:
    """A simple top-down car physics model.

    Attributes
    ----------
    position : tuple[float, float]
        The current (x, y) position of the car in world coordinates.
    heading_deg : float
        Direction the car is facing, in degrees. 0 degrees faces right.
    speed : float
        Current speed in meters per second.
    """

    def __init__(
        self,
        x: float,
        y: float,
        heading_deg: float = 0.0,
        max_speed: float = 18.0,
        acceleration: float = 8.0,
        brake_deceleration: float = 12.0,
        turn_rate: float = 90.0,
        friction: float = 6.0,
    ) -> None:
        self.x = x
        self.y = y
        self.heading_deg = heading_deg
        self.speed = 0.0
        self.max_speed = max_speed
        self.acceleration = acceleration
        self.brake_deceleration = brake_deceleration
        self.turn_rate = turn_rate
        self.friction = friction

    def accelerate(self, dt: float) -> None:
        self.speed = min(self.max_speed, self.speed + self.acceleration * dt)

    def brake(self, dt: float) -> None:
        self.speed = max(0.0, self.speed - self.brake_deceleration * dt)

    def coast(self, dt: float) -> None:
        if self.speed <= 0:
            return
        self.speed = max(0.0, self.speed - self.friction * dt)

    def steer_left(self, dt: float) -> None:
        self.heading_deg = (self.heading_deg + self.turn_rate * dt) % 360

    def steer_right(self, dt: float) -> None:
        self.heading_deg = (self.heading_deg - self.turn_rate * dt) % 360

    def update_position(self, dt: float) -> None:
        if self.speed == 0:
            return
        heading_rad = radians(self.heading_deg)
        dx = cos(heading_rad) * self.speed * dt
        dy = sin(heading_rad) * self.speed * dt
        self.x += dx
        self.y += dy

    def step(self, action: str, dt: float) -> CarState:
        """Advance the car state based on the provided action.

        Parameters
        ----------
        action:
            One of ``"accelerate"``, ``"brake"``, ``"left"``, ``"right"`` or
            ``"coast"``.
        dt:
            Frame duration in seconds.
        """

        actions = {
            "accelerate": self.accelerate,
            "brake": self.brake,
            "left": self.steer_left,
            "right": self.steer_right,
            "coast": self.coast,
        }

        if action not in actions:
            raise ValueError(f"Unknown action: {action}")

        actions[action](dt)
        self.update_position(dt)

        return CarState(self.x, self.y, self.heading_deg, self.speed)

    def snapshot(self) -> CarState:
        return CarState(self.x, self.y, self.heading_deg, self.speed)
