import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Vec3,
} from "@known-universe/core";

import {
  ProceduralUniverseGenerator,
  proceduralSectorKey,
} from "./procedural";

import type {
  GalaxyDescriptor,
  ProceduralSector,
  SectorCoordinate,
} from "./procedural";

import {
  DEFAULT_WORLD_STREAM_CONFIG,
  WORLD_STREAM_VERSION,
  WorldStreamManager,
  createWorldStream,
  sectorDistance,
  sectorDistanceSquared,
  sectorOffsetsWithinRadius,
  worldStreamInfo,
} from "./world-stream";

import type {
  WorldStreamEvent,
} from "./world-stream";


interface ManualClock {
  now:
    () => number;

  advance:
    (
      milliseconds:
        number,
    ) => void;
}


function createManualClock(
  start =
    1_000,
):
  ManualClock {
  let current =
    start;

  return {
    now:
      () =>
        current,

    advance:
      (
        milliseconds,
      ) => {
        current +=
          milliseconds;
      },
  };
}


function sectorPosition(
  generator:
    ProceduralUniverseGenerator,

  coordinate:
    SectorCoordinate,

  fraction =
    0.5,
):
  Vec3 {
  const size =
    generator
      .profile
      .sectorSizeLy;

  return [
    (
      coordinate.x +
      fraction
    ) *
    size,

    (
      coordinate.y +
      fraction
    ) *
    size,

    (
      coordinate.z +
      fraction
    ) *
    size,
  ];
}


function createTestStream(
  config: ConstructorParameters<
    typeof WorldStreamManager
  >[1] = {},

  seed =
    "WORLD STREAM TEST",
) {
  const clock =
    createManualClock();

  const generator =
    new ProceduralUniverseGenerator(
      seed,
    );

  const stream =
    new WorldStreamManager(
      generator,
      config,
      clock.now,
    );

  return {
    clock,
    generator,
    stream,
  };
}


const ORIGIN:
  SectorCoordinate = {
  x: 0,
  y: 0,
  z: 0,
};


describe(
  "world stream configuration",
  () => {
    it(
      "has safe default streaming limits",
      () => {
        expect(
          DEFAULT_WORLD_STREAM_CONFIG
            .loadRadiusSectors,
        ).toBeGreaterThanOrEqual(
          0,
        );

        expect(
          DEFAULT_WORLD_STREAM_CONFIG
            .retainRadiusSectors,
        ).toBeGreaterThanOrEqual(
          DEFAULT_WORLD_STREAM_CONFIG
            .loadRadiusSectors,
        );

        expect(
          DEFAULT_WORLD_STREAM_CONFIG
            .maximumQueuedJobs,
        ).toBeGreaterThan(
          0,
        );

        expect(
          DEFAULT_WORLD_STREAM_CONFIG
            .maximumGenerationsPerTick,
        ).toBeGreaterThan(
          0,
        );

        expect(
          DEFAULT_WORLD_STREAM_CONFIG
            .estimatedMemoryBudgetBytes,
        ).toBeGreaterThan(
          0,
        );
      },
    );


    it(
      "rejects retain radii smaller than load radii",
      () => {
        expect(
          () =>
            createTestStream({
              loadRadiusSectors:
                3,

              retainRadiusSectors:
                2,
            }),
        ).toThrow(
          "retainRadiusSectors",
        );
      },
    );


    it(
      "rejects galaxy detail outside the load radius",
      () => {
        expect(
          () =>
            createTestStream({
              loadRadiusSectors:
                1,

              retainRadiusSectors:
                2,

              galaxyDetailRadiusSectors:
                2,
            }),
        ).toThrow(
          "galaxyDetailRadiusSectors",
        );
      },
    );


    it(
      "rejects zero queue capacity",
      () => {
        expect(
          () =>
            createTestStream({
              maximumQueuedJobs:
                0,
            }),
        ).toThrow(
          "maximumQueuedJobs",
        );
      },
    );


    it(
      "rejects negative cache lifetimes",
      () => {
        expect(
          () =>
            createTestStream({
              sectorIdleLifetimeMs:
                -1,
            }),
        ).toThrow(
          "sectorIdleLifetimeMs",
        );
      },
    );
  },
);


describe(
  "sector distance utilities",
  () => {
    it(
      "calculates squared sector distance",
      () => {
        expect(
          sectorDistanceSquared(
            {
              x: 0,
              y: 0,
              z: 0,
            },
            {
              x: 2,
              y: 3,
              z: 6,
            },
          ),
        ).toBe(
          49,
        );
      },
    );


    it(
      "calculates Euclidean sector distance",
      () => {
        expect(
          sectorDistance(
            {
              x: 0,
              y: 0,
              z: 0,
            },
            {
              x: 2,
              y: 3,
              z: 6,
            },
          ),
        ).toBe(
          7,
        );
      },
    );


    it(
      "returns only the center for radius zero",
      () => {
        expect(
          sectorOffsetsWithinRadius(
            0,
          ),
        ).toEqual([
          {
            x: 0,
            y: 0,
            z: 0,
          },
        ]);
      },
    );


    it(
      "returns seven lattice sectors for radius one",
      () => {
        const offsets =
          sectorOffsetsWithinRadius(
            1,
          );

        expect(
          offsets,
        ).toHaveLength(
          7,
        );

        expect(
          offsets[0],
        ).toEqual({
          x: 0,
          y: 0,
          z: 0,
        });
      },
    );


    it(
      "sorts sector offsets nearest first",
      () => {
        const offsets =
          sectorOffsetsWithinRadius(
            2,
          );

        let previous =
          -1;

        for (
          const offset
          of offsets
        ) {
          const distance =
            sectorDistanceSquared(
              ORIGIN,
              offset,
            );

          expect(
            distance,
          ).toBeGreaterThanOrEqual(
            previous,
          );

          previous =
            distance;
        }
      },
    );
  },
);


describe(
  "sector request queue",
  () => {
    it(
      "queues a manual sector request",
      () => {
        const {
          stream,
        } =
          createTestStream();

        const view =
          stream.requestSector(
            ORIGIN,
          );

        expect(
          view.state,
        ).toBe(
          "queued",
        );

        expect(
          view.reason,
        ).toBe(
          "manual",
        );

        expect(
          stream.queueDepth,
        ).toBe(
          1,
        );
      },
    );


    it(
      "generates a queued sector",
      () => {
        const {
          stream,
        } =
          createTestStream();

        stream.requestSector(
          ORIGIN,
        );

        const result =
          stream.tick(
            1,
          );

        expect(
          result.generated,
        ).toBe(
          1,
        );

        expect(
          result.failed,
        ).toBe(
          0,
        );

        const sector =
          stream.getSector(
            ORIGIN,
          );

        expect(
          sector,
        ).not.toBeNull();

        expect(
          sector?.coordinate,
        ).toEqual(
          ORIGIN,
        );

        expect(
          sector?.realityClass,
        ).toBe(
          "procedural",
        );
      },
    );


    it(
      "processes lower numeric priorities first",
      () => {
        const {
          stream,
        } =
          createTestStream();

        const slow = {
          x: 1,
          y: 0,
          z: 0,
        };

        const urgent = {
          x: 2,
          y: 0,
          z: 0,
        };

        stream.requestSector(
          slow,
          "galaxy",
          100,
        );

        stream.requestSector(
          urgent,
          "galaxy",
          -100,
        );

        stream.tick(
          1,
        );

        expect(
          stream.getSector(
            urgent,
          ),
        ).not.toBeNull();

        expect(
          stream.getSector(
            slow,
          ),
        ).toBeNull();
      },
    );


    it(
      "invalidates stale jobs after reprioritizing the same sector",
      () => {
        const {
          stream,
        } =
          createTestStream();

        stream.requestSector(
          ORIGIN,
          "galaxy",
          100,
        );

        stream.requestSector(
          ORIGIN,
          "galaxy",
          -100,
        );

        const result =
          stream.drain();

        expect(
          result.generated,
        ).toBe(
          1,
        );

        expect(
          result.stale,
        ).toBe(
          1,
        );

        expect(
          stream.metrics
            .staleJobsSkipped,
        ).toBe(
          1,
        );
      },
    );


    it(
      "drops jobs when queue capacity is exhausted",
      () => {
        const {
          stream,
        } =
          createTestStream({
            maximumQueuedJobs:
              2,
          });

        stream.requestSector({
          x: 0,
          y: 0,
          z: 0,
        });

        stream.requestSector({
          x: 1,
          y: 0,
          z: 0,
        });

        const third =
          stream.requestSector({
            x: 2,
            y: 0,
            z: 0,
          });

        expect(
          stream.queueDepth,
        ).toBe(
          2,
        );

        expect(
          stream.metrics
            .droppedJobs,
        ).toBe(
          1,
        );

        expect(
          third.state,
        ).toBe(
          "idle",
        );
      },
    );
  },
);


describe(
  "observer sector planning",
  () => {
    it(
      "loads the current sector at radius zero",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              0,

            retainRadiusSectors:
              0,

            galaxyDetailRadiusSectors:
              0,

            prefetchRadiusSectors:
              0,
          });

        const plan =
          stream.planObserver({
            positionLy:
              sectorPosition(
                generator,
                ORIGIN,
              ),
          });

        expect(
          plan.currentSector,
        ).toEqual(
          ORIGIN,
        );

        expect(
          plan.desiredSectorCount,
        ).toBe(
          1,
        );

        expect(
          stream.queueDepth,
        ).toBe(
          1,
        );
      },
    );


    it(
      "loads seven sectors around radius one",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              1,

            retainRadiusSectors:
              2,

            galaxyDetailRadiusSectors:
              1,

            prefetchRadiusSectors:
              0,
          });

        const plan =
          stream.planObserver({
            positionLy:
              sectorPosition(
                generator,
                ORIGIN,
              ),
          });

        expect(
          plan.desiredSectorCount,
        ).toBe(
          7,
        );

        stream.drain();

        expect(
          stream.memoryEstimate()
            .readySectors,
        ).toBe(
          7,
        );
      },
    );


    it(
      "assigns stronger LOD near the observer",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              2,

            retainRadiusSectors:
              3,

            galaxyDetailRadiusSectors:
              1,

            prefetchRadiusSectors:
              0,
          });

        stream.planObserver({
          positionLy:
            sectorPosition(
              generator,
              ORIGIN,
            ),
        });

        expect(
          stream.getSectorView(
            ORIGIN,
          )?.lod,
        ).toBe(
          "galaxy",
        );

        expect(
          stream.getSectorView({
            x: 2,
            y: 0,
            z: 0,
          })?.lod,
        ).toBe(
          "cosmic",
        );
      },
    );


    it(
      "prefetches sectors in the predicted direction of travel",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              0,

            retainRadiusSectors:
              2,

            galaxyDetailRadiusSectors:
              0,

            prefetchRadiusSectors:
              0,

            prefetchSeconds:
              2,
          });

        const size =
          generator
            .profile
            .sectorSizeLy;

        const plan =
          stream.planObserver({
            positionLy: [
              size *
                0.9,
              size *
                0.5,
              size *
                0.5,
            ],

            velocityLyPerSecond: [
              size *
                0.1,
              0,
              0,
            ],
          });

        expect(
          plan.currentSector,
        ).toEqual(
          ORIGIN,
        );

        expect(
          plan.prefetchSectorCount,
        ).toBe(
          1,
        );

        const prefetched =
          stream.getSectorView({
            x: 1,
            y: 0,
            z: 0,
          });

        expect(
          prefetched?.reason,
        ).toBe(
          "prefetch",
        );

        expect(
          prefetched?.lod,
        ).toBe(
          "cosmic",
        );
      },
    );


    it(
      "does not prefetch another sector when prediction stays local",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              0,

            retainRadiusSectors:
              1,

            galaxyDetailRadiusSectors:
              0,

            prefetchRadiusSectors:
              1,
          });

        const plan =
          stream.planObserver({
            positionLy:
              sectorPosition(
                generator,
                ORIGIN,
              ),

            velocityLyPerSecond: [
              0,
              0,
              0,
            ],
          });

        expect(
          plan.prefetchSectorCount,
        ).toBe(
          0,
        );
      },
    );
  },
);


describe(
  "sector cache and eviction",
  () => {
    it(
      "records cache hits for already-loaded sectors",
      () => {
        const {
          stream,
        } =
          createTestStream();

        stream.requestSector(
          ORIGIN,
        );

        stream.drain();

        const before =
          stream.metrics
            .sectorCacheHits;

        stream.requestSector(
          ORIGIN,
        );

        expect(
          stream.metrics
            .sectorCacheHits,
        ).toBe(
          before +
          1,
        );
      },
    );


    it(
      "evicts sectors outside the retain radius",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              0,

            retainRadiusSectors:
              0,

            galaxyDetailRadiusSectors:
              0,

            prefetchRadiusSectors:
              0,
          });

        stream.requestSector(
          ORIGIN,
        );

        stream.drain();

        expect(
          stream.getSector(
            ORIGIN,
          ),
        ).not.toBeNull();

        stream.planObserver({
          positionLy:
            sectorPosition(
              generator,
              {
                x: 2,
                y: 0,
                z: 0,
              },
            ),
        });

        expect(
          stream.getSectorView(
            ORIGIN,
          ),
        ).toBeNull();

        expect(
          stream.metrics
            .sectorEvictions,
        ).toBeGreaterThanOrEqual(
          1,
        );
      },
    );


    it(
      "keeps pinned sectors resident outside the retain radius",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              0,

            retainRadiusSectors:
              0,

            galaxyDetailRadiusSectors:
              0,

            prefetchRadiusSectors:
              0,
          });

        const release =
          stream.pinSector(
            ORIGIN,
          );

        stream.drain();

        stream.planObserver({
          positionLy:
            sectorPosition(
              generator,
              {
                x: 5,
                y: 0,
                z: 0,
              },
            ),
        });

        expect(
          stream.getSector(
            ORIGIN,
          ),
        ).not.toBeNull();

        release();

        stream.planObserver({
          positionLy:
            sectorPosition(
              generator,
              {
                x: 5,
                y: 0,
                z: 0,
              },
            ),
        });

        expect(
          stream.getSectorView(
            ORIGIN,
          ),
        ).toBeNull();
      },
    );


    it(
      "enforces maximum resident sector count",
      () => {
        const {
          stream,
        } =
          createTestStream({
            maximumResidentSectors:
              2,

            estimatedMemoryBudgetBytes:
              100 *
              1024 *
              1024,
          });

        stream.requestSector({
          x: 0,
          y: 0,
          z: 0,
        });

        stream.requestSector({
          x: 1,
          y: 0,
          z: 0,
        });

        stream.requestSector({
          x: 2,
          y: 0,
          z: 0,
        });

        stream.drain();

        expect(
          stream.memoryEstimate()
            .readySectors,
        ).toBeLessThanOrEqual(
          2,
        );

        expect(
          stream.metrics
            .sectorEvictions,
        ).toBeGreaterThanOrEqual(
          1,
        );
      },
    );


    it(
      "uses last-touch time when evicting sectors",
      () => {
        const {
          clock,
          stream,
        } =
          createTestStream({
            maximumResidentSectors:
              2,

            estimatedMemoryBudgetBytes:
              100 *
              1024 *
              1024,
          });

        const first = {
          x: 0,
          y: 0,
          z: 0,
        };

        const second = {
          x: 1,
          y: 0,
          z: 0,
        };

        const third = {
          x: 2,
          y: 0,
          z: 0,
        };

        stream.requestSector(
          first,
        );

        stream.drain();

        clock.advance(
          10,
        );

        stream.requestSector(
          second,
        );

        stream.drain();

        clock.advance(
          10,
        );

        expect(
          stream.getSector(
            first,
          ),
        ).not.toBeNull();

        clock.advance(
          10,
        );

        stream.requestSector(
          third,
        );

        stream.drain();

        expect(
          stream.getSector(
            first,
          ),
        ).not.toBeNull();

        expect(
          stream.getSector(
            second,
          ),
        ).toBeNull();

        expect(
          stream.getSector(
            third,
          ),
        ).not.toBeNull();
      },
    );


    it(
      "evicts idle sectors after their lifetime expires",
      () => {
        const {
          clock,
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              0,

            retainRadiusSectors:
              10,

            galaxyDetailRadiusSectors:
              0,

            prefetchRadiusSectors:
              0,

            sectorIdleLifetimeMs:
              100,
          });

        const distant = {
          x: 1,
          y: 0,
          z: 0,
        };

        stream.requestSector(
          distant,
        );

        stream.drain();

        clock.advance(
          101,
        );

        stream.planObserver({
          positionLy:
            sectorPosition(
              generator,
              ORIGIN,
            ),
        });

        expect(
          stream.getSectorView(
            distant,
          ),
        ).toBeNull();
      },
    );


    it(
      "regenerates the identical sector after eviction",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              0,

            retainRadiusSectors:
              0,

            galaxyDetailRadiusSectors:
              0,

            prefetchRadiusSectors:
              0,
          });

        stream.requestSector(
          ORIGIN,
        );

        stream.drain();

        const original =
          stream.getSector(
            ORIGIN,
          );

        expect(
          original,
        ).not.toBeNull();

        stream.planObserver({
          positionLy:
            sectorPosition(
              generator,
              {
                x: 10,
                y: 0,
                z: 0,
              },
            ),
        });

        expect(
          stream.getSector(
            ORIGIN,
          ),
        ).toBeNull();

        stream.requestSector(
          ORIGIN,
        );

        stream.drain();

        const regenerated =
          stream.getSector(
            ORIGIN,
          );

        expect(
          regenerated,
        ).toEqual(
          original,
        );
      },
    );
  },
);


describe(
  "system streaming",
  () => {
    it(
      "queues and generates individual star systems",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream();

        const galaxy =
          generator.galaxy(
            ORIGIN,
            0,
          );

        const view =
          stream.requestSystem(
            galaxy,
            42,
          );

        expect(
          view.state,
        ).toBe(
          "queued",
        );

        stream.drain();

        const system =
          stream.getSystem(
            galaxy.id,
            42,
          );

        expect(
          system,
        ).not.toBeNull();

        expect(
          system?.systemIndex,
        ).toBe(
          42,
        );

        expect(
          system?.galaxyId,
        ).toBe(
          galaxy.id,
        );

        expect(
          system?.realityClass,
        ).toBe(
          "procedural",
        );
      },
    );


    it(
      "records system cache hits",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream();

        const galaxy =
          generator.galaxy(
            ORIGIN,
            0,
          );

        stream.requestSystem(
          galaxy,
          1,
        );

        stream.drain();

        const before =
          stream.metrics
            .systemCacheHits;

        stream.requestSystem(
          galaxy,
          1,
        );

        expect(
          stream.metrics
            .systemCacheHits,
        ).toBe(
          before +
          1,
        );
      },
    );


    it(
      "prioritizes urgent system jobs",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream();

        const galaxy =
          generator.galaxy(
            ORIGIN,
            0,
          );

        stream.requestSystem(
          galaxy,
          1,
          100,
        );

        stream.requestSystem(
          galaxy,
          2,
          -100,
        );

        stream.tick(
          1,
        );

        expect(
          stream.getSystem(
            galaxy.id,
            2,
          ),
        ).not.toBeNull();

        expect(
          stream.getSystem(
            galaxy.id,
            1,
          ),
        ).toBeNull();
      },
    );


    it(
      "requests ranges of systems",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream();

        const galaxy =
          generator.galaxy(
            ORIGIN,
            0,
          );

        const requests =
          stream.requestSystems(
            galaxy,
            10,
            4,
          );

        expect(
          requests,
        ).toHaveLength(
          4,
        );

        stream.drain();

        for (
          let index = 10;
          index <
          14;
          index++
        ) {
          expect(
            stream.getSystem(
              galaxy.id,
              index,
            ),
          ).not.toBeNull();
        }
      },
    );


    it(
      "rejects invalid system indexes",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream();

        const galaxy =
          generator.galaxy(
            ORIGIN,
            0,
          );

        expect(
          () =>
            stream.requestSystem(
              galaxy,
              -1,
            ),
        ).toThrow();

        expect(
          () =>
            stream.requestSystem(
              galaxy,
              1.5,
            ),
        ).toThrow();
      },
    );


    it(
      "enforces maximum resident system count",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            maximumResidentSystems:
              2,

            estimatedMemoryBudgetBytes:
              100 *
              1024 *
              1024,
          });

        const galaxy =
          generator.galaxy(
            ORIGIN,
            0,
          );

        stream.requestSystem(
          galaxy,
          0,
        );

        stream.requestSystem(
          galaxy,
          1,
        );

        stream.requestSystem(
          galaxy,
          2,
        );

        stream.drain();

        expect(
          stream.memoryEstimate()
            .readySystems,
        ).toBeLessThanOrEqual(
          2,
        );

        expect(
          stream.metrics
            .systemEvictions,
        ).toBeGreaterThanOrEqual(
          1,
        );
      },
    );


    it(
      "keeps pinned systems resident under count pressure",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            maximumResidentSystems:
              1,

            estimatedMemoryBudgetBytes:
              100 *
              1024 *
              1024,
          });

        const galaxy =
          generator.galaxy(
            ORIGIN,
            0,
          );

        const release =
          stream.pinSystem(
            galaxy,
            0,
          );

        stream.drain();

        stream.requestSystem(
          galaxy,
          1,
        );

        stream.drain();

        expect(
          stream.getSystem(
            galaxy.id,
            0,
          ),
        ).not.toBeNull();

        expect(
          stream.getSystem(
            galaxy.id,
            1,
          ),
        ).toBeNull();

        release();
      },
    );


    it(
      "evicts idle systems",
      () => {
        const {
          clock,
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              0,

            retainRadiusSectors:
              0,

            galaxyDetailRadiusSectors:
              0,

            prefetchRadiusSectors:
              0,

            systemIdleLifetimeMs:
              100,
          });

        const galaxy =
          generator.galaxy(
            ORIGIN,
            0,
          );

        stream.requestSystem(
          galaxy,
          3,
        );

        stream.drain();

        clock.advance(
          101,
        );

        stream.planObserver({
          positionLy:
            sectorPosition(
              generator,
              ORIGIN,
            ),
        });

        expect(
          stream.getSystem(
            galaxy.id,
            3,
          ),
        ).toBeNull();
      },
    );


    it(
      "refreshes system idle time when accessed",
      () => {
        const {
          clock,
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              0,

            retainRadiusSectors:
              0,

            galaxyDetailRadiusSectors:
              0,

            prefetchRadiusSectors:
              0,

            systemIdleLifetimeMs:
              100,
          });

        const galaxy =
          generator.galaxy(
            ORIGIN,
            0,
          );

        stream.requestSystem(
          galaxy,
          9,
        );

        stream.drain();

        clock.advance(
          60,
        );

        expect(
          stream.getSystem(
            galaxy.id,
            9,
          ),
        ).not.toBeNull();

        clock.advance(
          60,
        );

        stream.planObserver({
          positionLy:
            sectorPosition(
              generator,
              ORIGIN,
            ),
        });

        expect(
          stream.getSystem(
            galaxy.id,
            9,
          ),
        ).not.toBeNull();
      },
    );
  },
);


describe(
  "stream memory budget",
  () => {
    it(
      "estimates resident memory usage",
      () => {
        const {
          stream,
        } =
          createTestStream();

        stream.requestSector(
          ORIGIN,
        );

        stream.drain();

        const memory =
          stream.memoryEstimate();

        expect(
          memory.readySectors,
        ).toBe(
          1,
        );

        expect(
          memory.sectorBytes,
        ).toBeGreaterThan(
          0,
        );

        expect(
          memory.totalBytes,
        ).toBe(
          memory.sectorBytes +
          memory.systemBytes,
        );
      },
    );


    it(
      "evicts unpinned data when memory budget is exceeded",
      () => {
        const {
          stream,
        } =
          createTestStream({
            estimatedMemoryBudgetBytes:
              1,
          });

        stream.requestSector(
          ORIGIN,
        );

        stream.drain();

        expect(
          stream.memoryEstimate()
            .totalBytes,
        ).toBeLessThanOrEqual(
          1,
        );

        expect(
          stream.getSector(
            ORIGIN,
          ),
        ).toBeNull();

        expect(
          stream.metrics
            .sectorEvictions,
        ).toBeGreaterThanOrEqual(
          1,
        );
      },
    );


    it(
      "does not evict pinned data just to satisfy memory estimates",
      () => {
        const {
          stream,
        } =
          createTestStream({
            estimatedMemoryBudgetBytes:
              1,
          });

        const release =
          stream.pinSector(
            ORIGIN,
          );

        stream.drain();

        expect(
          stream.getSector(
            ORIGIN,
          ),
        ).not.toBeNull();

        expect(
          stream.memoryEstimate()
            .totalBytes,
        ).toBeGreaterThan(
          1,
        );

        release();
      },
    );
  },
);


describe(
  "loaded world queries",
  () => {
    it(
      "returns nearby loaded sectors nearest first",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            maximumResidentSectors:
              16,
          });

        const zero = {
          x: 0,
          y: 0,
          z: 0,
        };

        const one = {
          x: 1,
          y: 0,
          z: 0,
        };

        const two = {
          x: 2,
          y: 0,
          z: 0,
        };

        stream.requestSector(
          two,
        );

        stream.requestSector(
          zero,
        );

        stream.requestSector(
          one,
        );

        stream.drain();

        const nearby =
          stream.nearbyLoadedSectors(
            sectorPosition(
              generator,
              zero,
            ),
            2,
          );

        expect(
          nearby,
        ).toHaveLength(
          3,
        );

        expect(
          nearby[0]
            ?.coordinate,
        ).toEqual(
          zero,
        );

        expect(
          nearby[2]
            ?.coordinate,
        ).toEqual(
          two,
        );
      },
    );


    it(
      "returns all loaded systems",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream();

        const galaxy =
          generator.galaxy(
            ORIGIN,
            0,
          );

        stream.requestSystem(
          galaxy,
          0,
        );

        stream.requestSystem(
          galaxy,
          1,
        );

        stream.requestSystem(
          galaxy,
          2,
        );

        stream.drain();

        expect(
          stream.loadedSystems(),
        ).toHaveLength(
          3,
        );
      },
    );


    it(
      "returns galaxies from loaded sectors",
      () => {
        const {
          stream,
        } =
          createTestStream();

        stream.requestSector(
          ORIGIN,
        );

        stream.drain();

        const sector =
          stream.getSector(
            ORIGIN,
          );

        expect(
          sector,
        ).not.toBeNull();

        expect(
          stream.loadedGalaxies()
            .length,
        ).toBe(
          sector?.galaxies
            .length ??
          0,
        );
      },
    );
  },
);


describe(
  "world stream events",
  () => {
    it(
      "emits sector-ready events",
      () => {
        const {
          stream,
        } =
          createTestStream();

        const events:
          WorldStreamEvent[] = [];

        stream.subscribe(
          event => {
            events.push(
              event,
            );
          },
        );

        stream.requestSector(
          ORIGIN,
        );

        stream.drain();

        expect(
          events.some(
            event =>
              event.type ===
              "sector-ready",
          ),
        ).toBe(
          true,
        );
      },
    );


    it(
      "emits system-ready events",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream();

        const events:
          WorldStreamEvent[] = [];

        stream.subscribe(
          event => {
            events.push(
              event,
            );
          },
        );

        const galaxy =
          generator.galaxy(
            ORIGIN,
            0,
          );

        stream.requestSystem(
          galaxy,
          0,
        );

        stream.drain();

        expect(
          events.some(
            event =>
              event.type ===
              "system-ready",
          ),
        ).toBe(
          true,
        );
      },
    );


    it(
      "stops delivering events after unsubscribe",
      () => {
        const {
          stream,
        } =
          createTestStream();

        let count =
          0;

        const unsubscribe =
          stream.subscribe(
            () => {
              count++;
            },
          );

        stream.requestSector(
          ORIGIN,
        );

        stream.drain();

        expect(
          count,
        ).toBeGreaterThan(
          0,
        );

        const before =
          count;

        unsubscribe();

        stream.requestSector({
          x: 1,
          y: 0,
          z: 0,
        });

        stream.drain();

        expect(
          count,
        ).toBe(
          before,
        );
      },
    );
  },
);


class FailingSectorGenerator
  extends ProceduralUniverseGenerator {
  override sector(
    coordinate:
      SectorCoordinate,
  ):
    ProceduralSector {
    void coordinate;

    throw new Error(
      "planned sector failure",
    );
  }
}


describe(
  "stream failure handling",
  () => {
    it(
      "retries failed generation only up to the configured limit",
      () => {
        const generator =
          new FailingSectorGenerator(
            "FAILURE TEST",
          );

        const stream =
          new WorldStreamManager(
            generator,
            {
              maximumRetryCount:
                2,
            },
          );

        stream.requestSector(
          ORIGIN,
        );

        const result =
          stream.drain();

        expect(
          result.failed,
        ).toBe(
          3,
        );

        expect(
          stream.metrics
            .generationErrors,
        ).toBe(
          3,
        );

        expect(
          stream.hasPendingWork,
        ).toBe(
          false,
        );

        const view =
          stream.getSectorView(
            ORIGIN,
          );

        expect(
          view?.state,
        ).toBe(
          "failed",
        );

        expect(
          view?.retryCount,
        ).toBe(
          3,
        );
      },
    );


    it(
      "emits generation-error events",
      () => {
        const generator =
          new FailingSectorGenerator(
            "ERROR EVENT",
          );

        const stream =
          new WorldStreamManager(
            generator,
            {
              maximumRetryCount:
                0,
            },
          );

        const events:
          WorldStreamEvent[] = [];

        stream.subscribe(
          event => {
            events.push(
              event,
            );
          },
        );

        stream.requestSector(
          ORIGIN,
        );

        stream.drain();

        const error =
          events.find(
            event =>
              event.type ===
              "generation-error",
          );

        expect(
          error,
        ).toBeDefined();

        if (
          !error ||
          error.type !==
            "generation-error"
        ) {
          return;
        }

        expect(
          error.layer,
        ).toBe(
          "sector",
        );

        expect(
          error.message,
        ).toContain(
          "planned sector failure",
        );
      },
    );
  },
);


describe(
  "world stream snapshots",
  () => {
    it(
      "reports current observer and sector state",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              0,

            retainRadiusSectors:
              0,

            galaxyDetailRadiusSectors:
              0,

            prefetchRadiusSectors:
              0,
          });

        const position =
          sectorPosition(
            generator,
            {
              x: 4,
              y: -2,
              z: 9,
            },
          );

        stream.updateObserver(
          {
            positionLy:
              position,
          },
          1,
        );

        const snapshot =
          stream.snapshot();

        expect(
          snapshot.currentSector,
        ).toEqual({
          x: 4,
          y: -2,
          z: 9,
        });

        expect(
          snapshot.observer
            ?.positionLy,
        ).toEqual(
          position,
        );

        expect(
          snapshot.memory
            .readySectors,
        ).toBe(
          1,
        );
      },
    );


    it(
      "resets metrics without deleting cached data",
      () => {
        const {
          stream,
        } =
          createTestStream();

        stream.requestSector(
          ORIGIN,
        );

        stream.drain();

        expect(
          stream.metrics
            .generatedSectors,
        ).toBe(
          1,
        );

        stream.resetMetrics();

        expect(
          stream.metrics
            .generatedSectors,
        ).toBe(
          0,
        );

        expect(
          stream.getSector(
            ORIGIN,
          ),
        ).not.toBeNull();
      },
    );


    it(
      "clear removes queues caches observer and metrics",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream();

        stream.planObserver({
          positionLy:
            sectorPosition(
              generator,
              ORIGIN,
            ),
        });

        expect(
          stream.queueDepth,
        ).toBeGreaterThan(
          0,
        );

        stream.clear();

        const snapshot =
          stream.snapshot();

        expect(
          snapshot.queueDepth,
        ).toBe(
          0,
        );

        expect(
          snapshot.sectors,
        ).toHaveLength(
          0,
        );

        expect(
          snapshot.systems,
        ).toHaveLength(
          0,
        );

        expect(
          snapshot.observer,
        ).toBeNull();

        expect(
          snapshot.currentSector,
        ).toBeNull();

        expect(
          snapshot.metrics
            .sectorRequests,
        ).toBe(
          0,
        );
      },
    );
  },
);


describe(
  "world stream factory and metadata",
  () => {
    it(
      "creates a stream directly from a universe seed",
      () => {
        const stream =
          createWorldStream(
            "Factory Universe",
            {
              loadRadiusSectors:
                0,

              retainRadiusSectors:
                0,

              galaxyDetailRadiusSectors:
                0,
            },
          );

        expect(
          stream.generator
            .seed
            .input,
        ).toBe(
          "Factory Universe",
        );
      },
    );


    it(
      "reports stream metadata",
      () => {
        const {
          stream,
        } =
          createTestStream(
            {},
            "Information Universe",
          );

        const info =
          worldStreamInfo(
            stream,
          );

        expect(
          info.version,
        ).toBe(
          WORLD_STREAM_VERSION,
        );

        expect(
          info.seed,
        ).toBe(
          "Information Universe",
        );

        expect(
          info.seedKey,
        ).toBe(
          stream.generator
            .seed
            .key,
        );

        expect(
          info.sectorSizeLy,
        ).toBe(
          stream.generator
            .profile
            .sectorSizeLy,
        );

        expect(
          info.queueDepth,
        ).toBe(
          0,
        );
      },
    );


    it(
      "uses deterministic cache keys for loaded sectors",
      () => {
        const {
          stream,
        } =
          createTestStream();

        const coordinate = {
          x: -8,
          y: 4,
          z: 17,
        };

        stream.requestSector(
          coordinate,
        );

        const snapshot =
          stream.snapshot();

        expect(
          snapshot.sectors[0]
            ?.key,
        ).toBe(
          proceduralSectorKey(
            coordinate,
          ),
        );
      },
    );
  },
);


describe(
  "long-distance world streaming",
  () => {
    it(
      "supports observers millions of sectors from the origin",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              0,

            retainRadiusSectors:
              0,

            galaxyDetailRadiusSectors:
              0,

            prefetchRadiusSectors:
              0,
          });

        const coordinate = {
          x:
            2_000_000,

          y:
            -3_000_000,

          z:
            4_000_000,
        };

        const position =
          sectorPosition(
            generator,
            coordinate,
          );

        stream.updateObserver(
          {
            positionLy:
              position,
          },
          1,
        );

        expect(
          stream.currentSector,
        ).toEqual(
          coordinate,
        );

        expect(
          stream.getSector(
            coordinate,
          ),
        ).not.toBeNull();
      },
    );


    it(
      "reloads distant locations deterministically",
      () => {
        const {
          generator,
          stream,
        } =
          createTestStream({
            loadRadiusSectors:
              0,

            retainRadiusSectors:
              0,

            galaxyDetailRadiusSectors:
              0,

            prefetchRadiusSectors:
              0,
          });

        const distant = {
          x:
            500_000,

          y:
            -700_000,

          z:
            900_000,
        };

        stream.requestSector(
          distant,
        );

        stream.drain();

        const original =
          stream.getSector(
            distant,
          );

        stream.planObserver({
          positionLy:
            sectorPosition(
              generator,
              ORIGIN,
            ),
        });

        expect(
          stream.getSector(
            distant,
          ),
        ).toBeNull();

        stream.requestSector(
          distant,
        );

        stream.drain();

        expect(
          stream.getSector(
            distant,
          ),
        ).toEqual(
          original,
        );
      },
    );
  },
);