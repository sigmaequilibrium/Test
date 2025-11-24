import unittest

from simulator.car import Car
from simulator.simulator import DrivingSimulator, parse_actions_from_script
from simulator.track import Track, default_track


class CarPhysicsTests(unittest.TestCase):
    def test_acceleration_and_braking(self):
        car = Car(0, 0, max_speed=10, acceleration=5, brake_deceleration=5, friction=0)
        car.step("accelerate", dt=1.0)
        self.assertAlmostEqual(car.speed, 5)
        car.step("accelerate", dt=1.0)
        self.assertAlmostEqual(car.speed, 10)
        car.step("brake", dt=1.0)
        self.assertAlmostEqual(car.speed, 5)

    def test_turning_changes_heading(self):
        car = Car(0, 0, heading_deg=0, turn_rate=90)
        car.step("left", dt=1.0)
        self.assertEqual(car.heading_deg, 90)
        car.step("right", dt=0.5)
        self.assertEqual(car.heading_deg, 45)


class TrackTests(unittest.TestCase):
    def test_track_parsing_requires_start_and_finish(self):
        with self.assertRaises(ValueError):
            Track.from_ascii(["..."])

    def test_collision_detection(self):
        track = default_track()
        self.assertTrue(track.is_wall(-1, 0))
        self.assertTrue(track.is_wall(track.width, 0))


class SimulatorTests(unittest.TestCase):
    def test_reaches_finish_with_script(self):
        custom_track = Track.from_ascii(
            [
                "####",
                "#SF#",
                "####",
            ]
        )
        sim = DrivingSimulator(track=custom_track, timestep=1.0)
        sim.car.max_speed = 1
        sim.car.acceleration = 1
        sim.car.brake_deceleration = 1

        result = sim.run_script(["accelerate", "accelerate", "accelerate"], max_steps=5)
        self.assertTrue(result.finished)
        self.assertFalse(result.crashed)

    def test_parse_actions_from_script(self):
        actions = parse_actions_from_script("w, s, left, space")
        self.assertEqual(actions, ["accelerate", "brake", "left", "coast"])


if __name__ == "__main__":
    unittest.main()
