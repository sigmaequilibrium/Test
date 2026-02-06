const canvas = document.getElementById("simulator");
const context = canvas.getContext("2d");

const statusSpeed = document.getElementById("speed");
const statusLap = document.getElementById("lap");
const statusPosition = document.getElementById("position");
const statusMessage = document.getElementById("message");

const controlButtons = {
  accelerate: document.getElementById("accelerate"),
  brake: document.getElementById("brake"),
  left: document.getElementById("left"),
  right: document.getElementById("right"),
};

const state = {
  width: 360,
  height: 600,
  car: {
    x: 180,
    y: 520,
    angle: -Math.PI / 2,
    speed: 0,
  },
  maxSpeed: 4.8,
  acceleration: 0.12,
  brakePower: 0.16,
  friction: 0.04,
  turnRate: 0.04,
  laps: 0,
  finished: false,
};

const track = {
  outer: { x: 20, y: 20, width: 320, height: 560 },
  inner: { x: 85, y: 120, width: 190, height: 360 },
  finish: { x: 140, y: 50, width: 80, height: 16 },
  checkpoints: [
    { x: 70, y: 320, width: 40, height: 80 },
    { x: 250, y: 220, width: 40, height: 80 },
  ],
};

const input = {
  accelerate: false,
  brake: false,
  left: false,
  right: false,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const pointInside = (rect, x, y) =>
  x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;

const resetCar = () => {
  state.car.x = 180;
  state.car.y = 520;
  state.car.angle = -Math.PI / 2;
  state.car.speed = 0;
  state.finished = false;
  statusMessage.textContent = "";
};

const setButtonState = (button, isActive) => {
  button.classList.toggle("active", isActive);
};

const registerButton = (button, key) => {
  const setState = (value) => {
    input[key] = value;
    setButtonState(button, value);
  };

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setState(true);
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointerup", () => setState(false));
  button.addEventListener("pointercancel", () => setState(false));
  button.addEventListener("pointerleave", () => setState(false));
};

Object.entries(controlButtons).forEach(([key, button]) => {
  registerButton(button, key);
});

const keyboardMap = {
  ArrowUp: "accelerate",
  KeyW: "accelerate",
  ArrowDown: "brake",
  KeyS: "brake",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

window.addEventListener("keydown", (event) => {
  const action = keyboardMap[event.code];
  if (!action) {
    return;
  }
  input[action] = true;
  setButtonState(controlButtons[action], true);
});

window.addEventListener("keyup", (event) => {
  const action = keyboardMap[event.code];
  if (!action) {
    return;
  }
  input[action] = false;
  setButtonState(controlButtons[action], false);
});

const updatePhysics = () => {
  if (state.finished) {
    state.car.speed = Math.max(0, state.car.speed - state.friction * 0.5);
    return;
  }

  if (input.accelerate) {
    state.car.speed = clamp(
      state.car.speed + state.acceleration,
      0,
      state.maxSpeed
    );
  } else if (input.brake) {
    state.car.speed = clamp(
      state.car.speed - state.brakePower,
      0,
      state.maxSpeed
    );
  } else {
    state.car.speed = clamp(
      state.car.speed - state.friction,
      0,
      state.maxSpeed
    );
  }

  const turnIntensity = state.car.speed / state.maxSpeed;
  if (input.left) {
    state.car.angle -= state.turnRate * (0.5 + turnIntensity);
  }
  if (input.right) {
    state.car.angle += state.turnRate * (0.5 + turnIntensity);
  }

  state.car.x += Math.cos(state.car.angle) * state.car.speed;
  state.car.y += Math.sin(state.car.angle) * state.car.speed;

  const onTrack =
    pointInside(track.outer, state.car.x, state.car.y) &&
    !pointInside(track.inner, state.car.x, state.car.y);

  if (!onTrack) {
    state.car.speed *= 0.65;
    state.car.x = clamp(state.car.x, track.outer.x + 10, track.outer.x + track.outer.width - 10);
    state.car.y = clamp(state.car.y, track.outer.y + 10, track.outer.y + track.outer.height - 10);
  }

  const reachedFinish = pointInside(track.finish, state.car.x, state.car.y);
  if (reachedFinish) {
    state.finished = true;
    state.laps += 1;
    statusMessage.textContent = "Finish line! Tap reset to drive again.";
  }
};

const drawTrack = () => {
  context.fillStyle = "#0c1117";
  context.fillRect(0, 0, state.width, state.height);

  context.fillStyle = "#1f2937";
  context.fillRect(track.outer.x, track.outer.y, track.outer.width, track.outer.height);

  context.fillStyle = "#0c1117";
  context.fillRect(track.inner.x, track.inner.y, track.inner.width, track.inner.height);

  context.fillStyle = "#1f2a37";
  track.checkpoints.forEach((checkpoint) => {
    context.fillRect(checkpoint.x, checkpoint.y, checkpoint.width, checkpoint.height);
  });

  context.fillStyle = "#16a34a";
  context.fillRect(track.finish.x, track.finish.y, track.finish.width, track.finish.height);

  context.strokeStyle = "#334155";
  context.lineWidth = 3;
  context.strokeRect(track.outer.x, track.outer.y, track.outer.width, track.outer.height);
  context.strokeRect(track.inner.x, track.inner.y, track.inner.width, track.inner.height);
};

const drawCar = () => {
  context.save();
  context.translate(state.car.x, state.car.y);
  context.rotate(state.car.angle);

  context.fillStyle = "#f97316";
  context.fillRect(-10, -16, 20, 32);
  context.fillStyle = "#fde68a";
  context.fillRect(-6, -10, 12, 8);
  context.fillStyle = "#111827";
  context.fillRect(-10, -16, 20, 4);
  context.fillRect(-10, 12, 20, 4);

  context.restore();
};

const resizeCanvas = () => {
  const scale = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * scale;
  canvas.height = rect.height * scale;
  context.setTransform(scale, 0, 0, scale, 0, 0);
};

const render = () => {
  drawTrack();
  drawCar();

  statusSpeed.textContent = `${(state.car.speed * 18).toFixed(0)} km/h`;
  statusLap.textContent = `${state.laps}`;
  statusPosition.textContent = `${Math.round(state.car.x)}, ${Math.round(state.car.y)}`;
};

const loop = () => {
  updatePhysics();
  render();
  window.requestAnimationFrame(loop);
};

document.getElementById("reset").addEventListener("click", () => {
  resetCar();
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
render();
loop();
