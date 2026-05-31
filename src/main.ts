import "./styles.css";

type Basis = "position" | "spin" | "phase";

type Branch = {
  id: number;
  parentId: number | null;
  birth: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  amplitude: number;
  coherence: number;
  hue: number;
  history: Array<{ x: number; y: number }>;
};

type Settings = {
  splitRate: number;
  decoherence: number;
  interference: number;
  basis: Basis;
  collapsedView: boolean;
};

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function requiredContext(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = target.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }
  return context;
}

const canvas = required<HTMLCanvasElement>("#everett-canvas");
const branchCount = required<HTMLElement>("#branch-count");
const coherenceReadout = required<HTMLElement>("#coherence-readout");
const weightReadout = required<HTMLElement>("#weight-readout");
const splitRateInput = required<HTMLInputElement>("#split-rate");
const decoherenceInput = required<HTMLInputElement>("#decoherence");
const interferenceInput = required<HTMLInputElement>("#interference");
const pauseButton = required<HTMLButtonElement>("#pause-button");
const seedButton = required<HTMLButtonElement>("#seed-button");
const collapseButton = required<HTMLButtonElement>("#collapse-button");
const ctx = requiredContext(canvas);

const settings: Settings = {
  splitRate: Number(splitRateInput.value),
  decoherence: Number(decoherenceInput.value),
  interference: Number(interferenceInput.value),
  basis: "position",
  collapsedView: false,
};

let branches: Branch[] = [];
let nextBranchId = 1;
let time = 0;
let nextSplitAt = 1.35;
let running = true;
let selectedBranch = 0;
let lastFrame = performance.now();

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function resizeCanvas() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function createRootBranch(): Branch {
  return {
    id: nextBranchId++,
    parentId: null,
    birth: time,
    x: canvas.clientWidth * 0.18,
    y: canvas.clientHeight * 0.5,
    vx: 62,
    vy: 0,
    phase: randomBetween(0, Math.PI * 2),
    amplitude: 1,
    coherence: 1,
    hue: 172,
    history: [],
  };
}

function resetSimulation() {
  branches = [createRootBranch()];
  nextSplitAt = time + 1.1;
  selectedBranch = 0;
}

function basisVector(parent: Branch, index: number): { vx: number; vy: number; phase: number; hue: number } {
  const sign = index === 0 ? -1 : 1;
  const spinKick = settings.basis === "spin" ? 96 : 54;
  const phaseKick = settings.basis === "phase" ? Math.sin(parent.phase * 1.7) * 84 : 0;
  const positionKick = settings.basis === "position" ? randomBetween(24, 76) : randomBetween(8, 32);

  return {
    vx: parent.vx * randomBetween(0.93, 1.07) + randomBetween(-8, 18),
    vy: parent.vy * 0.45 + sign * (positionKick + spinKick * 0.35) + phaseKick,
    phase: parent.phase + sign * randomBetween(0.6, 1.4),
    hue: (parent.hue + sign * randomBetween(18, 42) + 360) % 360,
  };
}

function splitBranch(parent: Branch): Branch[] {
  const skew = randomBetween(0.34, 0.66);
  const weights = [Math.sqrt(skew), Math.sqrt(1 - skew)];

  return weights.map((weight, index) => {
    const vector = basisVector(parent, index);
    return {
      id: nextBranchId++,
      parentId: parent.id,
      birth: time,
      x: parent.x,
      y: parent.y,
      vx: vector.vx,
      vy: vector.vy,
      phase: vector.phase,
      amplitude: parent.amplitude * weight,
      coherence: parent.coherence * 0.92,
      hue: vector.hue,
      history: parent.history.slice(-48),
    };
  });
}

function normalizeVisibleWeights() {
  const totalWeight = branches.reduce((sum, branch) => sum + branch.amplitude ** 2, 0);
  if (totalWeight <= 0) {
    return;
  }

  const scale = 1 / Math.sqrt(totalWeight);
  for (const branch of branches) {
    branch.amplitude *= scale;
  }
}

function performMeasurement() {
  const live = branches
    .filter((branch) => branch.amplitude > 0.035)
    .sort((a, b) => b.amplitude - a.amplitude)
    .slice(0, 24);

  const descendants = live.flatMap(splitBranch);
  const survivors = branches.filter((branch) => !live.includes(branch) && branch.amplitude > 0.02);
  branches = [...survivors, ...descendants]
    .sort((a, b) => b.amplitude - a.amplitude)
    .slice(0, 160);

  normalizeVisibleWeights();
  selectedBranch = 0;
  nextSplitAt = time + randomBetween(0.85, 1.7) / settings.splitRate;
}

function updateBranch(branch: Branch, dt: number) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const age = time - branch.birth;
  const wave = Math.sin(time * 2.7 + branch.phase) * settings.interference * 78;
  const centerPull = (height * 0.5 - branch.y) * 0.018;
  const parentMemory = Math.cos(age * 2.2 + branch.phase) * settings.interference * branch.coherence;

  branch.vy += (centerPull + parentMemory * 22) * dt;
  branch.vy *= 1 - clamp(settings.decoherence * 0.09 * dt, 0, 0.22);
  branch.x += (branch.vx + wave * branch.coherence) * dt;
  branch.y += branch.vy * dt;
  branch.coherence = clamp(branch.coherence - settings.decoherence * dt * 0.055, 0.05, 1);

  if (branch.x > width + 90) {
    branch.x = -40;
    branch.history = [];
  }

  if (branch.y < 60 || branch.y > height - 60) {
    branch.vy *= -0.72;
    branch.y = clamp(branch.y, 60, height - 60);
  }

  branch.history.push({ x: branch.x, y: branch.y });
  if (branch.history.length > 84) {
    branch.history.shift();
  }
}

function drawBackground(width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#07080c");
  gradient.addColorStop(0.48, "#10131a");
  gradient.addColorStop(1, "#071614");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.055)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 56) {
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(time + x) * 4, 0);
    ctx.lineTo(x - Math.cos(time * 0.8 + x) * 4, height);
    ctx.stroke();
  }
}

function drawInterferenceVeil(width: number, height: number) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 9; i += 1) {
    const x = width * (0.2 + i * 0.085);
    const pulse = Math.sin(time * 1.5 + i) * 18;
    const alpha = 0.035 + settings.interference * 0.035;
    ctx.strokeStyle = `rgba(122, 215, 197, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = 0; y <= height; y += 24) {
      const offset = Math.sin(y * 0.018 + time * 2.4 + i) * (18 + pulse);
      if (y === 0) {
        ctx.moveTo(x + offset, y);
      } else {
        ctx.lineTo(x + offset, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawBranch(branch: Branch, emphasis: number) {
  if (branch.history.length < 2) {
    return;
  }

  const alpha = clamp(0.08 + branch.amplitude * 0.95, 0.08, 0.92) * emphasis;
  const lineWidth = clamp(1.2 + branch.amplitude * 6.5, 1.2, 8);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = `hsla(${branch.hue}, 82%, ${58 + branch.coherence * 18}%, ${alpha})`;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  branch.history.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();

  const glow = ctx.createRadialGradient(branch.x, branch.y, 0, branch.x, branch.y, 18 + lineWidth * 2);
  glow.addColorStop(0, `hsla(${branch.hue}, 95%, 72%, ${alpha})`);
  glow.addColorStop(1, `hsla(${branch.hue}, 95%, 72%, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(branch.x, branch.y, 18 + lineWidth * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMeasurements(width: number, height: number) {
  const meterX = width * 0.72;
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = "rgba(238, 203, 112, 0.22)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 12]);
  ctx.beginPath();
  ctx.moveTo(meterX, 48);
  ctx.lineTo(meterX, height - 48);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(238, 203, 112, 0.9)";
  ctx.beginPath();
  ctx.arc(meterX, height * 0.5, 5 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  drawBackground(width, height);
  drawInterferenceVeil(width, height);
  drawMeasurements(width, height);

  const visibleBranches = settings.collapsedView ? branches.slice(selectedBranch, selectedBranch + 1) : branches;
  for (const branch of visibleBranches) {
    drawBranch(branch, settings.collapsedView ? 1 : 0.86);
  }
}

function updateHud() {
  const totalWeight = branches.reduce((sum, branch) => sum + branch.amplitude ** 2, 0);
  const coherence = branches.reduce((sum, branch) => sum + branch.coherence, 0) / Math.max(1, branches.length);
  branchCount.textContent = String(branches.length);
  coherenceReadout.textContent = `${Math.round(coherence * 100)}%`;
  weightReadout.textContent = totalWeight.toFixed(3);
}

function frame(now: number) {
  const dt = Math.min(0.033, (now - lastFrame) / 1000);
  lastFrame = now;

  if (running) {
    time += dt;
    for (const branch of branches) {
      updateBranch(branch, dt);
    }

    if (time >= nextSplitAt) {
      performMeasurement();
    }
  }

  render();
  updateHud();
  requestAnimationFrame(frame);
}

splitRateInput.addEventListener("input", () => {
  settings.splitRate = Number(splitRateInput.value);
});

decoherenceInput.addEventListener("input", () => {
  settings.decoherence = Number(decoherenceInput.value);
});

interferenceInput.addEventListener("input", () => {
  settings.interference = Number(interferenceInput.value);
});

document.querySelectorAll<HTMLInputElement>('input[name="basis"]').forEach((input) => {
  input.addEventListener("change", () => {
    if (input.checked) {
      settings.basis = input.value as Basis;
    }
  });
});

pauseButton.addEventListener("click", () => {
  running = !running;
  pauseButton.textContent = running ? "Pause" : "Resume";
  pauseButton.classList.toggle("secondary-active", !running);
});

seedButton.addEventListener("click", () => {
  time = 0;
  nextBranchId = 1;
  resetSimulation();
});

collapseButton.addEventListener("click", () => {
  settings.collapsedView = !settings.collapsedView;
  collapseButton.textContent = settings.collapsedView ? "Show all branches" : "Show single branch";
  collapseButton.classList.toggle("secondary-active", settings.collapsedView);
});

canvas.addEventListener("click", () => {
  selectedBranch = (selectedBranch + 1) % Math.max(1, branches.length);
  settings.collapsedView = true;
  collapseButton.textContent = "Show all branches";
  collapseButton.classList.add("secondary-active");
});

window.addEventListener("resize", () => {
  resizeCanvas();
  resetSimulation();
});

resizeCanvas();
resetSimulation();
requestAnimationFrame(frame);
