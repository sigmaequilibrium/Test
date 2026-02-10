import unittest

from simulator.grid import GridWorld
from simulator.qlearning import QLearningPathfinder
from simulator.simulator import run_simulation


class GridWorldTests(unittest.TestCase):
    def test_requires_20x20(self):
        with self.assertRaises(ValueError):
            GridWorld(width=10, height=20)

    def test_transition_hits_wall(self):
        env = GridWorld(walls={(1, 0)})
        next_state, reward, done = env.transition((0, 0), 3)
        self.assertEqual(next_state, (0, 0))
        self.assertEqual(reward, -5.0)
        self.assertFalse(done)


class QLearningTests(unittest.TestCase):
    def test_finds_path_in_open_grid(self):
        env = GridWorld(walls=set())
        agent = QLearningPathfinder(env, epsilon_decay=0.99, seed=1)
        stats = agent.train(episodes=1200, max_steps_per_episode=200)
        path, solved = agent.greedy_path(max_steps=200)

        self.assertGreater(stats.solved_episodes, 0)
        self.assertTrue(solved)
        self.assertEqual(path[0], env.start)
        self.assertEqual(path[-1], env.goal)


class IntegrationTests(unittest.TestCase):
    def test_run_simulation(self):
        result = run_simulation(
            episodes=1000,
            max_steps=200,
            wall_density=0.0,
            seed=42,
        )
        self.assertTrue(result.solved)
        self.assertGreater(result.path_length, 0)
        self.assertIn("S", result.rendered_grid)
        self.assertIn("G", result.rendered_grid)


if __name__ == "__main__":
    unittest.main()
