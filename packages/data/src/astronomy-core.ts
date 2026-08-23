import { convertDistance } from "@known-universe/core";

import type {
  AstroTime,
  DistanceUnit,
  EntityId,
  FrameId,
  SourceId,
  SpaceEntity,
  Vec3,
} from "@known-universe/core";

export const SPEED_OF_LIGHT_M_S = 299_792_458;

export const GRAVITATIONAL_CONSTANT = 6.6743e-11;

export const ASTRONOMICAL_UNIT_M = 149_597_870_700;

export const JULIAN_YEAR_DAYS = 365.25;

export const JULIAN_CENTURY_DAYS = 36_525;

export const J2000_JULIAN_DAY = 2_451_545.0;

export const UNIX_EPOCH_JULIAN_DAY = 2_440_587.5;

export const SECONDS_PER_DAY = 86_400;

export const MILLISECONDS_PER_DAY = 86_400_000;

export const ARCSECONDS_PER_DEGREE = 3_600;

export const MILLIARCSECONDS_PER_DEGREE = 3_600_000;

export const DEGREES_PER_RADIAN = 180 / Math.PI;

export const RADIANS_PER_DEGREE = Math.PI / 180;

export const HOURS_PER_CIRCLE = 24;

export const DEGREES_PER_HOUR = 15;

export const SOLAR_MASS_KG = 1.98847e30;

export const SOLAR_RADIUS_M = 695_700_000;

export const SOLAR_LUMINOSITY_W = 3.828e26;

export const SOLAR_ABSOLUTE_MAGNITUDE_V = 4.83;

export const MU_SUN = 1.32712440018e20;

export const MU_EARTH = 3.986004418e14;

export const MU_MOON = 4.9048695e12;

export const EARTH_MASS_KG = 5.97237e24;

export const EARTH_MEAN_RADIUS_M = 6_371_000;

export const EARTH_EQUATORIAL_RADIUS_M = 6_378_137;

export const EARTH_POLAR_RADIUS_M = 6_356_752.314245;

export const EARTH_ROTATION_RATE_RAD_S = 7.292115e-5;

export const WGS84_SEMI_MAJOR_AXIS_M = 6_378_137;

export const WGS84_INVERSE_FLATTENING = 298.257223563;

export const WGS84_FLATTENING = 1 / WGS84_INVERSE_FLATTENING;

export const WGS84_SEMI_MINOR_AXIS_M =
  WGS84_SEMI_MAJOR_AXIS_M * (1 - WGS84_FLATTENING);

export const WGS84_FIRST_ECCENTRICITY_SQUARED =
  WGS84_FLATTENING * (2 - WGS84_FLATTENING);

export const WGS84_SECOND_ECCENTRICITY_SQUARED =
  (WGS84_SEMI_MAJOR_AXIS_M * WGS84_SEMI_MAJOR_AXIS_M -
    WGS84_SEMI_MINOR_AXIS_M * WGS84_SEMI_MINOR_AXIS_M) /
  (WGS84_SEMI_MINOR_AXIS_M * WGS84_SEMI_MINOR_AXIS_M);

export const FRAME_ICRS = "icrs";

export const FRAME_GALACTIC = "galactic";

export const FRAME_ECLIPTIC_J2000 = "ecliptic:j2000";

export const FRAME_SOLAR_HELIOCENTRIC = "solar-system:heliocentric";

export const FRAME_SOLAR_BARYCENTRIC = "solar-system:barycentric";

export const FRAME_EARTH_GEOCENTRIC = "earth:geocentric";

export const FRAME_EARTH_FIXED = "earth:fixed";

export const FRAME_MOON_GEOCENTRIC = "moon:geocentric";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function square(value: number): number {
  return value * value;
}

export function degreesToRadians(degrees: number): number {
  return degrees * RADIANS_PER_DEGREE;
}

export function radiansToDegrees(radians: number): number {
  return radians * DEGREES_PER_RADIAN;
}

export function hoursToDegrees(hours: number): number {
  return hours * DEGREES_PER_HOUR;
}

export function degreesToHours(degrees: number): number {
  return degrees / DEGREES_PER_HOUR;
}

export function hoursToRadians(hours: number): number {
  return degreesToRadians(hoursToDegrees(hours));
}

export function radiansToHours(radians: number): number {
  return degreesToHours(radiansToDegrees(radians));
}

export function arcsecondsToRadians(arcseconds: number): number {
  return degreesToRadians(arcseconds / ARCSECONDS_PER_DEGREE);
}

export function milliarcsecondsToRadians(milliarcseconds: number): number {
  return degreesToRadians(milliarcseconds / MILLIARCSECONDS_PER_DEGREE);
}

export function radiansToArcseconds(radians: number): number {
  return radiansToDegrees(radians) * ARCSECONDS_PER_DEGREE;
}

export function normalizeDegrees(degrees: number): number {
  let value = degrees % 360;

  if (value < 0) {
    value += 360;
  }

  return value;
}

export function normalizeSignedDegrees(degrees: number): number {
  let value = normalizeDegrees(degrees);

  if (value > 180) {
    value -= 360;
  }

  return value;
}

export function normalizeRadians(radians: number): number {
  const tau = Math.PI * 2;

  let value = radians % tau;

  if (value < 0) {
    value += tau;
  }

  return value;
}

export function normalizeSignedRadians(radians: number): number {
  let value = normalizeRadians(radians);

  if (value > Math.PI) {
    value -= Math.PI * 2;
  }

  return value;
}

export function normalizeHours(hours: number): number {
  let value = hours % HOURS_PER_CIRCLE;

  if (value < 0) {
    value += HOURS_PER_CIRCLE;
  }

  return value;
}

export function angularSeparationRadians(
  longitudeA: number,
  latitudeA: number,
  longitudeB: number,
  latitudeB: number,
): number {
  const deltaLongitude = longitudeB - longitudeA;

  const cosine =
    Math.sin(latitudeA) * Math.sin(latitudeB) +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.cos(deltaLongitude);

  return Math.acos(clamp(cosine, -1, 1));
}

export function angularSeparationDegrees(
  longitudeADeg: number,
  latitudeADeg: number,
  longitudeBDeg: number,
  latitudeBDeg: number,
): number {
  return radiansToDegrees(
    angularSeparationRadians(
      degreesToRadians(longitudeADeg),

      degreesToRadians(latitudeADeg),

      degreesToRadians(longitudeBDeg),

      degreesToRadians(latitudeBDeg),
    ),
  );
}

export interface Vector3Value {
  x: number;
  y: number;
  z: number;
}

export function vector3(x = 0, y = 0, z = 0): Vector3Value {
  return {
    x,
    y,
    z,
  };
}

export function tupleToVector3(value: Vec3): Vector3Value {
  return {
    x: value[0],

    y: value[1],

    z: value[2],
  };
}

export function vector3ToTuple(value: Vector3Value): Vec3 {
  return [value.x, value.y, value.z];
}

export function addVector(a: Vector3Value, b: Vector3Value): Vector3Value {
  return {
    x: a.x + b.x,

    y: a.y + b.y,

    z: a.z + b.z,
  };
}

export function subtractVector(a: Vector3Value, b: Vector3Value): Vector3Value {
  return {
    x: a.x - b.x,

    y: a.y - b.y,

    z: a.z - b.z,
  };
}

export function multiplyVector(
  value: Vector3Value,
  scalar: number,
): Vector3Value {
  return {
    x: value.x * scalar,

    y: value.y * scalar,

    z: value.z * scalar,
  };
}

export function divideVector(
  value: Vector3Value,
  scalar: number,
): Vector3Value {
  if (scalar === 0) {
    throw new Error("Cannot divide a vector by zero.");
  }

  return {
    x: value.x / scalar,

    y: value.y / scalar,

    z: value.z / scalar,
  };
}

export function dotVector(a: Vector3Value, b: Vector3Value): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossVector(a: Vector3Value, b: Vector3Value): Vector3Value {
  return {
    x: a.y * b.z - a.z * b.y,

    y: a.z * b.x - a.x * b.z,

    z: a.x * b.y - a.y * b.x,
  };
}

export function vectorMagnitude(value: Vector3Value): number {
  return Math.sqrt(value.x * value.x + value.y * value.y + value.z * value.z);
}

export function vectorMagnitudeSquared(value: Vector3Value): number {
  return value.x * value.x + value.y * value.y + value.z * value.z;
}

export function normalizeVector(value: Vector3Value): Vector3Value {
  const magnitude = vectorMagnitude(value);

  if (magnitude === 0) {
    return {
      x: 0,
      y: 0,
      z: 0,
    };
  }

  return divideVector(value, magnitude);
}

export function distanceVector(a: Vector3Value, b: Vector3Value): number {
  return vectorMagnitude(subtractVector(a, b));
}

export interface Matrix3 {
  readonly values: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
}

export function matrix3(values: Matrix3["values"]): Matrix3 {
  return {
    values,
  };
}

export const IDENTITY_MATRIX_3: Matrix3 = matrix3([1, 0, 0, 0, 1, 0, 0, 0, 1]);

export function multiplyMatrixVector(
  matrix: Matrix3,
  vector: Vector3Value,
): Vector3Value {
  const m = matrix.values;

  return {
    x: m[0] * vector.x + m[1] * vector.y + m[2] * vector.z,

    y: m[3] * vector.x + m[4] * vector.y + m[5] * vector.z,

    z: m[6] * vector.x + m[7] * vector.y + m[8] * vector.z,
  };
}

export function transposeMatrix3(matrix: Matrix3): Matrix3 {
  const m = matrix.values;

  return matrix3([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
}

export function rotationX(radians: number): Matrix3 {
  const cosine = Math.cos(radians);

  const sine = Math.sin(radians);

  return matrix3([1, 0, 0, 0, cosine, -sine, 0, sine, cosine]);
}

export function rotationY(radians: number): Matrix3 {
  const cosine = Math.cos(radians);

  const sine = Math.sin(radians);

  return matrix3([cosine, 0, sine, 0, 1, 0, -sine, 0, cosine]);
}

export function rotationZ(radians: number): Matrix3 {
  const cosine = Math.cos(radians);

  const sine = Math.sin(radians);

  return matrix3([cosine, -sine, 0, sine, cosine, 0, 0, 0, 1]);
}

export function multiplyMatrix3(a: Matrix3, b: Matrix3): Matrix3 {
  const x = a.values;

  const y = b.values;

  const result: number[] = [];

  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      let value = 0;

      for (let i = 0; i < 3; i++) {
        value += x[row * 3 + i]! * y[i * 3 + column]!;
      }

      result.push(value);
    }
  }

  return matrix3(result as unknown as Matrix3["values"]);
}

export function julianDayFromUnixMilliseconds(milliseconds: number): number {
  return milliseconds / MILLISECONDS_PER_DAY + UNIX_EPOCH_JULIAN_DAY;
}

export function unixMillisecondsFromJulianDay(julianDay: number): number {
  return (julianDay - UNIX_EPOCH_JULIAN_DAY) * MILLISECONDS_PER_DAY;
}

export function dateToJulianDay(date: Date): number {
  return julianDayFromUnixMilliseconds(date.getTime());
}

export function julianDayToDate(julianDay: number): Date {
  return new Date(unixMillisecondsFromJulianDay(julianDay));
}

export function julianYearsBetween(
  startJulianDay: number,
  endJulianDay: number,
): number {
  return (endJulianDay - startJulianDay) / JULIAN_YEAR_DAYS;
}

export function julianCenturiesSinceJ2000(julianDay: number): number {
  return (julianDay - J2000_JULIAN_DAY) / JULIAN_CENTURY_DAYS;
}

export function julianYearToJulianDay(year: number): number {
  return J2000_JULIAN_DAY + (year - 2000) * JULIAN_YEAR_DAYS;
}

export function julianDayToJulianYear(julianDay: number): number {
  return 2000 + (julianDay - J2000_JULIAN_DAY) / JULIAN_YEAR_DAYS;
}

export function makeAstroTime(
  julianDay: number,
  scale: AstroTime["scale"] = "UTC",
): AstroTime {
  return {
    julianDay,
    scale,
  };
}

export function nowAstroTime(): AstroTime {
  return {
    julianDay: dateToJulianDay(new Date()),

    scale: "UTC",
  };
}

export function advanceAstroTime(time: AstroTime, seconds: number): AstroTime {
  return {
    ...time,

    julianDay: time.julianDay + seconds / SECONDS_PER_DAY,
  };
}

export function meanObliquityRadians(julianDay: number): number {
  const t = julianCenturiesSinceJ2000(julianDay);

  const arcseconds =
    84_381.406 -
    46.836769 * t -
    0.0001831 * t * t +
    0.0020034 * t * t * t -
    5.76e-7 * Math.pow(t, 4) -
    4.34e-8 * Math.pow(t, 5);

  return arcsecondsToRadians(arcseconds);
}

export function greenwichMeanSiderealTimeDegrees(julianDay: number): number {
  const t = (julianDay - J2000_JULIAN_DAY) / JULIAN_CENTURY_DAYS;

  const value =
    280.46061837 +
    360.98564736629 * (julianDay - J2000_JULIAN_DAY) +
    0.000387933 * t * t -
    (t * t * t) / 38_710_000;

  return normalizeDegrees(value);
}

export function greenwichMeanSiderealTimeRadians(julianDay: number): number {
  return degreesToRadians(greenwichMeanSiderealTimeDegrees(julianDay));
}

export interface EquatorialCoordinate {
  rightAscensionDeg: number;

  declinationDeg: number;

  distance?: number;

  distanceUnit?: DistanceUnit;
}

export interface EquatorialCoordinateRadians {
  rightAscensionRad: number;

  declinationRad: number;

  distance?: number;

  distanceUnit?: DistanceUnit;
}

export interface GalacticCoordinate {
  longitudeDeg: number;

  latitudeDeg: number;

  distance?: number;

  distanceUnit?: DistanceUnit;
}

export interface EclipticCoordinate {
  longitudeDeg: number;

  latitudeDeg: number;

  distance?: number;

  distanceUnit?: DistanceUnit;
}

export function equatorialDegreesToRadians(
  coordinate: EquatorialCoordinate,
): EquatorialCoordinateRadians {
  const result: EquatorialCoordinateRadians = {
    rightAscensionRad: degreesToRadians(
      normalizeDegrees(coordinate.rightAscensionDeg),
    ),

    declinationRad: degreesToRadians(clamp(coordinate.declinationDeg, -90, 90)),
  };

  if (coordinate.distance !== undefined) {
    result.distance = coordinate.distance;
  }

  if (coordinate.distanceUnit !== undefined) {
    result.distanceUnit = coordinate.distanceUnit;
  }

  return result;
}

export function equatorialRadiansToDegrees(
  coordinate: EquatorialCoordinateRadians,
): EquatorialCoordinate {
  const result: EquatorialCoordinate = {
    rightAscensionDeg: normalizeDegrees(
      radiansToDegrees(coordinate.rightAscensionRad),
    ),

    declinationDeg: clamp(radiansToDegrees(coordinate.declinationRad), -90, 90),
  };

  if (coordinate.distance !== undefined) {
    result.distance = coordinate.distance;
  }

  if (coordinate.distanceUnit !== undefined) {
    result.distanceUnit = coordinate.distanceUnit;
  }

  return result;
}

export function sphericalToCartesian(
  longitudeRad: number,
  latitudeRad: number,
  radius = 1,
): Vector3Value {
  const cosineLatitude = Math.cos(latitudeRad);

  return {
    x: radius * cosineLatitude * Math.cos(longitudeRad),

    y: radius * cosineLatitude * Math.sin(longitudeRad),

    z: radius * Math.sin(latitudeRad),
  };
}

export interface SphericalCoordinate {
  longitudeRad: number;

  latitudeRad: number;

  radius: number;
}

export function cartesianToSpherical(
  vector: Vector3Value,
): SphericalCoordinate {
  const radius = vectorMagnitude(vector);

  if (radius === 0) {
    return {
      longitudeRad: 0,
      latitudeRad: 0,
      radius: 0,
    };
  }

  return {
    longitudeRad: normalizeRadians(Math.atan2(vector.y, vector.x)),

    latitudeRad: Math.asin(clamp(vector.z / radius, -1, 1)),

    radius,
  };
}

export function equatorialToCartesian(
  coordinate: EquatorialCoordinate,
  outputUnit: DistanceUnit = coordinate.distanceUnit ?? "pc",
): Vector3Value {
  const rightAscension = degreesToRadians(coordinate.rightAscensionDeg);

  const declination = degreesToRadians(coordinate.declinationDeg);

  let radius = 1;

  if (coordinate.distance !== undefined) {
    radius = coordinate.distance;

    if (coordinate.distanceUnit && coordinate.distanceUnit !== outputUnit) {
      radius = convertDistance(radius, coordinate.distanceUnit, outputUnit);
    }
  }

  return sphericalToCartesian(rightAscension, declination, radius);
}

export function cartesianToEquatorial(
  vector: Vector3Value,
  distanceUnit: DistanceUnit = "pc",
): EquatorialCoordinate {
  const spherical = cartesianToSpherical(vector);

  return {
    rightAscensionDeg: normalizeDegrees(
      radiansToDegrees(spherical.longitudeRad),
    ),

    declinationDeg: radiansToDegrees(spherical.latitudeRad),

    distance: spherical.radius,

    distanceUnit,
  };
}

export const ICRS_TO_GALACTIC: Matrix3 = matrix3([
  -0.0548755604, -0.8734370902, -0.4838350155,

  0.4941094279, -0.44482963, 0.7469822445,

  -0.867666149, -0.1980763734, 0.4559837762,
]);

export const GALACTIC_TO_ICRS: Matrix3 = transposeMatrix3(ICRS_TO_GALACTIC);

export function equatorialToGalactic(
  coordinate: EquatorialCoordinate,
): GalacticCoordinate {
  const distanceUnit = coordinate.distanceUnit ?? "pc";

  const vector = equatorialToCartesian(coordinate, distanceUnit);

  const galacticVector = multiplyMatrixVector(ICRS_TO_GALACTIC, vector);

  const spherical = cartesianToSpherical(galacticVector);

  const result: GalacticCoordinate = {
    longitudeDeg: normalizeDegrees(radiansToDegrees(spherical.longitudeRad)),

    latitudeDeg: radiansToDegrees(spherical.latitudeRad),
  };

  if (coordinate.distance !== undefined) {
    result.distance = spherical.radius;

    result.distanceUnit = distanceUnit;
  }

  return result;
}

export function galacticToEquatorial(
  coordinate: GalacticCoordinate,
): EquatorialCoordinate {
  const longitude = degreesToRadians(coordinate.longitudeDeg);

  const latitude = degreesToRadians(coordinate.latitudeDeg);

  const distance = coordinate.distance ?? 1;

  const vector = sphericalToCartesian(longitude, latitude, distance);

  const equatorialVector = multiplyMatrixVector(GALACTIC_TO_ICRS, vector);

  const spherical = cartesianToSpherical(equatorialVector);

  const result: EquatorialCoordinate = {
    rightAscensionDeg: normalizeDegrees(
      radiansToDegrees(spherical.longitudeRad),
    ),

    declinationDeg: radiansToDegrees(spherical.latitudeRad),
  };

  if (coordinate.distance !== undefined) {
    result.distance = spherical.radius;

    result.distanceUnit = coordinate.distanceUnit ?? "pc";
  }

  return result;
}

export function eclipticToEquatorial(
  coordinate: EclipticCoordinate,
  julianDay = J2000_JULIAN_DAY,
): EquatorialCoordinate {
  const longitude = degreesToRadians(coordinate.longitudeDeg);

  const latitude = degreesToRadians(coordinate.latitudeDeg);

  const distance = coordinate.distance ?? 1;

  const eclipticVector = sphericalToCartesian(longitude, latitude, distance);

  const obliquity = meanObliquityRadians(julianDay);

  const equatorialVector = multiplyMatrixVector(
    rotationX(obliquity),
    eclipticVector,
  );

  const result = cartesianToEquatorial(
    equatorialVector,
    coordinate.distanceUnit ?? "au",
  );

  if (coordinate.distance === undefined) {
    delete result.distance;
    delete result.distanceUnit;
  }

  return result;
}

export function equatorialToEcliptic(
  coordinate: EquatorialCoordinate,
  julianDay = J2000_JULIAN_DAY,
): EclipticCoordinate {
  const distanceUnit = coordinate.distanceUnit ?? "au";

  const vector = equatorialToCartesian(coordinate, distanceUnit);

  const obliquity = meanObliquityRadians(julianDay);

  const ecliptic = multiplyMatrixVector(rotationX(-obliquity), vector);

  const spherical = cartesianToSpherical(ecliptic);

  const result: EclipticCoordinate = {
    longitudeDeg: normalizeDegrees(radiansToDegrees(spherical.longitudeRad)),

    latitudeDeg: radiansToDegrees(spherical.latitudeRad),
  };

  if (coordinate.distance !== undefined) {
    result.distance = spherical.radius;

    result.distanceUnit = distanceUnit;
  }

  return result;
}

export interface GeodeticCoordinate {
  latitudeDeg: number;

  longitudeDeg: number;

  altitudeM: number;
}

export interface EarthFixedCoordinate {
  xM: number;

  yM: number;

  zM: number;
}

export function geodeticToEarthFixed(
  coordinate: GeodeticCoordinate,
): EarthFixedCoordinate {
  const latitude = degreesToRadians(coordinate.latitudeDeg);

  const longitude = degreesToRadians(coordinate.longitudeDeg);

  const sinLatitude = Math.sin(latitude);

  const cosLatitude = Math.cos(latitude);

  const normalRadius =
    WGS84_SEMI_MAJOR_AXIS_M /
    Math.sqrt(1 - WGS84_FIRST_ECCENTRICITY_SQUARED * sinLatitude * sinLatitude);

  const x =
    (normalRadius + coordinate.altitudeM) * cosLatitude * Math.cos(longitude);

  const y =
    (normalRadius + coordinate.altitudeM) * cosLatitude * Math.sin(longitude);

  const z =
    (normalRadius * (1 - WGS84_FIRST_ECCENTRICITY_SQUARED) +
      coordinate.altitudeM) *
    sinLatitude;

  return {
    xM: x,
    yM: y,
    zM: z,
  };
}

export function earthFixedToGeodetic(
  coordinate: EarthFixedCoordinate,
): GeodeticCoordinate {
  const x = coordinate.xM;

  const y = coordinate.yM;

  const z = coordinate.zM;

  const longitude = Math.atan2(y, x);

  const p = Math.sqrt(x * x + y * y);

  if (p === 0) {
    const latitude = z >= 0 ? Math.PI / 2 : -Math.PI / 2;

    return {
      latitudeDeg: radiansToDegrees(latitude),

      longitudeDeg: 0,

      altitudeM: Math.abs(z) - WGS84_SEMI_MINOR_AXIS_M,
    };
  }

  let latitude = Math.atan2(z, p * (1 - WGS84_FIRST_ECCENTRICITY_SQUARED));

  let altitude = 0;

  for (let iteration = 0; iteration < 12; iteration++) {
    const sinLatitude = Math.sin(latitude);

    const normalRadius =
      WGS84_SEMI_MAJOR_AXIS_M /
      Math.sqrt(
        1 - WGS84_FIRST_ECCENTRICITY_SQUARED * sinLatitude * sinLatitude,
      );

    altitude = p / Math.cos(latitude) - normalRadius;

    const denominator =
      1 -
      (WGS84_FIRST_ECCENTRICITY_SQUARED * normalRadius) /
        (normalRadius + altitude);

    const nextLatitude = Math.atan2(z, p * denominator);

    if (Math.abs(nextLatitude - latitude) < 1e-13) {
      latitude = nextLatitude;

      break;
    }

    latitude = nextLatitude;
  }

  return {
    latitudeDeg: radiansToDegrees(latitude),

    longitudeDeg: normalizeSignedDegrees(radiansToDegrees(longitude)),

    altitudeM: altitude,
  };
}

export function earthFixedToInertial(
  coordinate: EarthFixedCoordinate,
  julianDay: number,
): Vector3Value {
  const angle = greenwichMeanSiderealTimeRadians(julianDay);

  return multiplyMatrixVector(rotationZ(angle), {
    x: coordinate.xM,

    y: coordinate.yM,

    z: coordinate.zM,
  });
}

export function inertialToEarthFixed(
  vector: Vector3Value,
  julianDay: number,
): EarthFixedCoordinate {
  const angle = greenwichMeanSiderealTimeRadians(julianDay);

  const fixed = multiplyMatrixVector(rotationZ(-angle), vector);

  return {
    xM: fixed.x,

    yM: fixed.y,

    zM: fixed.z,
  };
}

export interface EastNorthUpCoordinate {
  eastM: number;

  northM: number;

  upM: number;
}

export function earthFixedToEastNorthUp(
  coordinate: EarthFixedCoordinate,
  observer: GeodeticCoordinate,
): EastNorthUpCoordinate {
  const origin = geodeticToEarthFixed(observer);

  const dx = coordinate.xM - origin.xM;

  const dy = coordinate.yM - origin.yM;

  const dz = coordinate.zM - origin.zM;

  const latitude = degreesToRadians(observer.latitudeDeg);

  const longitude = degreesToRadians(observer.longitudeDeg);

  const sinLatitude = Math.sin(latitude);

  const cosLatitude = Math.cos(latitude);

  const sinLongitude = Math.sin(longitude);

  const cosLongitude = Math.cos(longitude);

  return {
    eastM: -sinLongitude * dx + cosLongitude * dy,

    northM:
      -sinLatitude * cosLongitude * dx -
      sinLatitude * sinLongitude * dy +
      cosLatitude * dz,

    upM:
      cosLatitude * cosLongitude * dx +
      cosLatitude * sinLongitude * dy +
      sinLatitude * dz,
  };
}

export interface HorizontalCoordinate {
  azimuthDeg: number;

  altitudeDeg: number;

  distanceM: number;
}

export function eastNorthUpToHorizontal(
  coordinate: EastNorthUpCoordinate,
): HorizontalCoordinate {
  const distance = Math.sqrt(
    coordinate.eastM * coordinate.eastM +
      coordinate.northM * coordinate.northM +
      coordinate.upM * coordinate.upM,
  );

  if (distance === 0) {
    return {
      azimuthDeg: 0,
      altitudeDeg: 90,
      distanceM: 0,
    };
  }

  const azimuth = Math.atan2(coordinate.eastM, coordinate.northM);

  const altitude = Math.asin(clamp(coordinate.upM / distance, -1, 1));

  return {
    azimuthDeg: normalizeDegrees(radiansToDegrees(azimuth)),

    altitudeDeg: radiansToDegrees(altitude),

    distanceM: distance,
  };
}

export function parallaxMasToParsecs(parallaxMas: number): number | null {
  if (!finitePositive(parallaxMas)) {
    return null;
  }

  return 1_000 / parallaxMas;
}

export function parsecsToParallaxMas(parsecs: number): number | null {
  if (!finitePositive(parsecs)) {
    return null;
  }

  return 1_000 / parsecs;
}

export function distanceModulus(distanceParsecs: number): number {
  if (!finitePositive(distanceParsecs)) {
    return Number.NaN;
  }

  return 5 * Math.log10(distanceParsecs) - 5;
}

export function absoluteMagnitude(
  apparentMagnitude: number,
  distanceParsecs: number,
): number {
  return apparentMagnitude - distanceModulus(distanceParsecs);
}

export function apparentMagnitude(
  absoluteMagnitudeValue: number,
  distanceParsecs: number,
): number {
  return absoluteMagnitudeValue + distanceModulus(distanceParsecs);
}

export function luminosityRatioFromAbsoluteMagnitude(
  absoluteMagnitudeValue: number,
  referenceAbsoluteMagnitude = SOLAR_ABSOLUTE_MAGNITUDE_V,
): number {
  return Math.pow(
    10,
    -0.4 * (absoluteMagnitudeValue - referenceAbsoluteMagnitude),
  );
}

export function absoluteMagnitudeFromLuminosityRatio(
  luminosityRatio: number,
  referenceAbsoluteMagnitude = SOLAR_ABSOLUTE_MAGNITUDE_V,
): number {
  if (!finitePositive(luminosityRatio)) {
    return Number.NaN;
  }

  return referenceAbsoluteMagnitude - 2.5 * Math.log10(luminosityRatio);
}

export function fluxRatioFromMagnitudeDifference(
  magnitudeDifference: number,
): number {
  return Math.pow(10, -0.4 * magnitudeDifference);
}

export function magnitudeDifferenceFromFluxRatio(fluxRatio: number): number {
  if (!finitePositive(fluxRatio)) {
    return Number.NaN;
  }

  return -2.5 * Math.log10(fluxRatio);
}

export function bvColorIndexToApproximateTemperatureK(
  bv: number,
): number | null {
  if (!finite(bv)) {
    return null;
  }

  const first = 1 / (0.92 * bv + 1.7);

  const second = 1 / (0.92 * bv + 0.62);

  const temperature = 4_600 * (first + second);

  if (!finitePositive(temperature)) {
    return null;
  }

  return temperature;
}

export interface DisplayRgb {
  r: number;
  g: number;
  b: number;
}

export function temperatureToDisplayRgb(temperatureK: number): DisplayRgb {
  const temperature = clamp(temperatureK, 1_000, 40_000) / 100;

  let red: number;
  let green: number;
  let blue: number;

  if (temperature <= 66) {
    red = 255;

    green = 99.4708025861 * Math.log(temperature) - 161.1195681661;

    if (temperature <= 19) {
      blue = 0;
    } else {
      blue = 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;
    }
  } else {
    red = 329.698727446 * Math.pow(temperature - 60, -0.1332047592);

    green = 288.1221695283 * Math.pow(temperature - 60, -0.0755148492);

    blue = 255;
  }

  return {
    r: Math.round(clamp(red, 0, 255)),

    g: Math.round(clamp(green, 0, 255)),

    b: Math.round(clamp(blue, 0, 255)),
  };
}

export function bpRpToDisplayRgb(bpRp: number): DisplayRgb {
  const normalized = clamp((bpRp + 0.5) / 4, 0, 1);

  const temperature = 30_000 * Math.pow(1 - normalized, 1.7) + 2_500;

  return temperatureToDisplayRgb(temperature);
}

export interface ProperMotionRecord {
  rightAscensionDeg: number;

  declinationDeg: number;

  epochJulianYear: number;

  properMotionRaMasYr?: number;

  properMotionDecMasYr?: number;

  parallaxMas?: number;

  radialVelocityKmS?: number;
}

export interface PropagatedStarPosition {
  rightAscensionDeg: number;

  declinationDeg: number;

  distanceParsecs?: number;

  epochJulianYear: number;
}

export function propagateProperMotion(
  record: ProperMotionRecord,
  targetJulianYear: number,
): PropagatedStarPosition {
  const years = targetJulianYear - record.epochJulianYear;

  const declinationRadians = degreesToRadians(record.declinationDeg);

  const cosineDeclination = Math.cos(declinationRadians);

  let deltaRaMas = 0;

  if (
    record.properMotionRaMasYr !== undefined &&
    finite(record.properMotionRaMasYr)
  ) {
    if (Math.abs(cosineDeclination) > 1e-10) {
      deltaRaMas = (record.properMotionRaMasYr * years) / cosineDeclination;
    }
  }

  let deltaDecMas = 0;

  if (
    record.properMotionDecMasYr !== undefined &&
    finite(record.properMotionDecMasYr)
  ) {
    deltaDecMas = record.properMotionDecMasYr * years;
  }

  const result: PropagatedStarPosition = {
    rightAscensionDeg: normalizeDegrees(
      record.rightAscensionDeg + deltaRaMas / MILLIARCSECONDS_PER_DEGREE,
    ),

    declinationDeg: clamp(
      record.declinationDeg + deltaDecMas / MILLIARCSECONDS_PER_DEGREE,
      -90,
      90,
    ),

    epochJulianYear: targetJulianYear,
  };

  if (record.parallaxMas !== undefined) {
    const distance = parallaxMasToParsecs(record.parallaxMas);

    if (distance !== null) {
      let adjustedDistance = distance;

      if (
        record.radialVelocityKmS !== undefined &&
        finite(record.radialVelocityKmS)
      ) {
        const radialMeters =
          record.radialVelocityKmS *
          1_000 *
          years *
          JULIAN_YEAR_DAYS *
          SECONDS_PER_DAY;

        const radialParsecs = convertDistance(radialMeters, "m", "pc");

        adjustedDistance = Math.max(0, distance + radialParsecs);
      }

      result.distanceParsecs = adjustedDistance;
    }
  }

  return result;
}

export interface StellarCatalogRecord {
  id: EntityId;

  name?: string;

  rightAscensionDeg: number;

  declinationDeg: number;

  referenceEpoch: number;

  parallaxMas?: number;

  properMotionRaMasYr?: number;

  properMotionDecMasYr?: number;

  radialVelocityKmS?: number;

  apparentMagnitude?: number;

  absoluteMagnitude?: number;

  colorIndexBpRp?: number;

  temperatureK?: number;

  spectralType?: string;

  sourceIds: readonly SourceId[];

  aliases?: readonly string[];
}

export function stellarRecordDistanceParsecs(
  record: StellarCatalogRecord,
): number | null {
  if (record.parallaxMas === undefined) {
    return null;
  }

  return parallaxMasToParsecs(record.parallaxMas);
}

export function stellarRecordAbsoluteMagnitude(
  record: StellarCatalogRecord,
): number | null {
  if (record.absoluteMagnitude !== undefined) {
    return record.absoluteMagnitude;
  }

  if (record.apparentMagnitude === undefined) {
    return null;
  }

  const distance = stellarRecordDistanceParsecs(record);

  if (distance === null) {
    return null;
  }

  return absoluteMagnitude(record.apparentMagnitude, distance);
}

export function stellarRecordPosition(
  record: StellarCatalogRecord,
  epoch = record.referenceEpoch,
): Vec3 | null {
  const distance = stellarRecordDistanceParsecs(record);

  if (distance === null) {
    return null;
  }

  const properMotion: ProperMotionRecord = {
    rightAscensionDeg: record.rightAscensionDeg,

    declinationDeg: record.declinationDeg,

    epochJulianYear: record.referenceEpoch,
  };

  if (record.properMotionRaMasYr !== undefined) {
    properMotion.properMotionRaMasYr = record.properMotionRaMasYr;
  }

  if (record.properMotionDecMasYr !== undefined) {
    properMotion.properMotionDecMasYr = record.properMotionDecMasYr;
  }

  if (record.parallaxMas !== undefined) {
    properMotion.parallaxMas = record.parallaxMas;
  }

  if (record.radialVelocityKmS !== undefined) {
    properMotion.radialVelocityKmS = record.radialVelocityKmS;
  }

  const propagated = propagateProperMotion(properMotion, epoch);

  const vector = equatorialToCartesian(
    {
      rightAscensionDeg: propagated.rightAscensionDeg,

      declinationDeg: propagated.declinationDeg,

      distance: propagated.distanceParsecs ?? distance,

      distanceUnit: "pc",
    },
    "pc",
  );

  return vector3ToTuple(vector);
}

export function stellarRecordToEntity(
  record: StellarCatalogRecord,
): SpaceEntity {
  const entity: SpaceEntity = {
    id: record.id,

    name: record.name ?? record.id,

    kind: "star",

    sourceIds: [...record.sourceIds],
  };

  if (record.aliases) {
    entity.aliases = [...record.aliases];
  }

  const position = stellarRecordPosition(record);

  if (position) {
    entity.spatial = {
      frameId: FRAME_ICRS,

      position,

      unit: "pc",
    };
  }

  const physical: NonNullable<SpaceEntity["physical"]> = {};

  if (
    record.temperatureK !== undefined &&
    finitePositive(record.temperatureK)
  ) {
    physical.temperatureK = {
      value: record.temperatureK,

      evidence: "estimated",

      sourceIds: [...record.sourceIds],
    };
  }

  if (Object.keys(physical).length > 0) {
    entity.physical = physical;
  }

  const tags: string[] = ["stellar-catalog"];

  if (record.spectralType) {
    tags.push(`spectral:${record.spectralType}`);
  }

  if (record.apparentMagnitude !== undefined) {
    tags.push(`gmag:${record.apparentMagnitude}`);
  }

  entity.tags = tags;

  return entity;
}

export interface GaiaLikeRecord {
  source_id: string | number;

  ra: number;

  dec: number;

  ref_epoch?: number;

  parallax?: number;

  pmra?: number;

  pmdec?: number;

  radial_velocity?: number;

  phot_g_mean_mag?: number;

  bp_rp?: number;

  teff_gspphot?: number;

  designation?: string;
}

export function gaiaRecordToStellarRecord(
  record: GaiaLikeRecord,
  sourceId: SourceId = "gaia:dr3",
): StellarCatalogRecord {
  const id = `gaia:${String(record.source_id)}`;

  const result: StellarCatalogRecord = {
    id,

    name: record.designation ?? `Gaia ${String(record.source_id)}`,

    rightAscensionDeg: record.ra,

    declinationDeg: record.dec,

    referenceEpoch: record.ref_epoch ?? 2016,

    sourceIds: [sourceId],
  };

  if (record.parallax !== undefined && finite(record.parallax)) {
    result.parallaxMas = record.parallax;
  }

  if (record.pmra !== undefined && finite(record.pmra)) {
    result.properMotionRaMasYr = record.pmra;
  }

  if (record.pmdec !== undefined && finite(record.pmdec)) {
    result.properMotionDecMasYr = record.pmdec;
  }

  if (record.radial_velocity !== undefined && finite(record.radial_velocity)) {
    result.radialVelocityKmS = record.radial_velocity;
  }

  if (record.phot_g_mean_mag !== undefined && finite(record.phot_g_mean_mag)) {
    result.apparentMagnitude = record.phot_g_mean_mag;
  }

  if (record.bp_rp !== undefined && finite(record.bp_rp)) {
    result.colorIndexBpRp = record.bp_rp;
  }

  if (
    record.teff_gspphot !== undefined &&
    finitePositive(record.teff_gspphot)
  ) {
    result.temperatureK = record.teff_gspphot;
  }

  return result;
}

export function gaiaRecordToEntity(
  record: GaiaLikeRecord,
  sourceId: SourceId = "gaia:dr3",
): SpaceEntity {
  return stellarRecordToEntity(gaiaRecordToStellarRecord(record, sourceId));
}

export interface StateVector {
  positionM: Vec3;

  velocityMS: Vec3;

  frameId: FrameId;

  julianDay: number;
}

export function stateVectorDistance(state: StateVector): number {
  return vectorMagnitude(tupleToVector3(state.positionM));
}

export function stateVectorSpeed(state: StateVector): number {
  return vectorMagnitude(tupleToVector3(state.velocityMS));
}

export function translateStateVector(
  state: StateVector,
  origin: StateVector,
  outputFrameId: FrameId,
): StateVector {
  return {
    positionM: vector3ToTuple(
      subtractVector(
        tupleToVector3(state.positionM),

        tupleToVector3(origin.positionM),
      ),
    ),

    velocityMS: vector3ToTuple(
      subtractVector(
        tupleToVector3(state.velocityMS),

        tupleToVector3(origin.velocityMS),
      ),
    ),

    frameId: outputFrameId,

    julianDay: state.julianDay,
  };
}

export interface ClassicalOrbitalElements {
  semiMajorAxisM: number;

  eccentricity: number;

  inclinationRad: number;

  longitudeAscendingNodeRad: number;

  argumentPeriapsisRad: number;

  meanAnomalyRad: number;

  epochJulianDay: number;

  gravitationalParameter: number;
}

export interface KeplerSolution {
  eccentricAnomalyRad: number;

  iterations: number;

  converged: boolean;
}

export function solveEllipticKeplerEquation(
  meanAnomalyRad: number,
  eccentricity: number,
  tolerance = 1e-13,
  maximumIterations = 40,
): KeplerSolution {
  if (!finite(meanAnomalyRad)) {
    throw new Error("Mean anomaly must be finite.");
  }

  if (!finite(eccentricity) || eccentricity < 0 || eccentricity >= 1) {
    throw new Error("Elliptic Kepler solver requires eccentricity in [0, 1).");
  }

  const meanAnomaly = normalizeSignedRadians(meanAnomalyRad);

  let eccentricAnomaly = eccentricity < 0.8 ? meanAnomaly : Math.PI;

  for (let iteration = 1; iteration <= maximumIterations; iteration++) {
    const functionValue =
      eccentricAnomaly -
      eccentricity * Math.sin(eccentricAnomaly) -
      meanAnomaly;

    const derivative = 1 - eccentricity * Math.cos(eccentricAnomaly);

    if (Math.abs(derivative) < 1e-15) {
      break;
    }

    const correction = functionValue / derivative;

    eccentricAnomaly -= correction;

    if (Math.abs(correction) <= tolerance) {
      return {
        eccentricAnomalyRad: normalizeRadians(eccentricAnomaly),

        iterations: iteration,

        converged: true,
      };
    }
  }

  return {
    eccentricAnomalyRad: normalizeRadians(eccentricAnomaly),

    iterations: maximumIterations,

    converged: false,
  };
}

export function orbitalMeanMotionRadiansPerSecond(
  semiMajorAxisM: number,
  gravitationalParameter: number,
): number {
  if (
    !finitePositive(semiMajorAxisM) ||
    !finitePositive(gravitationalParameter)
  ) {
    return Number.NaN;
  }

  return Math.sqrt(gravitationalParameter / Math.pow(semiMajorAxisM, 3));
}

export function orbitalPeriodSeconds(
  semiMajorAxisM: number,
  gravitationalParameter: number,
): number {
  const meanMotion = orbitalMeanMotionRadiansPerSecond(
    semiMajorAxisM,
    gravitationalParameter,
  );

  if (!finitePositive(meanMotion)) {
    return Number.NaN;
  }

  return (Math.PI * 2) / meanMotion;
}

export function propagateMeanAnomaly(
  elements: ClassicalOrbitalElements,
  julianDay: number,
): number {
  const seconds = (julianDay - elements.epochJulianDay) * SECONDS_PER_DAY;

  const meanMotion = orbitalMeanMotionRadiansPerSecond(
    elements.semiMajorAxisM,
    elements.gravitationalParameter,
  );

  return normalizeRadians(elements.meanAnomalyRad + meanMotion * seconds);
}

export function orbitalRotationMatrix(
  longitudeAscendingNodeRad: number,
  inclinationRad: number,
  argumentPeriapsisRad: number,
): Matrix3 {
  return multiplyMatrix3(
    multiplyMatrix3(
      rotationZ(longitudeAscendingNodeRad),

      rotationX(inclinationRad),
    ),

    rotationZ(argumentPeriapsisRad),
  );
}

export function orbitalElementsToStateVector(
  elements: ClassicalOrbitalElements,
  julianDay: number,
  frameId: FrameId,
): StateVector {
  const meanAnomaly = propagateMeanAnomaly(elements, julianDay);

  const solution = solveEllipticKeplerEquation(
    meanAnomaly,
    elements.eccentricity,
  );

  const eccentricAnomaly = solution.eccentricAnomalyRad;

  const eccentricity = elements.eccentricity;

  const semiMajorAxis = elements.semiMajorAxisM;

  const sqrtOneMinusESquared = Math.sqrt(1 - eccentricity * eccentricity);

  const x = semiMajorAxis * (Math.cos(eccentricAnomaly) - eccentricity);

  const y = semiMajorAxis * sqrtOneMinusESquared * Math.sin(eccentricAnomaly);

  const meanMotion = orbitalMeanMotionRadiansPerSecond(
    semiMajorAxis,
    elements.gravitationalParameter,
  );

  const denominator = 1 - eccentricity * Math.cos(eccentricAnomaly);

  const vx =
    (-semiMajorAxis * meanMotion * Math.sin(eccentricAnomaly)) / denominator;

  const vy =
    (semiMajorAxis *
      meanMotion *
      sqrtOneMinusESquared *
      Math.cos(eccentricAnomaly)) /
    denominator;

  const rotation = orbitalRotationMatrix(
    elements.longitudeAscendingNodeRad,

    elements.inclinationRad,

    elements.argumentPeriapsisRad,
  );

  const position = multiplyMatrixVector(rotation, {
    x,
    y,
    z: 0,
  });

  const velocity = multiplyMatrixVector(rotation, {
    x: vx,
    y: vy,
    z: 0,
  });

  return {
    positionM: vector3ToTuple(position),

    velocityMS: vector3ToTuple(velocity),

    frameId,

    julianDay,
  };
}

export function trueAnomalyFromEccentricAnomaly(
  eccentricAnomalyRad: number,
  eccentricity: number,
): number {
  const numerator =
    Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomalyRad / 2);

  const denominator =
    Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomalyRad / 2);

  return normalizeRadians(2 * Math.atan2(numerator, denominator));
}

export function orbitalRadiusAtEccentricAnomaly(
  semiMajorAxisM: number,
  eccentricity: number,
  eccentricAnomalyRad: number,
): number {
  return semiMajorAxisM * (1 - eccentricity * Math.cos(eccentricAnomalyRad));
}

export interface OrbitSample {
  positionM: Vec3;

  anomalyRad: number;
}

export function sampleEllipticOrbit(
  elements: ClassicalOrbitalElements,
  samples = 180,
): OrbitSample[] {
  const count = Math.max(8, Math.floor(samples));

  const rotation = orbitalRotationMatrix(
    elements.longitudeAscendingNodeRad,

    elements.inclinationRad,

    elements.argumentPeriapsisRad,
  );

  const output: OrbitSample[] = [];

  for (let i = 0; i <= count; i++) {
    const eccentricAnomaly = (i / count) * Math.PI * 2;

    const x =
      elements.semiMajorAxisM *
      (Math.cos(eccentricAnomaly) - elements.eccentricity);

    const y =
      elements.semiMajorAxisM *
      Math.sqrt(1 - elements.eccentricity * elements.eccentricity) *
      Math.sin(eccentricAnomaly);

    const position = multiplyMatrixVector(rotation, {
      x,
      y,
      z: 0,
    });

    output.push({
      positionM: vector3ToTuple(position),

      anomalyRad: eccentricAnomaly,
    });
  }

  return output;
}

export interface SecularElementValue {
  base: number;

  ratePerCentury: number;
}

export interface SecularOrbitalModel {
  id: string;

  parentId: EntityId;

  semiMajorAxisAu: SecularElementValue;

  eccentricity: SecularElementValue;

  inclinationDeg: SecularElementValue;

  meanLongitudeDeg: SecularElementValue;

  longitudePerihelionDeg: SecularElementValue;

  longitudeAscendingNodeDeg: SecularElementValue;

  gravitationalParameter: number;

  sourceIds: readonly SourceId[];
}

export function secularValueAt(
  value: SecularElementValue,
  centuries: number,
): number {
  return value.base + value.ratePerCentury * centuries;
}

export function evaluateSecularOrbitalModel(
  model: SecularOrbitalModel,
  julianDay: number,
): ClassicalOrbitalElements {
  const centuries = julianCenturiesSinceJ2000(julianDay);

  const semiMajorAxisAu = secularValueAt(model.semiMajorAxisAu, centuries);

  const eccentricity = secularValueAt(model.eccentricity, centuries);

  const inclinationDeg = secularValueAt(model.inclinationDeg, centuries);

  const meanLongitudeDeg = secularValueAt(model.meanLongitudeDeg, centuries);

  const longitudePerihelionDeg = secularValueAt(
    model.longitudePerihelionDeg,
    centuries,
  );

  const longitudeAscendingNodeDeg = secularValueAt(
    model.longitudeAscendingNodeDeg,
    centuries,
  );

  const argumentPeriapsisDeg = normalizeSignedDegrees(
    longitudePerihelionDeg - longitudeAscendingNodeDeg,
  );

  const meanAnomalyDeg = normalizeDegrees(
    meanLongitudeDeg - longitudePerihelionDeg,
  );

  return {
    semiMajorAxisM: semiMajorAxisAu * ASTRONOMICAL_UNIT_M,

    eccentricity: clamp(eccentricity, 0, 0.999999999),

    inclinationRad: degreesToRadians(inclinationDeg),

    longitudeAscendingNodeRad: degreesToRadians(longitudeAscendingNodeDeg),

    argumentPeriapsisRad: degreesToRadians(argumentPeriapsisDeg),

    meanAnomalyRad: degreesToRadians(meanAnomalyDeg),

    epochJulianDay: julianDay,

    gravitationalParameter: model.gravitationalParameter,
  };
}
