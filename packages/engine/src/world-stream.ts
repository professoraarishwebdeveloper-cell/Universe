import type { Vec3 } from "@known-universe/core";

import {
  ProceduralUniverseGenerator,
  positionToSector,
  proceduralSectorKey,
} from "./procedural";

import type {
  GalaxyDescriptor,
  ProceduralSector,
  SectorCoordinate,
  StarSystemDescriptor,
} from "./procedural";

export const WORLD_STREAM_VERSION = 1;

export type StreamState =
  | "idle"
  | "queued"
  | "generating"
  | "ready"
  | "failed";

export type StreamReason =
  | "observer"
  | "prefetch"
  | "manual"
  | "system";

export type SectorLod =
  | "cosmic"
  | "galaxy";

export interface WorldStreamObserver {
  positionLy: Vec3;

  velocityLyPerSecond?: Vec3;
}

export interface WorldStreamConfig {
  loadRadiusSectors: number;

  retainRadiusSectors: number;

  galaxyDetailRadiusSectors: number;

  prefetchRadiusSectors: number;

  prefetchSeconds: number;

  maximumQueuedJobs: number;

  maximumGenerationsPerTick: number;

  maximumResidentSectors: number;

  maximumResidentSystems: number;

  estimatedMemoryBudgetBytes: number;

  sectorIdleLifetimeMs: number;

  systemIdleLifetimeMs: number;

  maximumRetryCount: number;
}

export const DEFAULT_WORLD_STREAM_CONFIG:
  WorldStreamConfig = {
  loadRadiusSectors: 2,

  retainRadiusSectors: 3,

  galaxyDetailRadiusSectors: 1,

  prefetchRadiusSectors: 1,

  prefetchSeconds: 4,

  maximumQueuedJobs: 4_096,

  maximumGenerationsPerTick: 8,

  maximumResidentSectors: 256,

  maximumResidentSystems: 128,

  estimatedMemoryBudgetBytes:
    128 *
    1024 *
    1024,

  sectorIdleLifetimeMs:
    5 *
    60 *
    1_000,

  systemIdleLifetimeMs:
    2 *
    60 *
    1_000,

  maximumRetryCount: 2,
};

export interface SectorStreamView {
  key: string;

  coordinate: SectorCoordinate;

  state: StreamState;

  reason: StreamReason;

  lod: SectorLod;

  desired: boolean;

  pinned: number;

  retryCount: number;

  lastTouchedMs: number;

  loadedAtMs: number | null;

  estimatedBytes: number;

  hasData: boolean;

  error: string | null;
}

export interface SystemStreamView {
  key: string;

  galaxyId: string;

  systemIndex: number;

  state: StreamState;

  pinned: number;

  retryCount: number;

  lastTouchedMs: number;

  loadedAtMs: number | null;

  estimatedBytes: number;

  hasData: boolean;

  error: string | null;
}

export interface WorldStreamMetrics {
  sectorRequests: number;

  systemRequests: number;

  sectorCacheHits: number;

  sectorCacheMisses: number;

  systemCacheHits: number;

  systemCacheMisses: number;

  generatedSectors: number;

  generatedSystems: number;

  sectorEvictions: number;

  systemEvictions: number;

  generationErrors: number;

  droppedJobs: number;

  staleJobsSkipped: number;

  queuePeak: number;

  generationTicks: number;

  generatedJobs: number;
}

export interface WorldStreamMemoryEstimate {
  sectorBytes: number;

  systemBytes: number;

  totalBytes: number;

  readySectors: number;

  readySystems: number;
}

export interface WorldStreamPlan {
  currentSector: SectorCoordinate;

  desiredSectorCount: number;

  queuedSectorCount: number;

  prefetchSectorCount: number;
}

export interface WorldStreamTickResult {
  processed: number;

  generated: number;

  failed: number;

  stale: number;

  queueRemaining: number;
}

export interface WorldStreamSnapshot {
  observer: WorldStreamObserver | null;

  currentSector: SectorCoordinate | null;

  queueDepth: number;

  sectors: readonly SectorStreamView[];

  systems: readonly SystemStreamView[];

  metrics: WorldStreamMetrics;

  memory: WorldStreamMemoryEstimate;
}

export type WorldStreamEvent =
  | {
      type: "sector-ready";

      key: string;

      coordinate: SectorCoordinate;

      sector: ProceduralSector;
    }
  | {
      type: "system-ready";

      key: string;

      galaxyId: string;

      systemIndex: number;

      system: StarSystemDescriptor;
    }
  | {
      type: "sector-evicted";

      key: string;

      coordinate: SectorCoordinate;

      reason: string;
    }
  | {
      type: "system-evicted";

      key: string;

      galaxyId: string;

      systemIndex: number;

      reason: string;
    }
  | {
      type: "generation-error";

      layer: "sector" | "system";

      key: string;

      message: string;
    };

export type WorldStreamListener = (
  event: WorldStreamEvent,
) => void;

export type WorldStreamClock = () => number;

interface SectorCacheRecord {
  key: string;

  coordinate: SectorCoordinate;

  state: StreamState;

  reason: StreamReason;

  lod: SectorLod;

  desired: boolean;

  pinned: number;

  priority: number;

  token: number;

  retryCount: number;

  requestedAtMs: number | null;

  loadedAtMs: number | null;

  lastTouchedMs: number;

  estimatedBytes: number;

  sector: ProceduralSector | null;

  error: string | null;
}

interface SystemCacheRecord {
  key: string;

  galaxy: GalaxyDescriptor;

  galaxyId: string;

  systemIndex: number;

  state: StreamState;

  pinned: number;

  priority: number;

  token: number;

  retryCount: number;

  requestedAtMs: number | null;

  loadedAtMs: number | null;

  lastTouchedMs: number;

  estimatedBytes: number;

  system: StarSystemDescriptor | null;

  error: string | null;
}

interface JobBase {
  priority: number;

  sequence: number;

  token: number;

  createdAtMs: number;

  reason: StreamReason;
}

interface SectorGenerationJob extends JobBase {
  kind: "sector";

  key: string;
}

interface SystemGenerationJob extends JobBase {
  kind: "system";

  key: string;
}

type GenerationJob =
  | SectorGenerationJob
  | SystemGenerationJob;

function finite(
  value: number,
): boolean {
  return Number.isFinite(value);
}

function finiteVec3(
  value: Vec3,
): boolean {
  return (
    finite(value[0]) &&
    finite(value[1]) &&
    finite(value[2])
  );
}

function cloneVec3(
  value: Vec3,
): Vec3 {
  return [
    value[0],
    value[1],
    value[2],
  ];
}

function cloneCoordinate(
  value: SectorCoordinate,
): SectorCoordinate {
  return {
    x: value.x,
    y: value.y,
    z: value.z,
  };
}

function validateCoordinate(
  coordinate: SectorCoordinate,
): void {
  if (
    !Number.isSafeInteger(coordinate.x) ||
    !Number.isSafeInteger(coordinate.y) ||
    !Number.isSafeInteger(coordinate.z)
  ) {
    throw new Error(
      "Sector coordinates must be safe integers.",
    );
  }
}

function square(
  value: number,
): number {
  return value * value;
}

export function sectorDistanceSquared(
  first: SectorCoordinate,
  second: SectorCoordinate,
): number {
  return (
    square(first.x - second.x) +
    square(first.y - second.y) +
    square(first.z - second.z)
  );
}

export function sectorDistance(
  first: SectorCoordinate,
  second: SectorCoordinate,
): number {
  return Math.sqrt(
    sectorDistanceSquared(
      first,
      second,
    ),
  );
}

function systemCacheKey(
  galaxyId: string,
  systemIndex: number,
): string {
  return `${galaxyId}|${systemIndex}`;
}

function estimateSectorBytes(
  sector: ProceduralSector,
): number {
  const base = 768;

  const galaxies =
    sector.galaxies.length *
    640;

  return base + galaxies;
}

function estimateSystemBytes(
  system: StarSystemDescriptor,
): number {
  let total = 2_048;

  total +=
    system.stars.length *
    320;

  total +=
    system.planets.length *
    960;

  total +=
    system.belts.length *
    256;

  for (
    const planet
    of system.planets
  ) {
    total +=
      planet.moons.length *
      448;
  }

  return total;
}

function normalizeInteger(
  value: number,
  minimum: number,
  name: string,
): number {
  if (
    !finite(value)
  ) {
    throw new Error(
      `${name} must be finite.`,
    );
  }

  const result =
    Math.floor(value);

  if (
    result < minimum
  ) {
    throw new Error(
      `${name} must be at least ${minimum}.`,
    );
  }

  return result;
}

function normalizePositive(
  value: number,
  name: string,
): number {
  if (
    !finite(value) ||
    value <= 0
  ) {
    throw new Error(
      `${name} must be positive.`,
    );
  }

  return value;
}

function normalizeNonNegative(
  value: number,
  name: string,
): number {
  if (
    !finite(value) ||
    value < 0
  ) {
    throw new Error(
      `${name} cannot be negative.`,
    );
  }

  return value;
}

function normalizeConfig(
  input:
    Partial<WorldStreamConfig>,
): WorldStreamConfig {
  const config = {
    ...DEFAULT_WORLD_STREAM_CONFIG,
    ...input,
  };

  const normalized:
    WorldStreamConfig = {
    loadRadiusSectors:
      normalizeInteger(
        config.loadRadiusSectors,
        0,
        "loadRadiusSectors",
      ),

    retainRadiusSectors:
      normalizeInteger(
        config.retainRadiusSectors,
        0,
        "retainRadiusSectors",
      ),

    galaxyDetailRadiusSectors:
      normalizeInteger(
        config.galaxyDetailRadiusSectors,
        0,
        "galaxyDetailRadiusSectors",
      ),

    prefetchRadiusSectors:
      normalizeInteger(
        config.prefetchRadiusSectors,
        0,
        "prefetchRadiusSectors",
      ),

    prefetchSeconds:
      normalizeNonNegative(
        config.prefetchSeconds,
        "prefetchSeconds",
      ),

    maximumQueuedJobs:
      normalizeInteger(
        config.maximumQueuedJobs,
        1,
        "maximumQueuedJobs",
      ),

    maximumGenerationsPerTick:
      normalizeInteger(
        config.maximumGenerationsPerTick,
        1,
        "maximumGenerationsPerTick",
      ),

    maximumResidentSectors:
      normalizeInteger(
        config.maximumResidentSectors,
        1,
        "maximumResidentSectors",
      ),

    maximumResidentSystems:
      normalizeInteger(
        config.maximumResidentSystems,
        1,
        "maximumResidentSystems",
      ),

    estimatedMemoryBudgetBytes:
      normalizePositive(
        config.estimatedMemoryBudgetBytes,
        "estimatedMemoryBudgetBytes",
      ),

    sectorIdleLifetimeMs:
      normalizeNonNegative(
        config.sectorIdleLifetimeMs,
        "sectorIdleLifetimeMs",
      ),

    systemIdleLifetimeMs:
      normalizeNonNegative(
        config.systemIdleLifetimeMs,
        "systemIdleLifetimeMs",
      ),

    maximumRetryCount:
      normalizeInteger(
        config.maximumRetryCount,
        0,
        "maximumRetryCount",
      ),
  };

  if (
    normalized.retainRadiusSectors <
    normalized.loadRadiusSectors
  ) {
    throw new Error(
      "retainRadiusSectors cannot be smaller than loadRadiusSectors.",
    );
  }

  if (
    normalized.galaxyDetailRadiusSectors >
    normalized.loadRadiusSectors
  ) {
    throw new Error(
      "galaxyDetailRadiusSectors cannot exceed loadRadiusSectors.",
    );
  }

  return normalized;
}

function newMetrics():
  WorldStreamMetrics {
  return {
    sectorRequests: 0,
    systemRequests: 0,

    sectorCacheHits: 0,
    sectorCacheMisses: 0,

    systemCacheHits: 0,
    systemCacheMisses: 0,

    generatedSectors: 0,
    generatedSystems: 0,

    sectorEvictions: 0,
    systemEvictions: 0,

    generationErrors: 0,

    droppedJobs: 0,
    staleJobsSkipped: 0,

    queuePeak: 0,

    generationTicks: 0,
    generatedJobs: 0,
  };
}

function copyMetrics(
  metrics: WorldStreamMetrics,
): WorldStreamMetrics {
  return {
    ...metrics,
  };
}

function lodRank(
  lod: SectorLod,
): number {
  switch (lod) {
    case "cosmic":
      return 0;

    case "galaxy":
      return 1;
  }
}

function strongerLod(
  first: SectorLod,
  second: SectorLod,
): SectorLod {
  return lodRank(first) >=
    lodRank(second)
    ? first
    : second;
}

function lodForDistance(
  distanceSquared: number,
  galaxyRadius: number,
): SectorLod {
  return distanceSquared <=
    square(galaxyRadius)
    ? "galaxy"
    : "cosmic";
}

function predictObserverPosition(
  observer: WorldStreamObserver,
  seconds: number,
): Vec3 {
  const velocity =
    observer.velocityLyPerSecond;

  if (
    !velocity ||
    seconds <= 0
  ) {
    return cloneVec3(
      observer.positionLy,
    );
  }

  return [
    observer.positionLy[0] +
      velocity[0] *
      seconds,

    observer.positionLy[1] +
      velocity[1] *
      seconds,

    observer.positionLy[2] +
      velocity[2] *
      seconds,
  ];
}

const OFFSET_CACHE =
  new Map<
    number,
    readonly SectorCoordinate[]
  >();

export function sectorOffsetsWithinRadius(
  radius: number,
): readonly SectorCoordinate[] {
  const safeRadius =
    normalizeInteger(
      radius,
      0,
      "radius",
    );

  const cached =
    OFFSET_CACHE.get(
      safeRadius,
    );

  if (cached) {
    return cached;
  }

  const radiusSquared =
    safeRadius *
    safeRadius;

  const offsets:
    SectorCoordinate[] = [];

  for (
    let x = -safeRadius;
    x <= safeRadius;
    x++
  ) {
    for (
      let y = -safeRadius;
      y <= safeRadius;
      y++
    ) {
      for (
        let z = -safeRadius;
        z <= safeRadius;
        z++
      ) {
        const distanceSquared =
          x * x +
          y * y +
          z * z;

        if (
          distanceSquared >
          radiusSquared
        ) {
          continue;
        }

        offsets.push({
  x: x === 0 ? 0 : x,
  y: y === 0 ? 0 : y,
  z: z === 0 ? 0 : z,
});
      }
    }
  }

  offsets.sort(
    (
      first,
      second,
    ) => {
      const firstDistance =
        first.x *
          first.x +
        first.y *
          first.y +
        first.z *
          first.z;

      const secondDistance =
        second.x *
          second.x +
        second.y *
          second.y +
        second.z *
          second.z;

      if (
        firstDistance !==
        secondDistance
      ) {
        return (
          firstDistance -
          secondDistance
        );
      }

      if (
        first.x !==
        second.x
      ) {
        return (
          first.x -
          second.x
        );
      }

      if (
        first.y !==
        second.y
      ) {
        return (
          first.y -
          second.y
        );
      }

      return (
        first.z -
        second.z
      );
    },
  );

  const frozen =
    offsets.map(
      cloneCoordinate,
    );

  OFFSET_CACHE.set(
    safeRadius,
    frozen,
  );

  return frozen;
}

function addCoordinate(
  origin: SectorCoordinate,
  offset: SectorCoordinate,
): SectorCoordinate {
  return {
    x:
      origin.x +
      offset.x,

    y:
      origin.y +
      offset.y,

    z:
      origin.z +
      offset.z,
  };
}

class GenerationPriorityQueue {
  private heap:
    GenerationJob[] = [];

  get size():
    number {
    return this.heap.length;
  }

  clear():
    void {
    this.heap.length = 0;
  }

  push(
    job: GenerationJob,
  ): void {
    this.heap.push(job);

    this.bubbleUp(
      this.heap.length - 1,
    );
  }

  pop():
    GenerationJob | null {
    if (
      this.heap.length ===
      0
    ) {
      return null;
    }

    const root =
      this.heap[0] ??
      null;

    const last =
      this.heap.pop();

    if (
      this.heap.length >
        0 &&
      last
    ) {
      this.heap[0] =
        last;

      this.bubbleDown(
        0,
      );
    }

    return root;
  }

  drain():
    GenerationJob[] {
    const jobs:
      GenerationJob[] = [];

    while (
      this.size >
      0
    ) {
      const job =
        this.pop();

      if (job) {
        jobs.push(job);
      }
    }

    return jobs;
  }

  private before(
    first: GenerationJob,
    second: GenerationJob,
  ): boolean {
    if (
      first.priority !==
      second.priority
    ) {
      return (
        first.priority <
        second.priority
      );
    }

    return (
      first.sequence <
      second.sequence
    );
  }

  private bubbleUp(
    start: number,
  ): void {
    let index = start;

    while (
      index >
      0
    ) {
      const parent =
        Math.floor(
          (index - 1) /
          2,
        );

      const current =
        this.heap[index];

      const parentJob =
        this.heap[parent];

      if (
        !current ||
        !parentJob ||
        !this.before(
          current,
          parentJob,
        )
      ) {
        break;
      }

      this.heap[index] =
        parentJob;

      this.heap[parent] =
        current;

      index =
        parent;
    }
  }

  private bubbleDown(
    start: number,
  ): void {
    let index = start;

    while (true) {
      const left =
        index *
          2 +
        1;

      const right =
        left +
        1;

      let best =
        index;

      const bestJob =
        this.heap[best];

      const leftJob =
        this.heap[left];

      if (
        bestJob &&
        leftJob &&
        this.before(
          leftJob,
          bestJob,
        )
      ) {
        best =
          left;
      }

      const currentBest =
        this.heap[best];

      const rightJob =
        this.heap[right];

      if (
        currentBest &&
        rightJob &&
        this.before(
          rightJob,
          currentBest,
        )
      ) {
        best =
          right;
      }

      if (
        best ===
        index
      ) {
        break;
      }

      const first =
        this.heap[index];

      const second =
        this.heap[best];

      if (
        !first ||
        !second
      ) {
        break;
      }

      this.heap[index] =
        second;

      this.heap[best] =
        first;

      index =
        best;
    }
  }
}

export class WorldStreamManager {
  readonly generator:
    ProceduralUniverseGenerator;

  readonly config:
    WorldStreamConfig;

  private readonly clock:
    WorldStreamClock;

  private readonly queue =
    new GenerationPriorityQueue();

  private readonly sectors =
    new Map<
      string,
      SectorCacheRecord
    >();

  private readonly systems =
    new Map<
      string,
      SystemCacheRecord
    >();

  private readonly listeners =
    new Set<
      WorldStreamListener
    >();

  private metricsValue =
    newMetrics();

  private sequence = 0;

  private observerValue:
    WorldStreamObserver | null =
    null;

  private currentSectorValue:
    SectorCoordinate | null =
    null;

  constructor(
    generator:
      ProceduralUniverseGenerator,

    config:
      Partial<
        WorldStreamConfig
      > = {},

    clock:
      WorldStreamClock =
      Date.now,
  ) {
    this.generator =
      generator;

    this.config =
      normalizeConfig(
        config,
      );

    this.clock =
      clock;
  }

  get observer():
    WorldStreamObserver | null {
    if (
      !this.observerValue
    ) {
      return null;
    }

    const result:
      WorldStreamObserver = {
      positionLy:
        cloneVec3(
          this.observerValue
            .positionLy,
        ),
    };

    if (
      this.observerValue
        .velocityLyPerSecond
    ) {
      result.velocityLyPerSecond =
        cloneVec3(
          this.observerValue
            .velocityLyPerSecond,
        );
    }

    return result;
  }

  get currentSector():
    SectorCoordinate | null {
    return this.currentSectorValue
      ? cloneCoordinate(
          this.currentSectorValue,
        )
      : null;
  }

  get queueDepth():
    number {
    return this.queue.size;
  }

  get hasPendingWork():
    boolean {
    return (
      this.queue.size >
      0
    );
  }

  get metrics():
    WorldStreamMetrics {
    return copyMetrics(
      this.metricsValue,
    );
  }

  subscribe(
    listener:
      WorldStreamListener,
  ):
    () => void {
    this.listeners.add(
      listener,
    );

    let active = true;

    return () => {
      if (!active) {
        return;
      }

      active = false;

      this.listeners.delete(
        listener,
      );
    };
  }

  private emit(
    event:
      WorldStreamEvent,
  ): void {
    for (
      const listener
      of this.listeners
    ) {
      try {
        listener(
          event,
        );
      } catch {
        // Streaming must continue even if a UI listener fails.
      }
    }
  }

  private sectorView(
    record:
      SectorCacheRecord,
  ):
    SectorStreamView {
    return {
      key:
        record.key,

      coordinate:
        cloneCoordinate(
          record.coordinate,
        ),

      state:
        record.state,

      reason:
        record.reason,

      lod:
        record.lod,

      desired:
        record.desired,

      pinned:
        record.pinned,

      retryCount:
        record.retryCount,

      lastTouchedMs:
        record.lastTouchedMs,

      loadedAtMs:
        record.loadedAtMs,

      estimatedBytes:
        record
          .estimatedBytes,

      hasData:
        record.sector !==
        null,

      error:
        record.error,
    };
  }

  private systemView(
    record:
      SystemCacheRecord,
  ):
    SystemStreamView {
    return {
      key:
        record.key,

      galaxyId:
        record.galaxyId,

      systemIndex:
        record.systemIndex,

      state:
        record.state,

      pinned:
        record.pinned,

      retryCount:
        record.retryCount,

      lastTouchedMs:
        record.lastTouchedMs,

      loadedAtMs:
        record.loadedAtMs,

      estimatedBytes:
        record
          .estimatedBytes,

      hasData:
        record.system !==
        null,

      error:
        record.error,
    };
  }

  private validJob(
    job:
      GenerationJob,
  ): boolean {
    if (
      job.kind ===
      "sector"
    ) {
      const record =
        this.sectors.get(
          job.key,
        );

      return Boolean(
        record &&
        record.state ===
          "queued" &&
        record.token ===
          job.token,
      );
    }

    const record =
      this.systems.get(
        job.key,
      );

    return Boolean(
      record &&
      record.state ===
        "queued" &&
      record.token ===
        job.token,
    );
  }

  private compactQueue():
    void {
    const jobs =
      this.queue.drain();

    for (
      const job
      of jobs
    ) {
      if (
        this.validJob(
          job,
        )
      ) {
        this.queue.push(
          job,
        );
      }
    }
  }

  private queueJob(
    job:
      GenerationJob,
  ):
    boolean {
    if (
      this.queue.size >=
      this.config
        .maximumQueuedJobs
    ) {
      this.compactQueue();
    }

    if (
      this.queue.size >=
      this.config
        .maximumQueuedJobs
    ) {
      this.metricsValue
        .droppedJobs++;

      return false;
    }

    this.queue.push(
      job,
    );

    this.metricsValue
      .queuePeak =
      Math.max(
        this.metricsValue
          .queuePeak,

        this.queue.size,
      );

    return true;
  }

  private queueSector(
    record:
      SectorCacheRecord,

    now:
      number,
  ): boolean {
    record.token++;

    record.state =
      "queued";

    record.requestedAtMs =
      now;

    const queued =
      this.queueJob({
        kind:
          "sector",

        key:
          record.key,

        token:
          record.token,

        priority:
          record.priority,

        sequence:
          this.sequence++,

        createdAtMs:
          now,

        reason:
          record.reason,
      });

    if (
      !queued
    ) {
      record.state =
        "idle";
    }

    return queued;
  }

  private queueSystem(
    record:
      SystemCacheRecord,

    now:
      number,
  ): boolean {
    record.token++;

    record.state =
      "queued";

    record.requestedAtMs =
      now;

    const queued =
      this.queueJob({
        kind:
          "system",

        key:
          record.key,

        token:
          record.token,

        priority:
          record.priority,

        sequence:
          this.sequence++,

        createdAtMs:
          now,

        reason:
          "system",
      });

    if (
      !queued
    ) {
      record.state =
        "idle";
    }

    return queued;
  }

  private requestSectorInternal(
    coordinate:
      SectorCoordinate,

    reason:
      StreamReason,

    lod:
      SectorLod,

    priority:
      number,

    desired:
      boolean,

    now:
      number,
  ):
    SectorCacheRecord {
    validateCoordinate(
      coordinate,
    );

    this.metricsValue
      .sectorRequests++;

    const key =
      proceduralSectorKey(
        coordinate,
      );

    let record =
      this.sectors.get(
        key,
      );

    if (!record) {
      this.metricsValue
        .sectorCacheMisses++;

      record = {
        key,

        coordinate:
          cloneCoordinate(
            coordinate,
          ),

        state:
          "idle",

        reason,

        lod,

        desired,

        pinned:
          0,

        priority,

        token:
          0,

        retryCount:
          0,

        requestedAtMs:
          null,

        loadedAtMs:
          null,

        lastTouchedMs:
          now,

        estimatedBytes:
          0,

        sector:
          null,

        error:
          null,
      };

      this.sectors.set(
        key,
        record,
      );
    } else {
      if (
        record.state ===
        "ready"
      ) {
        this.metricsValue
          .sectorCacheHits++;
      } else {
        this.metricsValue
          .sectorCacheMisses++;
      }

      record.lastTouchedMs =
        now;

      record.desired =
        record.desired ||
        desired;

      record.lod =
        strongerLod(
          record.lod,
          lod,
        );

      if (
        priority <
        record.priority
      ) {
        record.priority =
          priority;

        record.reason =
          reason;

        if (
          record.state ===
          "queued"
        ) {
          this.queueSector(
            record,
            now,
          );

          return record;
        }
      }
    }

    if (
      record.state ===
        "idle" ||
      (
        record.state ===
          "failed" &&
        record.retryCount <=
          this.config
            .maximumRetryCount
      )
    ) {
      this.queueSector(
        record,
        now,
      );
    }

    return record;
  }

  requestSector(
    coordinate:
      SectorCoordinate,

    lod:
      SectorLod =
      "galaxy",

    priority =
      -100,
  ):
    SectorStreamView {
    const now =
      this.clock();

    const record =
      this.requestSectorInternal(
        coordinate,
        "manual",
        lod,
        priority,
        true,
        now,
      );

    return this.sectorView(
      record,
    );
  }

  getSector(
    coordinate:
      SectorCoordinate,
  ):
    ProceduralSector | null {
    const key =
      proceduralSectorKey(
        coordinate,
      );

    const record =
      this.sectors.get(
        key,
      );

    if (
      !record ||
      record.state !==
        "ready" ||
      !record.sector
    ) {
      return null;
    }

    record.lastTouchedMs =
      this.clock();

    return record.sector;
  }

  getSectorView(
    coordinate:
      SectorCoordinate,
  ):
    SectorStreamView | null {
    const record =
      this.sectors.get(
        proceduralSectorKey(
          coordinate,
        ),
      );

    return record
      ? this.sectorView(
          record,
        )
      : null;
  }

  pinSector(
    coordinate:
      SectorCoordinate,
  ):
    () => void {
    const now =
      this.clock();

    const record =
      this.requestSectorInternal(
        coordinate,
        "manual",
        "galaxy",
        -500,
        true,
        now,
      );

    record.pinned++;

    let released =
      false;

    return () => {
      if (released) {
        return;
      }

      released =
        true;

      record.pinned =
        Math.max(
          0,
          record.pinned -
          1,
        );

      record.lastTouchedMs =
        this.clock();
    };
  }

  requestSystem(
    galaxy:
      GalaxyDescriptor,

    systemIndex:
      number,

    priority =
      -50,
  ):
    SystemStreamView {
    if (
      !Number.isSafeInteger(
        systemIndex,
      ) ||
      systemIndex <
        0
    ) {
      throw new Error(
        "System index must be a non-negative safe integer.",
      );
    }

    this.metricsValue
      .systemRequests++;

    const now =
      this.clock();

    const key =
      systemCacheKey(
        galaxy.id,
        systemIndex,
      );

    let record =
      this.systems.get(
        key,
      );

    if (!record) {
      this.metricsValue
        .systemCacheMisses++;

      record = {
        key,

        galaxy,

        galaxyId:
          galaxy.id,

        systemIndex,

        state:
          "idle",

        pinned:
          0,

        priority,

        token:
          0,

        retryCount:
          0,

        requestedAtMs:
          null,

        loadedAtMs:
          null,

        lastTouchedMs:
          now,

        estimatedBytes:
          0,

        system:
          null,

        error:
          null,
      };

      this.systems.set(
        key,
        record,
      );
    } else {
      if (
        record.state ===
        "ready"
      ) {
        this.metricsValue
          .systemCacheHits++;
      } else {
        this.metricsValue
          .systemCacheMisses++;
      }

      record.lastTouchedMs =
        now;

      if (
        priority <
        record.priority
      ) {
        record.priority =
          priority;

        if (
          record.state ===
          "queued"
        ) {
          this.queueSystem(
            record,
            now,
          );

          return this.systemView(
            record,
          );
        }
      }
    }

    if (
      record.state ===
        "idle" ||
      (
        record.state ===
          "failed" &&
        record.retryCount <=
          this.config
            .maximumRetryCount
      )
    ) {
      this.queueSystem(
        record,
        now,
      );
    }

    return this.systemView(
      record,
    );
  }

  requestSystems(
    galaxy:
      GalaxyDescriptor,

    startIndex:
      number,

    count:
      number,
  ):
    readonly SystemStreamView[] {
    if (
      !Number.isSafeInteger(
        startIndex,
      ) ||
      startIndex <
        0
    ) {
      throw new Error(
        "System start index must be a non-negative safe integer.",
      );
    }

    const safeCount =
      Math.max(
        0,
        Math.floor(
          count,
        ),
      );

    const output:
      SystemStreamView[] = [];

    for (
      let offset = 0;
      offset <
      safeCount;
      offset++
    ) {
      output.push(
        this.requestSystem(
          galaxy,
          startIndex +
            offset,
          offset,
        ),
      );
    }

    return output;
  }

  getSystem(
    galaxyId:
      string,

    systemIndex:
      number,
  ):
    StarSystemDescriptor | null {
    const record =
      this.systems.get(
        systemCacheKey(
          galaxyId,
          systemIndex,
        ),
      );

    if (
      !record ||
      record.state !==
        "ready" ||
      !record.system
    ) {
      return null;
    }

    record.lastTouchedMs =
      this.clock();

    return record.system;
  }

  getSystemView(
    galaxyId:
      string,

    systemIndex:
      number,
  ):
    SystemStreamView | null {
    const record =
      this.systems.get(
        systemCacheKey(
          galaxyId,
          systemIndex,
        ),
      );

    return record
      ? this.systemView(
          record,
        )
      : null;
  }

  pinSystem(
    galaxy:
      GalaxyDescriptor,

    systemIndex:
      number,
  ):
    () => void {
    this.requestSystem(
      galaxy,
      systemIndex,
      -500,
    );

    const key =
      systemCacheKey(
        galaxy.id,
        systemIndex,
      );

    const record =
      this.systems.get(
        key,
      );

    if (!record) {
      throw new Error(
        "Failed to create system stream record.",
      );
    }

    record.pinned++;

    let released =
      false;

    return () => {
      if (released) {
        return;
      }

      released =
        true;

      record.pinned =
        Math.max(
          0,
          record.pinned -
          1,
        );

      record.lastTouchedMs =
        this.clock();
    };
  }

  planObserver(
    observer:
      WorldStreamObserver,
  ):
    WorldStreamPlan {
    if (
      !finiteVec3(
        observer.positionLy,
      )
    ) {
      throw new Error(
        "Observer position must contain finite coordinates.",
      );
    }

    if (
      observer.velocityLyPerSecond &&
      !finiteVec3(
        observer.velocityLyPerSecond,
      )
    ) {
      throw new Error(
        "Observer velocity must contain finite coordinates.",
      );
    }

    const now =
      this.clock();

    const storedObserver:
      WorldStreamObserver = {
      positionLy:
        cloneVec3(
          observer.positionLy,
        ),
    };

    if (
      observer.velocityLyPerSecond
    ) {
      storedObserver.velocityLyPerSecond =
        cloneVec3(
          observer.velocityLyPerSecond,
        );
    }

    this.observerValue =
      storedObserver;

    const current =
      positionToSector(
        observer.positionLy,

        this.generator
          .profile
          .sectorSizeLy,
      );

    this.currentSectorValue =
      cloneCoordinate(
        current,
      );

    for (
      const record
      of this.sectors.values()
    ) {
      record.desired =
        false;
    }

    const desiredKeys =
      new Set<string>();

    const observerOffsets =
      sectorOffsetsWithinRadius(
        this.config
          .loadRadiusSectors,
      );

    let queuedSectorCount =
      0;

    for (
      const offset
      of observerOffsets
    ) {
      const coordinate =
        addCoordinate(
          current,
          offset,
        );

      const distanceSquared =
        offset.x *
          offset.x +
        offset.y *
          offset.y +
        offset.z *
          offset.z;

      const lod =
        lodForDistance(
          distanceSquared,

          this.config
            .galaxyDetailRadiusSectors,
        );

      const priority =
        distanceSquared *
        10;

      const record =
        this.requestSectorInternal(
          coordinate,
          "observer",
          lod,
          priority,
          true,
          now,
        );

      desiredKeys.add(
        record.key,
      );

      if (
        record.state ===
        "queued"
      ) {
        queuedSectorCount++;
      }
    }

    let prefetchSectorCount =
      0;

    const predictedPosition =
      predictObserverPosition(
        observer,

        this.config
          .prefetchSeconds,
      );

    const predictedSector =
      positionToSector(
        predictedPosition,

        this.generator
          .profile
          .sectorSizeLy,
      );

    if (
      predictedSector.x !==
        current.x ||
      predictedSector.y !==
        current.y ||
      predictedSector.z !==
        current.z
    ) {
      const prefetchOffsets =
        sectorOffsetsWithinRadius(
          this.config
            .prefetchRadiusSectors,
        );

      for (
        const offset
        of prefetchOffsets
      ) {
        const coordinate =
          addCoordinate(
            predictedSector,
            offset,
          );

        const key =
          proceduralSectorKey(
            coordinate,
          );

        if (
          desiredKeys.has(
            key,
          )
        ) {
          continue;
        }

        const distanceSquared =
          sectorDistanceSquared(
            current,
            coordinate,
          );

        const record =
          this.requestSectorInternal(
            coordinate,
            "prefetch",
            "cosmic",
            1_000 +
              distanceSquared *
              10,
            true,
            now,
          );

        desiredKeys.add(
          record.key,
        );

        prefetchSectorCount++;

        if (
          record.state ===
          "queued"
        ) {
          queuedSectorCount++;
        }
      }
    }

    this.pruneUnwantedSectors(
      current,
      now,
    );

    this.pruneIdleSystems(
      now,
    );

    this.enforceCacheBudgets(
      now,
    );

    return {
      currentSector:
        cloneCoordinate(
          current,
        ),

      desiredSectorCount:
        desiredKeys.size,

      queuedSectorCount,

      prefetchSectorCount,
    };
  }

  updateObserver(
    observer:
      WorldStreamObserver,

    generationLimit =
      this.config
        .maximumGenerationsPerTick,
  ):
    WorldStreamTickResult {
    this.planObserver(
      observer,
    );

    return this.tick(
      generationLimit,
    );
  }

  private generateSectorJob(
    job:
      SectorGenerationJob,

    now:
      number,
  ):
    "generated" |
    "failed" |
    "stale" {
    const record =
      this.sectors.get(
        job.key,
      );

    if (
      !record ||
      record.state !==
        "queued" ||
      record.token !==
        job.token
    ) {
      this.metricsValue
        .staleJobsSkipped++;

      return "stale";
    }

    record.state =
      "generating";

    try {
      const sector =
        this.generator.sector(
          record.coordinate,
        );

      record.sector =
        sector;

      record.state =
        "ready";

      record.error =
        null;

      record.loadedAtMs =
        now;

      record.lastTouchedMs =
        now;

      record.estimatedBytes =
        estimateSectorBytes(
          sector,
        );

      this.metricsValue
        .generatedSectors++;

      this.metricsValue
        .generatedJobs++;

      this.emit({
        type:
          "sector-ready",

        key:
          record.key,

        coordinate:
          cloneCoordinate(
            record.coordinate,
          ),

        sector,
      });

      return "generated";
    } catch (error) {
      const message =
        error instanceof
        Error
          ? error.message
          : String(error);

      record.state =
        "failed";

      record.error =
        message;

      record.retryCount++;

      this.metricsValue
        .generationErrors++;

      this.emit({
        type:
          "generation-error",

        layer:
          "sector",

        key:
          record.key,

        message,
      });

      if (
        record.retryCount <=
          this.config
            .maximumRetryCount &&
        (
          record.desired ||
          record.pinned >
            0
        )
      ) {
        record.priority +=
          50 *
          record.retryCount;

        this.queueSector(
          record,
          now,
        );
      }

      return "failed";
    }
  }

  private generateSystemJob(
    job:
      SystemGenerationJob,

    now:
      number,
  ):
    "generated" |
    "failed" |
    "stale" {
    const record =
      this.systems.get(
        job.key,
      );

    if (
      !record ||
      record.state !==
        "queued" ||
      record.token !==
        job.token
    ) {
      this.metricsValue
        .staleJobsSkipped++;

      return "stale";
    }

    record.state =
      "generating";

    try {
      const system =
        this.generator.system(
          record.galaxy,
          record.systemIndex,
        );

      record.system =
        system;

      record.state =
        "ready";

      record.error =
        null;

      record.loadedAtMs =
        now;

      record.lastTouchedMs =
        now;

      record.estimatedBytes =
        estimateSystemBytes(
          system,
        );

      this.metricsValue
        .generatedSystems++;

      this.metricsValue
        .generatedJobs++;

      this.emit({
        type:
          "system-ready",

        key:
          record.key,

        galaxyId:
          record.galaxyId,

        systemIndex:
          record.systemIndex,

        system,
      });

      return "generated";
    } catch (error) {
      const message =
        error instanceof
        Error
          ? error.message
          : String(error);

      record.state =
        "failed";

      record.error =
        message;

      record.retryCount++;

      this.metricsValue
        .generationErrors++;

      this.emit({
        type:
          "generation-error",

        layer:
          "system",

        key:
          record.key,

        message,
      });

      if (
        record.retryCount <=
        this.config
          .maximumRetryCount
      ) {
        record.priority +=
          50 *
          record.retryCount;

        this.queueSystem(
          record,
          now,
        );
      }

      return "failed";
    }
  }

  tick(
    generationLimit =
      this.config
        .maximumGenerationsPerTick,
  ):
    WorldStreamTickResult {
    const limit =
      normalizeInteger(
        generationLimit,
        0,
        "generationLimit",
      );

    const result:
      WorldStreamTickResult = {
      processed: 0,

      generated: 0,

      failed: 0,

      stale: 0,

      queueRemaining: 0,
    };

    this.metricsValue
      .generationTicks++;

    for (
      let index = 0;
      index <
      limit;
      index++
    ) {
      const job =
        this.queue.pop();

      if (!job) {
        break;
      }

      result.processed++;

      const now =
        this.clock();

      const outcome =
        job.kind ===
        "sector"
          ? this.generateSectorJob(
              job,
              now,
            )
          : this.generateSystemJob(
              job,
              now,
            );

      if (
        outcome ===
        "generated"
      ) {
        result.generated++;
      } else if (
        outcome ===
        "failed"
      ) {
        result.failed++;
      } else {
        result.stale++;
      }
    }

    this.enforceCacheBudgets(
      this.clock(),
    );

    result.queueRemaining =
      this.queue.size;

    return result;
  }

  drain(
    maximumJobs =
      100_000,
  ):
    WorldStreamTickResult {
    const maximum =
      normalizeInteger(
        maximumJobs,
        0,
        "maximumJobs",
      );

    const total:
      WorldStreamTickResult = {
      processed: 0,

      generated: 0,

      failed: 0,

      stale: 0,

      queueRemaining:
        this.queue.size,
    };

    while (
      this.queue.size >
        0 &&
      total.processed <
        maximum
    ) {
      const remaining =
        maximum -
        total.processed;

      const tick =
        this.tick(
          Math.min(
            remaining,

            this.config
              .maximumGenerationsPerTick,
          ),
        );

      total.processed +=
        tick.processed;

      total.generated +=
        tick.generated;

      total.failed +=
        tick.failed;

      total.stale +=
        tick.stale;

      total.queueRemaining =
        tick.queueRemaining;

      if (
        tick.processed ===
        0
      ) {
        break;
      }
    }

    return total;
  }

  private pruneUnwantedSectors(
    current:
      SectorCoordinate,

    now:
      number,
  ): void {
    const retainSquared =
      square(
        this.config
          .retainRadiusSectors,
      );

    const records =
      [
        ...this.sectors.values(),
      ];

    for (
      const record
      of records
    ) {
      if (
        record.desired ||
        record.pinned >
          0
      ) {
        continue;
      }

      const distanceSquared =
        sectorDistanceSquared(
          current,
          record.coordinate,
        );

      const tooFar =
        distanceSquared >
        retainSquared;

      const expired =
        now -
          record.lastTouchedMs >
        this.config
          .sectorIdleLifetimeMs;

      if (
        tooFar ||
        expired
      ) {
        this.evictSector(
          record.key,

          tooFar
            ? "outside-retain-radius"
            : "idle-timeout",
        );
      }
    }
  }

  private pruneIdleSystems(
    now:
      number,
  ): void {
    const records =
      [
        ...this.systems.values(),
      ];

    for (
      const record
      of records
    ) {
      if (
        record.pinned >
        0
      ) {
        continue;
      }

      if (
        now -
          record.lastTouchedMs >
        this.config
          .systemIdleLifetimeMs
      ) {
        this.evictSystem(
          record.key,
          "idle-timeout",
        );
      }
    }
  }

  private evictSector(
    key:
      string,

    reason:
      string,
  ):
    boolean {
    const record =
      this.sectors.get(
        key,
      );

    if (
      !record ||
      record.pinned >
        0
    ) {
      return false;
    }

    record.token++;

    this.sectors.delete(
      key,
    );

    this.metricsValue
      .sectorEvictions++;

    this.emit({
      type:
        "sector-evicted",

      key:

        record.key,

      coordinate:
        cloneCoordinate(
          record.coordinate,
        ),

      reason,
    });

    return true;
  }

  private evictSystem(
    key:
      string,

    reason:
      string,
  ):
    boolean {
    const record =
      this.systems.get(
        key,
      );

    if (
      !record ||
      record.pinned >
        0
    ) {
      return false;
    }

    record.token++;

    this.systems.delete(
      key,
    );

    this.metricsValue
      .systemEvictions++;

    this.emit({
      type:
        "system-evicted",

      key:
        record.key,

      galaxyId:
        record.galaxyId,

      systemIndex:
        record.systemIndex,

      reason,
    });

    return true;
  }

  private readySectorRecords():
    SectorCacheRecord[] {
    return [
      ...this.sectors.values(),
    ].filter(
      record =>
        record.state ===
          "ready" &&
        record.sector !==
          null,
    );
  }

  private readySystemRecords():
    SystemCacheRecord[] {
    return [
      ...this.systems.values(),
    ].filter(
      record =>
        record.state ===
          "ready" &&
        record.system !==
          null,
    );
  }

  private enforceSectorCount():
    void {
    let records =
      this.readySectorRecords();

    if (
      records.length <=
      this.config
        .maximumResidentSectors
    ) {
      return;
    }

    records = records
      .filter(
        record =>
          record.pinned ===
          0,
      )
      .sort(
        (
          first,
          second,
        ) =>
          first.lastTouchedMs -
          second.lastTouchedMs,
      );

    let excess =
      this.readySectorRecords()
        .length -
      this.config
        .maximumResidentSectors;

    for (
      const record
      of records
    ) {
      if (
        excess <=
        0
      ) {
        break;
      }

      if (
        this.evictSector(
          record.key,
          "sector-count-budget",
        )
      ) {
        excess--;
      }
    }
  }

  private enforceSystemCount():
    void {
    let records =
      this.readySystemRecords();

    if (
      records.length <=
      this.config
        .maximumResidentSystems
    ) {
      return;
    }

    records = records
      .filter(
        record =>
          record.pinned ===
          0,
      )
      .sort(
        (
          first,
          second,
        ) =>
          first.lastTouchedMs -
          second.lastTouchedMs,
      );

    let excess =
      this.readySystemRecords()
        .length -
      this.config
        .maximumResidentSystems;

    for (
      const record
      of records
    ) {
      if (
        excess <=
        0
      ) {
        break;
      }

      if (
        this.evictSystem(
          record.key,
          "system-count-budget",
        )
      ) {
        excess--;
      }
    }
  }

  memoryEstimate():
    WorldStreamMemoryEstimate {
    let sectorBytes =
      0;

    let systemBytes =
      0;

    let readySectors =
      0;

    let readySystems =
      0;

    for (
      const record
      of this.sectors.values()
    ) {
      if (
        record.state !==
        "ready"
      ) {
        continue;
      }

      readySectors++;

      sectorBytes +=
        record.estimatedBytes;
    }

    for (
      const record
      of this.systems.values()
    ) {
      if (
        record.state !==
        "ready"
      ) {
        continue;
      }

      readySystems++;

      systemBytes +=
        record.estimatedBytes;
    }

    return {
      sectorBytes,

      systemBytes,

      totalBytes:
        sectorBytes +
        systemBytes,

      readySectors,

      readySystems,
    };
  }

  private enforceMemoryBudget():
    void {
    let memory =
      this.memoryEstimate();

    if (
      memory.totalBytes <=
      this.config
        .estimatedMemoryBudgetBytes
    ) {
      return;
    }

    type Candidate = {
      layer:
        "sector" |
        "system";

      key:
        string;

      touched:
        number;

      bytes:
        number;
    };

    const candidates:
      Candidate[] = [];

    for (
      const record
      of this.sectors.values()
    ) {
      if (
        record.state ===
          "ready" &&
        record.pinned ===
          0
      ) {
        candidates.push({
          layer:
            "sector",

          key:
            record.key,

          touched:
            record
              .lastTouchedMs,

          bytes:
            record
              .estimatedBytes,
        });
      }
    }

    for (
      const record
      of this.systems.values()
    ) {
      if (
        record.state ===
          "ready" &&
        record.pinned ===
          0
      ) {
        candidates.push({
          layer:
            "system",

          key:
            record.key,

          touched:
            record
              .lastTouchedMs,

          bytes:
            record
              .estimatedBytes,
        });
      }
    }

    candidates.sort(
      (
        first,
        second,
      ) => {
        if (
          first.touched !==
          second.touched
        ) {
          return (
            first.touched -
            second.touched
          );
        }

        return (
          second.bytes -
          first.bytes
        );
      },
    );

    for (
      const candidate
      of candidates
    ) {
      if (
        memory.totalBytes <=
        this.config
          .estimatedMemoryBudgetBytes
      ) {
        break;
      }

      const evicted =
        candidate.layer ===
        "sector"
          ? this.evictSector(
              candidate.key,
              "memory-budget",
            )
          : this.evictSystem(
              candidate.key,
              "memory-budget",
            );

      if (evicted) {
        memory =
          this.memoryEstimate();
      }
    }
  }

  private enforceCacheBudgets(
    now:
      number,
  ): void {
    this.pruneIdleSystems(
      now,
    );

    this.enforceSectorCount();

    this.enforceSystemCount();

    this.enforceMemoryBudget();
  }

  nearbyLoadedSectors(
    positionLy:
      Vec3,

    radiusSectors:
      number,
  ):
    readonly ProceduralSector[] {
    if (
      !finiteVec3(
        positionLy,
      )
    ) {
      throw new Error(
        "Position must contain finite values.",
      );
    }

    const radius =
      normalizeInteger(
        radiusSectors,
        0,
        "radiusSectors",
      );

    const center =
      positionToSector(
        positionLy,

        this.generator
          .profile
          .sectorSizeLy,
      );

    const maximumDistanceSquared =
      radius *
      radius;

    const results:
      {
        distanceSquared:
          number;

        sector:
          ProceduralSector;
      }[] = [];

    for (
      const record
      of this.sectors.values()
    ) {
      if (
        record.state !==
          "ready" ||
        !record.sector
      ) {
        continue;
      }

      const distanceSquared =
        sectorDistanceSquared(
          center,
          record.coordinate,
        );

      if (
        distanceSquared >
        maximumDistanceSquared
      ) {
        continue;
      }

      results.push({
        distanceSquared,

        sector:
          record.sector,
      });
    }

    results.sort(
      (
        first,
        second,
      ) =>
        first.distanceSquared -
        second.distanceSquared,
    );

    return results.map(
      result =>
        result.sector,
    );
  }

  loadedGalaxies():
    readonly GalaxyDescriptor[] {
    const galaxies:
      GalaxyDescriptor[] = [];

    for (
      const record
      of this.sectors.values()
    ) {
      if (
        record.state !==
          "ready" ||
        !record.sector
      ) {
        continue;
      }

      galaxies.push(
        ...record.sector
          .galaxies,
      );
    }

    return galaxies;
  }

  loadedSystems():
    readonly StarSystemDescriptor[] {
    const systems:
      StarSystemDescriptor[] = [];

    for (
      const record
      of this.systems.values()
    ) {
      if (
        record.state ===
          "ready" &&
        record.system
      ) {
        systems.push(
          record.system,
        );
      }
    }

    return systems;
  }

  snapshot():
    WorldStreamSnapshot {
    const sectors =
      [
        ...this.sectors.values(),
      ]
        .map(
          record =>
            this.sectorView(
              record,
            ),
        )
        .sort(
          (
            first,
            second,
          ) =>
            first.key.localeCompare(
              second.key,
            ),
        );

    const systems =
      [
        ...this.systems.values(),
      ]
        .map(
          record =>
            this.systemView(
              record,
            ),
        )
        .sort(
          (
            first,
            second,
          ) =>
            first.key.localeCompare(
              second.key,
            ),
        );

    return {
      observer:
        this.observer,

      currentSector:
        this.currentSector,

      queueDepth:
        this.queue.size,

      sectors,

      systems,

      metrics:
        copyMetrics(
          this.metricsValue,
        ),

      memory:
        this.memoryEstimate(),
    };
  }

  resetMetrics():
    void {
    this.metricsValue =
      newMetrics();
  }

  clear():
    void {
    for (
      const record
      of this.sectors.values()
    ) {
      record.token++;
    }

    for (
      const record
      of this.systems.values()
    ) {
      record.token++;
    }

    this.queue.clear();

    this.sectors.clear();

    this.systems.clear();

    this.observerValue =
      null;

    this.currentSectorValue =
      null;

    this.resetMetrics();
  }

  dispose():
    void {
    this.clear();

    this.listeners.clear();
  }
}

export function createWorldStream(
  seed:
    string,

  config:
    Partial<
      WorldStreamConfig
    > = {},
):
  WorldStreamManager {
  return new WorldStreamManager(
    new ProceduralUniverseGenerator(
      seed,
    ),
    config,
  );
}

export function worldStreamInfo(
  stream:
    WorldStreamManager,
): {
  version:
    number;

  seed:
    string;

  seedKey:
    string;

  preset:
    string;

  sectorSizeLy:
    number;

  queueDepth:
    number;

  memory:
    WorldStreamMemoryEstimate;
} {
  return {
    version:
      WORLD_STREAM_VERSION,

    seed:
      stream
        .generator
        .seed
        .input,

    seedKey:
      stream
        .generator
        .seed
        .key,

    preset:
      stream
        .generator
        .profile
        .preset,

    sectorSizeLy:
      stream
        .generator
        .profile
        .sectorSizeLy,

    queueDepth:
      stream.queueDepth,

    memory:
      stream.memoryEstimate(),
  };
}   