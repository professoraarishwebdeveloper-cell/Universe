import type { EntityId, SpaceEntity } from "@known-universe/core";

import { PROCEDURAL_ENGINE_VERSION } from "./procedural";

import type {
  AsteroidBeltDescriptor,
  GalaxyDescriptor,
  MoonDescriptor,
  PlanetDescriptor,
  ProceduralSector,
  RealityClass,
  SectorCoordinate,
  StarDescriptor,
  StarSystemDescriptor,
} from "./procedural";

import type { SectorLod } from "./world-stream";

import { WorldStreamManager } from "./world-stream";

export const UNIFIED_UNIVERSE_VERSION = 1;

export type ScientificRealityClass = Exclude<RealityClass, "procedural">;

export type UniverseRealm =
  "reality" | "observational-frontier" | "procedural-frontier";

export type ProceduralTargetKind =
  "sector" | "galaxy" | "system" | "star" | "planet" | "moon" | "asteroid-belt";

export interface ScientificUniverseRecord {
  entity: SpaceEntity;

  realityClass: ScientificRealityClass;

  confidence?: number;

  note?: string;
}

export interface ScientificSearchOptions {
  limit?: number;

  kinds?: readonly string[];

  realityClasses?: readonly ScientificRealityClass[];
}

export interface ScientificUniverseSource {
  get(id: EntityId): Promise<ScientificUniverseRecord | null>;

  search(
    query: string,

    options?: ScientificSearchOptions,
  ): Promise<readonly ScientificUniverseRecord[]>;

  children?(parentId: EntityId): Promise<readonly ScientificUniverseRecord[]>;
}

export interface RealityUniverseAddress {
  domain: "reality";

  entityId: EntityId;
}

export interface ObservationalFrontierAddress {
  domain: "observational-frontier";

  label: string;
}

export interface ProceduralUniverseAddress {
  domain: "procedural";

  seedKey: string;

  kind: ProceduralTargetKind;

  sector: SectorCoordinate;

  galaxyIndex?: number;

  systemIndex?: number;

  planetIndex?: number;

  moonIndex?: number;

  componentIndex?: number;
}

export type UniverseAddress =
  | RealityUniverseAddress
  | ObservationalFrontierAddress
  | ProceduralUniverseAddress;

export interface ScientificSelection {
  realm: "reality";

  address: RealityUniverseAddress;

  record: ScientificUniverseRecord;
}

export interface ObservationalFrontierSelection {
  realm: "observational-frontier";

  address: ObservationalFrontierAddress;

  title: string;

  message: string;
}

export interface ProceduralSectorSelection {
  realm: "procedural-frontier";

  address: ProceduralUniverseAddress;

  targetKind: "sector";

  sector: ProceduralSector;
}

export interface ProceduralGalaxySelection {
  realm: "procedural-frontier";

  address: ProceduralUniverseAddress;

  targetKind: "galaxy";

  galaxy: GalaxyDescriptor;
}

export interface ProceduralSystemSelection {
  realm: "procedural-frontier";

  address: ProceduralUniverseAddress;

  targetKind: "system";

  galaxy: GalaxyDescriptor;

  system: StarSystemDescriptor;
}

export interface ProceduralStarSelection {
  realm: "procedural-frontier";

  address: ProceduralUniverseAddress;

  targetKind: "star";

  galaxy: GalaxyDescriptor;

  system: StarSystemDescriptor;

  star: StarDescriptor;
}

export interface ProceduralPlanetSelection {
  realm: "procedural-frontier";

  address: ProceduralUniverseAddress;

  targetKind: "planet";

  galaxy: GalaxyDescriptor;

  system: StarSystemDescriptor;

  planet: PlanetDescriptor;
}

export interface ProceduralMoonSelection {
  realm: "procedural-frontier";

  address: ProceduralUniverseAddress;

  targetKind: "moon";

  galaxy: GalaxyDescriptor;

  system: StarSystemDescriptor;

  planet: PlanetDescriptor;

  moon: MoonDescriptor;
}

export interface ProceduralBeltSelection {
  realm: "procedural-frontier";

  address: ProceduralUniverseAddress;

  targetKind: "asteroid-belt";

  galaxy: GalaxyDescriptor;

  system: StarSystemDescriptor;

  belt: AsteroidBeltDescriptor;
}

export type ProceduralSelection =
  | ProceduralSectorSelection
  | ProceduralGalaxySelection
  | ProceduralSystemSelection
  | ProceduralStarSelection
  | ProceduralPlanetSelection
  | ProceduralMoonSelection
  | ProceduralBeltSelection;

export type UniverseSelection =
  ScientificSelection | ObservationalFrontierSelection | ProceduralSelection;

export interface UniverseHistoryEntry {
  address: UniverseAddress;

  title: string;

  visitedAtMs: number;
}

export interface UnifiedUniverseSnapshot {
  version: number;

  realm: UniverseRealm;

  selection: UniverseSelection | null;

  history: readonly UniverseHistoryEntry[];

  historyIndex: number;

  proceduralSeedKey: string;

  proceduralGenerationVersion: number;
}

export interface UnifiedUniverseOptions {
  allowProceduralFrontier: boolean;

  maximumHistoryEntries: number;

  generationTicksPerResolve: number;

  defaultSectorLod: SectorLod;
}

export const DEFAULT_UNIFIED_UNIVERSE_OPTIONS: UnifiedUniverseOptions = {
  allowProceduralFrontier: true,

  maximumHistoryEntries: 128,

  generationTicksPerResolve: 64,

  defaultSectorLod: "galaxy",
};

export type UnifiedUniverseEvent =
  | {
      type: "realm-changed";

      realm: UniverseRealm;
    }
  | {
      type: "selection-changed";

      selection: UniverseSelection | null;
    }
  | {
      type: "history-changed";

      historyIndex: number;

      historyLength: number;
    };

export type UnifiedUniverseListener = (event: UnifiedUniverseEvent) => void;

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function validConfidence(value: number | undefined): boolean {
  return value === undefined || (finite(value) && value >= 0 && value <= 1);
}

function cloneCoordinate(coordinate: SectorCoordinate): SectorCoordinate {
  return {
    x: coordinate.x,

    y: coordinate.y,

    z: coordinate.z,
  };
}

function validateSectorCoordinate(coordinate: SectorCoordinate): void {
  if (
    !Number.isSafeInteger(coordinate.x) ||
    !Number.isSafeInteger(coordinate.y) ||
    !Number.isSafeInteger(coordinate.z)
  ) {
    throw new Error("Universe sector coordinates must be safe integers.");
  }
}

function requireNonNegativeInteger(
  value: number | undefined,

  name: string,
): number {
  if (value === undefined || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }

  return value;
}

function normalizeOptions(
  options: Partial<UnifiedUniverseOptions>,
): UnifiedUniverseOptions {
  const result = {
    ...DEFAULT_UNIFIED_UNIVERSE_OPTIONS,
    ...options,
  };

  if (
    !Number.isSafeInteger(result.maximumHistoryEntries) ||
    result.maximumHistoryEntries < 1
  ) {
    throw new Error("maximumHistoryEntries must be a positive safe integer.");
  }

  if (
    !Number.isSafeInteger(result.generationTicksPerResolve) ||
    result.generationTicksPerResolve < 1
  ) {
    throw new Error(
      "generationTicksPerResolve must be a positive safe integer.",
    );
  }

  return result;
}

export function validateScientificRecord(
  record: ScientificUniverseRecord,
): readonly string[] {
  const issues: string[] = [];

  if (!record.entity.id) {
    issues.push("Scientific entity is missing an ID.");
  }

  if (!record.entity.name) {
    issues.push("Scientific entity is missing a name.");
  }

  if (!validConfidence(record.confidence)) {
    issues.push("Scientific confidence must be between 0 and 1.");
  }

  if (!record.entity.sourceIds || record.entity.sourceIds.length === 0) {
    issues.push("Scientific entity has no provenance sources.");
  }

  return issues;
}

export function scientificAddress(entityId: EntityId): RealityUniverseAddress {
  if (!entityId) {
    throw new Error("Scientific address requires an entity ID.");
  }

  return {
    domain: "reality",

    entityId,
  };
}

export function frontierAddress(
  label = "observational-frontier",
): ObservationalFrontierAddress {
  return {
    domain: "observational-frontier",

    label,
  };
}

export function proceduralAddress(
  seedKey: string,

  kind: ProceduralTargetKind,

  sector: SectorCoordinate,

  indexes: {
    galaxyIndex?: number | undefined;

    systemIndex?: number | undefined;

    planetIndex?: number | undefined;

    moonIndex?: number | undefined;

    componentIndex?: number | undefined;
  } = {},
): ProceduralUniverseAddress {
  validateSectorCoordinate(sector);

  if (!seedKey) {
    throw new Error("Procedural universe address requires a seed key.");
  }

  const address: ProceduralUniverseAddress = {
    domain: "procedural",

    seedKey,

    kind,

    sector: cloneCoordinate(sector),
  };

  if (indexes.galaxyIndex !== undefined) {
    address.galaxyIndex = indexes.galaxyIndex;
  }

  if (indexes.systemIndex !== undefined) {
    address.systemIndex = indexes.systemIndex;
  }

  if (indexes.planetIndex !== undefined) {
    address.planetIndex = indexes.planetIndex;
  }

  if (indexes.moonIndex !== undefined) {
    address.moonIndex = indexes.moonIndex;
  }

  if (indexes.componentIndex !== undefined) {
    address.componentIndex = indexes.componentIndex;
  }

  return address;
}

export function universeAddressEquals(
  first: UniverseAddress,

  second: UniverseAddress,
): boolean {
  if (first.domain !== second.domain) {
    return false;
  }

  if (first.domain === "reality" && second.domain === "reality") {
    return first.entityId === second.entityId;
  }

  if (
    first.domain === "observational-frontier" &&
    second.domain === "observational-frontier"
  ) {
    return first.label === second.label;
  }

  if (first.domain !== "procedural" || second.domain !== "procedural") {
    return false;
  }

  return (
    first.seedKey === second.seedKey &&
    first.kind === second.kind &&
    first.sector.x === second.sector.x &&
    first.sector.y === second.sector.y &&
    first.sector.z === second.sector.z &&
    first.galaxyIndex === second.galaxyIndex &&
    first.systemIndex === second.systemIndex &&
    first.planetIndex === second.planetIndex &&
    first.moonIndex === second.moonIndex &&
    first.componentIndex === second.componentIndex
  );
}

export function serializeUniverseAddress(address: UniverseAddress): string {
  if (address.domain === "reality") {
    return ["real", encodeURIComponent(address.entityId)].join(":");
  }

  if (address.domain === "observational-frontier") {
    return ["frontier", encodeURIComponent(address.label)].join(":");
  }

  const values = [
    "proc",

    encodeURIComponent(address.seedKey),

    address.kind,

    String(address.sector.x),

    String(address.sector.y),

    String(address.sector.z),

    address.galaxyIndex ?? "",

    address.systemIndex ?? "",

    address.planetIndex ?? "",

    address.moonIndex ?? "",

    address.componentIndex ?? "",
  ];

  return values.map(String).join(":");
}

function parseOptionalIndex(value: string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Serialized universe address contains an invalid index.");
  }

  return parsed;
}

function isProceduralTargetKind(value: string): value is ProceduralTargetKind {
  return (
    value === "sector" ||
    value === "galaxy" ||
    value === "system" ||
    value === "star" ||
    value === "planet" ||
    value === "moon" ||
    value === "asteroid-belt"
  );
}

export function parseUniverseAddress(value: string): UniverseAddress {
  const parts = value.split(":");

  const domain = parts[0];

  if (domain === "real") {
    const entityId = decodeURIComponent(parts.slice(1).join(":"));

    if (!entityId) {
      throw new Error("Serialized scientific address has no entity ID.");
    }

    return scientificAddress(entityId);
  }

  if (domain === "frontier") {
    const label = decodeURIComponent(parts.slice(1).join(":"));

    return frontierAddress(label);
  }

  if (domain !== "proc") {
    throw new Error("Unknown universe address domain.");
  }

  if (parts.length < 6) {
    throw new Error("Serialized procedural address is incomplete.");
  }

  const seedKey = decodeURIComponent(parts[1] ?? "");

  const kind = parts[2] ?? "";

  if (!isProceduralTargetKind(kind)) {
    throw new Error(
      "Serialized procedural address has an invalid target kind.",
    );
  }

  const x = Number(parts[3]);

  const y = Number(parts[4]);

  const z = Number(parts[5]);

  const sector = {
    x,
    y,
    z,
  };

  validateSectorCoordinate(sector);

  return proceduralAddress(seedKey, kind, sector, {
    galaxyIndex: parseOptionalIndex(parts[6]),

    systemIndex: parseOptionalIndex(parts[7]),

    planetIndex: parseOptionalIndex(parts[8]),

    moonIndex: parseOptionalIndex(parts[9]),

    componentIndex: parseOptionalIndex(parts[10]),
  });
}

function scientificTitle(record: ScientificUniverseRecord): string {
  return record.entity.name;
}

function proceduralTitle(selection: ProceduralSelection): string {
  switch (selection.targetKind) {
    case "sector":
      return [
        "Procedural Sector",
        selection.sector.coordinate.x,
        selection.sector.coordinate.y,
        selection.sector.coordinate.z,
      ].join(" ");

    case "galaxy":
      return selection.galaxy.name;

    case "system":
      return selection.system.name;

    case "star":
      return selection.star.name;

    case "planet":
      return selection.planet.name;

    case "moon":
      return selection.moon.name;

    case "asteroid-belt":
      return selection.belt.name;
  }
}

export class UnifiedUniverse {
  readonly scientific: ScientificUniverseSource;

  readonly stream: WorldStreamManager;

  readonly options: UnifiedUniverseOptions;

  private realmValue: UniverseRealm = "reality";

  private selectionValue: UniverseSelection | null = null;

  private historyValue: UniverseHistoryEntry[] = [];

  private historyIndexValue = -1;

  private listeners = new Set<UnifiedUniverseListener>();

  constructor(
    scientific: ScientificUniverseSource,

    stream: WorldStreamManager,

    options: Partial<UnifiedUniverseOptions> = {},
  ) {
    this.scientific = scientific;

    this.stream = stream;

    this.options = normalizeOptions(options);
  }

  get realm(): UniverseRealm {
    return this.realmValue;
  }

  get selection(): UniverseSelection | null {
    return this.selectionValue;
  }

  get history(): readonly UniverseHistoryEntry[] {
    return [...this.historyValue];
  }

  get historyIndex(): number {
    return this.historyIndexValue;
  }

  get canGoBack(): boolean {
    return this.historyIndexValue > 0;
  }

  get canGoForward(): boolean {
    return (
      this.historyIndexValue >= 0 &&
      this.historyIndexValue < this.historyValue.length - 1
    );
  }

  subscribe(listener: UnifiedUniverseListener): () => void {
    this.listeners.add(listener);

    let active = true;

    return () => {
      if (!active) {
        return;
      }

      active = false;

      this.listeners.delete(listener);
    };
  }

  private emit(event: UnifiedUniverseEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // A UI listener must never stop universe navigation.
      }
    }
  }

  private setRealm(realm: UniverseRealm): void {
    if (realm === this.realmValue) {
      return;
    }

    this.realmValue = realm;

    this.emit({
      type: "realm-changed",

      realm,
    });
  }

  private titleForSelection(selection: UniverseSelection): string {
    if (selection.realm === "reality") {
      return scientificTitle(selection.record);
    }

    if (selection.realm === "observational-frontier") {
      return selection.title;
    }

    return proceduralTitle(selection);
  }

  private pushHistory(selection: UniverseSelection): void {
    const current = this.historyValue[this.historyIndexValue];

    if (current && universeAddressEquals(current.address, selection.address)) {
      return;
    }

    if (this.historyIndexValue < this.historyValue.length - 1) {
      this.historyValue = this.historyValue.slice(
        0,
        this.historyIndexValue + 1,
      );
    }

    this.historyValue.push({
      address: selection.address,

      title: this.titleForSelection(selection),

      visitedAtMs: Date.now(),
    });

    if (this.historyValue.length > this.options.maximumHistoryEntries) {
      const excess =
        this.historyValue.length - this.options.maximumHistoryEntries;

      this.historyValue.splice(0, excess);
    }

    this.historyIndexValue = this.historyValue.length - 1;

    this.emit({
      type: "history-changed",

      historyIndex: this.historyIndexValue,

      historyLength: this.historyValue.length,
    });
  }

  private select(
    selection: UniverseSelection,

    recordHistory = true,
  ): UniverseSelection {
    this.selectionValue = selection;

    this.setRealm(selection.realm);

    if (recordHistory) {
      this.pushHistory(selection);
    }

    this.emit({
      type: "selection-changed",

      selection,
    });

    return selection;
  }

  async selectScientific(entityId: EntityId): Promise<ScientificSelection> {
    const record = await this.scientific.get(entityId);

    if (!record) {
      throw new Error(`Scientific entity "${entityId}" was not found.`);
    }

    const issues = validateScientificRecord(record);

    if (issues.length > 0) {
      throw new Error(
        [`Scientific entity "${entityId}" failed validation.`, ...issues].join(
          " ",
        ),
      );
    }

    const selection: ScientificSelection = {
      realm: "reality",

      address: scientificAddress(entityId),

      record,
    };

    this.select(selection);

    return selection;
  }

  async searchScientific(
    query: string,

    options: ScientificSearchOptions = {},
  ): Promise<readonly ScientificUniverseRecord[]> {
    const normalized = query.trim();

    if (!normalized) {
      return [];
    }

    const records = await this.scientific.search(normalized, options);

    return records.filter(
      (record) => validateScientificRecord(record).length === 0,
    );
  }

  async scientificChildren(
    parentId: EntityId,
  ): Promise<readonly ScientificUniverseRecord[]> {
    if (!this.scientific.children) {
      return [];
    }

    const records = await this.scientific.children(parentId);

    return records.filter(
      (record) => validateScientificRecord(record).length === 0,
    );
  }

  enterObservationalFrontier(
    title = "Observational Frontier",

    message = "Detailed observational data is unavailable beyond this point.",
  ): ObservationalFrontierSelection {
    const selection: ObservationalFrontierSelection = {
      realm: "observational-frontier",

      address: frontierAddress("observational-frontier"),

      title,

      message,
    };

    this.select(selection);

    return selection;
  }

  private requireProceduralEnabled(): void {
    if (!this.options.allowProceduralFrontier) {
      throw new Error("Procedural frontier access is disabled.");
    }
  }

  private validateProceduralSeed(seedKey: string): void {
    if (seedKey !== this.stream.generator.seed.key) {
      throw new Error(
        "Procedural address belongs to a different universe seed.",
      );
    }
  }

  private ensureSector(coordinate: SectorCoordinate): ProceduralSector {
    validateSectorCoordinate(coordinate);

    let sector = this.stream.getSector(coordinate);

    if (sector) {
      return sector;
    }

    this.stream.requestSector(
      coordinate,
      this.options.defaultSectorLod,
      -1_000,
    );

    for (let tick = 0; tick < this.options.generationTicksPerResolve; tick++) {
      this.stream.tick(1);

      sector = this.stream.getSector(coordinate);

      if (sector) {
        return sector;
      }

      if (!this.stream.hasPendingWork) {
        break;
      }
    }

    throw new Error(
      [
        "Unable to generate procedural sector",
        `${coordinate.x},${coordinate.y},${coordinate.z}.`,
      ].join(" "),
    );
  }

  private findGalaxy(
    sector: ProceduralSector,

    galaxyIndex: number,
  ): GalaxyDescriptor {
    const galaxy = sector.galaxies[galaxyIndex];

    if (galaxy) {
      return galaxy;
    }

    return this.stream.generator.galaxy(sector.coordinate, galaxyIndex);
  }

  private ensureSystem(
    galaxy: GalaxyDescriptor,

    systemIndex: number,
  ): StarSystemDescriptor {
    let system = this.stream.getSystem(galaxy.id, systemIndex);

    if (system) {
      return system;
    }

    this.stream.requestSystem(galaxy, systemIndex, -1_000);

    for (let tick = 0; tick < this.options.generationTicksPerResolve; tick++) {
      this.stream.tick(1);

      system = this.stream.getSystem(galaxy.id, systemIndex);

      if (system) {
        return system;
      }

      if (!this.stream.hasPendingWork) {
        break;
      }
    }

    throw new Error(`Unable to generate procedural system ${systemIndex}.`);
  }

  selectProceduralSector(
    coordinate: SectorCoordinate,
  ): ProceduralSectorSelection {
    this.requireProceduralEnabled();

    const sector = this.ensureSector(coordinate);

    const selection: ProceduralSectorSelection = {
      realm: "procedural-frontier",

      address: proceduralAddress(
        this.stream.generator.seed.key,
        "sector",
        coordinate,
      ),

      targetKind: "sector",

      sector,
    };

    this.select(selection);

    return selection;
  }

  selectProceduralGalaxy(
    coordinate: SectorCoordinate,

    galaxyIndex: number,
  ): ProceduralGalaxySelection {
    this.requireProceduralEnabled();

    requireNonNegativeInteger(galaxyIndex, "galaxyIndex");

    const sector = this.ensureSector(coordinate);

    const galaxy = this.findGalaxy(sector, galaxyIndex);

    const selection: ProceduralGalaxySelection = {
      realm: "procedural-frontier",

      address: proceduralAddress(
        this.stream.generator.seed.key,
        "galaxy",
        coordinate,
        {
          galaxyIndex,
        },
      ),

      targetKind: "galaxy",

      galaxy,
    };

    this.select(selection);

    return selection;
  }

  selectProceduralSystem(
    coordinate: SectorCoordinate,

    galaxyIndex: number,

    systemIndex: number,
  ): ProceduralSystemSelection {
    this.requireProceduralEnabled();

    requireNonNegativeInteger(galaxyIndex, "galaxyIndex");

    requireNonNegativeInteger(systemIndex, "systemIndex");

    const sector = this.ensureSector(coordinate);

    const galaxy = this.findGalaxy(sector, galaxyIndex);

    const system = this.ensureSystem(galaxy, systemIndex);

    const selection: ProceduralSystemSelection = {
      realm: "procedural-frontier",

      address: proceduralAddress(
        this.stream.generator.seed.key,
        "system",
        coordinate,
        {
          galaxyIndex,
          systemIndex,
        },
      ),

      targetKind: "system",

      galaxy,

      system,
    };

    this.select(selection);

    return selection;
  }

  selectProceduralStar(
    coordinate: SectorCoordinate,

    galaxyIndex: number,

    systemIndex: number,

    stellarIndex: number,
  ): ProceduralStarSelection {
    const systemSelection = this.selectProceduralSystem(
      coordinate,
      galaxyIndex,
      systemIndex,
    );

    requireNonNegativeInteger(stellarIndex, "stellarIndex");

    const star = systemSelection.system.stars[stellarIndex];

    if (!star) {
      throw new Error(
        `Procedural star ${stellarIndex} does not exist in system ${systemIndex}.`,
      );
    }

    const selection: ProceduralStarSelection = {
      realm: "procedural-frontier",

      address: proceduralAddress(
        this.stream.generator.seed.key,
        "star",
        coordinate,
        {
          galaxyIndex,
          systemIndex,
          componentIndex: stellarIndex,
        },
      ),

      targetKind: "star",

      galaxy: systemSelection.galaxy,

      system: systemSelection.system,

      star,
    };

    this.select(selection);

    return selection;
  }

  selectProceduralPlanet(
    coordinate: SectorCoordinate,

    galaxyIndex: number,

    systemIndex: number,

    planetIndex: number,
  ): ProceduralPlanetSelection {
    const systemSelection = this.selectProceduralSystem(
      coordinate,
      galaxyIndex,
      systemIndex,
    );

    requireNonNegativeInteger(planetIndex, "planetIndex");

    const planet = systemSelection.system.planets[planetIndex];

    if (!planet) {
      throw new Error(
        `Procedural planet ${planetIndex} does not exist in system ${systemIndex}.`,
      );
    }

    const selection: ProceduralPlanetSelection = {
      realm: "procedural-frontier",

      address: proceduralAddress(
        this.stream.generator.seed.key,
        "planet",
        coordinate,
        {
          galaxyIndex,
          systemIndex,
          planetIndex,
        },
      ),

      targetKind: "planet",

      galaxy: systemSelection.galaxy,

      system: systemSelection.system,

      planet,
    };

    this.select(selection);

    return selection;
  }

  selectProceduralMoon(
    coordinate: SectorCoordinate,

    galaxyIndex: number,

    systemIndex: number,

    planetIndex: number,

    moonIndex: number,
  ): ProceduralMoonSelection {
    const planetSelection = this.selectProceduralPlanet(
      coordinate,
      galaxyIndex,
      systemIndex,
      planetIndex,
    );

    requireNonNegativeInteger(moonIndex, "moonIndex");

    const moon = planetSelection.planet.moons[moonIndex];

    if (!moon) {
      throw new Error(
        `Procedural moon ${moonIndex} does not exist on planet ${planetIndex}.`,
      );
    }

    const selection: ProceduralMoonSelection = {
      realm: "procedural-frontier",

      address: proceduralAddress(
        this.stream.generator.seed.key,
        "moon",
        coordinate,
        {
          galaxyIndex,
          systemIndex,
          planetIndex,
          moonIndex,
        },
      ),

      targetKind: "moon",

      galaxy: planetSelection.galaxy,

      system: planetSelection.system,

      planet: planetSelection.planet,

      moon,
    };

    this.select(selection);

    return selection;
  }

  selectProceduralBelt(
    coordinate: SectorCoordinate,

    galaxyIndex: number,

    systemIndex: number,

    beltIndex: number,
  ): ProceduralBeltSelection {
    const systemSelection = this.selectProceduralSystem(
      coordinate,
      galaxyIndex,
      systemIndex,
    );

    requireNonNegativeInteger(beltIndex, "beltIndex");

    const belt = systemSelection.system.belts[beltIndex];

    if (!belt) {
      throw new Error(
        `Procedural asteroid belt ${beltIndex} does not exist in system ${systemIndex}.`,
      );
    }

    const selection: ProceduralBeltSelection = {
      realm: "procedural-frontier",

      address: proceduralAddress(
        this.stream.generator.seed.key,
        "asteroid-belt",
        coordinate,
        {
          galaxyIndex,
          systemIndex,
          componentIndex: beltIndex,
        },
      ),

      targetKind: "asteroid-belt",

      galaxy: systemSelection.galaxy,

      system: systemSelection.system,

      belt,
    };

    this.select(selection);

    return selection;
  }

  async resolve(
    address: UniverseAddress,

    recordHistory = true,
  ): Promise<UniverseSelection> {
    if (address.domain === "reality") {
      const record = await this.scientific.get(address.entityId);

      if (!record) {
        throw new Error(
          `Scientific entity "${address.entityId}" was not found.`,
        );
      }

      const issues = validateScientificRecord(record);

      if (issues.length > 0) {
        throw new Error(issues.join(" "));
      }

      return this.select(
        {
          realm: "reality",

          address,

          record,
        },
        recordHistory,
      ) as ScientificSelection;
    }

    if (address.domain === "observational-frontier") {
      return this.select(
        {
          realm: "observational-frontier",

          address,

          title: "Observational Frontier",

          message:
            "Human observations do not currently provide detailed verified information beyond this point.",
        },
        recordHistory,
      );
    }

    this.requireProceduralEnabled();

    this.validateProceduralSeed(address.seedKey);

    const coordinate = address.sector;

    switch (address.kind) {
      case "sector": {
        const sector = this.ensureSector(coordinate);

        return this.select(
          {
            realm: "procedural-frontier",

            address,

            targetKind: "sector",

            sector,
          },
          recordHistory,
        );
      }

      case "galaxy": {
        const sector = this.ensureSector(coordinate);

        const galaxyIndex = requireNonNegativeInteger(
          address.galaxyIndex,
          "galaxyIndex",
        );

        const galaxy = this.findGalaxy(sector, galaxyIndex);

        return this.select(
          {
            realm: "procedural-frontier",

            address,

            targetKind: "galaxy",

            galaxy,
          },
          recordHistory,
        );
      }

      case "system": {
        const sector = this.ensureSector(coordinate);

        const galaxyIndex = requireNonNegativeInteger(
          address.galaxyIndex,
          "galaxyIndex",
        );

        const systemIndex = requireNonNegativeInteger(
          address.systemIndex,
          "systemIndex",
        );

        const galaxy = this.findGalaxy(sector, galaxyIndex);

        const system = this.ensureSystem(galaxy, systemIndex);

        return this.select(
          {
            realm: "procedural-frontier",

            address,

            targetKind: "system",

            galaxy,

            system,
          },
          recordHistory,
        );
      }

      case "star": {
        const systemSelection = await this.resolve(
          proceduralAddress(address.seedKey, "system", coordinate, {
            galaxyIndex: address.galaxyIndex,

            systemIndex: address.systemIndex,
          }),
          false,
        );

        if (
          systemSelection.realm !== "procedural-frontier" ||
          systemSelection.targetKind !== "system"
        ) {
          throw new Error("Unable to resolve procedural star system.");
        }

        const stellarIndex = requireNonNegativeInteger(
          address.componentIndex,
          "stellarIndex",
        );

        const star = systemSelection.system.stars[stellarIndex];

        if (!star) {
          throw new Error(`Procedural star ${stellarIndex} does not exist.`);
        }

        return this.select(
          {
            realm: "procedural-frontier",

            address,

            targetKind: "star",

            galaxy: systemSelection.galaxy,

            system: systemSelection.system,

            star,
          },
          recordHistory,
        );
      }

      case "planet": {
        const systemSelection = await this.resolve(
          proceduralAddress(address.seedKey, "system", coordinate, {
            galaxyIndex: address.galaxyIndex,

            systemIndex: address.systemIndex,
          }),
          false,
        );

        if (
          systemSelection.realm !== "procedural-frontier" ||
          systemSelection.targetKind !== "system"
        ) {
          throw new Error("Unable to resolve procedural planet system.");
        }

        const planetIndex = requireNonNegativeInteger(
          address.planetIndex,
          "planetIndex",
        );

        const planet = systemSelection.system.planets[planetIndex];

        if (!planet) {
          throw new Error(`Procedural planet ${planetIndex} does not exist.`);
        }

        return this.select(
          {
            realm: "procedural-frontier",

            address,

            targetKind: "planet",

            galaxy: systemSelection.galaxy,

            system: systemSelection.system,

            planet,
          },
          recordHistory,
        );
      }

      case "moon": {
        const planetSelection = await this.resolve(
          proceduralAddress(address.seedKey, "planet", coordinate, {
            galaxyIndex: address.galaxyIndex,

            systemIndex: address.systemIndex,

            planetIndex: address.planetIndex,
          }),
          false,
        );

        if (
          planetSelection.realm !== "procedural-frontier" ||
          planetSelection.targetKind !== "planet"
        ) {
          throw new Error("Unable to resolve procedural moon planet.");
        }

        const moonIndex = requireNonNegativeInteger(
          address.moonIndex,
          "moonIndex",
        );

        const moon = planetSelection.planet.moons[moonIndex];

        if (!moon) {
          throw new Error(`Procedural moon ${moonIndex} does not exist.`);
        }

        return this.select(
          {
            realm: "procedural-frontier",

            address,

            targetKind: "moon",

            galaxy: planetSelection.galaxy,

            system: planetSelection.system,

            planet: planetSelection.planet,

            moon,
          },
          recordHistory,
        );
      }

      case "asteroid-belt": {
        const systemSelection = await this.resolve(
          proceduralAddress(address.seedKey, "system", coordinate, {
            galaxyIndex: address.galaxyIndex,

            systemIndex: address.systemIndex,
          }),
          false,
        );

        if (
          systemSelection.realm !== "procedural-frontier" ||
          systemSelection.targetKind !== "system"
        ) {
          throw new Error("Unable to resolve procedural asteroid belt system.");
        }

        const beltIndex = requireNonNegativeInteger(
          address.componentIndex,
          "beltIndex",
        );

        const belt = systemSelection.system.belts[beltIndex];

        if (!belt) {
          throw new Error(
            `Procedural asteroid belt ${beltIndex} does not exist.`,
          );
        }

        return this.select(
          {
            realm: "procedural-frontier",

            address,

            targetKind: "asteroid-belt",

            galaxy: systemSelection.galaxy,

            system: systemSelection.system,

            belt,
          },
          recordHistory,
        );
      }
    }
  }

  async goBack(): Promise<UniverseSelection | null> {
    if (!this.canGoBack) {
      return null;
    }

    this.historyIndexValue--;

    const entry = this.historyValue[this.historyIndexValue];

    if (!entry) {
      return null;
    }

    const selection = await this.resolve(entry.address, false);

    this.emit({
      type: "history-changed",

      historyIndex: this.historyIndexValue,

      historyLength: this.historyValue.length,
    });

    return selection;
  }

  async goForward(): Promise<UniverseSelection | null> {
    if (!this.canGoForward) {
      return null;
    }

    this.historyIndexValue++;

    const entry = this.historyValue[this.historyIndexValue];

    if (!entry) {
      return null;
    }

    const selection = await this.resolve(entry.address, false);

    this.emit({
      type: "history-changed",

      historyIndex: this.historyIndexValue,

      historyLength: this.historyValue.length,
    });

    return selection;
  }

  clearSelection(): void {
    this.selectionValue = null;

    this.emit({
      type: "selection-changed",

      selection: null,
    });
  }

  snapshot(): UnifiedUniverseSnapshot {
    return {
      version: UNIFIED_UNIVERSE_VERSION,

      realm: this.realmValue,

      selection: this.selectionValue,

      history: [...this.historyValue],

      historyIndex: this.historyIndexValue,

      proceduralSeedKey: this.stream.generator.seed.key,

      proceduralGenerationVersion: PROCEDURAL_ENGINE_VERSION,
    };
  }

  dispose(): void {
    this.listeners.clear();

    this.selectionValue = null;

    this.historyValue = [];

    this.historyIndexValue = -1;
  }
}
