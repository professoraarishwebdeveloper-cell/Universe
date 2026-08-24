import type {
  AstroTime,
  EntityId,
  FrameId,
  SpaceEntity,
  Vec3,
} from "@known-universe/core";

export type ScaleBand =
  | "surface"
  | "regional"
  | "planet"
  | "orbital"
  | "system"
  | "stellar"
  | "galactic"
  | "intergalactic"
  | "cosmic";

export type CameraMode =
  "orbit" | "free" | "surface" | "chase" | "cinematic" | "scale" | "observer";

export type ControlProfile =
  "explorer" | "scientific" | "gaming" | "keyboard" | "custom";

export type WasdMode =
  | "free-flight"
  | "smart-navigation"
  | "object-selection"
  | "surface"
  | "custom";

export type GraphicsPreset =
  "auto" | "low" | "medium" | "high" | "ultra" | "custom";

export type InputDevice = "keyboard" | "mouse" | "touch" | "controller";

export type LodLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const ACTIONS = [
  "move.forward",
  "move.backward",
  "move.left",
  "move.right",
  "move.up",
  "move.down",

  "camera.rollLeft",
  "camera.rollRight",
  "camera.brake",
  "camera.reset",

  "navigation.parent",
  "navigation.child",
  "navigation.previous",
  "navigation.next",

  "focus",
  "inspect",
  "search",
  "commandPalette",

  "view.next",

  "orbit.toggle",
  "labels.toggle",
  "gravity.toggle",
  "humanity.toggle",
  "knowledge.toggle",

  "time.toggle",
  "time.faster",
  "time.slower",
  "time.realtime",
  "time.reverse",

  "scale.surface",
  "scale.planet",
  "scale.system",
  "scale.stellar",
  "scale.galactic",
  "scale.cosmic",

  "home",
  "back",
] as const;

export type ActionId = (typeof ACTIONS)[number];

export interface KeyBinding {
  action: ActionId;
  code: string;

  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface InputAction {
  action: ActionId;
  active: boolean;
  value: number;
  device: InputDevice;
}

export interface KeyboardLikeEvent {
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface ShortcutTarget {
  tagName?: string;
  isContentEditable?: boolean;
}

export const DEFAULT_BINDINGS: readonly KeyBinding[] = [
  {
    action: "move.forward",
    code: "KeyW",
  },
  {
    action: "move.backward",
    code: "KeyS",
  },
  {
    action: "move.left",
    code: "KeyA",
  },
  {
    action: "move.right",
    code: "KeyD",
  },
  {
    action: "move.up",
    code: "Space",
  },
  {
    action: "move.down",
    code: "ShiftLeft",
  },

  {
    action: "camera.rollLeft",
    code: "KeyQ",
  },
  {
    action: "camera.rollRight",
    code: "KeyE",
  },
  {
    action: "camera.brake",
    code: "KeyX",
  },
  {
    action: "camera.reset",
    code: "KeyR",
  },

  {
    action: "navigation.parent",
    code: "ArrowUp",
  },
  {
    action: "navigation.child",
    code: "ArrowDown",
  },
  {
    action: "navigation.previous",
    code: "ArrowLeft",
  },
  {
    action: "navigation.next",
    code: "ArrowRight",
  },

  {
    action: "focus",
    code: "KeyF",
  },
  {
    action: "inspect",
    code: "KeyI",
  },
  {
    action: "search",
    code: "Slash",
  },
  {
    action: "commandPalette",
    code: "KeyK",
    ctrl: true,
  },

  {
    action: "view.next",
    code: "KeyV",
  },

  {
    action: "orbit.toggle",
    code: "KeyO",
  },
  {
    action: "labels.toggle",
    code: "KeyL",
  },
  {
    action: "gravity.toggle",
    code: "KeyG",
  },
  {
    action: "humanity.toggle",
    code: "KeyH",
  },
  {
    action: "knowledge.toggle",
    code: "KeyK",
  },

  {
    action: "time.toggle",
    code: "KeyT",
  },
  {
    action: "time.faster",
    code: "Equal",
  },
  {
    action: "time.slower",
    code: "Minus",
  },
  {
    action: "time.realtime",
    code: "KeyT",
    shift: true,
  },
  {
    action: "time.reverse",
    code: "KeyJ",
  },

  {
    action: "scale.surface",
    code: "Digit1",
  },
  {
    action: "scale.planet",
    code: "Digit2",
  },
  {
    action: "scale.system",
    code: "Digit4",
  },
  {
    action: "scale.stellar",
    code: "Digit5",
  },
  {
    action: "scale.galactic",
    code: "Digit6",
  },
  {
    action: "scale.cosmic",
    code: "Digit9",
  },

  {
    action: "home",
    code: "Digit0",
  },
  {
    action: "back",
    code: "Backspace",
  },
];

export interface GraphicsSettings {
  preset: GraphicsPreset;

  targetFps: number;
  maxPixelRatio: number;

  starDensity: number;
  debrisDensity: number;

  atmosphere: boolean;
  orbitLines: boolean;
  shadows: boolean;
  bloom: boolean;

  maxVisibleObjects: number;
}

export interface NavigationSettings {
  wasdMode: WasdMode;

  mouseSensitivity: number;
  scrollSensitivity: number;

  movementSpeed: number;

  precisionMultiplier: number;
  fastMultiplier: number;

  invertZoom: boolean;
  cinematicTravel: boolean;
}

export interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;

  uiScale: number;

  discoveryOverlay: boolean;
  keyboardOnly: boolean;
}

export interface UserSettings {
  profile: ControlProfile;

  graphics: GraphicsSettings;
  navigation: NavigationSettings;
  accessibility: AccessibilitySettings;

  bindings: readonly KeyBinding[];
}

export const DEFAULT_SETTINGS: UserSettings = {
  profile: "explorer",

  graphics: {
    preset: "auto",

    targetFps: 60,
    maxPixelRatio: 2,

    starDensity: 1,
    debrisDensity: 1,

    atmosphere: true,
    orbitLines: true,
    shadows: true,
    bloom: false,

    maxVisibleObjects: 250_000,
  },

  navigation: {
    wasdMode: "smart-navigation",

    mouseSensitivity: 1,
    scrollSensitivity: 1,

    movementSpeed: 1,

    precisionMultiplier: 0.1,
    fastMultiplier: 10,

    invertZoom: false,
    cinematicTravel: true,
  },

  accessibility: {
    reducedMotion: false,
    highContrast: false,

    uiScale: 1,

    discoveryOverlay: true,
    keyboardOnly: false,
  },

  bindings: DEFAULT_BINDINGS,
};

export interface CameraState {
  mode: CameraMode;

  frameId: FrameId;

  position: Vec3;

  velocity: Vec3;

  targetId?: EntityId;

  fieldOfView: number;

  baseSpeed: number;
}

export interface ScaleState {
  band: ScaleBand;

  metersPerUnit: number;

  frameId: FrameId;
}

export interface SimulationClock {
  time: AstroTime;

  rate: number;

  paused: boolean;
}

export interface OverlayState {
  labels: boolean;
  gravity: boolean;
  humanity: boolean;
  knowledge: boolean;
  orbits: boolean;
}

export interface UniverseState {
  entities: ReadonlyMap<EntityId, SpaceEntity>;

  selectedId?: EntityId;
  focusId?: EntityId;

  camera: CameraState;
  scale: ScaleState;

  clock: SimulationClock;

  overlays: OverlayState;

  settings: UserSettings;
}

export function createInitialUniverseState(
  time: AstroTime,
  settings: UserSettings = DEFAULT_SETTINGS,
): UniverseState {
  return {
    entities: new Map(),

    camera: {
      mode: "orbit",
      frameId: "root",
      position: [0, 0, 10],
      velocity: [0, 0, 0],
      fieldOfView: 60,
      baseSpeed: 1,
    },

    scale: {
      band: "planet",
      metersPerUnit: 1,
      frameId: "root",
    },

    clock: {
      time,
      rate: 1,
      paused: false,
    },

    overlays: {
      labels: true,
      gravity: false,
      humanity: false,
      knowledge: false,
      orbits: true,
    },

    settings: cloneSettings(settings),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtractVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function multiplyVec3(vector: Vec3, amount: number): Vec3 {
  return [vector[0] * amount, vector[1] * amount, vector[2] * amount];
}

function lengthVec3(vector: Vec3): number {
  return Math.sqrt(
    vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2],
  );
}

function normalizeVec3(vector: Vec3): Vec3 {
  const length = lengthVec3(vector);

  if (length === 0) {
    return [0, 0, 0];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function mixVec3(from: Vec3, to: Vec3, t: number): Vec3 {
  const amount = clamp(t, 0, 1);

  return [
    from[0] + (to[0] - from[0]) * amount,

    from[1] + (to[1] - from[1]) * amount,

    from[2] + (to[2] - from[2]) * amount,
  ];
}

export function cloneSettings(settings: UserSettings): UserSettings {
  return {
    profile: settings.profile,

    graphics: {
      ...settings.graphics,
    },

    navigation: {
      ...settings.navigation,
    },

    accessibility: {
      ...settings.accessibility,
    },

    bindings: settings.bindings.map((binding) => ({
      ...binding,
    })),
  };
}

export function normalizeSettings(settings: UserSettings): UserSettings {
  return {
    profile: settings.profile,

    graphics: {
      ...settings.graphics,

      targetFps: Math.round(clamp(settings.graphics.targetFps, 30, 240)),

      maxPixelRatio: clamp(settings.graphics.maxPixelRatio, 0.5, 4),

      starDensity: clamp(settings.graphics.starDensity, 0, 2),

      debrisDensity: clamp(settings.graphics.debrisDensity, 0, 2),

      maxVisibleObjects: Math.round(
        clamp(settings.graphics.maxVisibleObjects, 1_000, 5_000_000),
      ),
    },

    navigation: {
      ...settings.navigation,

      mouseSensitivity: clamp(settings.navigation.mouseSensitivity, 0.05, 10),

      scrollSensitivity: clamp(settings.navigation.scrollSensitivity, 0.05, 10),

      movementSpeed: clamp(settings.navigation.movementSpeed, 0.01, 10_000),

      precisionMultiplier: clamp(
        settings.navigation.precisionMultiplier,
        0.001,
        1,
      ),

      fastMultiplier: clamp(settings.navigation.fastMultiplier, 1, 1_000),
    },

    accessibility: {
      ...settings.accessibility,

      uiScale: clamp(settings.accessibility.uiScale, 0.5, 3),
    },

    bindings: settings.bindings.map((binding) => ({
      ...binding,
    })),
  };
}

export function bindingMatches(
  binding: KeyBinding,
  event: KeyboardLikeEvent,
): boolean {
  return (
    binding.code === event.code &&
    Boolean(binding.ctrl) === event.ctrlKey &&
    Boolean(binding.shift) === event.shiftKey &&
    Boolean(binding.alt) === event.altKey
  );
}

export function resolveKeyboardAction(
  event: KeyboardLikeEvent,
  bindings: readonly KeyBinding[],
): ActionId | undefined {
  return bindings.find((binding) => bindingMatches(binding, event))?.action;
}

export function shouldHandleGlobalShortcut(
  target: ShortcutTarget | null,
): boolean {
  if (!target) {
    return true;
  }

  if (target.isContentEditable) {
    return false;
  }

  const tag = target.tagName?.toLowerCase();

  return tag !== "input" && tag !== "textarea" && tag !== "select";
}

export function findBindingConflict(
  candidate: KeyBinding,
  bindings: readonly KeyBinding[],
): KeyBinding | undefined {
  return bindings.find((binding) => {
    if (binding.action === candidate.action) {
      return false;
    }

    return (
      binding.code === candidate.code &&
      Boolean(binding.ctrl) === Boolean(candidate.ctrl) &&
      Boolean(binding.shift) === Boolean(candidate.shift) &&
      Boolean(binding.alt) === Boolean(candidate.alt)
    );
  });
}

export function replaceBinding(
  bindings: readonly KeyBinding[],
  replacement: KeyBinding,
): KeyBinding[] {
  const conflict = findBindingConflict(replacement, bindings);

  if (conflict) {
    throw new Error(
      `${replacement.code} is already bound to ${conflict.action}`,
    );
  }

  const next = bindings.filter(
    (binding) => binding.action !== replacement.action,
  );

  return [...next, replacement];
}

export class InputState {
  private readonly values = new Map<ActionId, number>();

  set(action: ActionId, value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }

    if (value === 0) {
      this.values.delete(action);
      return;
    }

    this.values.set(action, clamp(value, -1, 1));
  }

  press(action: ActionId): void {
    this.set(action, 1);
  }

  release(action: ActionId): void {
    this.values.delete(action);
  }

  value(action: ActionId): number {
    return this.values.get(action) ?? 0;
  }

  active(action: ActionId): boolean {
    return Math.abs(this.value(action)) > 0;
  }

  reset(): void {
    this.values.clear();
  }

  snapshot(): ReadonlyMap<ActionId, number> {
    return new Map(this.values);
  }
}

export class BrowserKeyboardInput {
  private attached = false;

  constructor(
    private readonly input: InputState,

    private getBindings: () => readonly KeyBinding[],

    private onAction?: (action: ActionId) => void,
  ) {}

  private readonly keyDown = (event: KeyboardEvent) => {
    if (!shouldHandleGlobalShortcut(event.target as ShortcutTarget | null)) {
      return;
    }

    const action = resolveKeyboardAction(event, this.getBindings());

    if (!action) {
      return;
    }

    event.preventDefault();

    if (
      action.startsWith("move.") ||
      action === "camera.rollLeft" ||
      action === "camera.rollRight" ||
      action === "camera.brake"
    ) {
      this.input.press(action);
      return;
    }

    if (!event.repeat) {
      this.onAction?.(action);
    }
  };

  private readonly keyUp = (event: KeyboardEvent) => {
    const action = resolveKeyboardAction(event, this.getBindings());

    if (!action) {
      return;
    }

    this.input.release(action);
  };

  attach(): void {
    if (this.attached) {
      return;
    }

    window.addEventListener("keydown", this.keyDown);

    window.addEventListener("keyup", this.keyUp);

    this.attached = true;
  }

  detach(): void {
    if (!this.attached) {
      return;
    }

    window.removeEventListener("keydown", this.keyDown);

    window.removeEventListener("keyup", this.keyUp);

    this.input.reset();

    this.attached = false;
  }
}

export type UniverseStateListener = (state: UniverseState) => void;

export class UniverseStore {
  private state: UniverseState;

  private readonly listeners = new Set<UniverseStateListener>();

  constructor(initialState: UniverseState) {
    this.state = initialState;
  }

  getSnapshot(): UniverseState {
    return this.state;
  }

  subscribe(listener: UniverseStateListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private commit(next: UniverseState): void {
    if (Object.is(this.state, next)) {
      return;
    }

    this.state = next;

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  update(updater: (state: UniverseState) => UniverseState): void {
    this.commit(updater(this.state));
  }

  replaceEntities(entities: Iterable<SpaceEntity>): void {
    const map = new Map<EntityId, SpaceEntity>();

    for (const entity of entities) {
      map.set(entity.id, entity);
    }

    this.commit({
      ...this.state,
      entities: map,
    });
  }

  upsertEntity(entity: SpaceEntity): void {
    const entities = new Map(this.state.entities);

    entities.set(entity.id, entity);

    this.commit({
      ...this.state,
      entities,
    });
  }

  upsertEntities(entities: Iterable<SpaceEntity>): void {
    const next = new Map(this.state.entities);

    for (const entity of entities) {
      next.set(entity.id, entity);
    }

    this.commit({
      ...this.state,
      entities: next,
    });
  }

  removeEntity(id: EntityId): void {
    if (!this.state.entities.has(id)) {
      return;
    }

    const entities = new Map(this.state.entities);

    entities.delete(id);

    const next: UniverseState = {
      ...this.state,
      entities,
    };

    if (next.selectedId === id) {
      delete next.selectedId;
    }

    if (next.focusId === id) {
      delete next.focusId;
    }

    this.commit(next);
  }

  select(id: EntityId | null): void {
    const next: UniverseState = {
      ...this.state,
    };

    if (id === null) {
      delete next.selectedId;
    } else {
      next.selectedId = id;
    }

    this.commit(next);
  }

  focus(id: EntityId | null): void {
    const next: UniverseState = {
      ...this.state,
    };

    if (id === null) {
      delete next.focusId;
    } else {
      next.focusId = id;
    }

    this.commit(next);
  }

  setCamera(camera: CameraState): void {
    this.commit({
      ...this.state,
      camera,
    });
  }

  setScale(scale: ScaleState): void {
    this.commit({
      ...this.state,
      scale,
    });
  }

  setClock(clock: SimulationClock): void {
    this.commit({
      ...this.state,
      clock,
    });
  }

  setSettings(settings: UserSettings): void {
    this.commit({
      ...this.state,

      settings: normalizeSettings(settings),
    });
  }

  setOverlays(overlays: OverlayState): void {
    this.commit({
      ...this.state,
      overlays,
    });
  }
}

export function getEntity(
  state: UniverseState,
  id: EntityId,
): SpaceEntity | undefined {
  return state.entities.get(id);
}

export function getEntityChildren(
  state: UniverseState,
  parentId: EntityId,
): SpaceEntity[] {
  const children: SpaceEntity[] = [];

  for (const entity of state.entities.values()) {
    if (entity.parentId === parentId) {
      children.push(entity);
    }
  }

  return children;
}

export function getEntityParent(
  state: UniverseState,
  id: EntityId,
): SpaceEntity | undefined {
  const entity = state.entities.get(id);

  if (!entity?.parentId) {
    return undefined;
  }

  return state.entities.get(entity.parentId);
}

export function getEntitySiblings(
  state: UniverseState,
  id: EntityId,
): SpaceEntity[] {
  const entity = state.entities.get(id);

  if (!entity?.parentId) {
    return [];
  }

  return getEntityChildren(state, entity.parentId);
}

export class NavigationHistory {
  private readonly entries: EntityId[] = [];

  private position = -1;

  constructor(private readonly limit = 100) {}

  push(id: EntityId): void {
    if (this.entries[this.position] === id) {
      return;
    }

    if (this.position < this.entries.length - 1) {
      this.entries.splice(this.position + 1);
    }

    this.entries.push(id);

    if (this.entries.length > this.limit) {
      this.entries.shift();
    }

    this.position = this.entries.length - 1;
  }

  back(): EntityId | undefined {
    if (this.position <= 0) {
      return undefined;
    }

    this.position--;

    return this.entries[this.position];
  }

  forward(): EntityId | undefined {
    if (this.position >= this.entries.length - 1) {
      return undefined;
    }

    this.position++;

    return this.entries[this.position];
  }

  current(): EntityId | undefined {
    if (this.position < 0) {
      return undefined;
    }

    return this.entries[this.position];
  }

  clear(): void {
    this.entries.length = 0;
    this.position = -1;
  }
}

export function advanceClock(
  clock: SimulationClock,
  realDeltaSeconds: number,
): SimulationClock {
  if (clock.paused || clock.rate === 0 || realDeltaSeconds === 0) {
    return clock;
  }

  const secondsPerDay = 86_400;

  const days = (realDeltaSeconds * clock.rate) / secondsPerDay;

  return {
    ...clock,

    time: {
      ...clock.time,

      julianDay: clock.time.julianDay + days,
    },
  };
}

export function toggleClock(clock: SimulationClock): SimulationClock {
  return {
    ...clock,
    paused: !clock.paused,
  };
}

export function speedUpClock(clock: SimulationClock): SimulationClock {
  let rate = clock.rate;

  if (rate === 0) {
    rate = 1;
  }

  const direction = Math.sign(rate) || 1;

  rate = Math.min(Math.abs(rate) * 2, 1_000_000) * direction;

  return {
    ...clock,
    rate,
    paused: false,
  };
}

export function slowDownClock(clock: SimulationClock): SimulationClock {
  let rate = clock.rate;

  if (rate === 0) {
    rate = 1;
  }

  rate /= 2;

  if (Math.abs(rate) < 1 / 1024) {
    rate = Math.sign(rate) * (1 / 1024);
  }

  return {
    ...clock,
    rate,
    paused: false,
  };
}

export function setRealtime(clock: SimulationClock): SimulationClock {
  return {
    ...clock,
    rate: 1,
    paused: false,
  };
}

export function reverseClock(clock: SimulationClock): SimulationClock {
  const rate = clock.rate === 0 ? -1 : -clock.rate;

  return {
    ...clock,
    rate,
    paused: false,
  };
}

export interface ScaleBandDefinition {
  band: ScaleBand;

  minimumMetersPerUnit: number;
}

export const SCALE_BANDS: readonly ScaleBandDefinition[] = [
  {
    band: "surface",
    minimumMetersPerUnit: 0,
  },
  {
    band: "regional",
    minimumMetersPerUnit: 100,
  },
  {
    band: "planet",
    minimumMetersPerUnit: 10_000,
  },
  {
    band: "orbital",
    minimumMetersPerUnit: 1_000_000,
  },
  {
    band: "system",
    minimumMetersPerUnit: 100_000_000,
  },
  {
    band: "stellar",
    minimumMetersPerUnit: 100_000_000_000,
  },
  {
    band: "galactic",
    minimumMetersPerUnit: 1e15,
  },
  {
    band: "intergalactic",
    minimumMetersPerUnit: 1e18,
  },
  {
    band: "cosmic",
    minimumMetersPerUnit: 1e21,
  },
];

export function scaleBandFor(metersPerUnit: number): ScaleBand {
  const value = Math.max(0, metersPerUnit);

  let band: ScaleBand = "surface";

  for (const definition of SCALE_BANDS) {
    if (value >= definition.minimumMetersPerUnit) {
      band = definition.band;
    }
  }

  return band;
}

export function changeScale(scale: ScaleState, multiplier: number): ScaleState {
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return scale;
  }

  const metersPerUnit = clamp(scale.metersPerUnit * multiplier, 1e-9, 1e30);

  return {
    ...scale,

    metersPerUnit,

    band: scaleBandFor(metersPerUnit),
  };
}

export function scaleForBand(band: ScaleBand, frameId: FrameId): ScaleState {
  const definition = SCALE_BANDS.find((candidate) => candidate.band === band);

  return {
    band,
    frameId,
    metersPerUnit: definition?.minimumMetersPerUnit ?? 1,
  };
}

export function semanticZoom(
  scale: ScaleState,
  wheelDelta: number,
  sensitivity = 1,
): ScaleState {
  if (wheelDelta === 0) {
    return scale;
  }

  const direction = wheelDelta > 0 ? 1 : -1;

  const amount = Math.abs(wheelDelta);

  const exponent = Math.min(amount / 100, 5) * sensitivity;

  const multiplier = Math.pow(2, direction * exponent);

  return changeScale(scale, multiplier);
}

export interface CameraInput {
  forward: number;
  right: number;
  up: number;

  fast: boolean;
  precision: boolean;
  braking: boolean;
}

export function readCameraInput(input: InputState): CameraInput {
  return {
    forward: input.value("move.forward") - input.value("move.backward"),

    right: input.value("move.right") - input.value("move.left"),

    up: input.value("move.up") - input.value("move.down"),

    fast: false,

    precision: false,

    braking: input.active("camera.brake"),
  };
}

export function updateFreeCamera(
  camera: CameraState,
  input: CameraInput,
  settings: NavigationSettings,
  deltaSeconds: number,
): CameraState {
  if (deltaSeconds <= 0) {
    return camera;
  }

  let speed = camera.baseSpeed * settings.movementSpeed;

  if (input.fast) {
    speed *= settings.fastMultiplier;
  }

  if (input.precision) {
    speed *= settings.precisionMultiplier;
  }

  const direction = normalizeVec3([input.right, input.up, -input.forward]);

  const acceleration = multiplyVec3(direction, speed * 5);

  let velocity = addVec3(
    camera.velocity,
    multiplyVec3(acceleration, deltaSeconds),
  );

  if (input.braking) {
    velocity = multiplyVec3(velocity, Math.pow(0.02, deltaSeconds));
  } else {
    velocity = multiplyVec3(velocity, Math.pow(0.35, deltaSeconds));
  }

  const position = addVec3(
    camera.position,
    multiplyVec3(velocity, deltaSeconds),
  );

  return {
    ...camera,
    position,
    velocity,
  };
}

export function stopCamera(camera: CameraState): CameraState {
  return {
    ...camera,
    velocity: [0, 0, 0],
  };
}

export function resetCamera(camera: CameraState): CameraState {
  const next: CameraState = {
    mode: camera.mode,

    frameId: camera.frameId,

    position: [0, 0, 10],

    velocity: [0, 0, 0],

    fieldOfView: 60,

    baseSpeed: 1,
  };

  if (camera.targetId !== undefined) {
    next.targetId = camera.targetId;
  }

  return next;
}

export interface LodRequest {
  entityId: EntityId;

  level: LodLevel;

  priority: number;

  apparentSize: number;
}

export function clampLodLevel(value: number): LodLevel {
  const rounded = Math.round(value);

  if (rounded <= 0) {
    return 0;
  }

  if (rounded >= 5) {
    return 5;
  }

  return rounded as LodLevel;
}

export function apparentDiameterPixels(
  radiusMeters: number,
  distanceMeters: number,
  viewportHeight: number,
  fieldOfViewDegrees: number,
): number {
  if (radiusMeters <= 0 || distanceMeters <= 0 || viewportHeight <= 0) {
    return 0;
  }

  const fovRadians = (fieldOfViewDegrees * Math.PI) / 180;

  const angularDiameter = 2 * Math.atan(radiusMeters / distanceMeters);

  const pixelsPerRadian = viewportHeight / fovRadians;

  return angularDiameter * pixelsPerRadian;
}

export function chooseLodLevel(apparentPixels: number): LodLevel {
  if (apparentPixels >= 1_000) {
    return 5;
  }

  if (apparentPixels >= 500) {
    return 4;
  }

  if (apparentPixels >= 200) {
    return 3;
  }

  if (apparentPixels >= 50) {
    return 2;
  }

  if (apparentPixels >= 5) {
    return 1;
  }

  return 0;
}

export function createLodRequest(
  entityId: EntityId,
  radiusMeters: number,
  distanceMeters: number,
  viewportHeight: number,
  fieldOfViewDegrees: number,
): LodRequest {
  const apparentSize = apparentDiameterPixels(
    radiusMeters,
    distanceMeters,
    viewportHeight,
    fieldOfViewDegrees,
  );

  const level = chooseLodLevel(apparentSize);

  const priority = apparentSize * (level + 1);

  return {
    entityId,
    level,
    priority,
    apparentSize,
  };
}

export class VisibilityBudget {
  constructor(private maximumObjects: number) {}

  setMaximum(value: number): void {
    this.maximumObjects = Math.max(1, Math.floor(value));
  }

  choose(requests: readonly LodRequest[]): LodRequest[] {
    if (requests.length <= this.maximumObjects) {
      return [...requests];
    }

    return [...requests]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, this.maximumObjects);
  }
}

export interface StreamRequest {
  key: string;

  frameId: FrameId;

  center: Vec3;

  radiusMeters: number;

  scale: ScaleBand;

  priority: number;
}

export interface StreamStats {
  queued: number;
  active: number;
  completed: number;
}

export class StreamingQueue {
  private readonly queued = new Map<string, StreamRequest>();

  private readonly active = new Set<string>();

  private completed = 0;

  enqueue(request: StreamRequest): void {
    if (this.active.has(request.key)) {
      return;
    }

    const current = this.queued.get(request.key);

    if (!current || request.priority > current.priority) {
      this.queued.set(request.key, request);
    }
  }

  next(): StreamRequest | undefined {
    let best: StreamRequest | undefined;

    for (const request of this.queued.values()) {
      if (!best || request.priority > best.priority) {
        best = request;
      }
    }

    if (!best) {
      return undefined;
    }

    this.queued.delete(best.key);

    this.active.add(best.key);

    return best;
  }

  finish(key: string): void {
    if (this.active.delete(key)) {
      this.completed++;
    }
  }

  fail(key: string): void {
    this.active.delete(key);
  }

  clear(): void {
    this.queued.clear();
    this.active.clear();
    this.completed = 0;
  }

  stats(): StreamStats {
    return {
      queued: this.queued.size,

      active: this.active.size,

      completed: this.completed,
    };
  }
}

export interface PerformanceSample {
  frameTimeMs: number;

  visibleObjects: number;
}

export interface PerformanceState {
  averageFrameTimeMs: number;

  estimatedFps: number;

  visibleObjects: number;

  sampleCount: number;
}

export class PerformanceTracker {
  private readonly samples: PerformanceSample[] = [];

  constructor(private readonly sampleLimit = 120) {}

  push(sample: PerformanceSample): void {
    if (!Number.isFinite(sample.frameTimeMs) || sample.frameTimeMs < 0) {
      return;
    }

    this.samples.push(sample);

    while (this.samples.length > this.sampleLimit) {
      this.samples.shift();
    }
  }

  snapshot(): PerformanceState {
    if (this.samples.length === 0) {
      return {
        averageFrameTimeMs: 0,
        estimatedFps: 0,
        visibleObjects: 0,
        sampleCount: 0,
      };
    }

    let totalTime = 0;
    let visibleObjects = 0;

    for (const sample of this.samples) {
      totalTime += sample.frameTimeMs;

      visibleObjects = sample.visibleObjects;
    }

    const averageFrameTimeMs = totalTime / this.samples.length;

    const estimatedFps =
      averageFrameTimeMs > 0 ? 1_000 / averageFrameTimeMs : 0;

    return {
      averageFrameTimeMs,
      estimatedFps,
      visibleObjects,
      sampleCount: this.samples.length,
    };
  }

  clear(): void {
    this.samples.length = 0;
  }
}

export interface AdaptiveQualityResult {
  starDensity: number;
  debrisDensity: number;
  pixelRatio: number;
}

export function calculateAdaptiveQuality(
  performance: PerformanceState,

  settings: GraphicsSettings,
): AdaptiveQualityResult {
  if (settings.preset !== "auto") {
    return {
      starDensity: settings.starDensity,

      debrisDensity: settings.debrisDensity,

      pixelRatio: settings.maxPixelRatio,
    };
  }

  if (performance.sampleCount < 20) {
    return {
      starDensity: 1,
      debrisDensity: 1,
      pixelRatio: settings.maxPixelRatio,
    };
  }

  const targetFrameTime = 1_000 / settings.targetFps;

  const ratio = performance.averageFrameTimeMs / targetFrameTime;

  if (ratio > 1.5) {
    return {
      starDensity: 0.35,
      debrisDensity: 0.25,
      pixelRatio: Math.min(settings.maxPixelRatio, 1),
    };
  }

  if (ratio > 1.15) {
    return {
      starDensity: 0.65,
      debrisDensity: 0.5,
      pixelRatio: Math.min(settings.maxPixelRatio, 1.5),
    };
  }

  return {
    starDensity: 1,
    debrisDensity: 1,
    pixelRatio: settings.maxPixelRatio,
  };
}

export interface SimulationStep {
  deltaSeconds: number;

  elapsedSeconds: number;
}

export class FixedStepClock {
  private accumulator = 0;

  private elapsed = 0;

  constructor(
    readonly stepSeconds = 1 / 60,

    readonly maxStepsPerFrame = 5,
  ) {
    if (stepSeconds <= 0) {
      throw new Error("stepSeconds must be greater than zero");
    }
  }

  advance(
    realDeltaSeconds: number,
    callback: (step: SimulationStep) => void,
  ): void {
    const delta = clamp(realDeltaSeconds, 0, 0.25);

    this.accumulator += delta;

    let steps = 0;

    while (
      this.accumulator >= this.stepSeconds &&
      steps < this.maxStepsPerFrame
    ) {
      this.accumulator -= this.stepSeconds;

      this.elapsed += this.stepSeconds;

      callback({
        deltaSeconds: this.stepSeconds,

        elapsedSeconds: this.elapsed,
      });

      steps++;
    }

    if (steps === this.maxStepsPerFrame) {
      this.accumulator = Math.min(this.accumulator, this.stepSeconds);
    }
  }

  reset(): void {
    this.accumulator = 0;
    this.elapsed = 0;
  }

  get elapsedSeconds(): number {
    return this.elapsed;
  }
}

export interface RenderFrame {
  deltaSeconds: number;

  state: UniverseState;

  visibleEntityIds: readonly EntityId[];
}

export interface UniverseRenderer {
  readonly name: string;

  initialize(container: HTMLElement): void | Promise<void>;

  resize(width: number, height: number, pixelRatio: number): void;

  render(frame: RenderFrame): void;

  dispose(): void;
}

export type FrameCallback = (deltaSeconds: number) => void;

export class FrameLoop {
  private running = false;

  private previousTime = 0;

  private frameId: number | null = null;

  constructor(private readonly callback: FrameCallback) {}

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;

    this.previousTime = performance.now();

    const tick = (currentTime: number) => {
      if (!this.running) {
        return;
      }

      const deltaSeconds = clamp(
        (currentTime - this.previousTime) / 1_000,
        0,
        0.25,
      );

      this.previousTime = currentTime;

      this.callback(deltaSeconds);

      this.frameId = requestAnimationFrame(tick);
    };

    this.frameId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
    }

    this.frameId = null;
  }

  get isRunning(): boolean {
    return this.running;
  }
}

export interface UniverseCommand {
  action: ActionId;

  value?: number;

  targetId?: EntityId;
}

export interface CommandResult {
  handled: boolean;

  message?: string;
}

export class CommandDispatcher {
  constructor(
    private readonly store: UniverseStore,

    private readonly history: NavigationHistory,
  ) {}

  dispatch(command: UniverseCommand): CommandResult {
    const state = this.store.getSnapshot();

    switch (command.action) {
      case "focus": {
        const id = command.targetId ?? state.selectedId;

        if (!id) {
          return {
            handled: false,
            message: "No entity selected",
          };
        }

        if (!state.entities.has(id)) {
          return {
            handled: false,
            message: "Entity was not found",
          };
        }

        this.history.push(id);
        this.store.focus(id);

        return {
          handled: true,
        };
      }

      case "navigation.parent": {
        const current = state.focusId ?? state.selectedId;

        if (!current) {
          return {
            handled: false,
          };
        }

        const parent = getEntityParent(state, current);

        if (!parent) {
          return {
            handled: false,
          };
        }

        this.history.push(parent.id);

        this.store.select(parent.id);

        this.store.focus(parent.id);

        return {
          handled: true,
        };
      }

      case "navigation.child": {
        const current = state.focusId ?? state.selectedId;

        if (!current) {
          return {
            handled: false,
          };
        }

        const children = getEntityChildren(state, current);

        const child = children[0];

        if (!child) {
          return {
            handled: false,
          };
        }

        this.history.push(child.id);

        this.store.select(child.id);

        this.store.focus(child.id);

        return {
          handled: true,
        };
      }

      case "navigation.previous":
      case "navigation.next": {
        const current = state.focusId ?? state.selectedId;

        if (!current) {
          return {
            handled: false,
          };
        }

        const siblings = getEntitySiblings(state, current);

        if (siblings.length < 2) {
          return {
            handled: false,
          };
        }

        const index = siblings.findIndex((entity) => entity.id === current);

        if (index < 0) {
          return {
            handled: false,
          };
        }

        const direction = command.action === "navigation.next" ? 1 : -1;

        const nextIndex =
          (index + direction + siblings.length) % siblings.length;

        const next = siblings[nextIndex];

        if (!next) {
          return {
            handled: false,
          };
        }

        this.history.push(next.id);

        this.store.select(next.id);

        this.store.focus(next.id);

        return {
          handled: true,
        };
      }

      case "back": {
        const id = this.history.back();

        if (!id) {
          return {
            handled: false,
          };
        }

        this.store.select(id);
        this.store.focus(id);

        return {
          handled: true,
        };
      }

      case "camera.reset": {
        this.store.setCamera(resetCamera(state.camera));

        return {
          handled: true,
        };
      }

      case "camera.brake": {
        this.store.setCamera(stopCamera(state.camera));

        return {
          handled: true,
        };
      }

      case "time.toggle": {
        this.store.setClock(toggleClock(state.clock));

        return {
          handled: true,
        };
      }

      case "time.faster": {
        this.store.setClock(speedUpClock(state.clock));

        return {
          handled: true,
        };
      }

      case "time.slower": {
        this.store.setClock(slowDownClock(state.clock));

        return {
          handled: true,
        };
      }

      case "time.realtime": {
        this.store.setClock(setRealtime(state.clock));

        return {
          handled: true,
        };
      }

      case "time.reverse": {
        this.store.setClock(reverseClock(state.clock));

        return {
          handled: true,
        };
      }

      case "labels.toggle": {
        this.store.setOverlays({
          ...state.overlays,

          labels: !state.overlays.labels,
        });

        return {
          handled: true,
        };
      }

      case "gravity.toggle": {
        this.store.setOverlays({
          ...state.overlays,

          gravity: !state.overlays.gravity,
        });

        return {
          handled: true,
        };
      }

      case "humanity.toggle": {
        this.store.setOverlays({
          ...state.overlays,

          humanity: !state.overlays.humanity,
        });

        return {
          handled: true,
        };
      }

      case "knowledge.toggle": {
        this.store.setOverlays({
          ...state.overlays,

          knowledge: !state.overlays.knowledge,
        });

        return {
          handled: true,
        };
      }

      case "orbit.toggle": {
        this.store.setOverlays({
          ...state.overlays,

          orbits: !state.overlays.orbits,
        });

        return {
          handled: true,
        };
      }

      case "scale.surface": {
        this.store.setScale(scaleForBand("surface", state.scale.frameId));

        return {
          handled: true,
        };
      }

      case "scale.planet": {
        this.store.setScale(scaleForBand("planet", state.scale.frameId));

        return {
          handled: true,
        };
      }

      case "scale.system": {
        this.store.setScale(scaleForBand("system", state.scale.frameId));

        return {
          handled: true,
        };
      }

      case "scale.stellar": {
        this.store.setScale(scaleForBand("stellar", state.scale.frameId));

        return {
          handled: true,
        };
      }

      case "scale.galactic": {
        this.store.setScale(scaleForBand("galactic", state.scale.frameId));

        return {
          handled: true,
        };
      }

      case "scale.cosmic": {
        this.store.setScale(scaleForBand("cosmic", state.scale.frameId));

        return {
          handled: true,
        };
      }

      case "home": {
        this.store.select(null);
        this.store.focus(null);

        this.store.setCamera({
          mode: "orbit",

          frameId: "root",

          position: [0, 0, 10],

          velocity: [0, 0, 0],

          fieldOfView: 60,

          baseSpeed: 1,
        });

        this.store.setScale({
          band: "planet",
          frameId: "root",
          metersPerUnit: 1,
        });

        return {
          handled: true,
        };
      }

      default:
        return {
          handled: false,
        };
    }
  }
}

export interface RuntimeOptions {
  state: UniverseState;

  renderer?: UniverseRenderer;
}

export class UniverseRuntime {
  readonly store: UniverseStore;

  readonly input = new InputState();

  readonly history = new NavigationHistory();

  readonly performance = new PerformanceTracker();

  readonly fixedStep = new FixedStepClock();

  readonly commands: CommandDispatcher;

  private renderer: UniverseRenderer | undefined;

  private loop: FrameLoop | null = null;

  constructor(options: RuntimeOptions) {
    this.store = new UniverseStore(options.state);

    this.renderer = options.renderer;

    this.commands = new CommandDispatcher(this.store, this.history);
  }

  attachRenderer(renderer: UniverseRenderer): void {
    this.renderer = renderer;
  }

  detachRenderer(): void {
    this.renderer = undefined;
  }

  start(): void {
    if (this.loop) {
      return;
    }

    this.loop = new FrameLoop((deltaSeconds) => {
      this.frame(deltaSeconds);
    });

    this.loop.start();
  }

  stop(): void {
    this.loop?.stop();

    this.loop = null;
  }

  dispatch(action: ActionId, targetId?: EntityId): CommandResult {
    if (targetId === undefined) {
      return this.commands.dispatch({
        action,
      });
    }

    return this.commands.dispatch({
      action,
      targetId,
    });
  }

  zoom(wheelDelta: number): void {
    const state = this.store.getSnapshot();

    const sensitivity = state.settings.navigation.scrollSensitivity;

    const direction = state.settings.navigation.invertZoom
      ? -wheelDelta
      : wheelDelta;

    this.store.setScale(semanticZoom(state.scale, direction, sensitivity));
  }

  frame(deltaSeconds: number): void {
    const startedAt = performance.now();

    let state = this.store.getSnapshot();

    const nextClock = advanceClock(state.clock, deltaSeconds);

    if (nextClock !== state.clock) {
      this.store.setClock(nextClock);
    }

    state = this.store.getSnapshot();

    const cameraInput = readCameraInput(this.input);

    const nextCamera = updateFreeCamera(
      state.camera,
      cameraInput,
      state.settings.navigation,
      deltaSeconds,
    );

    if (nextCamera !== state.camera) {
      this.store.setCamera(nextCamera);
    }

    this.fixedStep.advance(deltaSeconds, () => {
      // Physics and orbital simulation hooks will be added here.
    });

    state = this.store.getSnapshot();

    const visibleEntityIds = [...state.entities.keys()].slice(
      0,
      state.settings.graphics.maxVisibleObjects,
    );

    this.renderer?.render({
      deltaSeconds,

      state,

      visibleEntityIds,
    });

    this.performance.push({
      frameTimeMs: performance.now() - startedAt,

      visibleObjects: visibleEntityIds.length,
    });
  }

  dispose(): void {
    this.stop();

    this.input.reset();

    this.renderer?.dispose();

    this.renderer = undefined;

    this.history.clear();

    this.performance.clear();

    this.fixedStep.reset();
  }
}

export function cameraDistance(a: CameraState, b: CameraState): number {
  return lengthVec3(subtractVec3(a.position, b.position));
}

export function interpolateCamera(
  from: CameraState,
  to: CameraState,
  amount: number,
): CameraState {
  const t = clamp(amount, 0, 1);

  const result: CameraState = {
    mode: t < 1 ? from.mode : to.mode,

    frameId: t < 1 ? from.frameId : to.frameId,

    position: mixVec3(from.position, to.position, t),

    velocity: mixVec3(from.velocity, to.velocity, t),

    fieldOfView: from.fieldOfView + (to.fieldOfView - from.fieldOfView) * t,

    baseSpeed: from.baseSpeed + (to.baseSpeed - from.baseSpeed) * t,
  };

  const targetId = t < 0.5 ? from.targetId : to.targetId;

  if (targetId !== undefined) {
    result.targetId = targetId;
  }

  return result;
}

export const ENGINE_VERSION = 2;
export * from "./procedural";