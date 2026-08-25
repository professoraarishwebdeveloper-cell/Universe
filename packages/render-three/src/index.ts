import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Raycaster,
  REVISION,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

import { METERS_PER_UNIT } from "@known-universe/core";

import type {
  DistanceUnit,
  EntityId,
  EntityKind,
  FrameId,
  SpaceEntity,
  SpatialPosition,
  Vec3,
} from "@known-universe/core";

import type {
  RenderFrame,
  UniverseRenderer,
  UniverseState,
} from "@known-universe/engine";

export const RENDER_THREE_VERSION = 2;

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function positiveFinite(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function degreesToRadians(degrees: number | undefined): number {
  if (degrees === undefined || !Number.isFinite(degrees)) {
    return 0;
  }

  return (degrees * Math.PI) / 180;
}

function entityRadiusMeters(entity: SpaceEntity): number {
  const radius = entity.physical?.radiusM?.value;

  if (radius !== undefined && Number.isFinite(radius) && radius > 0) {
    return radius;
  }

  return 1;
}

function minimumMarkerRadius(kind: EntityKind): number {
  switch (kind) {
    case "star":
      return 0.045;

    case "planet":
    case "dwarf-planet":
      return 0.035;

    case "moon":
      return 0.025;

    case "black-hole":
    case "neutron-star":
      return 0.035;

    case "galaxy":
    case "galaxy-group":
    case "galaxy-cluster":
    case "cosmic-structure":
      return 0.06;

    case "nebula":
    case "star-cluster":
      return 0.045;

    case "asteroid":
    case "comet":
    case "satellite":
    case "spacecraft":
    case "debris":
      return 0.012;

    case "surface-feature":
    case "building":
    case "city":
    case "country":
      return 0.02;
  }
}

function entitySceneRadius(
  entity: SpaceEntity,
  metersPerSceneUnit = 1,
  minimum?: number,
): number {
  const divisor = positiveFinite(metersPerSceneUnit, 1);

  const physical = entityRadiusMeters(entity) / divisor;

  const markerMinimum = minimum ?? minimumMarkerRadius(entity.kind);

  return clamp(Math.max(physical, markerMinimum), markerMinimum, 1e9);
}

function entityDisplayColor(kind: EntityKind): Color {
  switch (kind) {
    case "star":
      return new Color(0xffe3a6);

    case "planet":
      return new Color(0x5f9df7);

    case "dwarf-planet":
      return new Color(0x8ca7c7);

    case "moon":
      return new Color(0xbec6d1);

    case "black-hole":
      return new Color(0x171821);

    case "neutron-star":
      return new Color(0xdde8ff);

    case "asteroid":
      return new Color(0x9b8b78);

    case "comet":
      return new Color(0xa8d8e8);

    case "satellite":
      return new Color(0x83d9ff);

    case "spacecraft":
      return new Color(0xf0d18a);

    case "debris":
      return new Color(0xd99b61);

    case "nebula":
      return new Color(0xb071c9);

    case "star-cluster":
      return new Color(0xe4d8ff);

    case "galaxy":
      return new Color(0x9dbfff);

    case "galaxy-group":
      return new Color(0x9b9bea);

    case "galaxy-cluster":
      return new Color(0xa78bfa);

    case "cosmic-structure":
      return new Color(0x7f8fb5);

    case "surface-feature":
      return new Color(0x8da87e);

    case "building":
      return new Color(0xc4c8ce);

    case "city":
      return new Color(0xffd37a);

    case "country":
      return new Color(0x91b8d9);
  }
}

export interface RendererStats {
  drawCalls: number;

  triangles: number;

  points: number;

  lines: number;

  objects: number;

  sceneObjects: number;

  frameMs: number;

  visibleEntities: number;

  backend: string;
}

export const rendererInfo = {
  backend: "three",

  revision: REVISION,
} as const;

/*
 * Reference-frame integration
 *
 * The renderer never pretends that two unrelated reference
 * frames share one universal XYZ system.
 *
 * Same-frame positions work without a provider. Cross-frame
 * transforms require an explicit FrameTransformProvider.
 */

export interface FrameTransformContext {
  entity: SpaceEntity;

  state: UniverseState;

  fromFrameId: FrameId;

  toFrameId: FrameId;

  sourceUnit: DistanceUnit;

  positionMeters: Vec3;
}

export interface FrameTransformProvider {
  transform(context: FrameTransformContext): Vec3 | null;
}

function spatialMeters(spatial: SpatialPosition): Vec3 {
  const multiplier = METERS_PER_UNIT[spatial.unit];

  return [
    spatial.position[0] * multiplier,

    spatial.position[1] * multiplier,

    spatial.position[2] * multiplier,
  ];
}

function sceneUnits(positionMeters: Vec3, metersPerSceneUnit: number): Vector3 {
  const divisor = positiveFinite(metersPerSceneUnit, 1);

  return new Vector3(
    positionMeters[0] / divisor,

    positionMeters[1] / divisor,

    positionMeters[2] / divisor,
  );
}

export class FrameSpace {
  private transformProvider: FrameTransformProvider | null;

  constructor(transformProvider: FrameTransformProvider | null = null) {
    this.transformProvider = transformProvider;
  }

  setTransformProvider(provider: FrameTransformProvider | null): void {
    this.transformProvider = provider;
  }

  toVector3(position: Vec3 | Vector3): Vector3 {
    if (position instanceof Vector3) {
      return position.clone();
    }

    return new Vector3(position[0], position[1], position[2]);
  }

  toScene(positionMeters: Vec3, metersPerSceneUnit: number): Vector3 {
    return sceneUnits(positionMeters, metersPerSceneUnit);
  }

  resolve(entity: SpaceEntity, state: UniverseState): Vector3 | null {
    const spatial = entity.spatial;

    if (!spatial) {
      return null;
    }

    const originalMeters = spatialMeters(spatial);

    let targetMeters: Vec3;

    if (spatial.frameId === state.scale.frameId) {
      targetMeters = originalMeters;
    } else {
      const provider = this.transformProvider;

      if (!provider) {
        return null;
      }

      const transformed = provider.transform({
        entity,

        state,

        fromFrameId: spatial.frameId,

        toFrameId: state.scale.frameId,

        sourceUnit: spatial.unit,

        positionMeters: originalMeters,
      });

      if (transformed === null) {
        return null;
      }

      targetMeters = transformed;
    }

    if (!targetMeters.every((value) => Number.isFinite(value))) {
      return null;
    }

    return sceneUnits(targetMeters, state.scale.metersPerUnit);
  }
}

/*
 * Floating origin
 *
 * The scientific position remains absolute in its active
 * reference frame. Only the rendering copy is translated
 * near the origin to preserve GPU precision.
 */

export class FloatingOrigin {
  private readonly value = new Vector3();

  set(position: Vec3 | Vector3): void {
    if (position instanceof Vector3) {
      this.value.copy(position);

      return;
    }

    this.value.set(position[0], position[1], position[2]);
  }

  setFromState(state: UniverseState): void {
    this.set(state.camera.position);
  }

  toLocal(
    absolute: Vector3,

    target = new Vector3(),
  ): Vector3 {
    return target.copy(absolute).sub(this.value);
  }

  toAbsolute(
    local: Vector3,

    target = new Vector3(),
  ): Vector3 {
    return target.copy(local).add(this.value);
  }

  get origin(): Vector3 {
    return this.value.clone();
  }
}

export type EntityMesh = Mesh<SphereGeometry, MeshBasicMaterial>;

export interface EntitySceneEntry {
  id: EntityId;

  entity: SpaceEntity;

  object: EntityMesh;

  position: Vector3;

  radius: number;
}

export class EntitySceneIndex {
  private readonly entriesValue = new Map<EntityId, EntitySceneEntry>();

  get(id: EntityId): EntitySceneEntry | undefined {
    return this.entriesValue.get(id);
  }

  set(id: EntityId, value: EntitySceneEntry): this {
    if (value.id !== id) {
      throw new Error("EntitySceneIndex id mismatch.");
    }

    this.entriesValue.set(id, value);

    return this;
  }

  has(id: EntityId): boolean {
    return this.entriesValue.has(id);
  }

  delete(id: EntityId): boolean {
    return this.entriesValue.delete(id);
  }

  clear(): void {
    this.entriesValue.clear();
  }

  getPosition(id: EntityId): Vector3 | undefined {
    return this.entriesValue.get(id)?.position;
  }

  getObject(id: EntityId): EntityMesh | undefined {
    return this.entriesValue.get(id)?.object;
  }

  values(): IterableIterator<EntitySceneEntry> {
    return this.entriesValue.values();
  }

  keys(): IterableIterator<EntityId> {
    return this.entriesValue.keys();
  }

  entriesIterator(): IterableIterator<[EntityId, EntitySceneEntry]> {
    return this.entriesValue.entries();
  }

  get size(): number {
    return this.entriesValue.size;
  }
}

/*
 * Real ray-cast picking.
 *
 * The old compatibility implementation always returned null.
 */

export class PickingController {
  enabled = true;

  private readonly raycaster = new Raycaster();

  private readonly pointer = new Vector2();

  private camera: PerspectiveCamera | null = null;

  private canvas: HTMLCanvasElement | null = null;

  private index: EntitySceneIndex | null = null;

  constructor(
    camera?: PerspectiveCamera,

    canvas?: HTMLCanvasElement,

    index?: EntitySceneIndex,
  ) {
    this.raycaster.params.Points.threshold = 4;

    if (camera && canvas && index) {
      this.configure(camera, canvas, index);
    }
  }

  configure(
    camera: PerspectiveCamera,

    canvas: HTMLCanvasElement,

    index: EntitySceneIndex,
  ): void {
    this.camera = camera;

    this.canvas = canvas;

    this.index = index;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  pick(clientX: number, clientY: number): EntityId | undefined {
    if (!this.enabled || !this.camera || !this.canvas || !this.index) {
      return undefined;
    }

    const rectangle = this.canvas.getBoundingClientRect();

    if (rectangle.width <= 0 || rectangle.height <= 0) {
      return undefined;
    }

    this.pointer.set(
      ((clientX - rectangle.left) / rectangle.width) * 2 - 1,

      -((clientY - rectangle.top) / rectangle.height) * 2 + 1,
    );

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const targets: EntityMesh[] = [];

    for (const entry of this.index.values()) {
      if (entry.object.visible) {
        targets.push(entry.object);
      }
    }

    const hits = this.raycaster.intersectObjects(targets, false);

    for (const hit of hits) {
      const id = hit.object.userData["entityId"];

      if (typeof id === "string") {
        return id;
      }
    }

    return undefined;
  }

  clear(): void {
    this.pointer.set(0, 0);
  }

  dispose(): void {
    this.clear();

    this.camera = null;

    this.canvas = null;

    this.index = null;
  }
}

/*
 * GPU packed point layer.
 *
 * Used for dense catalogs such as stars, orbital debris and
 * galaxy fields. This uses one draw object instead of one
 * Three.js object per catalog entry.
 */

export class PackedPointLayer {
  readonly geometry = new BufferGeometry();

  readonly material: PointsMaterial;

  readonly object: Points<BufferGeometry, PointsMaterial>;

  private countValue = 0;

  private densityValue = 1;

  private requestedVisible = true;

  private readonly capacity: number;

  constructor(
    capacity = 100_000,

    size = 1,

    color = 0xffffff,
  ) {
    this.capacity = Math.max(1, Math.floor(capacity));

    this.material = new PointsMaterial({
      color,

      size: positiveFinite(size, 1),

      sizeAttenuation: true,

      transparent: true,

      opacity: 1,

      depthWrite: false,

      blending: AdditiveBlending,
    });

    this.object = new Points(this.geometry, this.material);

    this.object.name = "packed-point-layer";

    this.object.frustumCulled = true;

    this.replace(new Float32Array());
  }

  get root(): Points<BufferGeometry, PointsMaterial> {
    return this.object;
  }

  get count(): number {
    return this.countValue;
  }

  private updateDrawRange(): void {
    const visibleCount = Math.floor(this.countValue * this.densityValue);

    this.geometry.setDrawRange(0, visibleCount);

    this.object.visible = this.requestedVisible && visibleCount > 0;
  }

  private buildBuffer(positions: readonly Vec3[] | Float32Array): Float32Array {
    const sourceCount =
      positions instanceof Float32Array
        ? Math.floor(positions.length / 3)
        : positions.length;

    const maximum = Math.min(this.capacity, sourceCount);

    const data = new Float32Array(maximum * 3);

    let written = 0;

    for (
      let index = 0;
      index < sourceCount && written < this.capacity;
      index++
    ) {
      let x: number | undefined;

      let y: number | undefined;

      let z: number | undefined;

      if (positions instanceof Float32Array) {
        const offset = index * 3;

        x = positions[offset];

        y = positions[offset + 1];

        z = positions[offset + 2];
      } else {
        const point = positions[index];

        if (!point) {
          continue;
        }

        x = point[0];

        y = point[1];

        z = point[2];
      }

      if (
        x === undefined ||
        y === undefined ||
        z === undefined ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(z)
      ) {
        continue;
      }

      const target = written * 3;

      data[target] = x;

      data[target + 1] = y;

      data[target + 2] = z;

      written++;
    }

    if (written === maximum) {
      return data;
    }

    return data.slice(0, written * 3);
  }

  replace(positions: readonly Vec3[] | Float32Array): void {
    const data = this.buildBuffer(positions);

    this.countValue = Math.floor(data.length / 3);

    this.geometry.setAttribute("position", new BufferAttribute(data, 3));

    if (this.countValue > 0) {
      this.geometry.computeBoundingSphere();
    } else {
      this.geometry.boundingSphere = null;
    }

    this.updateDrawRange();
  }

  setPoints(positions: readonly Vec3[] | Float32Array): void {
    this.replace(positions);
  }

  update(positions: readonly Vec3[] | Float32Array): void {
    this.replace(positions);
  }

  setDensity(value: number): void {
    this.densityValue = clamp(value, 0, 1);

    this.updateDrawRange();
  }

  setVisible(visible: boolean): void {
    this.requestedVisible = visible;

    this.updateDrawRange();
  }

  setOpacity(value: number): void {
    this.material.opacity = clamp(value, 0, 1);

    this.material.transparent = this.material.opacity < 1;
  }

  setSize(value: number): void {
    this.material.size = positiveFinite(value, 1);
  }

  setColor(value: number): void {
    this.material.color.setHex(value);
  }

  clear(): void {
    this.replace(new Float32Array());
  }

  dispose(): void {
    this.object.removeFromParent();

    this.geometry.dispose();

    this.material.dispose();
  }
}

interface OrbitSceneEntry {
  line: LineLoop<BufferGeometry, LineBasicMaterial>;

  signature: string;
}

function orbitSignature(
  entity: SpaceEntity,
  metersPerUnit: number,
  samples: number,
): string {
  const orbit = entity.orbit;

  if (!orbit) {
    return "";
  }

  return [
    orbit.semiMajorAxisM ?? "",

    orbit.eccentricity ?? "",

    orbit.inclinationDeg ?? "",

    orbit.longitudeAscendingNodeDeg ?? "",

    orbit.argumentPeriapsisDeg ?? "",

    metersPerUnit,

    samples,
  ].join(":");
}

function createOrbitGeometry(
  entity: SpaceEntity,
  metersPerUnit: number,
  samples: number,
): BufferGeometry | null {
  const orbit = entity.orbit;

  const semiMajorMeters = orbit?.semiMajorAxisM;

  if (
    orbit === undefined ||
    semiMajorMeters === undefined ||
    !Number.isFinite(semiMajorMeters) ||
    semiMajorMeters <= 0
  ) {
    return null;
  }

  const divisor = positiveFinite(metersPerUnit, 1);

  const semiMajor = semiMajorMeters / divisor;

  if (!Number.isFinite(semiMajor) || semiMajor <= 0) {
    return null;
  }

  const eccentricity = clamp(orbit.eccentricity ?? 0, 0, 0.999999);

  const semiMinor =
    semiMajor * Math.sqrt(Math.max(0, 1 - eccentricity * eccentricity));

  const inclination = degreesToRadians(orbit.inclinationDeg);

  const ascendingNode = degreesToRadians(orbit.longitudeAscendingNodeDeg);

  const periapsis = degreesToRadians(orbit.argumentPeriapsisDeg);

  const cosI = Math.cos(inclination);

  const sinI = Math.sin(inclination);

  const cosNode = Math.cos(ascendingNode);

  const sinNode = Math.sin(ascendingNode);

  const cosPeriapsis = Math.cos(periapsis);

  const sinPeriapsis = Math.sin(periapsis);

  const count = Math.max(24, Math.floor(samples));

  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index++) {
    const eccentricAnomaly = (index / count) * Math.PI * 2;

    const orbitalX = semiMajor * (Math.cos(eccentricAnomaly) - eccentricity);

    const orbitalY = semiMinor * Math.sin(eccentricAnomaly);

    const periapsisX = cosPeriapsis * orbitalX - sinPeriapsis * orbitalY;

    const periapsisY = sinPeriapsis * orbitalX + cosPeriapsis * orbitalY;

    const x = cosNode * periapsisX - sinNode * cosI * periapsisY;

    const y = sinNode * periapsisX + cosNode * cosI * periapsisY;

    const z = sinI * periapsisY;

    const offset = index * 3;

    positions[offset] = x;

    positions[offset + 1] = y;

    positions[offset + 2] = z;
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new BufferAttribute(positions, 3));

  geometry.computeBoundingSphere();

  return geometry;
}

export interface ThreeUniverseRendererOptions {
  background?: number;

  antialias?: boolean;

  alpha?: boolean;

  detailedObjectLimit?: number;

  frameTransformProvider?: FrameTransformProvider;

  extensions?: UniverseRendererExtensionOptions;
}

/*
 * Concrete renderer.
 *
 * This replaces the former no-op compatibility implementation.
 */

export class ThreeUniverseRenderer implements UniverseRenderer {
  readonly name = "Three.js Universe Renderer";

  readonly rendererInfo = rendererInfo;

  readonly stats: RendererStats = {
    backend: rendererInfo.backend,

    drawCalls: 0,

    triangles: 0,

    points: 0,

    lines: 0,

    objects: 0,

    sceneObjects: 0,

    frameMs: 0,

    visibleEntities: 0,
  };

  readonly frameSpace: FrameSpace;

  readonly floatingOrigin = new FloatingOrigin();

  readonly index = new EntitySceneIndex();

  readonly worldRoot = new Group();

  readonly entityRoot = new Group();

  readonly orbitRoot = new Group();

  readonly extensions: UniverseRendererExtensions;

  private readonly orbitEntries = new Map<EntityId, OrbitSceneEntry>();

  private readonly unitSphere = new SphereGeometry(1, 24, 16);

  private readonly detailedObjectLimit: number;

  private readonly background: number;

  private readonly antialias: boolean;

  private readonly alpha: boolean;

  private rendererValue: WebGLRenderer | null = null;

  private cameraValue: PerspectiveCamera | null = null;

  private sceneValue: Scene | null = null;

  private pickingValue: PickingController | null = null;

  private containerValue: HTMLElement | null = null;

  private width = 1;

  private height = 1;

  private lastVisibleCount = -1;

  constructor(options: ThreeUniverseRendererOptions = {}) {
    this.background = options.background ?? 0x01030a;

    this.antialias = options.antialias ?? true;

    this.alpha = options.alpha ?? false;

    this.detailedObjectLimit = Math.max(
      100,
      Math.floor(options.detailedObjectLimit ?? 10_000),
    );

    this.frameSpace = new FrameSpace(options.frameTransformProvider ?? null);

    this.extensions = new UniverseRendererExtensions(options.extensions);

    this.worldRoot.name = "universe-world";

    this.entityRoot.name = "universe-entities";

    this.orbitRoot.name = "universe-orbits";

    this.worldRoot.add(this.orbitRoot);

    this.worldRoot.add(this.entityRoot);
  }

  async initialize(container: HTMLElement): Promise<void> {
    if (this.rendererValue) {
      throw new Error("ThreeUniverseRenderer is already initialized.");
    }

    this.containerValue = container;

    if (typeof window !== "undefined") {
      const style = window.getComputedStyle(container);

      if (style.position === "static") {
        container.style.position = "relative";
      }
    }

    const renderer = new WebGLRenderer({
      antialias: this.antialias,

      alpha: this.alpha,

      logarithmicDepthBuffer: true,

      powerPreference: "high-performance",
    });

    renderer.outputColorSpace = SRGBColorSpace;

    renderer.domElement.classList.add("universe-three-canvas");

    Object.assign(renderer.domElement.style, {
      display: "block",

      width: "100%",

      height: "100%",

      outline: "none",

      touchAction: "none",
    });

    const scene = new Scene();

    if (!this.alpha) {
      scene.background = new Color(this.background);
    }

    const camera = new PerspectiveCamera(60, 1, 1e-7, 1e12);

    camera.position.set(0, 0, 0);

    scene.add(this.worldRoot);

    container.appendChild(renderer.domElement);

    const picking = new PickingController(
      camera,
      renderer.domElement,
      this.index,
    );

    this.rendererValue = renderer;

    this.sceneValue = scene;

    this.cameraValue = camera;

    this.pickingValue = picking;

    this.extensions.initialize(
      container,
      renderer,
      camera,
      this.worldRoot,
      this.index,
      picking,
    );

    await this.extensions.plugins.activateAll();

    const initialWidth = Math.max(1, container.clientWidth || 1);

    const initialHeight = Math.max(1, container.clientHeight || 1);

    const initialRatio =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    this.resize(initialWidth, initialHeight, initialRatio);
  }

  private requireRenderer(): WebGLRenderer {
    const renderer = this.rendererValue;

    if (!renderer) {
      throw new Error("ThreeUniverseRenderer has not been initialized.");
    }

    return renderer;
  }

  private requireScene(): Scene {
    const scene = this.sceneValue;

    if (!scene) {
      throw new Error("ThreeUniverseRenderer has not been initialized.");
    }

    return scene;
  }

  private requireCamera(): PerspectiveCamera {
    const camera = this.cameraValue;

    if (!camera) {
      throw new Error("ThreeUniverseRenderer has not been initialized.");
    }

    return camera;
  }

  private buildDesiredEntityIds(frame: RenderFrame): Set<EntityId> {
    const result = new Set<EntityId>();

    const state = frame.state;

    if (state.focusId !== undefined && state.entities.has(state.focusId)) {
      result.add(state.focusId);
    }

    if (
      state.selectedId !== undefined &&
      state.entities.has(state.selectedId)
    ) {
      result.add(state.selectedId);
    }

    for (const id of frame.visibleEntityIds) {
      if (result.size >= this.detailedObjectLimit) {
        break;
      }

      if (state.entities.has(id)) {
        result.add(id);
      }
    }

    return result;
  }

  private removeEntity(id: EntityId): void {
    const entry = this.index.get(id);

    if (!entry) {
      return;
    }

    entry.object.removeFromParent();

    entry.object.material.dispose();

    this.index.delete(id);
  }

  private createEntityEntry(
    entity: SpaceEntity,
    localPosition: Vector3,
    radius: number,
  ): EntitySceneEntry {
    const style = resolvedEntityStyle(entity, this.extensions.themes.current);

    const material = new MeshBasicMaterial({
      color: style.color,

      transparent: style.bodyOpacity < 0.999,

      opacity: clamp(style.bodyOpacity, 0, 1),

      depthWrite: style.bodyOpacity >= 0.999,
    });

    if (entity.kind === "star") {
      material.blending = AdditiveBlending;
    }

    const object = new Mesh(this.unitSphere, material);

    object.name = `entity:${entity.id}`;

    object.userData["entityId"] = entity.id;

    object.userData["entityKind"] = entity.kind;

    object.position.copy(localPosition);

    object.scale.setScalar(radius);

    this.entityRoot.add(object);

    const entry: EntitySceneEntry = {
      id: entity.id,

      entity,

      object,

      position: localPosition.clone(),

      radius,
    };

    this.index.set(entity.id, entry);

    return entry;
  }

  private updateEntityEntry(
    entry: EntitySceneEntry,
    entity: SpaceEntity,
    localPosition: Vector3,
    radius: number,
    state: UniverseState,
  ): void {
    entry.entity = entity;

    entry.position.copy(localPosition);

    entry.radius = radius;

    entry.object.position.copy(localPosition);

    const uiSelection = this.extensions.selection.getSnapshot();

    const selected =
      state.selectedId === entity.id || uiSelection.selectedId === entity.id;

    const focused =
      state.focusId === entity.id || uiSelection.focusedId === entity.id;

    const scaleMultiplier = focused ? 1.3 : selected ? 1.15 : 1;

    entry.object.scale.setScalar(radius * scaleMultiplier);

    const theme = this.extensions.themes.current;

    const style = resolvedEntityStyle(entity, theme);

    let color = style.color;

    if (selected) {
      color = theme.selection;
    }

    if (focused) {
      color = theme.focus;
    }

    entry.object.material.color.setHex(color);

    entry.object.material.opacity = clamp(style.bodyOpacity, 0, 1);

    entry.object.material.transparent = entry.object.material.opacity < 0.999;

    entry.object.material.depthWrite = entry.object.material.opacity >= 0.999;

    entry.object.material.blending =
      entity.kind === "star" ? AdditiveBlending : NormalBlending;

    entry.object.material.needsUpdate = true;

    entry.object.userData["entityKind"] = entity.kind;

    entry.object.userData["physicalRadiusMeters"] = entityRadiusMeters(entity);

    entry.object.userData["renderRadius"] = radius;
  }

  private syncEntities(frame: RenderFrame): void {
    const desired = this.buildDesiredEntityIds(frame);

    for (const id of [...this.index.keys()]) {
      if (!desired.has(id)) {
        this.removeEntity(id);
      }
    }

    const state = frame.state;

    this.floatingOrigin.setFromState(state);

    for (const id of desired) {
      const entity = state.entities.get(id);

      if (!entity) {
        this.removeEntity(id);

        continue;
      }

      const absolute = this.frameSpace.resolve(entity, state);

      if (!absolute) {
        this.removeEntity(id);

        continue;
      }

      const local = this.floatingOrigin.toLocal(absolute);

      const radius = entitySceneRadius(entity, state.scale.metersPerUnit);

      let entry = this.index.get(id);

      if (!entry) {
        entry = this.createEntityEntry(entity, local, radius);
      }

      this.updateEntityEntry(entry, entity, local, radius, state);
    }

    if (this.lastVisibleCount !== this.index.size) {
      this.lastVisibleCount = this.index.size;

      this.extensions.events.emit("visibility.change", {
        visibleCount: this.index.size,
      });
    }
  }

  private disposeOrbit(id: EntityId): void {
    const entry = this.orbitEntries.get(id);

    if (!entry) {
      return;
    }

    entry.line.removeFromParent();

    entry.line.geometry.dispose();

    entry.line.material.dispose();

    this.orbitEntries.delete(id);
  }

  private clearOrbits(): void {
    for (const id of [...this.orbitEntries.keys()]) {
      this.disposeOrbit(id);
    }
  }

  private syncOrbits(frame: RenderFrame): void {
    const state = frame.state;

    const enabled = state.overlays.orbits && state.settings.graphics.orbitLines;

    if (!enabled) {
      this.clearOrbits();

      return;
    }

    const desired = new Set<EntityId>();

    const quality = this.extensions.quality.profile;

    const samples = Math.round(clamp(96 * quality.orbitDetail, 24, 192));

    for (const entityEntry of this.index.values()) {
      const entity = entityEntry.entity;

      if (
        !entity.parentId ||
        !entity.orbit ||
        entity.orbit.semiMajorAxisM === undefined
      ) {
        continue;
      }

      const parentPosition = this.index.getPosition(entity.parentId);

      if (!parentPosition) {
        continue;
      }

      const signature = orbitSignature(
        entity,
        state.scale.metersPerUnit,
        samples,
      );

      let orbitEntry = this.orbitEntries.get(entity.id);

      if (!orbitEntry || orbitEntry.signature !== signature) {
        if (orbitEntry) {
          this.disposeOrbit(entity.id);
        }

        const geometry = createOrbitGeometry(
          entity,
          state.scale.metersPerUnit,
          samples,
        );

        if (!geometry) {
          continue;
        }

        const material = new LineBasicMaterial({
          color: this.extensions.themes.current.orbit,

          transparent: true,

          opacity: 0.38,

          depthWrite: false,
        });

        const line = new LineLoop(geometry, material);

        line.name = `orbit:${entity.id}`;

        line.frustumCulled = true;

        this.orbitRoot.add(line);

        orbitEntry = {
          line,

          signature,
        };

        this.orbitEntries.set(entity.id, orbitEntry);
      }

      orbitEntry.line.position.copy(parentPosition);

      orbitEntry.line.material.color.setHex(
        this.extensions.themes.current.orbit,
      );

      desired.add(entity.id);
    }

    for (const id of [...this.orbitEntries.keys()]) {
      if (!desired.has(id)) {
        this.disposeOrbit(id);
      }
    }
  }

  private syncCamera(frame: RenderFrame): void {
    const camera = this.requireCamera();

    const state = frame.state;

    camera.position.set(0, 0, 0);

    const nextFov = clamp(state.camera.fieldOfView, 5, 140);

    if (camera.fov !== nextFov) {
      camera.fov = nextFov;

      camera.updateProjectionMatrix();
    }

    const targetId = state.camera.targetId ?? state.focusId;

    if (targetId !== undefined) {
      const target = this.index.getPosition(targetId);

      if (target && target.lengthSq() > 1e-18) {
        camera.lookAt(target);
      }
    }

    const event: {
      position: Vec3;

      targetId?: EntityId;
    } = {
      position: [
        state.camera.position[0],

        state.camera.position[1],

        state.camera.position[2],
      ],
    };

    if (targetId !== undefined) {
      event.targetId = targetId;
    }

    this.extensions.events.emit("camera.change", event);
  }

  private updateTheme(): void {
    const scene = this.requireScene();

    if (this.alpha) {
      scene.background = null;

      return;
    }

    const color = this.extensions.themes.current.background;

    if (scene.background instanceof Color) {
      scene.background.setHex(color);
    } else {
      scene.background = new Color(color);
    }
  }

  private updateStats(frameMilliseconds: number): void {
    const renderer = this.requireRenderer();

    const render = renderer.info.render;

    this.stats.drawCalls = render.calls;

    this.stats.triangles = render.triangles;

    this.stats.points = render.points;

    this.stats.lines = render.lines;

    this.stats.objects = this.index.size;

    this.stats.sceneObjects =
      this.index.size +
      this.orbitEntries.size +
      this.extensions.denseLayers.count +
      3;

    this.stats.frameMs = frameMilliseconds;

    this.stats.visibleEntities = this.index.size;
  }

  render(frame: RenderFrame): void {
    const renderer = this.requireRenderer();

    const scene = this.requireScene();

    const camera = this.requireCamera();

    const started = performance.now();

    this.extensions.beforeFrame(frame);

    this.syncEntities(frame);

    this.syncOrbits(frame);

    this.syncCamera(frame);

    this.updateTheme();

    this.extensions.afterEntitySync();

    this.extensions.syncLabels(frame);

    renderer.render(scene, camera);

    this.extensions.markRendered();

    const frameMilliseconds = performance.now() - started;

    this.updateStats(frameMilliseconds);

    this.extensions.endFrame(frame, this.stats);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = Math.max(1, Math.floor(width));

    this.height = Math.max(1, Math.floor(height));

    const renderer = this.rendererValue;

    const camera = this.cameraValue;

    if (!renderer || !camera) {
      return;
    }

    const qualityLimit = this.extensions.quality.profile.pixelRatioLimit;

    const ratio = clamp(pixelRatio, 0.5, qualityLimit);

    renderer.setPixelRatio(ratio);

    renderer.setSize(this.width, this.height, false);

    camera.aspect = this.width / this.height;

    camera.updateProjectionMatrix();

    this.extensions.resize(this.width, this.height, ratio);
  }

  setFrameTransformProvider(provider: FrameTransformProvider | null): void {
    this.frameSpace.setTransformProvider(provider);
  }

  getStats(): RendererStats {
    return {
      ...this.stats,
    };
  }

  get scene(): Scene | null {
    return this.sceneValue;
  }

  get camera(): PerspectiveCamera | null {
    return this.cameraValue;
  }

  get threeRenderer(): WebGLRenderer | null {
    return this.rendererValue;
  }

  get picking(): PickingController | null {
    return this.pickingValue;
  }

  private clearEntityObjects(): void {
    for (const entry of this.index.values()) {
      entry.object.removeFromParent();

      entry.object.material.dispose();
    }

    this.index.clear();
  }

  dispose(): void {
    this.extensions.dispose();

    this.clearOrbits();

    this.clearEntityObjects();

    this.pickingValue?.dispose();

    this.pickingValue = null;

    this.unitSphere.dispose();

    const renderer = this.rendererValue;

    if (renderer) {
      const canvas = renderer.domElement;

      renderer.dispose();

      canvas.remove();
    }

    this.sceneValue?.clear();

    this.rendererValue = null;

    this.cameraValue = null;

    this.sceneValue = null;

    this.containerValue = null;

    this.lastVisibleCount = -1;

    this.stats.drawCalls = 0;

    this.stats.triangles = 0;

    this.stats.points = 0;

    this.stats.lines = 0;

    this.stats.objects = 0;

    this.stats.sceneObjects = 0;

    this.stats.frameMs = 0;

    this.stats.visibleEntities = 0;
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
      return `${entity.name} Â· ` + entity.kind;
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
    this.element.textContent = `${data.name} Â· ${data.kind}`;

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
