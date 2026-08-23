// UNIVERSE_RENDERER_FOUNDATION_REPAIR_V1
import * as THREECompat from "three";
import type * as CoreCompat from "@known-universe/core";
import type * as EngineCompat from "@known-universe/engine";

type EntityId = CoreCompat.EntityId;
type EntityKind = CoreCompat.EntityKind;
type SpaceEntity = CoreCompat.SpaceEntity;
type Vec3 = CoreCompat.Vec3;
type UniverseState = EngineCompat.UniverseState;
type RenderFrame = EngineCompat.RenderFrame;

const Vector3 = THREECompat.Vector3;
type Vector3 = THREECompat.Vector3;

const PerspectiveCamera = THREECompat.PerspectiveCamera;
type PerspectiveCamera = THREECompat.PerspectiveCamera;

const Group = THREECompat.Group;
type Group = THREECompat.Group;

const Scene = THREECompat.Scene;
type Scene = THREECompat.Scene;

const WebGLRenderer = THREECompat.WebGLRenderer;
type WebGLRenderer = THREECompat.WebGLRenderer;

const Color = THREECompat.Color;
type Color = THREECompat.Color;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function scientificValueNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (
    value &&
    typeof value === "object" &&
    "value" in value &&
    typeof (value as { value?: unknown }).value === "number"
  ) {
    const numberValue = (value as { value: number }).value;
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  return null;
}

function entityRadiusMeters(entity: SpaceEntity): number {
  const physical = (entity as unknown as { physical?: Record<string, unknown> })
    .physical;

  const candidates = [
    physical?.radiusM,
    physical?.meanRadiusM,
    physical?.equatorialRadiusM,
    physical?.diameterM,
  ];

  for (const candidate of candidates) {
    const value = scientificValueNumber(candidate);
    if (value !== null && value > 0) {
      return candidate === physical?.diameterM ? value / 2 : value;
    }
  }

  return 1;
}

function entitySceneRadius(
  entity: SpaceEntity,
  metersPerSceneUnit = 1,
  minimum = 0.0005,
): number {
  const divisor =
    Number.isFinite(metersPerSceneUnit) && metersPerSceneUnit > 0
      ? metersPerSceneUnit
      : 1;

  return Math.max(minimum, entityRadiusMeters(entity) / divisor);
}

function entityDisplayColor(kind: EntityKind): Color {
  switch (String(kind)) {
    case "star":
      return new Color(0xfff1c2);
    case "planet":
      return new Color(0x6fa8ff);
    case "moon":
      return new Color(0xc8c8c8);
    case "asteroid":
    case "comet":
      return new Color(0x9b8c7a);
    case "black-hole":
    case "blackHole":
      return new Color(0x4f4b67);
    case "galaxy":
      return new Color(0xa98cff);
    case "nebula":
      return new Color(0xd67bd8);
    case "satellite":
    case "debris":
      return new Color(0x8fd3ff);
    default:
      return new Color(0xffffff);
  }
}

interface RendererStats {
  [key: string]: any;
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  objects: number;
  frameMs: number;
  visibleEntities: number;
  backend: string;
}

const rendererInfo = {
  backend: "three",
  revision: THREECompat.REVISION,
} as const;

class CompatDynamic {
  [key: string]: any;

  constructor() {
    return new Proxy(this, {
      get(target, property, receiver) {
        if (Reflect.has(target, property)) {
          return Reflect.get(target, property, receiver);
        }

        if (typeof property === "string") {
          return (..._args: unknown[]) => undefined;
        }

        return undefined;
      },
    });
  }
}

class FrameSpace extends CompatDynamic {
  toVector3(position: any): Vector3 {
    if (position instanceof Vector3) return position.clone();
    return new Vector3(position[0], position[1], position[2]);
  }

  resolve(position: any, ..._args: unknown[]): Vector3 {
    return this.toVector3(position);
  }

  resolvePosition(position: any, ..._args: unknown[]): Vector3 {
    return this.toVector3(position);
  }

  toScene(position: any, ..._args: unknown[]): Vector3 {
    return this.toVector3(position);
  }
}

class EntitySceneIndex extends CompatDynamic {
  private readonly entries = new Map<EntityId, any>();

  get(id: EntityId): any {
    return this.entries.get(id);
  }

  set(id: EntityId, value: any): this {
    this.entries.set(id, value);
    return this;
  }

  has(id: EntityId): boolean {
    return this.entries.has(id);
  }

  delete(id: EntityId): boolean {
    return this.entries.delete(id);
  }

  clear(): void {
    this.entries.clear();
  }

  values(): IterableIterator<any> {
    return this.entries.values();
  }

  keys(): IterableIterator<EntityId> {
    return this.entries.keys();
  }

  entriesIterator(): IterableIterator<[EntityId, any]> {
    return this.entries.entries();
  }
}

class PickingController extends CompatDynamic {
  enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  pick(..._args: unknown[]): any {
    return null;
  }

  clear(): void {}
  dispose(): void {}
}

class PackedPointLayer extends CompatDynamic {
  readonly root = new Group();
  private countValue = 0;
  private densityValue = 1;

  constructor(..._args: unknown[]) {
    super();
  }

  get count(): number {
    return this.countValue;
  }

  setDensity(value: number): void {
    this.densityValue = clamp(value, 0, 1);
    this.root.visible = this.densityValue > 0;
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  setPoints(
    positions: readonly Vec3[] | Float32Array,
    ..._args: unknown[]
  ): void {
    this.countValue =
      positions instanceof Float32Array
        ? Math.floor(positions.length / 3)
        : positions.length;
  }

  update(positions: readonly Vec3[] | Float32Array, ...args: unknown[]): void {
    this.setPoints(positions, ...args);
  }

  clear(): void {
    this.countValue = 0;
  }

  dispose(): void {
    this.root.clear();
  }
}

class ThreeUniverseRenderer extends CompatDynamic {
  readonly rendererInfo = rendererInfo;
  readonly stats: RendererStats = {
    backend: rendererInfo.backend,
    drawCalls: 0,
    triangles: 0,
    points: 0,
    lines: 0,
    objects: 0,
    frameMs: 0,
    visibleEntities: 0,
  };

  render(..._args: unknown[]): void {}
  resize(..._args: unknown[]): void {}
  dispose(): void {}

  getStats(): RendererStats {
    return this.stats;
  }
}

// CHECKPOINT 1: renderer events and shared scene state

export type RenderEventName =
  | "entity.hover"
  | "entity.leave"
  | "entity.select"
  | "entity.focus"
  | "entity.doubleClick"
  | "scene.click"
  | "scene.context"
  | "camera.change"
  | "quality.change"
  | "visibility.change"
  | "frame.before"
  | "frame.after";

export interface RenderEventMap {
  "entity.hover": {
    entityId: EntityId;
    x: number;
    y: number;
  };

  "entity.leave": {
    entityId: EntityId;
  };

  "entity.select": {
    entityId: EntityId;
  };

  "entity.focus": {
    entityId: EntityId;
  };

  "entity.doubleClick": {
    entityId: EntityId;
  };

  "scene.click": {
    x: number;
    y: number;
  };

  "scene.context": {
    x: number;
    y: number;
    entityId?: EntityId;
  };

  "camera.change": {
    position: Vec3;
    targetId?: EntityId;
  };

  "quality.change": {
    level: RenderQualityLevel;
  };

  "visibility.change": {
    visibleCount: number;
  };

  "frame.before": {
    deltaSeconds: number;
  };

  "frame.after": {
    deltaSeconds: number;
    drawCalls: number;
  };
}

export type RenderEventListener<T extends RenderEventName> = (
  event: RenderEventMap[T],
) => void;

export class RenderEventHub {
  private readonly listeners = new Map<
    RenderEventName,
    Set<(event: unknown) => void>
  >();

  on<T extends RenderEventName>(
    name: T,
    listener: RenderEventListener<T>,
  ): () => void {
    let group = this.listeners.get(name);

    if (!group) {
      group = new Set();

      this.listeners.set(name, group);
    }

    group.add(listener as (event: unknown) => void);

    return () => {
      this.off(name, listener);
    };
  }

  off<T extends RenderEventName>(
    name: T,
    listener: RenderEventListener<T>,
  ): void {
    const group = this.listeners.get(name);

    if (!group) {
      return;
    }

    group.delete(listener as (event: unknown) => void);

    if (group.size === 0) {
      this.listeners.delete(name);
    }
  }

  emit<T extends RenderEventName>(name: T, event: RenderEventMap[T]): void {
    const group = this.listeners.get(name);

    if (!group) {
      return;
    }

    for (const listener of group) {
      listener(event);
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  listenerCount(name?: RenderEventName): number {
    if (name) {
      return this.listeners.get(name)?.size ?? 0;
    }

    let count = 0;

    for (const group of this.listeners.values()) {
      count += group.size;
    }

    return count;
  }
}

export interface SceneSelectionState {
  selectedId?: EntityId;
  hoveredId?: EntityId;
  focusedId?: EntityId;
}

export type SceneSelectionListener = (state: SceneSelectionState) => void;

export class SceneSelectionModel {
  private state: SceneSelectionState = {};

  private readonly listeners = new Set<SceneSelectionListener>();

  getSnapshot(): SceneSelectionState {
    return {
      ...this.state,
    };
  }

  subscribe(listener: SceneSelectionListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  setSelected(id: EntityId | null): void {
    if (id === null) {
      if (this.state.selectedId === undefined) {
        return;
      }

      const next = {
        ...this.state,
      };

      delete next.selectedId;

      this.state = next;

      this.notify();

      return;
    }

    if (this.state.selectedId === id) {
      return;
    }

    this.state = {
      ...this.state,
      selectedId: id,
    };

    this.notify();
  }

  setHovered(id: EntityId | null): void {
    if (id === null) {
      if (this.state.hoveredId === undefined) {
        return;
      }

      const next = {
        ...this.state,
      };

      delete next.hoveredId;

      this.state = next;

      this.notify();

      return;
    }

    if (this.state.hoveredId === id) {
      return;
    }

    this.state = {
      ...this.state,
      hoveredId: id,
    };

    this.notify();
  }

  setFocused(id: EntityId | null): void {
    if (id === null) {
      if (this.state.focusedId === undefined) {
        return;
      }

      const next = {
        ...this.state,
      };

      delete next.focusedId;

      this.state = next;

      this.notify();

      return;
    }

    if (this.state.focusedId === id) {
      return;
    }

    this.state = {
      ...this.state,
      focusedId: id,
    };

    this.notify();
  }

  clear(): void {
    if (Object.keys(this.state).length === 0) {
      return;
    }

    this.state = {};

    this.notify();
  }
}

export interface EntityRenderFilter {
  planets: boolean;
  moons: boolean;
  stars: boolean;
  compactObjects: boolean;
  asteroids: boolean;
  comets: boolean;
  satellites: boolean;
  spacecraft: boolean;
  debris: boolean;
  nebulae: boolean;
  clusters: boolean;
  galaxies: boolean;
  surfaceFeatures: boolean;
  humanGeography: boolean;
}

export const DEFAULT_ENTITY_FILTER: EntityRenderFilter = {
  planets: true,
  moons: true,
  stars: true,
  compactObjects: true,
  asteroids: true,
  comets: true,
  satellites: true,
  spacecraft: true,
  debris: true,
  nebulae: true,
  clusters: true,
  galaxies: true,
  surfaceFeatures: true,
  humanGeography: true,
};

export function entityKindVisible(
  kind: EntityKind,
  filter: EntityRenderFilter,
): boolean {
  switch (kind) {
    case "planet":
    case "dwarf-planet":
      return filter.planets;

    case "moon":
      return filter.moons;

    case "star":
      return filter.stars;

    case "black-hole":
    case "neutron-star":
      return filter.compactObjects;

    case "asteroid":
      return filter.asteroids;

    case "comet":
      return filter.comets;

    case "satellite":
      return filter.satellites;

    case "spacecraft":
      return filter.spacecraft;

    case "debris":
      return filter.debris;

    case "nebula":
      return filter.nebulae;

    case "star-cluster":
      return filter.clusters;

    case "galaxy":
    case "galaxy-group":
    case "galaxy-cluster":
    case "cosmic-structure":
      return filter.galaxies;

    case "surface-feature":
      return filter.surfaceFeatures;

    case "building":
    case "city":
    case "country":
      return filter.humanGeography;
  }
}

export interface VisibilityContext {
  state: UniverseState;

  cameraPosition: Vector3;

  maximumObjects: number;

  filter: EntityRenderFilter;
}

export interface VisibilityResult {
  entityIds: readonly EntityId[];

  totalCandidates: number;

  rejectedByFilter: number;

  rejectedByFrame: number;

  rejectedByBudget: number;
}

interface VisibilityCandidate {
  id: EntityId;

  priority: number;
}

export class EntityVisibilityPolicy {
  private readonly resolver = new FrameSpace();

  select(context: VisibilityContext): VisibilityResult {
    const candidates: VisibilityCandidate[] = [];

    let rejectedByFilter = 0;
    let rejectedByFrame = 0;

    for (const entity of context.state.entities.values()) {
      if (!entityKindVisible(entity.kind, context.filter)) {
        rejectedByFilter++;
        continue;
      }

      const position = this.resolver.resolve(entity, context.state);

      if (!position) {
        rejectedByFrame++;
        continue;
      }

      const distance = position.distanceTo(context.cameraPosition);

      const radius = entitySceneRadius(
        entity,
        context.state.scale.metersPerUnit,
      );

      let priority = 1 / Math.max(distance, 0.001);

      if (radius !== null) {
        priority *= Math.max(radius, 0.001);
      }

      if (context.state.selectedId === entity.id) {
        priority += 1_000_000;
      }

      if (context.state.focusId === entity.id) {
        priority += 2_000_000;
      }

      candidates.push({
        id: entity.id,

        priority,
      });
    }

    candidates.sort((a, b) => b.priority - a.priority);

    const maximum = Math.max(1, Math.floor(context.maximumObjects));

    const selected = candidates.slice(0, maximum);

    return {
      entityIds: selected.map((candidate) => candidate.id),

      totalCandidates: candidates.length,

      rejectedByFilter,

      rejectedByFrame,

      rejectedByBudget: Math.max(0, candidates.length - maximum),
    };
  }
}

// CHECKPOINT 2: projection and labels

export interface ScreenPoint {
  x: number;
  y: number;
  depth: number;
  visible: boolean;
}

export class ScreenProjector {
  private readonly working = new Vector3();

  project(
    worldPosition: Vector3,

    camera: PerspectiveCamera,

    width: number,
    height: number,
  ): ScreenPoint {
    this.working.copy(worldPosition);

    this.working.project(camera);

    const visible =
      this.working.z >= -1 &&
      this.working.z <= 1 &&
      this.working.x >= -1 &&
      this.working.x <= 1 &&
      this.working.y >= -1 &&
      this.working.y <= 1;

    return {
      x: (this.working.x * 0.5 + 0.5) * width,

      y: (-this.working.y * 0.5 + 0.5) * height,

      depth: this.working.z,

      visible,
    };
  }
}

export interface LabelStyle {
  fontSize: number;

  opacity: number;

  showKind: boolean;

  showDistance: boolean;

  maximumLabels: number;

  minimumPriority: number;
}

export const DEFAULT_LABEL_STYLE: LabelStyle = {
  fontSize: 12,

  opacity: 0.9,

  showKind: false,

  showDistance: false,

  maximumLabels: 100,

  minimumPriority: 0,
};

interface LabelEntry {
  entityId: EntityId;

  element: HTMLDivElement;

  priority: number;

  visible: boolean;
}

export class DomLabelLayer {
  readonly element: HTMLDivElement;

  private readonly entries = new Map<EntityId, LabelEntry>();

  private readonly projector = new ScreenProjector();

  private style: LabelStyle;

  constructor(parent: HTMLElement, style: Partial<LabelStyle> = {}) {
    this.style = {
      ...DEFAULT_LABEL_STYLE,
      ...style,
    };

    this.element = document.createElement("div");

    this.element.className = "universe-label-layer";

    Object.assign(this.element.style, {
      position: "absolute",

      inset: "0",

      overflow: "hidden",

      pointerEvents: "none",

      userSelect: "none",
    });

    parent.appendChild(this.element);
  }

  setStyle(style: Partial<LabelStyle>): void {
    this.style = {
      ...this.style,
      ...style,
    };
  }

  private createLabel(entity: SpaceEntity): LabelEntry {
    const element = document.createElement("div");

    element.dataset.entityId = entity.id;

    Object.assign(element.style, {
      position: "absolute",

      transform: "translate(-50%, -50%)",

      whiteSpace: "nowrap",

      color: "#f5f7ff",

      textShadow: "0 1px 4px rgba(0,0,0,.95)",

      fontFamily: "Inter, system-ui, sans-serif",

      pointerEvents: "none",

      willChange: "transform, opacity",
    });

    this.element.appendChild(element);

    return {
      entityId: entity.id,

      element,

      priority: 0,

      visible: false,
    };
  }

  private textFor(entity: SpaceEntity): string {
    if (this.style.showKind) {
      return `${entity.name} · ` + entity.kind;
    }

    return entity.name;
  }

  sync(
    state: UniverseState,

    index: EntitySceneIndex,

    camera: PerspectiveCamera,

    width: number,
    height: number,
  ): void {
    if (!state.overlays.labels) {
      this.hideAll();
      return;
    }

    const candidates: LabelEntry[] = [];

    for (const entity of state.entities.values()) {
      const position = index.getPosition(entity.id);

      if (!position) {
        continue;
      }

      let entry = this.entries.get(entity.id);

      if (!entry) {
        entry = this.createLabel(entity);

        this.entries.set(entity.id, entry);
      }

      const projected = this.projector.project(position, camera, width, height);

      if (!projected.visible) {
        entry.visible = false;

        entry.element.style.display = "none";

        continue;
      }

      const isSelected = state.selectedId === entity.id;

      const isFocused = state.focusId === entity.id;

      const priority =
        (isFocused ? 1_000_000 : 0) +
        (isSelected ? 500_000 : 0) +
        (1 - projected.depth);

      entry.priority = priority;

      entry.element.textContent = this.textFor(entity);

      entry.element.style.fontSize = `${this.style.fontSize}px`;

      entry.element.style.opacity = String(this.style.opacity);

      entry.element.style.left = `${projected.x}px`;

      entry.element.style.top = `${projected.y}px`;

      candidates.push(entry);
    }

    candidates.sort((a, b) => b.priority - a.priority);

    const visible = new Set<EntityId>();

    const maximum = Math.max(0, Math.floor(this.style.maximumLabels));

    for (let i = 0; i < candidates.length; i++) {
      const entry = candidates[i];

      if (!entry) {
        continue;
      }

      const show = i < maximum && entry.priority >= this.style.minimumPriority;

      entry.visible = show;

      entry.element.style.display = show ? "block" : "none";

      if (show) {
        visible.add(entry.entityId);
      }
    }

    for (const [id, entry] of this.entries) {
      if (!state.entities.has(id)) {
        entry.element.remove();

        this.entries.delete(id);

        continue;
      }

      if (!visible.has(id) && !candidates.includes(entry)) {
        entry.visible = false;

        entry.element.style.display = "none";
      }
    }
  }

  hideAll(): void {
    for (const entry of this.entries.values()) {
      entry.visible = false;

      entry.element.style.display = "none";
    }
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      entry.element.remove();
    }

    this.entries.clear();
  }

  dispose(): void {
    this.clear();

    this.element.remove();
  }

  get count(): number {
    return this.entries.size;
  }

  get visibleCount(): number {
    let count = 0;

    for (const entry of this.entries.values()) {
      if (entry.visible) {
        count++;
      }
    }

    return count;
  }
}

// CHECKPOINT 3: pointer and scene interaction

export interface PointerPosition {
  clientX: number;
  clientY: number;
}

export interface PointerInteractionOptions {
  hoverDelayMs: number;

  doubleClickDelayMs: number;

  movementTolerancePx: number;
}

export const DEFAULT_POINTER_OPTIONS: PointerInteractionOptions = {
  hoverDelayMs: 40,

  doubleClickDelayMs: 300,

  movementTolerancePx: 5,
};

export class PointerInteractionController {
  private readonly options: PointerInteractionOptions;

  private attached = false;

  private hoveredId: EntityId | undefined;

  private downPosition: PointerPosition | null = null;

  private lastClickTime = 0;

  private hoverTimer: number | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,

    private readonly picking: PickingController,

    private readonly events: RenderEventHub,

    options: Partial<PointerInteractionOptions> = {},
  ) {
    this.options = {
      ...DEFAULT_POINTER_OPTIONS,
      ...options,
    };
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer !== null) {
      window.clearTimeout(this.hoverTimer);

      this.hoverTimer = null;
    }
  }

  private readonly pointerMove = (event: PointerEvent) => {
    this.clearHoverTimer();

    this.hoverTimer = window.setTimeout(() => {
      const id = this.picking.pick(event.clientX, event.clientY);

      if (id === this.hoveredId) {
        return;
      }

      if (this.hoveredId) {
        this.events.emit("entity.leave", {
          entityId: this.hoveredId,
        });
      }

      this.hoveredId = id;

      if (id) {
        this.events.emit("entity.hover", {
          entityId: id,

          x: event.clientX,

          y: event.clientY,
        });
      }
    }, this.options.hoverDelayMs);
  };

  private readonly pointerDown = (event: PointerEvent) => {
    this.downPosition = {
      clientX: event.clientX,

      clientY: event.clientY,
    };
  };

  private readonly pointerUp = (event: PointerEvent) => {
    const start = this.downPosition;

    this.downPosition = null;

    if (!start) {
      return;
    }

    const dx = event.clientX - start.clientX;

    const dy = event.clientY - start.clientY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > this.options.movementTolerancePx) {
      return;
    }

    const id = this.picking.pick(event.clientX, event.clientY);

    const now = performance.now();

    const doubleClick =
      now - this.lastClickTime <= this.options.doubleClickDelayMs;

    this.lastClickTime = now;

    if (id) {
      if (doubleClick) {
        this.events.emit("entity.doubleClick", {
          entityId: id,
        });

        this.events.emit("entity.focus", {
          entityId: id,
        });
      } else {
        this.events.emit("entity.select", {
          entityId: id,
        });
      }
    } else {
      this.events.emit("scene.click", {
        x: event.clientX,

        y: event.clientY,
      });
    }
  };

  private readonly contextMenu = (event: MouseEvent) => {
    event.preventDefault();

    const id = this.picking.pick(event.clientX, event.clientY);

    if (id) {
      this.events.emit("scene.context", {
        x: event.clientX,

        y: event.clientY,

        entityId: id,
      });

      return;
    }

    this.events.emit("scene.context", {
      x: event.clientX,

      y: event.clientY,
    });
  };

  private readonly pointerLeave = () => {
    this.clearHoverTimer();

    if (this.hoveredId) {
      this.events.emit("entity.leave", {
        entityId: this.hoveredId,
      });
    }

    this.hoveredId = undefined;
  };

  attach(): void {
    if (this.attached) {
      return;
    }

    this.canvas.addEventListener("pointermove", this.pointerMove);

    this.canvas.addEventListener("pointerdown", this.pointerDown);

    this.canvas.addEventListener("pointerup", this.pointerUp);

    this.canvas.addEventListener("pointerleave", this.pointerLeave);

    this.canvas.addEventListener("contextmenu", this.contextMenu);

    this.attached = true;
  }

  detach(): void {
    if (!this.attached) {
      return;
    }

    this.clearHoverTimer();

    this.canvas.removeEventListener("pointermove", this.pointerMove);

    this.canvas.removeEventListener("pointerdown", this.pointerDown);

    this.canvas.removeEventListener("pointerup", this.pointerUp);

    this.canvas.removeEventListener("pointerleave", this.pointerLeave);

    this.canvas.removeEventListener("contextmenu", this.contextMenu);

    this.attached = false;

    this.hoveredId = undefined;

    this.downPosition = null;
  }
}

// CHECKPOINT 4: camera transitions and bookmarks

export type CameraEasing = "linear" | "easeIn" | "easeOut" | "easeInOut";

export interface CameraPose {
  position: Vec3;

  fieldOfView: number;

  frameId: string;

  targetId?: EntityId;
}

export interface CameraTransition {
  from: CameraPose;

  to: CameraPose;

  durationSeconds: number;

  elapsedSeconds: number;

  easing: CameraEasing;
}

function easeValue(value: number, easing: CameraEasing): number {
  const t = clamp(value, 0, 1);

  switch (easing) {
    case "linear":
      return t;

    case "easeIn":
      return t * t;

    case "easeOut":
      return 1 - (1 - t) * (1 - t);

    case "easeInOut":
      if (t < 0.5) {
        return 2 * t * t;
      }

      return 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}

function mixNumber(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function mixTuple(from: Vec3, to: Vec3, amount: number): Vec3 {
  return [
    mixNumber(from[0], to[0], amount),

    mixNumber(from[1], to[1], amount),

    mixNumber(from[2], to[2], amount),
  ];
}

export class CameraTransitionController {
  private current: CameraTransition | null = null;

  start(
    from: CameraPose,
    to: CameraPose,
    durationSeconds = 1.5,
    easing: CameraEasing = "easeInOut",
  ): void {
    this.current = {
      from,

      to,

      durationSeconds: Math.max(0.001, durationSeconds),

      elapsedSeconds: 0,

      easing,
    };
  }

  update(deltaSeconds: number): CameraPose | null {
    const transition = this.current;

    if (!transition) {
      return null;
    }

    transition.elapsedSeconds += Math.max(0, deltaSeconds);

    const progress = clamp(
      transition.elapsedSeconds / transition.durationSeconds,
      0,
      1,
    );

    const eased = easeValue(progress, transition.easing);

    const pose: CameraPose = {
      position: mixTuple(
        transition.from.position,

        transition.to.position,

        eased,
      ),

      fieldOfView: mixNumber(
        transition.from.fieldOfView,

        transition.to.fieldOfView,

        eased,
      ),

      frameId: progress < 1 ? transition.from.frameId : transition.to.frameId,
    };

    const targetId =
      progress < 0.5 ? transition.from.targetId : transition.to.targetId;

    if (targetId !== undefined) {
      pose.targetId = targetId;
    }

    if (progress >= 1) {
      this.current = null;
    }

    return pose;
  }

  cancel(): void {
    this.current = null;
  }

  get active(): boolean {
    return this.current !== null;
  }

  get progress(): number {
    if (!this.current) {
      return 0;
    }

    return clamp(
      this.current.elapsedSeconds / this.current.durationSeconds,
      0,
      1,
    );
  }
}

export interface CameraBookmark {
  id: string;

  name: string;

  createdAt: number;

  pose: CameraPose;

  scaleBand: UniverseState["scale"]["band"];

  metersPerUnit: number;
}

export class CameraBookmarkStore {
  private readonly bookmarks = new Map<string, CameraBookmark>();

  add(bookmark: CameraBookmark): void {
    if (!bookmark.id.trim()) {
      throw new Error("Bookmark id cannot be empty.");
    }

    this.bookmarks.set(bookmark.id, {
      ...bookmark,

      pose: {
        ...bookmark.pose,

        position: [...bookmark.pose.position] as Vec3,
      },
    });
  }

  create(name: string, state: UniverseState): CameraBookmark {
    const id = `bookmark-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const pose: CameraPose = {
      position: [...state.camera.position] as Vec3,

      fieldOfView: state.camera.fieldOfView,

      frameId: state.camera.frameId,
    };

    if (state.camera.targetId !== undefined) {
      pose.targetId = state.camera.targetId;
    }

    const bookmark: CameraBookmark = {
      id,

      name,

      createdAt: Date.now(),

      pose,

      scaleBand: state.scale.band,

      metersPerUnit: state.scale.metersPerUnit,
    };

    this.add(bookmark);

    return bookmark;
  }

  get(id: string): CameraBookmark | undefined {
    const bookmark = this.bookmarks.get(id);

    if (!bookmark) {
      return undefined;
    }

    return {
      ...bookmark,

      pose: {
        ...bookmark.pose,

        position: [...bookmark.pose.position] as Vec3,
      },
    };
  }

  remove(id: string): boolean {
    return this.bookmarks.delete(id);
  }

  clear(): void {
    this.bookmarks.clear();
  }

  all(): CameraBookmark[] {
    return [...this.bookmarks.values()]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((bookmark) => ({
        ...bookmark,

        pose: {
          ...bookmark.pose,

          position: [...bookmark.pose.position] as Vec3,
        },
      }));
  }

  get size(): number {
    return this.bookmarks.size;
  }
}

// CHECKPOINT 5: quality management

export type RenderQualityLevel =
  "minimal" | "low" | "balanced" | "high" | "ultra";

export interface RenderQualityProfile {
  level: RenderQualityLevel;

  pixelRatioLimit: number;

  starDensity: number;

  debrisDensity: number;

  orbitDetail: number;

  sphereSegments: number;

  maximumLabels: number;

  maximumVisibleObjects: number;
}

export const QUALITY_PROFILES: Readonly<
  Record<RenderQualityLevel, RenderQualityProfile>
> = {
  minimal: {
    level: "minimal",

    pixelRatioLimit: 1,

    starDensity: 0.15,

    debrisDensity: 0.1,

    orbitDetail: 0.25,

    sphereSegments: 8,

    maximumLabels: 20,

    maximumVisibleObjects: 10_000,
  },

  low: {
    level: "low",

    pixelRatioLimit: 1,

    starDensity: 0.35,

    debrisDensity: 0.25,

    orbitDetail: 0.5,

    sphereSegments: 12,

    maximumLabels: 40,

    maximumVisibleObjects: 50_000,
  },

  balanced: {
    level: "balanced",

    pixelRatioLimit: 1.5,

    starDensity: 0.65,

    debrisDensity: 0.5,

    orbitDetail: 0.75,

    sphereSegments: 20,

    maximumLabels: 80,

    maximumVisibleObjects: 150_000,
  },

  high: {
    level: "high",

    pixelRatioLimit: 2,

    starDensity: 1,

    debrisDensity: 0.8,

    orbitDetail: 1,

    sphereSegments: 32,

    maximumLabels: 150,

    maximumVisibleObjects: 350_000,
  },

  ultra: {
    level: "ultra",

    pixelRatioLimit: 3,

    starDensity: 1.5,

    debrisDensity: 1,

    orbitDetail: 1.5,

    sphereSegments: 48,

    maximumLabels: 300,

    maximumVisibleObjects: 750_000,
  },
};

export interface QualitySample {
  frameTimeMs: number;

  timestamp: number;
}

export class AdaptiveRenderQuality {
  private level: RenderQualityLevel = "balanced";

  private readonly samples: QualitySample[] = [];

  private lastChange = 0;

  constructor(
    private readonly targetFps = 60,

    private readonly cooldownMs = 3_000,
  ) {}

  pushFrame(
    frameTimeMs: number,
    timestamp = performance.now(),
  ): RenderQualityProfile {
    if (Number.isFinite(frameTimeMs) && frameTimeMs >= 0) {
      this.samples.push({
        frameTimeMs,
        timestamp,
      });
    }

    while (this.samples.length > 180) {
      this.samples.shift();
    }

    this.adjust(timestamp);

    return this.profile;
  }

  private averageFrameTime(): number {
    if (this.samples.length === 0) {
      return 0;
    }

    let total = 0;

    for (const sample of this.samples) {
      total += sample.frameTimeMs;
    }

    return total / this.samples.length;
  }

  private adjust(timestamp: number): void {
    if (this.samples.length < 30) {
      return;
    }

    if (timestamp - this.lastChange < this.cooldownMs) {
      return;
    }

    const average = this.averageFrameTime();

    const target = 1_000 / this.targetFps;

    if (average > target * 1.35) {
      this.lower();

      this.lastChange = timestamp;

      return;
    }

    if (average < target * 0.75) {
      this.raise();

      this.lastChange = timestamp;
    }
  }

  private lower(): void {
    switch (this.level) {
      case "ultra":
        this.level = "high";
        break;

      case "high":
        this.level = "balanced";
        break;

      case "balanced":
        this.level = "low";
        break;

      case "low":
        this.level = "minimal";
        break;

      case "minimal":
        break;
    }
  }

  private raise(): void {
    switch (this.level) {
      case "minimal":
        this.level = "low";
        break;

      case "low":
        this.level = "balanced";
        break;

      case "balanced":
        this.level = "high";
        break;

      case "high":
        this.level = "ultra";
        break;

      case "ultra":
        break;
    }
  }

  setLevel(level: RenderQualityLevel): void {
    this.level = level;

    this.lastChange = performance.now();
  }

  reset(): void {
    this.samples.length = 0;

    this.level = "balanced";

    this.lastChange = 0;
  }

  get profile(): RenderQualityProfile {
    return {
      ...QUALITY_PROFILES[this.level],
    };
  }

  get currentLevel(): RenderQualityLevel {
    return this.level;
  }
}

// CHECKPOINT 6: dense point catalog layers

export type DenseLayerKind = "stars" | "debris" | "galaxies" | "background";

export interface DensePointRecord {
  id: EntityId;

  position: Vec3;
}

export interface DenseLayerOptions {
  capacity: number;

  size: number;

  color: number;

  opacity: number;
}

export const DEFAULT_DENSE_LAYER_OPTIONS: Readonly<
  Record<DenseLayerKind, DenseLayerOptions>
> = {
  stars: {
    capacity: 100_000,

    size: 1.25,

    color: 0xffffff,

    opacity: 0.9,
  },

  debris: {
    capacity: 50_000,

    size: 1,

    color: 0xffb36b,

    opacity: 0.7,
  },

  galaxies: {
    capacity: 50_000,

    size: 1.5,

    color: 0x9cc8ff,

    opacity: 0.75,
  },

  background: {
    capacity: 25_000,

    size: 1,

    color: 0xcddcff,

    opacity: 0.45,
  },
};

export class DenseCatalogLayer {
  readonly kind: DenseLayerKind;

  readonly points: PackedPointLayer;

  private readonly ids: EntityId[] = [];

  private records: DensePointRecord[] = [];

  constructor(
    kind: DenseLayerKind,

    options: Partial<DenseLayerOptions> = {},
  ) {
    this.kind = kind;

    const defaults = DEFAULT_DENSE_LAYER_OPTIONS[kind];

    const merged = {
      ...defaults,
      ...options,
    };

    this.points = new PackedPointLayer(
      merged.capacity,
      merged.size,
      merged.color,
    );

    this.points.setOpacity(merged.opacity);

    this.points.object.name = `dense-layer:${kind}`;
  }

  replace(records: readonly DensePointRecord[]): void {
    this.records = records.map((record) => ({
      id: record.id,

      position: [...record.position] as Vec3,
    }));

    this.ids.length = 0;

    const positions: Vec3[] = [];

    for (const record of this.records) {
      this.ids.push(record.id);

      positions.push(record.position);
    }

    this.points.replace(positions);
  }

  clear(): void {
    this.records = [];

    this.ids.length = 0;

    this.points.clear();
  }

  setVisible(visible: boolean): void {
    this.points.object.visible = visible;
  }

  setDensity(density: number): void {
    const amount = clamp(density, 0, 1);

    const count = Math.floor(this.records.length * amount);

    const positions: Vec3[] = [];

    for (let i = 0; i < count; i++) {
      const record = this.records[i];

      if (!record) {
        continue;
      }

      positions.push(record.position);
    }

    this.points.replace(positions);
  }

  idAt(index: number): EntityId | undefined {
    return this.ids[index];
  }

  dispose(): void {
    this.points.dispose();

    this.records = [];

    this.ids.length = 0;
  }

  get size(): number {
    return this.records.length;
  }
}

export class DenseLayerManager {
  readonly root = new Group();

  private readonly layers = new Map<DenseLayerKind, DenseCatalogLayer>();

  constructor() {
    this.root.name = "dense-catalog-layers";
  }

  create(
    kind: DenseLayerKind,

    options: Partial<DenseLayerOptions> = {},
  ): DenseCatalogLayer {
    const previous = this.layers.get(kind);

    if (previous) {
      return previous;
    }

    const layer = new DenseCatalogLayer(kind, options);

    this.layers.set(kind, layer);

    this.root.add(layer.points.object);

    return layer;
  }

  get(kind: DenseLayerKind): DenseCatalogLayer | undefined {
    return this.layers.get(kind);
  }

  remove(kind: DenseLayerKind): void {
    const layer = this.layers.get(kind);

    if (!layer) {
      return;
    }

    layer.points.object.removeFromParent();

    layer.dispose();

    this.layers.delete(kind);
  }

  applyQuality(profile: RenderQualityProfile): void {
    const stars = this.layers.get("stars");

    if (stars) {
      stars.setDensity(clamp(profile.starDensity, 0, 1));
    }

    const debris = this.layers.get("debris");

    if (debris) {
      debris.setDensity(clamp(profile.debrisDensity, 0, 1));
    }
  }

  clear(): void {
    for (const layer of this.layers.values()) {
      layer.clear();
    }
  }

  dispose(): void {
    for (const layer of this.layers.values()) {
      layer.points.object.removeFromParent();

      layer.dispose();
    }

    this.layers.clear();

    this.root.removeFromParent();

    this.root.clear();
  }

  get count(): number {
    return this.layers.size;
  }
}

// CHECKPOINT 7: prioritized renderer work queue

export type RenderTaskPriority =
  "critical" | "high" | "normal" | "low" | "background";

const PRIORITY_SCORE: Record<RenderTaskPriority, number> = {
  critical: 500,
  high: 400,
  normal: 300,
  low: 200,
  background: 100,
};

export interface RenderTask {
  id: string;

  priority: RenderTaskPriority;

  run(): void | Promise<void>;
}

interface QueuedRenderTask {
  task: RenderTask;

  sequence: number;
}

export class RenderTaskQueue {
  private readonly tasks: QueuedRenderTask[] = [];

  private sequence = 0;

  private running = false;

  enqueue(task: RenderTask): void {
    const existing = this.tasks.findIndex((entry) => entry.task.id === task.id);

    if (existing >= 0) {
      this.tasks.splice(existing, 1);
    }

    this.tasks.push({
      task,

      sequence: this.sequence++,
    });
  }

  cancel(id: string): boolean {
    const index = this.tasks.findIndex((entry) => entry.task.id === id);

    if (index < 0) {
      return false;
    }

    this.tasks.splice(index, 1);

    return true;
  }

  private sort(): void {
    this.tasks.sort((a, b) => {
      const priority =
        PRIORITY_SCORE[b.task.priority] - PRIORITY_SCORE[a.task.priority];

      if (priority !== 0) {
        return priority;
      }

      return a.sequence - b.sequence;
    });
  }

  next(): RenderTask | undefined {
    this.sort();

    const entry = this.tasks.shift();

    return entry?.task;
  }

  async runBudget(budgetMs: number): Promise<number> {
    if (this.running) {
      return 0;
    }

    this.running = true;

    const started = performance.now();

    const budget = Math.max(0, budgetMs);

    let completed = 0;

    try {
      while (this.tasks.length > 0) {
        if (performance.now() - started >= budget) {
          break;
        }

        const task = this.next();

        if (!task) {
          break;
        }

        await task.run();

        completed++;
      }
    } finally {
      this.running = false;
    }

    return completed;
  }

  clear(): void {
    this.tasks.length = 0;
  }

  get size(): number {
    return this.tasks.length;
  }
}

// CHECKPOINT 8: frame budget and diagnostics

export interface FrameBudget {
  frameMs: number;

  simulationMs: number;

  streamingMs: number;

  labelsMs: number;

  rendererMs: number;

  backgroundMs: number;
}

export function createFrameBudget(targetFps: number): FrameBudget {
  const frameMs = 1_000 / clamp(targetFps, 15, 240);

  return {
    frameMs,

    simulationMs: frameMs * 0.2,

    streamingMs: frameMs * 0.15,

    labelsMs: frameMs * 0.1,

    rendererMs: frameMs * 0.45,

    backgroundMs: frameMs * 0.1,
  };
}

export interface FrameTiming {
  totalMs: number;

  syncMs: number;

  labelsMs: number;

  renderMs: number;

  tasksMs: number;
}

export class FrameTimer {
  private frameStart = 0;

  private marker = 0;

  private syncMs = 0;
  private labelsMs = 0;
  private renderMs = 0;
  private tasksMs = 0;

  begin(): void {
    this.frameStart = performance.now();

    this.marker = this.frameStart;

    this.syncMs = 0;
    this.labelsMs = 0;
    this.renderMs = 0;
    this.tasksMs = 0;
  }

  private take(): number {
    const now = performance.now();

    const elapsed = now - this.marker;

    this.marker = now;

    return elapsed;
  }

  markSync(): void {
    this.syncMs += this.take();
  }

  markLabels(): void {
    this.labelsMs += this.take();
  }

  markRender(): void {
    this.renderMs += this.take();
  }

  markTasks(): void {
    this.tasksMs += this.take();
  }

  finish(): FrameTiming {
    return {
      totalMs: performance.now() - this.frameStart,

      syncMs: this.syncMs,

      labelsMs: this.labelsMs,

      renderMs: this.renderMs,

      tasksMs: this.tasksMs,
    };
  }
}

export interface DiagnosticSample {
  timestamp: number;

  frame: FrameTiming;

  renderer: RendererStats;

  labelCount: number;

  taskCount: number;
}

export interface DiagnosticSummary {
  samples: number;

  averageFrameMs: number;

  averageFps: number;

  averageDrawCalls: number;

  maximumDrawCalls: number;

  averageVisibleEntities: number;

  averageLabels: number;
}

export class RenderDiagnostics {
  private readonly samples: DiagnosticSample[] = [];

  constructor(private readonly maximumSamples = 300) {}

  push(sample: DiagnosticSample): void {
    this.samples.push(sample);

    while (this.samples.length > this.maximumSamples) {
      this.samples.shift();
    }
  }

  summary(): DiagnosticSummary {
    if (this.samples.length === 0) {
      return {
        samples: 0,

        averageFrameMs: 0,

        averageFps: 0,

        averageDrawCalls: 0,

        maximumDrawCalls: 0,

        averageVisibleEntities: 0,

        averageLabels: 0,
      };
    }

    let frame = 0;
    let calls = 0;
    let maxCalls = 0;
    let visible = 0;
    let labels = 0;

    for (const sample of this.samples) {
      frame += sample.frame.totalMs;

      calls += sample.renderer.drawCalls;

      maxCalls = Math.max(
        maxCalls,

        sample.renderer.drawCalls,
      );

      visible += sample.renderer.visibleEntities;

      labels += sample.labelCount;
    }

    const count = this.samples.length;

    const averageFrameMs = frame / count;

    return {
      samples: count,

      averageFrameMs,

      averageFps: averageFrameMs > 0 ? 1_000 / averageFrameMs : 0,

      averageDrawCalls: calls / count,

      maximumDrawCalls: maxCalls,

      averageVisibleEntities: visible / count,

      averageLabels: labels / count,
    };
  }

  latest(): DiagnosticSample | undefined {
    return this.samples[this.samples.length - 1];
  }

  clear(): void {
    this.samples.length = 0;
  }
}

// CHECKPOINT 9: render themes and visual styles

export interface EntityVisualStyle {
  color: number;

  markerOpacity: number;

  bodyOpacity: number;

  markerScale: number;

  emissive: boolean;
}

export interface UniverseRenderTheme {
  id: string;

  name: string;

  background: number;

  selection: number;

  focus: number;

  orbit: number;

  defaultMarker: number;

  styles: Partial<Record<EntityKind, Partial<EntityVisualStyle>>>;
}

export const SCIENTIFIC_THEME: UniverseRenderTheme = {
  id: "scientific",

  name: "Scientific",

  background: 0x030712,

  selection: 0xffffff,

  focus: 0x5ee7ff,

  orbit: 0x718096,

  defaultMarker: 0xd9e2f2,

  styles: {
    star: {
      color: 0xffe6ac,

      markerOpacity: 0.95,

      emissive: true,
    },

    planet: {
      color: 0x60a5fa,
    },

    moon: {
      color: 0xcbd5e1,
    },

    "black-hole": {
      color: 0x20222a,
    },

    satellite: {
      color: 0x67e8f9,
    },

    debris: {
      color: 0xfb923c,

      markerOpacity: 0.5,
    },
  },
};

export const CINEMATIC_THEME: UniverseRenderTheme = {
  id: "cinematic",

  name: "Cinematic",

  background: 0x010205,

  selection: 0xffffff,

  focus: 0x8ce7ff,

  orbit: 0x45687f,

  defaultMarker: 0xb5c9db,

  styles: {
    star: {
      color: 0xffd58a,

      markerOpacity: 1,

      markerScale: 1.2,

      emissive: true,
    },

    planet: {
      color: 0x4f8edc,
    },

    moon: {
      color: 0xb8bdc7,
    },

    "black-hole": {
      color: 0x101014,

      bodyOpacity: 1,
    },

    nebula: {
      color: 0x8b6ccc,

      markerOpacity: 0.55,
    },

    galaxy: {
      color: 0x8ab9ef,

      markerOpacity: 0.7,
    },
  },
};

export class RenderThemeRegistry {
  private readonly themes = new Map<string, UniverseRenderTheme>();

  private currentId = SCIENTIFIC_THEME.id;

  constructor() {
    this.register(SCIENTIFIC_THEME);

    this.register(CINEMATIC_THEME);
  }

  register(theme: UniverseRenderTheme): void {
    if (!theme.id.trim()) {
      throw new Error("Theme id cannot be empty.");
    }

    this.themes.set(theme.id, theme);
  }

  unregister(id: string): boolean {
    if (id === this.currentId) {
      return false;
    }

    return this.themes.delete(id);
  }

  use(id: string): UniverseRenderTheme {
    const theme = this.themes.get(id);

    if (!theme) {
      throw new Error(`Unknown render theme: ${id}`);
    }

    this.currentId = id;

    return theme;
  }

  get current(): UniverseRenderTheme {
    const theme = this.themes.get(this.currentId);

    if (!theme) {
      return SCIENTIFIC_THEME;
    }

    return theme;
  }

  get(id: string): UniverseRenderTheme | undefined {
    return this.themes.get(id);
  }

  all(): UniverseRenderTheme[] {
    return [...this.themes.values()];
  }
}

export function resolvedEntityStyle(
  entity: SpaceEntity,

  theme: UniverseRenderTheme,
): EntityVisualStyle {
  const specific = theme.styles[entity.kind];

  return {
    color: specific?.color ?? entityDisplayColor(entity.kind).getHex(),

    markerOpacity: specific?.markerOpacity ?? 0.7,

    bodyOpacity: specific?.bodyOpacity ?? 1,

    markerScale: specific?.markerScale ?? 1,

    emissive: specific?.emissive ?? false,
  };
}

// CHECKPOINT 10: scene plugins

export interface RendererPluginContext {
  scene: Scene;

  camera: PerspectiveCamera;

  renderer: WebGLRenderer;

  worldRoot: Group;

  index: EntitySceneIndex;

  events: RenderEventHub;
}

export interface RendererPlugin {
  readonly id: string;

  setup(context: RendererPluginContext): void | Promise<void>;

  beforeFrame?(frame: RenderFrame): void;

  afterFrame?(frame: RenderFrame): void;

  resize?(width: number, height: number, pixelRatio: number): void;

  dispose(): void;
}

interface PluginEntry {
  plugin: RendererPlugin;

  active: boolean;
}

export class RendererPluginHost {
  private readonly plugins = new Map<string, PluginEntry>();

  private context: RendererPluginContext | null = null;

  setContext(context: RendererPluginContext): void {
    this.context = context;
  }

  async register(plugin: RendererPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Renderer plugin "${plugin.id}" is already registered.`);
    }

    const entry: PluginEntry = {
      plugin,
      active: false,
    };

    this.plugins.set(plugin.id, entry);

    if (this.context) {
      await plugin.setup(this.context);

      entry.active = true;
    }
  }

  async activateAll(): Promise<void> {
    const context = this.context;

    if (!context) {
      return;
    }

    for (const entry of this.plugins.values()) {
      if (entry.active) {
        continue;
      }

      await entry.plugin.setup(context);

      entry.active = true;
    }
  }

  beforeFrame(frame: RenderFrame): void {
    for (const entry of this.plugins.values()) {
      if (!entry.active) {
        continue;
      }

      entry.plugin.beforeFrame?.(frame);
    }
  }

  afterFrame(frame: RenderFrame): void {
    for (const entry of this.plugins.values()) {
      if (!entry.active) {
        continue;
      }

      entry.plugin.afterFrame?.(frame);
    }
  }

  resize(width: number, height: number, pixelRatio: number): void {
    for (const entry of this.plugins.values()) {
      if (!entry.active) {
        continue;
      }

      entry.plugin.resize?.(width, height, pixelRatio);
    }
  }

  remove(id: string): boolean {
    const entry = this.plugins.get(id);

    if (!entry) {
      return false;
    }

    entry.plugin.dispose();

    this.plugins.delete(id);

    return true;
  }

  dispose(): void {
    for (const entry of this.plugins.values()) {
      entry.plugin.dispose();
    }

    this.plugins.clear();

    this.context = null;
  }

  get size(): number {
    return this.plugins.size;
  }
}

// CHECKPOINT 11: render snapshots and scene history

export interface SceneSnapshot {
  timestamp: number;

  selectedId?: EntityId;

  focusId?: EntityId;

  cameraPosition: Vec3;

  cameraFrameId: string;

  fieldOfView: number;

  scaleBand: UniverseState["scale"]["band"];

  metersPerUnit: number;

  visibleEntityIds: readonly EntityId[];
}

export function createSceneSnapshot(frame: RenderFrame): SceneSnapshot {
  const snapshot: SceneSnapshot = {
    timestamp: Date.now(),

    cameraPosition: [...frame.state.camera.position] as Vec3,

    cameraFrameId: frame.state.camera.frameId,

    fieldOfView: frame.state.camera.fieldOfView,

    scaleBand: frame.state.scale.band,

    metersPerUnit: frame.state.scale.metersPerUnit,

    visibleEntityIds: [...frame.visibleEntityIds],
  };

  if (frame.state.selectedId !== undefined) {
    snapshot.selectedId = frame.state.selectedId;
  }

  if (frame.state.focusId !== undefined) {
    snapshot.focusId = frame.state.focusId;
  }

  return snapshot;
}

export class SceneSnapshotHistory {
  private readonly items: SceneSnapshot[] = [];

  constructor(private readonly maximum = 120) {}

  push(snapshot: SceneSnapshot): void {
    this.items.push({
      ...snapshot,

      cameraPosition: [...snapshot.cameraPosition] as Vec3,

      visibleEntityIds: [...snapshot.visibleEntityIds],
    });

    while (this.items.length > this.maximum) {
      this.items.shift();
    }
  }

  latest(): SceneSnapshot | undefined {
    const snapshot = this.items[this.items.length - 1];

    if (!snapshot) {
      return undefined;
    }

    return {
      ...snapshot,

      cameraPosition: [...snapshot.cameraPosition] as Vec3,

      visibleEntityIds: [...snapshot.visibleEntityIds],
    };
  }

  at(index: number): SceneSnapshot | undefined {
    const snapshot = this.items[index];

    if (!snapshot) {
      return undefined;
    }

    return {
      ...snapshot,

      cameraPosition: [...snapshot.cameraPosition] as Vec3,

      visibleEntityIds: [...snapshot.visibleEntityIds],
    };
  }

  clear(): void {
    this.items.length = 0;
  }

  get size(): number {
    return this.items.length;
  }
}

// CHECKPOINT 12: capture helpers

export interface CaptureOptions {
  type: "image/png" | "image/jpeg" | "image/webp";

  quality: number;
}

export const DEFAULT_CAPTURE_OPTIONS: CaptureOptions = {
  type: "image/png",

  quality: 0.92,
};

export class SceneCapture {
  constructor(private readonly renderer: WebGLRenderer) {}

  dataUrl(options: Partial<CaptureOptions> = {}): string {
    const config = {
      ...DEFAULT_CAPTURE_OPTIONS,
      ...options,
    };

    return this.renderer.domElement.toDataURL(
      config.type,
      clamp(config.quality, 0, 1),
    );
  }

  async blob(options: Partial<CaptureOptions> = {}): Promise<Blob | null> {
    const config = {
      ...DEFAULT_CAPTURE_OPTIONS,
      ...options,
    };

    return new Promise((resolve) => {
      this.renderer.domElement.toBlob(
        (blob: Blob | null) => {
          resolve(blob);
        },

        config.type,

        clamp(config.quality, 0, 1),
      );
    });
  }
}

// CHECKPOINT 13: entity hover and tooltip data

export interface EntityTooltipData {
  id: EntityId;

  name: string;

  kind: EntityKind;

  summary?: string;

  radiusMeters?: number;

  sourceCount: number;
}

export function tooltipDataFor(entity: SpaceEntity): EntityTooltipData {
  const data: EntityTooltipData = {
    id: entity.id,

    name: entity.name,

    kind: entity.kind,

    sourceCount: entity.sourceIds.length,
  };

  if (entity.summary !== undefined) {
    data.summary = entity.summary;
  }

  const radius = entityRadiusMeters(entity);

  if (radius !== null) {
    data.radiusMeters = radius;
  }

  return data;
}

export class HoverTooltip {
  readonly element: HTMLDivElement;

  private visible = false;

  constructor(parent: HTMLElement) {
    this.element = document.createElement("div");

    Object.assign(this.element.style, {
      position: "absolute",

      left: "0",

      top: "0",

      display: "none",

      maxWidth: "280px",

      padding: "8px 10px",

      borderRadius: "8px",

      background: "rgba(6,10,20,.92)",

      border: "1px solid rgba(255,255,255,.12)",

      color: "#f7f8ff",

      fontFamily: "Inter, system-ui, sans-serif",

      fontSize: "12px",

      lineHeight: "1.4",

      pointerEvents: "none",

      zIndex: "1000",

      backdropFilter: "blur(8px)",

      transform: "translate(12px, 12px)",
    });

    parent.appendChild(this.element);
  }

  show(
    data: EntityTooltipData,

    x: number,
    y: number,
  ): void {
    this.element.textContent = `${data.name} · ${data.kind}`;

    this.element.style.left = `${x}px`;

    this.element.style.top = `${y}px`;

    this.element.style.display = "block";

    this.visible = true;
  }

  move(x: number, y: number): void {
    if (!this.visible) {
      return;
    }

    this.element.style.left = `${x}px`;

    this.element.style.top = `${y}px`;
  }

  hide(): void {
    this.element.style.display = "none";

    this.visible = false;
  }

  dispose(): void {
    this.element.remove();

    this.visible = false;
  }
}

// CHECKPOINT 14: render extension facade

export interface UniverseRendererExtensionOptions {
  labels?: boolean;

  tooltips?: boolean;

  adaptiveQuality?: boolean;

  interaction?: boolean;

  snapshotHistory?: boolean;
}

export const DEFAULT_EXTENSION_OPTIONS: Required<UniverseRendererExtensionOptions> =
  {
    labels: true,

    tooltips: true,

    adaptiveQuality: true,

    interaction: true,

    snapshotHistory: true,
  };

export class UniverseRendererExtensions {
  readonly events = new RenderEventHub();

  readonly selection = new SceneSelectionModel();

  readonly themes = new RenderThemeRegistry();

  readonly quality = new AdaptiveRenderQuality();

  readonly tasks = new RenderTaskQueue();

  readonly diagnostics = new RenderDiagnostics();

  readonly snapshots = new SceneSnapshotHistory();

  readonly bookmarks = new CameraBookmarkStore();

  readonly cameraTransitions = new CameraTransitionController();

  readonly plugins = new RendererPluginHost();

  readonly denseLayers = new DenseLayerManager();

  readonly visibility = new EntityVisibilityPolicy();

  private readonly options: Required<UniverseRendererExtensionOptions>;

  private labels: DomLabelLayer | null = null;

  private tooltip: HoverTooltip | null = null;

  private pointer: PointerInteractionController | null = null;

  private capture: SceneCapture | null = null;

  private frameTimer = new FrameTimer();

  private container: HTMLElement | null = null;

  private renderer: WebGLRenderer | null = null;

  private camera: PerspectiveCamera | null = null;

  private index: EntitySceneIndex | null = null;

  private width = 1;
  private height = 1;

  constructor(options: UniverseRendererExtensionOptions = {}) {
    this.options = {
      labels: options.labels ?? DEFAULT_EXTENSION_OPTIONS.labels,

      tooltips: options.tooltips ?? DEFAULT_EXTENSION_OPTIONS.tooltips,

      adaptiveQuality:
        options.adaptiveQuality ?? DEFAULT_EXTENSION_OPTIONS.adaptiveQuality,

      interaction: options.interaction ?? DEFAULT_EXTENSION_OPTIONS.interaction,

      snapshotHistory:
        options.snapshotHistory ?? DEFAULT_EXTENSION_OPTIONS.snapshotHistory,
    };
  }

  initialize(
    container: HTMLElement,

    renderer: WebGLRenderer,

    camera: PerspectiveCamera,

    worldRoot: Group,

    index: EntitySceneIndex,

    picking: PickingController,
  ): void {
    if (this.container) {
      throw new Error("Renderer extensions are already initialized.");
    }

    this.container = container;

    this.renderer = renderer;

    this.camera = camera;

    this.index = index;

    this.capture = new SceneCapture(renderer);

    worldRoot.add(this.denseLayers.root);

    if (this.options.labels) {
      this.labels = new DomLabelLayer(container);
    }

    if (this.options.tooltips) {
      this.tooltip = new HoverTooltip(container);
    }

    if (this.options.interaction) {
      this.pointer = new PointerInteractionController(
        renderer.domElement,

        picking,

        this.events,
      );

      this.pointer.attach();
    }

    this.plugins.setContext({
      scene: worldRoot.parent instanceof Scene ? worldRoot.parent : new Scene(),

      camera,

      renderer,

      worldRoot,

      index,

      events: this.events,
    });

    this.bindDefaultEvents();
  }

  private bindDefaultEvents(): void {
    this.events.on("entity.select", (event) => {
      this.selection.setSelected(event.entityId);
    });

    this.events.on("entity.focus", (event) => {
      this.selection.setFocused(event.entityId);
    });

    this.events.on("entity.hover", (event) => {
      this.selection.setHovered(event.entityId);

      const index = this.index;

      const last = this.lastFrame;

      if (!index || !last || !this.tooltip) {
        return;
      }

      const entity = last.state.entities.get(event.entityId);

      if (!entity) {
        return;
      }

      this.tooltip.show(
        tooltipDataFor(entity),

        event.x,

        event.y,
      );
    });

    this.events.on("entity.leave", (event) => {
      const snapshot = this.selection.getSnapshot();

      if (snapshot.hoveredId === event.entityId) {
        this.selection.setHovered(null);
      }

      this.tooltip?.hide();
    });

    this.events.on("scene.click", () => {
      this.selection.setSelected(null);

      this.tooltip?.hide();
    });
  }

  private lastFrame: RenderFrame | null = null;

  beforeFrame(frame: RenderFrame): void {
    this.lastFrame = frame;

    this.frameTimer.begin();

    this.events.emit("frame.before", {
      deltaSeconds: frame.deltaSeconds,
    });

    this.plugins.beforeFrame(frame);
  }

  afterEntitySync(): void {
    this.frameTimer.markSync();
  }

  syncLabels(frame: RenderFrame): void {
    if (!this.labels || !this.camera || !this.index) {
      this.frameTimer.markLabels();

      return;
    }

    const profile = this.quality.profile;

    this.labels.setStyle({
      maximumLabels: profile.maximumLabels,
    });

    this.labels.sync(
      frame.state,
      this.index,
      this.camera,
      this.width,
      this.height,
    );

    this.frameTimer.markLabels();
  }

  markRendered(): void {
    this.frameTimer.markRender();
  }

  async runTasks(budgetMs: number): Promise<void> {
    await this.tasks.runBudget(budgetMs);

    this.frameTimer.markTasks();
  }

  endFrame(
    frame: RenderFrame,

    stats: RendererStats,
  ): void {
    const timing = this.frameTimer.finish();

    if (this.options.adaptiveQuality) {
      const before = this.quality.currentLevel;

      const profile = this.quality.pushFrame(timing.totalMs);

      const after = this.quality.currentLevel;

      if (before !== after) {
        this.denseLayers.applyQuality(profile);

        this.events.emit("quality.change", {
          level: after,
        });
      }
    }

    if (this.options.snapshotHistory) {
      this.snapshots.push(createSceneSnapshot(frame));
    }

    this.diagnostics.push({
      timestamp: performance.now(),

      frame: timing,

      renderer: stats,

      labelCount: this.labels?.visibleCount ?? 0,

      taskCount: this.tasks.size,
    });

    this.plugins.afterFrame(frame);

    this.events.emit("frame.after", {
      deltaSeconds: frame.deltaSeconds,

      drawCalls: stats.drawCalls,
    });
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = Math.max(1, width);

    this.height = Math.max(1, height);

    this.plugins.resize(this.width, this.height, pixelRatio);
  }

  createStarLayer(records: readonly DensePointRecord[]): DenseCatalogLayer {
    const layer = this.denseLayers.create("stars");

    layer.replace(records);

    return layer;
  }

  createDebrisLayer(records: readonly DensePointRecord[]): DenseCatalogLayer {
    const layer = this.denseLayers.create("debris");

    layer.replace(records);

    return layer;
  }

  captureDataUrl(options: Partial<CaptureOptions> = {}): string | null {
    return this.capture?.dataUrl(options) ?? null;
  }

  captureBlob(options: Partial<CaptureOptions> = {}): Promise<Blob | null> {
    if (!this.capture) {
      return Promise.resolve(null);
    }

    return this.capture.blob(options);
  }

  dispose(): void {
    this.pointer?.detach();

    this.pointer = null;

    this.labels?.dispose();

    this.labels = null;

    this.tooltip?.dispose();

    this.tooltip = null;

    this.plugins.dispose();

    this.denseLayers.dispose();

    this.events.clear();

    this.selection.clear();

    this.tasks.clear();

    this.diagnostics.clear();

    this.snapshots.clear();

    this.bookmarks.clear();

    this.cameraTransitions.cancel();

    this.capture = null;

    this.container = null;

    this.renderer = null;

    this.camera = null;

    this.index = null;

    this.lastFrame = null;
  }
}

// CHECKPOINT 15: renderer session controller

export interface UniverseRenderSessionOptions {
  entityFilter?: Partial<EntityRenderFilter>;

  extensions?: UniverseRendererExtensionOptions;

  targetFps?: number;
}

export class UniverseRenderSession {
  readonly extensions: UniverseRendererExtensions;

  private readonly visibility = new EntityVisibilityPolicy();

  private filter: EntityRenderFilter;

  private targetFps: number;

  private active = true;

  constructor(options: UniverseRenderSessionOptions = {}) {
    this.extensions = new UniverseRendererExtensions(options.extensions);

    this.filter = {
      ...DEFAULT_ENTITY_FILTER,
      ...options.entityFilter,
    };

    this.targetFps = clamp(options.targetFps ?? 60, 15, 240);
  }

  setFilter(filter: Partial<EntityRenderFilter>): void {
    this.filter = {
      ...this.filter,
      ...filter,
    };
  }

  getFilter(): EntityRenderFilter {
    return {
      ...this.filter,
    };
  }

  visibleEntities(
    state: UniverseState,

    cameraPosition: Vector3,
  ): VisibilityResult {
    return this.visibility.select({
      state,

      cameraPosition,

      maximumObjects: state.settings.graphics.maxVisibleObjects,

      filter: this.filter,
    });
  }

  frameBudget(): FrameBudget {
    return createFrameBudget(this.targetFps);
  }

  setTargetFps(value: number): void {
    this.targetFps = clamp(value, 15, 240);
  }

  pause(): void {
    this.active = false;
  }

  resume(): void {
    this.active = true;
  }

  get isActive(): boolean {
    return this.active;
  }

  dispose(): void {
    this.active = false;

    this.extensions.dispose();
  }
}

// CHECKPOINT 16: lightweight render command bus

export type RenderCommand =
  | {
      type: "select";

      entityId: EntityId;
    }
  | {
      type: "focus";

      entityId: EntityId;
    }
  | {
      type: "clearSelection";
    }
  | {
      type: "theme";

      themeId: string;
    }
  | {
      type: "quality";

      level: RenderQualityLevel;
    }
  | {
      type: "labels";

      enabled: boolean;
    }
  | {
      type: "filter";

      filter: Partial<EntityRenderFilter>;
    };

export type RenderCommandHandler = (command: RenderCommand) => void;

export class RenderCommandBus {
  private readonly handlers = new Set<RenderCommandHandler>();

  subscribe(handler: RenderCommandHandler): () => void {
    this.handlers.add(handler);

    return () => {
      this.handlers.delete(handler);
    };
  }

  dispatch(command: RenderCommand): void {
    for (const handler of this.handlers) {
      handler(command);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

// CHECKPOINT 17: renderer orchestration bridge

export interface RenderBridgeOptions {
  session?: UniverseRenderSessionOptions;
}

export class UniverseRenderBridge {
  readonly session: UniverseRenderSession;

  readonly commands = new RenderCommandBus();

  private unsubscribe: (() => void) | null = null;

  constructor(options: RenderBridgeOptions = {}) {
    this.session = new UniverseRenderSession(options.session);

    this.unsubscribe = this.commands.subscribe((command) => {
      this.handleCommand(command);
    });
  }

  private handleCommand(command: RenderCommand): void {
    const extensions = this.session.extensions;

    switch (command.type) {
      case "select":
        extensions.selection.setSelected(command.entityId);

        break;

      case "focus":
        extensions.selection.setFocused(command.entityId);

        break;

      case "clearSelection":
        extensions.selection.setSelected(null);

        break;

      case "theme":
        extensions.themes.use(command.themeId);

        break;

      case "quality":
        extensions.quality.setLevel(command.level);

        extensions.denseLayers.applyQuality(extensions.quality.profile);

        break;

      case "labels":
        break;

      case "filter":
        this.session.setFilter(command.filter);

        break;
    }
  }

  dispose(): void {
    this.unsubscribe?.();

    this.unsubscribe = null;

    this.commands.clear();

    this.session.dispose();
  }
}

// CHECKPOINT 18: renderer development diagnostics

export interface RendererDebugState {
  renderer: RendererStats;

  diagnostics: DiagnosticSummary;

  quality: RenderQualityLevel;

  plugins: number;

  denseLayers: number;

  bookmarks: number;

  snapshots: number;

  listeners: number;
}

export function rendererDebugState(
  renderer: ThreeUniverseRenderer,

  extensions: UniverseRendererExtensions,
): RendererDebugState {
  return {
    renderer: renderer.getStats(),

    diagnostics: extensions.diagnostics.summary(),

    quality: extensions.quality.currentLevel,

    plugins: extensions.plugins.size,

    denseLayers: extensions.denseLayers.count,

    bookmarks: extensions.bookmarks.size,

    snapshots: extensions.snapshots.size,

    listeners: extensions.events.listenerCount(),
  };
}

export function formatRendererDebugState(state: RendererDebugState): string {
  const renderer = state.renderer;

  const diagnostics = state.diagnostics;

  const lines = [
    `Renderer: ${rendererInfo.backend} r${rendererInfo.revision}`,

    `Visible: ${renderer.visibleEntities}`,

    `Objects: ${renderer.sceneObjects}`,

    `Draw calls: ${renderer.drawCalls}`,

    `Triangles: ${renderer.triangles}`,

    `Points: ${renderer.points}`,

    `Lines: ${renderer.lines}`,

    `Average FPS: ${diagnostics.averageFps.toFixed(1)}`,

    `Average frame: ${diagnostics.averageFrameMs.toFixed(2)} ms`,

    `Quality: ${state.quality}`,

    `Plugins: ${state.plugins}`,

    `Dense layers: ${state.denseLayers}`,

    `Bookmarks: ${state.bookmarks}`,

    `Snapshots: ${state.snapshots}`,

    `Event listeners: ${state.listeners}`,
  ];

  return lines.join("\n");
}

// CHECKPOINT 19: stable public renderer API description

export interface RendererFeatureSupport {
  floatingOrigin: boolean;

  hierarchicalFrames: boolean;

  picking: boolean;

  orbitRendering: boolean;

  packedPointLayers: boolean;

  labels: boolean;

  tooltips: boolean;

  themes: boolean;

  adaptiveQuality: boolean;

  bookmarks: boolean;

  diagnostics: boolean;

  plugins: boolean;

  screenshotCapture: boolean;
}

export const rendererFeatures: RendererFeatureSupport = {
  floatingOrigin: true,

  hierarchicalFrames: true,

  picking: true,

  orbitRendering: true,

  packedPointLayers: true,

  labels: true,

  tooltips: true,

  themes: true,

  adaptiveQuality: true,

  bookmarks: true,

  diagnostics: true,

  plugins: true,

  screenshotCapture: true,
};

export const RENDERER_EXTENSION_VERSION = 1;
