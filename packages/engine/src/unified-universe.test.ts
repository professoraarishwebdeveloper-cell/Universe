import { describe, expect, it } from "vitest";

import type { EntityId, SpaceEntity } from "@known-universe/core";

import { ProceduralUniverseGenerator } from "./procedural";

import type {
  GalaxyDescriptor,
  SectorCoordinate,
  StarSystemDescriptor,
} from "./procedural";

import { WorldStreamManager } from "./world-stream";

import {
  DEFAULT_UNIFIED_UNIVERSE_OPTIONS,
  UNIFIED_UNIVERSE_VERSION,
  UnifiedUniverse,
  frontierAddress,
  parseUniverseAddress,
  proceduralAddress,
  scientificAddress,
  serializeUniverseAddress,
  universeAddressEquals,
  validateScientificRecord,
} from "./unified-universe";

import type {
  ScientificSearchOptions,
  ScientificUniverseRecord,
  ScientificUniverseSource,
  UnifiedUniverseEvent,
  UniverseAddress,
} from "./unified-universe";

const ORIGIN: SectorCoordinate = {
  x: 0,
  y: 0,
  z: 0,
};

const SCIENTIFIC_RECORDS: readonly ScientificUniverseRecord[] = [
  {
    entity: {
      id: "sun",

      name: "Sun",

      kind: "star",

      sourceIds: ["science:test"],

      summary: "The Solar System's star.",
    },

    realityClass: "measured",

    confidence: 1,
  },

  {
    entity: {
      id: "earth",

      name: "Earth",

      kind: "planet",

      parentId: "sun",

      sourceIds: ["science:test"],

      summary: "The third planet from the Sun.",
    },

    realityClass: "measured",

    confidence: 1,
  },

  {
    entity: {
      id: "moon",

      name: "Moon",

      kind: "moon",

      parentId: "earth",

      sourceIds: ["science:test"],
    },

    realityClass: "measured",

    confidence: 0.99,
  },

  {
    entity: {
      id: "proxima-centauri",

      name: "Proxima Centauri",

      kind: "star",

      sourceIds: ["science:test"],
    },

    realityClass: "observed",

    confidence: 0.99,
  },

  {
    entity: {
      id: "candidate-world",

      name: "Candidate World",

      kind: "planet",

      sourceIds: ["science:test"],
    },

    realityClass: "estimated",

    confidence: 0.65,
  },

  {
    entity: {
      id: "theoretical-object",

      name: "Theoretical Object",

      kind: "star",
      sourceIds: ["science:test"],
    },

    realityClass: "theoretical",

    confidence: 0.2,
  },
];

class MemoryScientificSource implements ScientificUniverseSource {
  private readonly records = new Map<EntityId, ScientificUniverseRecord>();

  constructor(
    records: readonly ScientificUniverseRecord[] = SCIENTIFIC_RECORDS,
  ) {
    for (const record of records) {
      this.records.set(record.entity.id, record);
    }
  }

  async get(id: EntityId): Promise<ScientificUniverseRecord | null> {
    return this.records.get(id) ?? null;
  }

  async search(
    query: string,

    options: ScientificSearchOptions = {},
  ): Promise<readonly ScientificUniverseRecord[]> {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return [];
    }

    let records = [...this.records.values()].filter(
      (record) =>
        record.entity.name.toLowerCase().includes(normalized) ||
        record.entity.id.toLowerCase().includes(normalized),
    );

    if (options.kinds && options.kinds.length > 0) {
      const kinds = new Set(options.kinds);

      records = records.filter((record) => kinds.has(record.entity.kind));
    }

    if (options.realityClasses && options.realityClasses.length > 0) {
      const classes = new Set(options.realityClasses);

      records = records.filter((record) => classes.has(record.realityClass));
    }

    if (options.limit !== undefined) {
      records = records.slice(0, Math.max(0, Math.floor(options.limit)));
    }

    return records;
  }

  async children(
    parentId: EntityId,
  ): Promise<readonly ScientificUniverseRecord[]> {
    return [...this.records.values()].filter(
      (record) => record.entity.parentId === parentId,
    );
  }
}

function createUniverse(
  options: ConstructorParameters<typeof UnifiedUniverse>[2] = {},
) {
  const scientific = new MemoryScientificSource();

  const generator = new ProceduralUniverseGenerator(
    "UNIFIED UNIVERSE TEST",
    "exotic-sandbox",
  );

  const stream = new WorldStreamManager(generator, {
    maximumResidentSectors: 128,

    maximumResidentSystems: 128,

    estimatedMemoryBudgetBytes: 256 * 1024 * 1024,
  });

  const universe = new UnifiedUniverse(scientific, stream, options);

  return {
    scientific,
    generator,
    stream,
    universe,
  };
}

function findSystemWithPlanet(
  generator: ProceduralUniverseGenerator,

  galaxy: GalaxyDescriptor,
): StarSystemDescriptor {
  for (let index = 0; index < 500; index++) {
    const system = generator.system(galaxy, index);

    if (system.planets.length > 0) {
      return system;
    }
  }

  throw new Error(
    "Unable to find deterministic test system containing a planet.",
  );
}

function findSystemWithMoon(
  generator: ProceduralUniverseGenerator,

  galaxy: GalaxyDescriptor,
): {
  system: StarSystemDescriptor;

  planetIndex: number;

  moonIndex: number;
} {
  for (let systemIndex = 0; systemIndex < 1_000; systemIndex++) {
    const system = generator.system(galaxy, systemIndex);

    for (
      let planetIndex = 0;
      planetIndex < system.planets.length;
      planetIndex++
    ) {
      const planet = system.planets[planetIndex];

      if (planet && planet.moons.length > 0) {
        return {
          system,

          planetIndex,

          moonIndex: 0,
        };
      }
    }
  }

  throw new Error(
    "Unable to find deterministic test system containing a moon.",
  );
}

function findSystemWithBelt(
  generator: ProceduralUniverseGenerator,

  galaxy: GalaxyDescriptor,
): StarSystemDescriptor {
  for (let index = 0; index < 1_000; index++) {
    const system = generator.system(galaxy, index);

    if (system.belts.length > 0) {
      return system;
    }
  }

  throw new Error(
    "Unable to find deterministic test system containing an asteroid belt.",
  );
}

describe("scientific record validation", () => {
  it("accepts valid scientific records", () => {
    expect(validateScientificRecord(SCIENTIFIC_RECORDS[0]!)).toHaveLength(0);
  });

  it("rejects scientific records without provenance", () => {
    const entity: SpaceEntity = {
      id: "bad",

      name: "Bad Object",

      kind: "star",

      sourceIds: [],
    };

    const record: ScientificUniverseRecord = {
      entity,

      realityClass: "observed",

      confidence: 0.8,
    };

    expect(validateScientificRecord(record)).toContain(
      "Scientific entity has no provenance sources.",
    );
  });

  it("rejects confidence above one", () => {
    const record: ScientificUniverseRecord = {
      entity: {
        id: "confidence-test",

        name: "Confidence Test",

        kind: "star",

        sourceIds: ["test"],
      },

      realityClass: "measured",

      confidence: 1.1,
    };

    expect(validateScientificRecord(record)).toContain(
      "Scientific confidence must be between 0 and 1.",
    );
  });

  it("rejects negative confidence", () => {
    const record: ScientificUniverseRecord = {
      entity: {
        id: "negative-confidence",

        name: "Negative Confidence",

        kind: "star",

        sourceIds: ["test"],
      },

      realityClass: "estimated",

      confidence: -0.1,
    };

    expect(validateScientificRecord(record)).toContain(
      "Scientific confidence must be between 0 and 1.",
    );
  });
});

describe("universe addresses", () => {
  it("creates scientific addresses", () => {
    expect(scientificAddress("earth")).toEqual({
      domain: "reality",

      entityId: "earth",
    });
  });

  it("creates observational frontier addresses", () => {
    expect(frontierAddress("unknown-zone")).toEqual({
      domain: "observational-frontier",

      label: "unknown-zone",
    });
  });

  it("creates procedural addresses", () => {
    const address = proceduralAddress(
      "seed-key",
      "planet",
      {
        x: 1,
        y: 2,
        z: 3,
      },
      {
        galaxyIndex: 4,

        systemIndex: 5,

        planetIndex: 6,
      },
    );

    expect(address.domain).toBe("procedural");

    expect(address.kind).toBe("planet");

    expect(address.planetIndex).toBe(6);
  });

  it("compares scientific addresses", () => {
    expect(
      universeAddressEquals(
        scientificAddress("earth"),
        scientificAddress("earth"),
      ),
    ).toBe(true);

    expect(
      universeAddressEquals(
        scientificAddress("earth"),
        scientificAddress("moon"),
      ),
    ).toBe(false);
  });

  it("compares procedural addresses", () => {
    const first = proceduralAddress("seed", "planet", ORIGIN, {
      galaxyIndex: 1,

      systemIndex: 2,

      planetIndex: 3,
    });

    const second = proceduralAddress("seed", "planet", ORIGIN, {
      galaxyIndex: 1,

      systemIndex: 2,

      planetIndex: 3,
    });

    expect(universeAddressEquals(first, second)).toBe(true);

    expect(
      universeAddressEquals(first, {
        ...second,

        planetIndex: 4,
      }),
    ).toBe(false);
  });

  it("does not compare addresses from different realms as equal", () => {
    expect(
      universeAddressEquals(
        scientificAddress("earth"),
        frontierAddress("earth"),
      ),
    ).toBe(false);
  });

  it("round-trips scientific addresses", () => {
    const original = scientificAddress("catalog:object:123");

    expect(parseUniverseAddress(serializeUniverseAddress(original))).toEqual(
      original,
    );
  });

  it("round-trips frontier addresses", () => {
    const original = frontierAddress("unknown cosmic region");

    expect(parseUniverseAddress(serializeUniverseAddress(original))).toEqual(
      original,
    );
  });

  it("round-trips procedural addresses", () => {
    const original = proceduralAddress(
      "1234567890abcdef",
      "moon",
      {
        x: -500,

        y: 10,

        z: 900,
      },
      {
        galaxyIndex: 2,

        systemIndex: 50,

        planetIndex: 4,

        moonIndex: 3,
      },
    );

    expect(parseUniverseAddress(serializeUniverseAddress(original))).toEqual(
      original,
    );
  });

  it("rejects unknown serialized address domains", () => {
    expect(() => parseUniverseAddress("wrong:something")).toThrow(
      "Unknown universe address domain.",
    );
  });

  it("rejects invalid procedural coordinates", () => {
    expect(() =>
      proceduralAddress("seed", "sector", {
        x: 1.5,

        y: 0,

        z: 0,
      }),
    ).toThrow();
  });
});

describe("scientific universe navigation", () => {
  it("starts in the reality realm", () => {
    const { universe } = createUniverse();

    expect(universe.realm).toBe("reality");

    expect(universe.selection).toBeNull();
  });

  it("selects a scientific object", async () => {
    const { universe } = createUniverse();

    const selection = await universe.selectScientific("earth");

    expect(selection.realm).toBe("reality");

    expect(selection.record.entity.id).toBe("earth");

    expect(universe.selection).toEqual(selection);
  });

  it("rejects missing scientific objects", async () => {
    const { universe } = createUniverse();

    await expect(universe.selectScientific("not-real")).rejects.toThrow(
      "was not found",
    );
  });

  it("searches scientific data", async () => {
    const { universe } = createUniverse();

    const results = await universe.searchScientific("earth");

    expect(results).toHaveLength(1);

    expect(results[0]?.entity.id).toBe("earth");
  });

  it("filters scientific searches by reality class", async () => {
    const { universe } = createUniverse();

    const results = await universe.searchScientific("world", {
      realityClasses: ["estimated"],
    });

    expect(results).toHaveLength(1);

    expect(results[0]?.entity.id).toBe("candidate-world");
  });

  it("returns scientific children", async () => {
    const { universe } = createUniverse();

    const children = await universe.scientificChildren("earth");

    expect(children).toHaveLength(1);

    expect(children[0]?.entity.id).toBe("moon");
  });

  it("returns no search results for blank queries", async () => {
    const { universe } = createUniverse();

    expect(await universe.searchScientific("   ")).toEqual([]);
  });
});

describe("observational frontier", () => {
  it("enters the observational frontier explicitly", () => {
    const { universe } = createUniverse();

    const selection = universe.enterObservationalFrontier();

    expect(selection.realm).toBe("observational-frontier");

    expect(universe.realm).toBe("observational-frontier");

    expect(selection.message.length).toBeGreaterThan(0);
  });
});

describe("procedural frontier navigation", () => {
  it("selects a procedural sector", () => {
    const { universe } = createUniverse();

    const selection = universe.selectProceduralSector(ORIGIN);

    expect(selection.realm).toBe("procedural-frontier");

    expect(selection.targetKind).toBe("sector");

    expect(selection.sector.realityClass).toBe("procedural");
  });

  it("selects deterministic galaxies", () => {
    const { universe } = createUniverse();

    const first = universe.selectProceduralGalaxy(ORIGIN, 3);

    const second = universe.selectProceduralGalaxy(ORIGIN, 3);

    expect(second.galaxy).toEqual(first.galaxy);
  });

  it("selects deterministic star systems", () => {
    const { universe } = createUniverse();

    const first = universe.selectProceduralSystem(ORIGIN, 0, 100);

    const second = universe.selectProceduralSystem(ORIGIN, 0, 100);

    expect(second.system).toEqual(first.system);

    expect(second.system.realityClass).toBe("procedural");
  });

  it("selects procedural stars", () => {
    const { universe } = createUniverse();

    const selection = universe.selectProceduralStar(ORIGIN, 0, 0, 0);

    expect(selection.targetKind).toBe("star");

    expect(selection.star.realityClass).toBe("procedural");
  });

  it("selects planets from systems that contain planets", () => {
    const { generator, universe } = createUniverse();

    const galaxy = generator.galaxy(ORIGIN, 0);

    const system = findSystemWithPlanet(generator, galaxy);

    const selection = universe.selectProceduralPlanet(
      ORIGIN,
      0,
      system.systemIndex,
      0,
    );

    expect(selection.targetKind).toBe("planet");

    expect(selection.planet.realityClass).toBe("procedural");
  });

  it("selects moons from systems that contain moons", () => {
    const { generator, universe } = createUniverse();

    const galaxy = generator.galaxy(ORIGIN, 0);

    const target = findSystemWithMoon(generator, galaxy);

    const selection = universe.selectProceduralMoon(
      ORIGIN,
      0,
      target.system.systemIndex,
      target.planetIndex,
      target.moonIndex,
    );

    expect(selection.targetKind).toBe("moon");

    expect(selection.moon.realityClass).toBe("procedural");
  });

  it("selects asteroid belts when present", () => {
    const { generator, universe } = createUniverse();

    const galaxy = generator.galaxy(ORIGIN, 0);

    const system = findSystemWithBelt(generator, galaxy);

    const selection = universe.selectProceduralBelt(
      ORIGIN,
      0,
      system.systemIndex,
      0,
    );

    expect(selection.targetKind).toBe("asteroid-belt");

    expect(selection.belt.realityClass).toBe("procedural");
  });

  it("rejects negative procedural indexes", () => {
    const { universe } = createUniverse();

    expect(() => universe.selectProceduralGalaxy(ORIGIN, -1)).toThrow();
  });

  it("can disable procedural frontier access", () => {
    const { universe } = createUniverse({
      allowProceduralFrontier: false,
    });

    expect(() => universe.selectProceduralSector(ORIGIN)).toThrow("disabled");
  });
});

describe("unified address resolution", () => {
  it("resolves scientific addresses", async () => {
    const { universe } = createUniverse();

    const selection = await universe.resolve(scientificAddress("earth"));

    expect(selection.realm).toBe("reality");

    if (selection.realm !== "reality") {
      return;
    }

    expect(selection.record.entity.id).toBe("earth");
  });

  it("resolves observational frontier addresses", async () => {
    const { universe } = createUniverse();

    const selection = await universe.resolve(frontierAddress("far-limit"));

    expect(selection.realm).toBe("observational-frontier");
  });

  it("resolves procedural sectors", async () => {
    const { stream, universe } = createUniverse();

    const address = proceduralAddress(
      stream.generator.seed.key,
      "sector",
      ORIGIN,
    );

    const selection = await universe.resolve(address);

    expect(selection.realm).toBe("procedural-frontier");

    if (selection.realm !== "procedural-frontier") {
      return;
    }

    expect(selection.targetKind).toBe("sector");
  });

  it("rejects procedural addresses belonging to another seed", async () => {
    const { universe } = createUniverse();

    const address = proceduralAddress("wrong-seed", "sector", ORIGIN);

    await expect(universe.resolve(address)).rejects.toThrow(
      "different universe seed",
    );
  });
});

describe("navigation history", () => {
  it("records scientific selections", async () => {
    const { universe } = createUniverse();

    await universe.selectScientific("sun");

    await universe.selectScientific("earth");

    expect(universe.history).toHaveLength(2);

    expect(universe.historyIndex).toBe(1);

    expect(universe.canGoBack).toBe(true);
  });

  it("does not duplicate identical consecutive addresses", async () => {
    const { universe } = createUniverse();

    await universe.selectScientific("earth");

    await universe.selectScientific("earth");

    expect(universe.history).toHaveLength(1);
  });

  it("goes backward through history", async () => {
    const { universe } = createUniverse();

    await universe.selectScientific("sun");

    await universe.selectScientific("earth");

    const previous = await universe.goBack();

    expect(previous?.realm).toBe("reality");

    if (previous?.realm !== "reality") {
      return;
    }

    expect(previous.record.entity.id).toBe("sun");

    expect(universe.historyIndex).toBe(0);
  });

  it("goes forward through history", async () => {
    const { universe } = createUniverse();

    await universe.selectScientific("sun");

    await universe.selectScientific("earth");

    await universe.goBack();

    const next = await universe.goForward();

    expect(next?.realm).toBe("reality");

    if (next?.realm !== "reality") {
      return;
    }

    expect(next.record.entity.id).toBe("earth");
  });

  it("truncates forward history after branching", async () => {
    const { universe } = createUniverse();

    await universe.selectScientific("sun");

    await universe.selectScientific("earth");

    await universe.selectScientific("moon");

    await universe.goBack();

    await universe.selectScientific("proxima-centauri");

    expect(universe.history.map((entry) => entry.title)).toEqual([
      "Sun",
      "Earth",
      "Proxima Centauri",
    ]);

    expect(universe.canGoForward).toBe(false);
  });

  it("limits maximum history length", async () => {
    const { universe } = createUniverse({
      maximumHistoryEntries: 2,
    });

    await universe.selectScientific("sun");

    await universe.selectScientific("earth");

    await universe.selectScientific("moon");

    expect(universe.history).toHaveLength(2);

    expect(universe.history.map((entry) => entry.title)).toEqual([
      "Earth",
      "Moon",
    ]);
  });

  it("returns null when backward navigation is unavailable", async () => {
    const { universe } = createUniverse();

    expect(await universe.goBack()).toBeNull();
  });

  it("returns null when forward navigation is unavailable", async () => {
    const { universe } = createUniverse();

    expect(await universe.goForward()).toBeNull();
  });
});

describe("unified universe events", () => {
  it("emits selection changes", async () => {
    const { universe } = createUniverse();

    const events: UnifiedUniverseEvent[] = [];

    universe.subscribe((event) => {
      events.push(event);
    });

    await universe.selectScientific("earth");

    expect(events.some((event) => event.type === "selection-changed")).toBe(
      true,
    );
  });

  it("emits realm changes", () => {
    const { universe } = createUniverse();

    const events: UnifiedUniverseEvent[] = [];

    universe.subscribe((event) => {
      events.push(event);
    });

    universe.enterObservationalFrontier();

    expect(
      events.some(
        (event) =>
          event.type === "realm-changed" &&
          event.realm === "observational-frontier",
      ),
    ).toBe(true);
  });

  it("stops events after unsubscribe", async () => {
    const { universe } = createUniverse();

    let count = 0;

    const unsubscribe = universe.subscribe(() => {
      count++;
    });

    await universe.selectScientific("sun");

    const before = count;

    unsubscribe();

    await universe.selectScientific("earth");

    expect(count).toBe(before);
  });
});

describe("unified universe snapshots", () => {
  it("reports engine versions and procedural seed", () => {
    const { stream, universe } = createUniverse();

    const snapshot = universe.snapshot();

    expect(snapshot.version).toBe(UNIFIED_UNIVERSE_VERSION);

    expect(snapshot.proceduralSeedKey).toBe(stream.generator.seed.key);

    expect(snapshot.proceduralGenerationVersion).toBeGreaterThan(0);
  });

  it("reflects the active realm and selection", async () => {
    const { universe } = createUniverse();

    await universe.selectScientific("earth");

    const snapshot = universe.snapshot();

    expect(snapshot.realm).toBe("reality");

    expect(snapshot.selection?.realm).toBe("reality");

    expect(snapshot.history).toHaveLength(1);
  });

  it("clears the active selection", async () => {
    const { universe } = createUniverse();

    await universe.selectScientific("earth");

    universe.clearSelection();

    expect(universe.selection).toBeNull();
  });
});

describe("unified universe options", () => {
  it("provides safe defaults", () => {
    expect(DEFAULT_UNIFIED_UNIVERSE_OPTIONS.allowProceduralFrontier).toBe(true);

    expect(
      DEFAULT_UNIFIED_UNIVERSE_OPTIONS.maximumHistoryEntries,
    ).toBeGreaterThan(0);

    expect(
      DEFAULT_UNIFIED_UNIVERSE_OPTIONS.generationTicksPerResolve,
    ).toBeGreaterThan(0);
  });

  it("rejects zero history capacity", () => {
    expect(() =>
      createUniverse({
        maximumHistoryEntries: 0,
      }),
    ).toThrow("maximumHistoryEntries");
  });

  it("rejects zero generation resolve budget", () => {
    expect(() =>
      createUniverse({
        generationTicksPerResolve: 0,
      }),
    ).toThrow("generationTicksPerResolve");
  });
});
