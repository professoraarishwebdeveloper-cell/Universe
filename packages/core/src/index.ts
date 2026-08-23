export type EntityId = string;
export type FrameId = string;
export type SourceId = string;

export type Vec3 = readonly [number, number, number];

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/* Distance */

export type DistanceUnit = "m" | "km" | "au" | "ly" | "pc";

export const METERS_PER_UNIT: Readonly<Record<DistanceUnit, number>> = {
  m: 1,
  km: 1_000,
  au: 149_597_870_700,
  ly: 9_460_730_472_580_800,
  pc: 3.0856775814913673e16,
};

export function convertDistance(
  value: number,
  from: DistanceUnit,
  to: DistanceUnit,
): number {
  return (value * METERS_PER_UNIT[from]) / METERS_PER_UNIT[to];
}

export function vectorLength(vector: Vec3): number {
  const [x, y, z] = vector;

  return Math.sqrt(x * x + y * y + z * z);
}

export function validVector(vector: Vec3): boolean {
  return vector.every((value) => Number.isFinite(value));
}

/* Reference frames */

export type ReferenceFrameKind =
  | "local"
  | "surface"
  | "body"
  | "barycentric"
  | "stellar"
  | "galactic"
  | "cosmological";

export interface ReferenceFrame {
  id: FrameId;
  name: string;
  kind: ReferenceFrameKind;

  parentId?: FrameId;
  originEntityId?: EntityId;
}

export interface SpatialPosition {
  frameId: FrameId;
  position: Vec3;
  unit: DistanceUnit;

  orientation?: Quaternion;
}

/* Scientific knowledge */

export type EvidenceLevel =
  "measured" | "derived" | "estimated" | "theoretical" | "unknown";

export interface ScientificSource {
  id: SourceId;
  title: string;

  organization?: string;
  url?: string;
  accessedAt?: string;
}

export interface ScientificValue<T> {
  value: T;

  evidence: EvidenceLevel;

  confidence?: number;

  sourceIds: readonly SourceId[];
}

export function validConfidence(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/* Space objects */

export type EntityKind =
  | "surface-feature"
  | "building"
  | "city"
  | "country"
  | "planet"
  | "dwarf-planet"
  | "moon"
  | "star"
  | "black-hole"
  | "neutron-star"
  | "asteroid"
  | "comet"
  | "satellite"
  | "spacecraft"
  | "debris"
  | "nebula"
  | "star-cluster"
  | "galaxy"
  | "galaxy-group"
  | "galaxy-cluster"
  | "cosmic-structure";

export interface PhysicalProperties {
  radiusM?: ScientificValue<number>;
  massKg?: ScientificValue<number>;

  temperatureK?: ScientificValue<number>;
  densityKgM3?: ScientificValue<number>;

  surfaceGravityMs2?: ScientificValue<number>;
}

export interface OrbitalElements {
  semiMajorAxisM?: number;

  eccentricity?: number;

  inclinationDeg?: number;

  longitudeAscendingNodeDeg?: number;

  argumentPeriapsisDeg?: number;

  meanAnomalyDeg?: number;

  epochJulianDay?: number;
}

export interface SpaceEntity {
  id: EntityId;

  name: string;

  kind: EntityKind;

  parentId?: EntityId;

  spatial?: SpatialPosition;

  physical?: PhysicalProperties;

  orbit?: OrbitalElements;

  summary?: string;

  aliases?: readonly string[];

  tags?: readonly string[];

  sourceIds: readonly SourceId[];
}

/* Entity hierarchy */

export function findEntity(
  id: EntityId,
  entities: Iterable<SpaceEntity>,
): SpaceEntity | undefined {
  for (const entity of entities) {
    if (entity.id === id) {
      return entity;
    }
  }

  return undefined;
}

export function getChildren(
  parentId: EntityId,
  entities: Iterable<SpaceEntity>,
): SpaceEntity[] {
  const children: SpaceEntity[] = [];

  for (const entity of entities) {
    if (entity.parentId === parentId) {
      children.push(entity);
    }
  }

  return children;
}

export function getAncestors(
  id: EntityId,
  entities: Iterable<SpaceEntity>,
): SpaceEntity[] {
  const entityList = [...entities];

  const ancestors: SpaceEntity[] = [];

  let current = findEntity(id, entityList);

  const visited = new Set<EntityId>();

  while (current?.parentId) {
    if (visited.has(current.id)) {
      break;
    }

    visited.add(current.id);

    const parent = findEntity(current.parentId, entityList);

    if (!parent) {
      break;
    }

    ancestors.push(parent);

    current = parent;
  }

  return ancestors;
}

/* Astronomical time */

export type TimeScale = "UTC" | "TAI" | "TT" | "TDB";

export interface AstroTime {
  julianDay: number;

  scale: TimeScale;
}

export interface ClockState {
  time: AstroTime;

  rate: number;

  paused: boolean;
}

/*
 * Julian Day conversion.
 *
 * JavaScript dates remain useful at the boundary of the
 * application, but the astronomical engine should work with
 * explicit astronomical time values.
 */

const UNIX_EPOCH_JULIAN_DAY = 2_440_587.5;
const MILLISECONDS_PER_DAY = 86_400_000;

export function dateToJulianDay(date: Date): number {
  return date.getTime() / MILLISECONDS_PER_DAY + UNIX_EPOCH_JULIAN_DAY;
}

export function julianDayToDate(julianDay: number): Date {
  return new Date((julianDay - UNIX_EPOCH_JULIAN_DAY) * MILLISECONDS_PER_DAY);
}

/* Knowledge */

export interface KnowledgeProfile {
  entityId: EntityId;

  position?: number;

  mass?: number;

  composition?: number;

  surface?: number;

  overall?: number;

  notes?: readonly string[];
}

export function knowledgeConfidence(
  profile: KnowledgeProfile,
): number | undefined {
  if (profile.overall !== undefined && validConfidence(profile.overall)) {
    return profile.overall;
  }

  const values = [
    profile.position,
    profile.mass,
    profile.composition,
    profile.surface,
  ].filter(
    (value): value is number => value !== undefined && validConfidence(value),
  );

  if (values.length === 0) {
    return undefined;
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return total / values.length;
}

/* Humanity */

export type InterstellarCapability = "none" | "uncrewed-probe" | "crew-capable";

export interface HumanityStatus {
  year: number;

  civilizationLabel: string;

  kardashevEstimate?: number;

  farthestHumanObjectId?: EntityId;

  humansLivingOffEarth: number;

  interstellarCapability: InterstellarCapability;

  confirmedExtraterrestrialLife: boolean;
}

/* Utility validation */

export function assertFiniteNumber(value: number, label = "value"): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

export function assertConfidence(value: number, label = "confidence"): void {
  if (!validConfidence(value)) {
    throw new Error(`${label} must be between 0 and 1.`);
  }
}

export function assertValidEntity(entity: SpaceEntity): void {
  if (!entity.id.trim()) {
    throw new Error("Entity id cannot be empty.");
  }

  if (!entity.name.trim()) {
    throw new Error(`Entity "${entity.id}" must have a name.`);
  }

  if (entity.parentId === entity.id) {
    throw new Error(`Entity "${entity.id}" cannot be its own parent.`);
  }

  if (entity.spatial && !validVector(entity.spatial.position)) {
    throw new Error(`Entity "${entity.id}" has an invalid position.`);
  }
}

/* Core information */

export const ARCHITECTURE_VERSION = 1;

export const CORE_NAME = "Known Universe Core";
