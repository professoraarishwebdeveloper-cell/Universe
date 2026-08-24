import { describe, expect, it } from "vitest";

import type { ReferenceFrame } from "@known-universe/core";

import {
  ASTRONOMICAL_UNIT_M,
  FRAME_EARTH_GEOCENTRIC,
  FRAME_ICRS,
  J2000_JULIAN_DAY,
  MU_EARTH,
  absoluteMagnitude,
  apparentMagnitude,
  cartesianToEquatorial,
  dateToJulianDay,
  distanceModulus,
  earthFixedToGeodetic,
  equatorialToCartesian,
  equatorialToGalactic,
  gaiaRecordToEntity,
  gaiaRecordToStellarRecord,
  galacticToEquatorial,
  geodeticToEarthFixed,
  julianDayToDate,
  normalizeDegrees,
  normalizeHours,
  normalizeRadians,
  normalizeSignedDegrees,
  orbitalElementsToStateVector,
  orbitalPeriodSeconds,
  parallaxMasToParsecs,
  parsecsToParallaxMas,
  propagateProperMotion,
  sampleEllipticOrbit,
  solveEllipticKeplerEquation,
} from "./astronomy-core";

import type {
  ClassicalOrbitalElements,
  StellarCatalogRecord,
} from "./astronomy-core";

import {
  ASTRONOMICAL_REFERENCE_FRAMES,
  AstronomyCatalogProvider,
  MeanElementPreviewPropagator,
  SOLAR_SYSTEM_BODIES,
  astronomyHealthReport,
  createStaticSolarSystemEntities,
  distanceLightTravelTimeSeconds,
  formatLightTravelTime,
  importGaiaCsv,
  lightTravelTimeSecondsBetween,
  packStarChunk,
  parseTle,
  tleChecksum,
  tleEpochToJulianDay,
  validateReferenceFrameGraph,
  validateTleChecksum,
} from "./astronomy-catalog";

function expectClose(
  actual: number,
  expected: number,
  tolerance: number,
): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    tolerance,
  );
}

function createTleLine(first68Characters: string): string {
  const base = first68Characters.padEnd(68, " ").slice(0, 68);

  return base + String(tleChecksum(base));
}

const TLE_LINE_1 = createTleLine(
  "1 25544U 98067A   24001.50000000  .00016717  00000-0  30142-3 0  999",
);

const TLE_LINE_2 = createTleLine(
  "2 25544  51.6400 100.0000 0005000  50.0000 310.0000 15.5000000012345",
);

const CIRCULAR_LOW_EARTH_ORBIT: ClassicalOrbitalElements = {
  semiMajorAxisM: 7_000_000,
  eccentricity: 0,
  inclinationRad: 0,
  longitudeAscendingNodeRad: 0,
  argumentPeriapsisRad: 0,
  meanAnomalyRad: 0,
  epochJulianDay: J2000_JULIAN_DAY,
  gravitationalParameter: MU_EARTH,
};

const TEST_STAR: StellarCatalogRecord = {
  id: "test:alpha",
  name: "Alpha Test Star",
  rightAscensionDeg: 0,
  declinationDeg: 0,
  referenceEpoch: 2016,
  parallaxMas: 100,
  apparentMagnitude: 4.5,
  temperatureK: 5_778,
  sourceIds: ["test:catalog"],
};

describe("astronomy angles", () => {
  it("normalizes degrees into one complete circle", () => {
    expect(normalizeDegrees(-30)).toBe(330);
    expect(normalizeDegrees(390)).toBe(30);
    expect(normalizeDegrees(720)).toBe(0);
  });

  it("normalizes signed degrees", () => {
    expect(normalizeSignedDegrees(270)).toBe(-90);
    expect(normalizeSignedDegrees(-270)).toBe(90);
  });

  it("normalizes radians", () => {
    expectClose(
      normalizeRadians(-Math.PI / 2),
      Math.PI * 1.5,
      1e-12,
    );
  });

  it("normalizes right ascension hours", () => {
    expect(normalizeHours(25)).toBe(1);
    expect(normalizeHours(-1)).toBe(23);
    expect(normalizeHours(48)).toBe(0);
  });
});

describe("equatorial coordinates", () => {
  it("places RA 0 Dec 0 on positive x", () => {
    const position = equatorialToCartesian({
      rightAscensionDeg: 0,
      declinationDeg: 0,
      distance: 1,
      distanceUnit: "pc",
    });

    expectClose(position.x, 1, 1e-12);
    expectClose(position.y, 0, 1e-12);
    expectClose(position.z, 0, 1e-12);
  });

  it("places RA 90 Dec 0 on positive y", () => {
    const position = equatorialToCartesian({
      rightAscensionDeg: 90,
      declinationDeg: 0,
      distance: 2,
      distanceUnit: "pc",
    });

    expectClose(position.x, 0, 1e-12);
    expectClose(position.y, 2, 1e-12);
    expectClose(position.z, 0, 1e-12);
  });

  it("places the north celestial pole on positive z", () => {
    const position = equatorialToCartesian({
      rightAscensionDeg: 0,
      declinationDeg: 90,
      distance: 1,
      distanceUnit: "pc",
    });

    expectClose(position.x, 0, 1e-12);
    expectClose(position.y, 0, 1e-12);
    expectClose(position.z, 1, 1e-12);
  });

  it("round-trips equatorial and Cartesian coordinates", () => {
    const original = {
      rightAscensionDeg: 123.456,
      declinationDeg: -31.25,
      distance: 17.5,
      distanceUnit: "pc" as const,
    };

    const cartesian = equatorialToCartesian(original);

    const restored = cartesianToEquatorial(
      cartesian,
      "pc",
    );

    expectClose(
      restored.rightAscensionDeg,
      original.rightAscensionDeg,
      1e-10,
    );

    expectClose(
      restored.declinationDeg,
      original.declinationDeg,
      1e-10,
    );

    expectClose(
      restored.distance ?? 0,
      original.distance,
      1e-10,
    );
  });

  it("round-trips equatorial and galactic coordinates", () => {
    const original = {
      rightAscensionDeg: 83.6331,
      declinationDeg: 22.0145,
      distance: 2,
      distanceUnit: "pc" as const,
    };

    const galactic = equatorialToGalactic(original);
    const restored = galacticToEquatorial(galactic);

    expectClose(
      restored.rightAscensionDeg,
      original.rightAscensionDeg,
      1e-6,
    );

    expectClose(
      restored.declinationDeg,
      original.declinationDeg,
      1e-6,
    );

    expectClose(
      restored.distance ?? 0,
      2,
      1e-8,
    );
  });
});

describe("Earth coordinates", () => {
  it("round-trips WGS84 geodetic coordinates", () => {
    const location = {
      latitudeDeg: 20.7096,
      longitudeDeg: 76.9981,
      altitudeM: 285,
    };

    const earthFixed = geodeticToEarthFixed(location);

    const restored = earthFixedToGeodetic(
      earthFixed,
    );

    expectClose(
      restored.latitudeDeg,
      location.latitudeDeg,
      1e-7,
    );

    expectClose(
      restored.longitudeDeg,
      location.longitudeDeg,
      1e-7,
    );

    expectClose(
      restored.altitudeM,
      location.altitudeM,
      1e-3,
    );
  });

  it("keeps the equator on the equatorial plane", () => {
    const earthFixed = geodeticToEarthFixed({
      latitudeDeg: 0,
      longitudeDeg: 0,
      altitudeM: 0,
    });

    expectClose(earthFixed.yM, 0, 1e-8);
    expectClose(earthFixed.zM, 0, 1e-8);

    expect(earthFixed.xM).toBeGreaterThan(
      6_000_000,
    );
  });
});

describe("astronomical time", () => {
  it("maps J2000 to Julian Day 2451545", () => {
    const date = new Date(
      "2000-01-01T12:00:00.000Z",
    );

    expectClose(
      dateToJulianDay(date),
      J2000_JULIAN_DAY,
      1e-12,
    );
  });

  it("round-trips Julian Day and Date", () => {
    const original = new Date(
      "2026-08-24T00:00:00.000Z",
    );

    const julianDay = dateToJulianDay(original);
    const restored = julianDayToDate(julianDay);

    expect(restored.toISOString()).toBe(
      original.toISOString(),
    );
  });
});

describe("stellar distances and magnitudes", () => {
  it("converts 1000 milliarcseconds to one parsec", () => {
    expect(parallaxMasToParsecs(1_000)).toBe(1);
    expect(parsecsToParallaxMas(1)).toBe(1_000);
  });

  it("converts 100 milliarcseconds to ten parsecs", () => {
    expect(parallaxMasToParsecs(100)).toBe(10);
    expect(parsecsToParallaxMas(10)).toBe(100);
  });

  it("rejects invalid parallax", () => {
    expect(parallaxMasToParsecs(0)).toBeNull();
    expect(parallaxMasToParsecs(-1)).toBeNull();

    expect(parsecsToParallaxMas(0)).toBeNull();
    expect(parsecsToParallaxMas(-5)).toBeNull();
  });

  it("has zero distance modulus at ten parsecs", () => {
    expectClose(
      distanceModulus(10),
      0,
      1e-12,
    );

    expectClose(
      absoluteMagnitude(5, 10),
      5,
      1e-12,
    );

    expectClose(
      apparentMagnitude(5, 10),
      5,
      1e-12,
    );
  });
});

describe("proper motion", () => {
  it("keeps a zero-motion star at the same sky position", () => {
    const result = propagateProperMotion(
      {
        rightAscensionDeg: 100,
        declinationDeg: -20,
        epochJulianYear: 2016,
        parallaxMas: 100,
      },
      2036,
    );

    expectClose(
      result.rightAscensionDeg,
      100,
      1e-12,
    );

    expectClose(
      result.declinationDeg,
      -20,
      1e-12,
    );

    expectClose(
      result.distanceParsecs ?? 0,
      10,
      1e-12,
    );

    expect(result.epochJulianYear).toBe(2036);
  });

  it("applies declination proper motion", () => {
    const result = propagateProperMotion(
      {
        rightAscensionDeg: 100,
        declinationDeg: 20,
        epochJulianYear: 2000,
        properMotionDecMasYr: 1_000,
      },
      2010,
    );

    expectClose(
      result.declinationDeg,
      20 + 10_000 / 3_600_000,
      1e-12,
    );
  });
});

describe("Gaia records", () => {
  it("maps Gaia-like data into the stellar catalog", () => {
    const star = gaiaRecordToStellarRecord({
      source_id: "42",
      designation: "Gaia Test 42",
      ra: 12.5,
      dec: -3.25,
      ref_epoch: 2016,
      parallax: 50,
      pmra: 2,
      pmdec: -4,
      radial_velocity: 30,
      phot_g_mean_mag: 7.2,
      bp_rp: 0.8,
      teff_gspphot: 5_900,
    });

    expect(star.id).toBe("gaia:42");
    expect(star.name).toBe("Gaia Test 42");

    expect(star.sourceIds).toEqual([
      "gaia:dr3",
    ]);

    expect(star.parallaxMas).toBe(50);
    expect(star.properMotionRaMasYr).toBe(2);
    expect(star.properMotionDecMasYr).toBe(-4);
    expect(star.radialVelocityKmS).toBe(30);
    expect(star.apparentMagnitude).toBe(7.2);
    expect(star.temperatureK).toBe(5_900);
  });

  it("creates a positioned star entity from Gaia data", () => {
    const entity = gaiaRecordToEntity({
      source_id: 99,
      ra: 0,
      dec: 0,
      parallax: 100,
      teff_gspphot: 5_778,
    });

    expect(entity.id).toBe("gaia:99");
    expect(entity.kind).toBe("star");

    expect(entity.sourceIds).toContain(
      "gaia:dr3",
    );

    expect(entity.spatial?.frameId).toBe(
      FRAME_ICRS,
    );

    expect(entity.spatial?.unit).toBe("pc");

    expectClose(
      entity.spatial?.position[0] ?? 0,
      10,
      1e-9,
    );
  });

  it("packs star data into typed arrays", () => {
    const chunk = packStarChunk([
      TEST_STAR,
    ]);

    expect(chunk.count).toBe(1);

    expect(chunk.ids).toEqual([
      "test:alpha",
    ]);

    expect(chunk.positionsPc).toHaveLength(3);

    expect(
      chunk.apparentMagnitudes,
    ).toHaveLength(1);

    expect(chunk.rgb).toHaveLength(3);

    expect(chunk.parallaxMas).toHaveLength(1);

    expectClose(
      chunk.positionsPc[0] ?? 0,
      10,
      1e-5,
    );

    expectClose(
      chunk.apparentMagnitudes[0] ?? 0,
      4.5,
      1e-6,
    );
  });

  it("imports valid Gaia CSV rows and rejects invalid ones", () => {
    const csv = [
      "source_id,ra,dec,parallax,phot_g_mean_mag,designation",
      "1,10,20,100,5.5,Valid Star",
      "2,20,100,50,6.0,Invalid Star",
    ].join("\n");

    const result = importGaiaCsv(csv);

    expect(result.records).toHaveLength(1);
    expect(result.rejected).toBe(1);

    expect(result.records[0]?.id).toBe(
      "gaia:1",
    );

    expect(
      result.issues[0]?.message,
    ).toContain("Declination");
  });
});

describe("Keplerian orbit mathematics", () => {
  it("solves a circular Kepler equation exactly", () => {
    const solution =
      solveEllipticKeplerEquation(
        1.2,
        0,
      );

    expect(solution.converged).toBe(true);

    expectClose(
      solution.eccentricAnomalyRad,
      1.2,
      1e-12,
    );
  });

  it("solves an eccentric Kepler equation", () => {
    const meanAnomaly = 1.1;
    const eccentricity = 0.63;

    const solution =
      solveEllipticKeplerEquation(
        meanAnomaly,
        eccentricity,
      );

    const residual =
      solution.eccentricAnomalyRad -
      eccentricity *
        Math.sin(
          solution.eccentricAnomalyRad,
        ) -
      meanAnomaly;

    expect(solution.converged).toBe(true);

    expectClose(
      residual,
      0,
      1e-11,
    );
  });

  it("creates the expected circular orbit state", () => {
    const state =
      orbitalElementsToStateVector(
        CIRCULAR_LOW_EARTH_ORBIT,
        J2000_JULIAN_DAY,
        FRAME_EARTH_GEOCENTRIC,
      );

    expectClose(
      state.positionM[0],
      7_000_000,
      1e-6,
    );

    expectClose(
      state.positionM[1],
      0,
      1e-6,
    );

    expectClose(
      state.positionM[2],
      0,
      1e-6,
    );

    expectClose(
      state.velocityMS[0],
      0,
      1e-9,
    );

    expectClose(
      state.velocityMS[1],
      Math.sqrt(
        MU_EARTH / 7_000_000,
      ),
      1e-8,
    );

    expect(state.frameId).toBe(
      FRAME_EARTH_GEOCENTRIC,
    );
  });

  it("calculates orbital period from semi-major axis", () => {
    const expected =
      2 *
      Math.PI *
      Math.sqrt(
        Math.pow(
          7_000_000,
          3,
        ) / MU_EARTH,
      );

    expectClose(
      orbitalPeriodSeconds(
        7_000_000,
        MU_EARTH,
      ),
      expected,
      1e-9,
    );
  });

  it("samples a complete closed ellipse", () => {
    const samples = sampleEllipticOrbit(
      {
        ...CIRCULAR_LOW_EARTH_ORBIT,
        eccentricity: 0.1,
      },
      32,
    );

    expect(samples).toHaveLength(33);

    const first = samples[0];
    const last =
      samples[samples.length - 1];

    expect(first).toBeDefined();
    expect(last).toBeDefined();

    if (!first || !last) {
      return;
    }

    expectClose(
      first.positionM[0],
      last.positionM[0],
      1e-5,
    );

    expectClose(
      first.positionM[1],
      last.positionM[1],
      1e-5,
    );

    expectClose(
      first.positionM[2],
      last.positionM[2],
      1e-5,
    );
  });
});

describe("reference-frame hierarchy", () => {
  it("accepts the built-in astronomical frame graph", () => {
    const report =
      validateReferenceFrameGraph(
        ASTRONOMICAL_REFERENCE_FRAMES,
      );

    expect(report.valid).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it("detects cyclic frame graphs", () => {
    const frames: ReferenceFrame[] = [
      {
        id: "test:frame-a",
        name: "Frame A",
        kind: "body",
        parentId: "test:frame-b",
      },
      {
        id: "test:frame-b",
        name: "Frame B",
        kind: "body",
        parentId: "test:frame-a",
      },
    ];

    const report =
      validateReferenceFrameGraph(frames);

    expect(report.valid).toBe(false);

    expect(
      report.issues.some(
        (issue) =>
          issue.code === "frame.cycle",
      ),
    ).toBe(true);
  });
});

describe("Solar System catalog", () => {
  it("contains the expected major Solar System bodies", () => {
    const ids = new Set(
      SOLAR_SYSTEM_BODIES.map(
        (body) => body.id,
      ),
    );

    expect(ids.has("sun")).toBe(true);
    expect(ids.has("mercury")).toBe(true);
    expect(ids.has("venus")).toBe(true);
    expect(ids.has("earth")).toBe(true);
    expect(ids.has("moon")).toBe(true);
    expect(ids.has("mars")).toBe(true);
    expect(ids.has("jupiter")).toBe(true);
    expect(ids.has("saturn")).toBe(true);
    expect(ids.has("uranus")).toBe(true);
    expect(ids.has("neptune")).toBe(true);

    expect(
      SOLAR_SYSTEM_BODIES,
    ).toHaveLength(10);
  });

  it("preserves the Sun Earth Moon hierarchy", () => {
    const entities =
      createStaticSolarSystemEntities();

    const earth = entities.find(
      (entity) => entity.id === "earth",
    );

    const moon = entities.find(
      (entity) => entity.id === "moon",
    );

    expect(earth?.parentId).toBe("sun");
    expect(moon?.parentId).toBe("earth");
  });

  it("reports a healthy astronomy foundation", () => {
    const health = astronomyHealthReport();

    expect(
      health.referenceFramesValid,
    ).toBe(true);

    expect(
      health.referenceFrameIssues,
    ).toBe(0);

    expect(
      health.solarSystemBodies,
    ).toBe(
      SOLAR_SYSTEM_BODIES.length,
    );

    expect(
      health.astronomySources,
    ).toBeGreaterThan(0);

    expect(
      health.ephemerisBodies,
    ).toBeGreaterThan(0);
  });
});

describe("TLE support", () => {
  it("creates valid TLE checksums", () => {
    expect(TLE_LINE_1).toHaveLength(69);
    expect(TLE_LINE_2).toHaveLength(69);

    expect(
      validateTleChecksum(TLE_LINE_1),
    ).toBe(true);

    expect(
      validateTleChecksum(TLE_LINE_2),
    ).toBe(true);
  });

  it("rejects a corrupted checksum", () => {
    const digit = Number(
      TLE_LINE_1[68],
    );

    const replacement = String(
      (digit + 1) % 10,
    );

    const corrupted =
      TLE_LINE_1.slice(0, 68) +
      replacement;

    expect(
      validateTleChecksum(corrupted),
    ).toBe(false);
  });

  it("parses fixed-width TLE fields", () => {
    const tle = parseTle(
      TLE_LINE_1,
      TLE_LINE_2,
      "Test Satellite",
    );

    expect(tle.name).toBe(
      "Test Satellite",
    );

    expect(tle.satelliteNumber).toBe(
      25_544,
    );

    expectClose(
      tle.inclinationDeg,
      51.64,
      1e-8,
    );

    expectClose(
      tle.eccentricity,
      0.0005,
      1e-12,
    );

    expectClose(
      tle.meanMotionRevPerDay,
      15.5,
      1e-10,
    );
  });

  it("converts TLE epoch into Julian Day", () => {
    const expected = dateToJulianDay(
      new Date(
        "2024-01-01T12:00:00.000Z",
      ),
    );

    expectClose(
      tleEpochToJulianDay(
        24,
        1.5,
      ),
      expected,
      1e-12,
    );
  });

  it("marks the two-body TLE propagator as preview-only", () => {
    const tle = parseTle(
      TLE_LINE_1,
      TLE_LINE_2,
    );

    const epoch =
      tleEpochToJulianDay(
        tle.epochYear,
        tle.epochDay,
      );

    const result =
      new MeanElementPreviewPropagator().propagate(
        tle,
        epoch,
      );

    expect(result.accuracy).toBe(
      "preview-only",
    );

    expect(result.warning).toContain(
      "SGP4",
    );

    expect(result.state.frameId).toBe(
      FRAME_EARTH_GEOCENTRIC,
    );
  });
});

describe("astronomy catalog provider", () => {
  it("ingests and searches stellar records", async () => {
    const provider =
      new AstronomyCatalogProvider({
        includeSolarSystem: false,
      });

    await provider.initialize();

    expect(provider.size).toBe(0);

    expect(
      provider.ingestStars([
        TEST_STAR,
      ]),
    ).toBe(1);

    expect(provider.size).toBe(1);

    const page = await provider.query({
      text: "alpha",
      limit: 10,
    });

    expect(page.total).toBe(1);

    expect(page.items[0]?.id).toBe(
      TEST_STAR.id,
    );

    const search = await provider.search(
      "Alpha Test",
      {
        kinds: ["star"],
        limit: 5,
      },
    );

    expect(search).toHaveLength(1);

    expect(search[0]?.id).toBe(
      TEST_STAR.id,
    );
  });

  it("returns null for an unknown entity", async () => {
    const provider =
      new AstronomyCatalogProvider({
        includeSolarSystem: false,
      });

    await provider.initialize();

    expect(
      await provider.get(
        "missing:entity",
      ),
    ).toBeNull();
  });
});

describe("light travel time", () => {
  it("calculates light travel across one AU", () => {
    const seconds =
      distanceLightTravelTimeSeconds(
        ASTRONOMICAL_UNIT_M,
      );

    expectClose(
      seconds,
      499.004783836,
      1e-6,
    );
  });

  it("calculates light travel between two coordinates", () => {
    const direct =
      distanceLightTravelTimeSeconds(
        ASTRONOMICAL_UNIT_M,
      );

    const between =
      lightTravelTimeSecondsBetween(
        [0, 0, 0],
        [1, 0, 0],
        "au",
      );

    expectClose(
      between,
      direct,
      1e-10,
    );
  });

  it("formats light travel durations", () => {
    expect(
      formatLightTravelTime(30),
    ).toBe("30.0 s");

    expect(
      formatLightTravelTime(120),
    ).toBe("2.0 min");

    expect(
      formatLightTravelTime(7_200),
    ).toBe("2.0 h");
  });
});
             