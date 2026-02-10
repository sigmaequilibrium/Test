"""Q-learning agent for grid pathfinding."""

from __future__ import annotations

from dataclasses import dataclass
import random
from typing import List, Tuple

from simulator.grid import GridWorld, Position


@dataclass
class TrainingStats:
    episodes: int
    solved_episodes: int
    best_steps: int | None


class QLearningPathfinder:
    def __init__(
        self,
        env: GridWorld,
        alpha: float = 0.1,
        gamma: float = 0.95,
        epsilon: float = 1.0,
        epsilon_decay: float = 0.995,
        min_epsilon: float = 0.05,
        seed: int | None = None,
    ) -> None:
        self.env = env
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.min_epsilon = min_epsilon
        self.rng = random.Random(seed)
        self.q_table = [[[0.0 for _ in range(4)] for _ in range(env.width)] for _ in range(env.height)]

    def _choose_action(self, state: Position) -> int:
        x, y = state
        if self.rng.random() < self.epsilon:
            return self.rng.randrange(4)
        values = self.q_table[y][x]
        max_value = max(values)
        best = [i for i, value in enumerate(values) if value == max_value]
        return self.rng.choice(best)

    def train(self, episodes: int = 2000, max_steps_per_episode: int = 400) -> TrainingStats:
        solved_episodes = 0
        best_steps: int | None = None

        for _ in range(episodes):
            state = self.env.start
            for step in range(1, max_steps_per_episode + 1):
                action = self._choose_action(state)
                next_state, reward, done = self.env.transition(state, action)

                x, y = state
                nx, ny = next_state
                current = self.q_table[y][x][action]
                future = max(self.q_table[ny][nx])
                self.q_table[y][x][action] = current + self.alpha * (reward + self.gamma * future - current)

                state = next_state
                if done:
                    solved_episodes += 1
                    if best_steps is None or step < best_steps:
                        best_steps = step
                    break

            self.epsilon = max(self.min_epsilon, self.epsilon * self.epsilon_decay)

        return TrainingStats(episodes=episodes, solved_episodes=solved_episodes, best_steps=best_steps)

    def greedy_path(self, max_steps: int = 400) -> Tuple[List[Position], bool]:
        state = self.env.start
        path = [state]
        visited = {state}
        for _ in range(max_steps):
            x, y = state
            ranked_actions = sorted(
                range(4),
                key=lambda idx: self.q_table[y][x][idx],
                reverse=True,
            )

            next_state = state
            done = False
            for action in ranked_actions:
                candidate_state, _, candidate_done = self.env.transition(state, action)
                if candidate_state != state and candidate_state not in visited:
                    next_state = candidate_state
                    done = candidate_done
                    break

            if next_state == state:
                return path, False

            path.append(next_state)
            visited.add(next_state)
            state = next_state

            if done:
                return path, True

        return path, False
