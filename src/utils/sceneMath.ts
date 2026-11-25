export type CameraMode = 'orbit' | 'drift';

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface CameraRigPose {
  stageIndex: 0 | 1 | 2 | 3 | 4;
  position: [number, number, number];
  target: [number, number, number];
  characterPosition: [number, number, number];
  characterYaw: number;
  fov: number;
  atmosphereShift: number;
  titleOffsetXPercent: number;
  titleTopVh: number;
  titleScale: number;
  titleSkewDeg: number;
  titleRotateDeg: number;
  titleLetterSpacingEm: number;
  bgParallaxX: number;
  bgParallaxY: number;
  bgScale: number;
  bgRotateDeg: number;
}

export interface SpringState {
  value: number;
  velocity: number;
}

export interface RoamState {
  x: number;
  z: number;
  yaw: number;
  walkSpeed: number;
  isManual: boolean;
  targetX: number | null;
  targetZ: number | null;
}

export interface RoamInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  scrollX: number;
  scrollZ: number;
  scrollYaw: number;
  hasPatrolMotion?: boolean;
}

export const STAGE_SCROLL_STOPS: readonly [number, number, number, number, number] = [
  0,
  0.25,
  0.5,
  0.75,
  1,
];

export const PLAYGROUND_BOUNDS = {
  minX: -11.5,
  maxX: 11.5,
  minZ: -44.5,
  maxZ: 5.5,
} as const;

export const SPOT_PLAZAS: ReadonlyArray<{ x: number; z: number; radius: number; lift: number }> = [
  { x: 0, z: 0, radius: 4.2, lift: 0.14 },
  { x: -2.4, z: -11, radius: 3.8, lift: 0.18 },
  { x: 2.4, z: -21.5, radius: 4.1, lift: 0.2 },
  { x: -2.1, z: -31, radius: 3.7, lift: 0.22 },
  { x: 0, z: -40, radius: 4.2, lift: 0.24 },
];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function lerpAngle(a: number, b: number, t: number): number {
  const twoPi = Math.PI * 2;
  const diff = ((((b - a + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
  return a + diff * t;
}

export function getActiveStageIndex(scrollProgress: number): 0 | 1 | 2 | 3 | 4 {
  const p = clamp(scrollProgress, 0, 1);
  if (p < 0.125) return 0;
  if (p < 0.375) return 1;
  if (p < 0.625) return 2;
  if (p < 0.875) return 3;
  return 4;
}

/**
 * Computes ground/terrace elevation Y at world (x, z) so Alif steps smoothly
 * across the wide side-to-side plazas and elevated walkways.
 */
export function getWorldFloorY(x: number, z: number): number {
  const baseFloor = -0.88;
  let maxLift = 0;
  for (let i = 0; i < SPOT_PLAZAS.length; i++) {
    const plaza = SPOT_PLAZAS[i];
    const dist = Math.hypot(x - plaza.x, z - plaza.z);
    if (dist < plaza.radius + 0.65) {
      const factor = 1 - smoothstep(plaza.radius - 0.45, plaza.radius + 0.65, dist);
      maxLift = Math.max(maxLift, plaza.lift * factor);
    }
  }
  return baseFloor + maxLift;
}

interface SpotKeyframe {
  position: [number, number, number];
  target: [number, number, number];
  characterPosition: [number, number, number];
  characterYaw: number;
  fov: number;
  atmosphereShift: number;
  titleOffsetXPercent: number;
  titleTopVh: number;
  titleScale: number;
  titleSkewDeg: number;
  titleRotateDeg: number;
  titleLetterSpacingEm: number;
  bgParallaxX: number;
  bgParallaxY: number;
  bgScale: number;
  bgRotateDeg: number;
}

const SPOT_KEYFRAMES: readonly SpotKeyframe[] = [
  // Spot 1: ALIF AHMED Wide Entrance Promenade (sweeping front perspective)
  {
    position: [0.35, 1.35, 6.4],
    target: [0, 0.55, 0],
    characterPosition: [0, 0, 0],
    characterYaw: 0,
    fov: 43,
    atmosphereShift: 0,
    titleOffsetXPercent: 0,
    titleTopVh: 4,
    titleScale: 1,
    titleSkewDeg: -2,
    titleRotateDeg: -0.6,
    titleLetterSpacingEm: 0.05,
    bgParallaxX: 0,
    bgParallaxY: 0,
    bgScale: 1,
    bgRotateDeg: -2,
  },
  // Spot 2: ROAM Left Terrace & Zig-Zag Arches (camera sweeps from right-front looking left-across)
  {
    position: [2.8, 1.55, -6.2],
    target: [-2.1, 0.58, -11],
    characterPosition: [-2.4, 0, -11],
    characterYaw: 0.42,
    fov: 44,
    atmosphereShift: 0.25,
    titleOffsetXPercent: -26,
    titleTopVh: 16,
    titleScale: 1.04,
    titleSkewDeg: -5,
    titleRotateDeg: -1.8,
    titleLetterSpacingEm: 0.04,
    bgParallaxX: 5,
    bgParallaxY: -3,
    bgScale: 1.06,
    bgRotateDeg: 2.5,
  },
  // Spot 3: EAT & CHILL Right Snack Plaza (camera sweeps across from left looking right!)
  {
    position: [-2.85, 1.65, -16.8],
    target: [2.1, 0.6, -21.5],
    characterPosition: [2.4, 0, -21.5],
    characterYaw: -0.45,
    fov: 44,
    atmosphereShift: 0.5,
    titleOffsetXPercent: 25,
    titleTopVh: 15,
    titleScale: 1.02,
    titleSkewDeg: 4,
    titleRotateDeg: 1.6,
    titleLetterSpacingEm: 0.04,
    bgParallaxX: -5.5,
    bgParallaxY: 2,
    bgScale: 1.08,
    bgRotateDeg: -2.2,
  },
  // Spot 4: CHILL Left Cloud Terrace (low oblique sweep)
  {
    position: [2.4, 1.42, -26.2],
    target: [-1.9, 0.72, -31],
    characterPosition: [-2.1, 0, -31],
    characterYaw: 0.36,
    fov: 46,
    atmosphereShift: 0.75,
    titleOffsetXPercent: -25,
    titleTopVh: 16,
    titleScale: 1.04,
    titleSkewDeg: -4,
    titleRotateDeg: -1.4,
    titleLetterSpacingEm: 0.06,
    bgParallaxX: 4.5,
    bgParallaxY: -2,
    bgScale: 1.05,
    bgRotateDeg: 2.0,
  },
  // Spot 5: DOING NOTHING Open Sky Loop (wide centered horizon sweep)
  {
    position: [0, 1.75, -33.6],
    target: [0, 0.75, -40],
    characterPosition: [0, 0, -40],
    characterYaw: 0,
    fov: 47,
    atmosphereShift: 1.0,
    titleOffsetXPercent: 0,
    titleTopVh: 4.5,
    titleScale: 1.04,
    titleSkewDeg: 0,
    titleRotateDeg: 0,
    titleLetterSpacingEm: 0.08,
    bgParallaxX: 0,
    bgParallaxY: 0,
    bgScale: 1.1,
    bgRotateDeg: 0,
  },
];

export function computeScrollCameraRig(scrollProgress: number, mode: CameraMode): CameraRigPose {
  const p = clamp(scrollProgress, 0, 1);
  const scaled = p * 4;
  const seg = Math.min(3, Math.floor(scaled));
  const localT = smoothstep(0, 1, scaled - seg);

  const a = SPOT_KEYFRAMES[seg];
  const b = SPOT_KEYFRAMES[seg + 1];
  const driftOffset = mode === 'drift' ? Math.sin(p * Math.PI * 2) * 0.06 : 0;

  return {
    stageIndex: getActiveStageIndex(p),
    position: [
      lerp(a.position[0], b.position[0], localT),
      lerp(a.position[1], b.position[1], localT),
      lerp(a.position[2], b.position[2], localT),
    ],
    target: [
      lerp(a.target[0], b.target[0], localT) + driftOffset,
      lerp(a.target[1], b.target[1], localT),
      lerp(a.target[2], b.target[2], localT),
    ],
    characterPosition: [
      lerp(a.characterPosition[0], b.characterPosition[0], localT),
      lerp(a.characterPosition[1], b.characterPosition[1], localT),
      lerp(a.characterPosition[2], b.characterPosition[2], localT),
    ],
    characterYaw: lerp(a.characterYaw, b.characterYaw, localT),
    fov: lerp(a.fov, b.fov, localT),
    atmosphereShift: lerp(a.atmosphereShift, b.atmosphereShift, localT),
    titleOffsetXPercent: lerp(a.titleOffsetXPercent, b.titleOffsetXPercent, localT),
    titleTopVh: lerp(a.titleTopVh, b.titleTopVh, localT),
    titleScale: lerp(a.titleScale, b.titleScale, localT),
    titleSkewDeg: lerp(a.titleSkewDeg, b.titleSkewDeg, localT),
    titleRotateDeg: lerp(a.titleRotateDeg, b.titleRotateDeg, localT),
    titleLetterSpacingEm: lerp(a.titleLetterSpacingEm, b.titleLetterSpacingEm, localT),
    bgParallaxX: lerp(a.bgParallaxX, b.bgParallaxX, localT),
    bgParallaxY: lerp(a.bgParallaxY, b.bgParallaxY, localT),
    bgScale: lerp(a.bgScale, b.bgScale, localT),
    bgRotateDeg: lerp(a.bgRotateDeg, b.bgRotateDeg, localT),
  };
}

/**
 * Computes Alif's continuous side-to-side & figure-8 weave waypoint around the
 * current scroll spot so he walks left-to-right, pauses playfully, turns around,
 * and struts back rather than standing frozen in one spot.
 */
export function computePatrolWaypoint(
  baseX: number,
  baseZ: number,
  patrolTime: number,
): { x: number; z: number; yaw: number; isMoving: boolean } {
  const omega = 0.64;
  const ampX = 2.75;
  const ampZ = 0.42;

  const x = baseX + Math.sin(patrolTime * omega) * ampX;
  const z = baseZ + Math.cos(patrolTime * omega * 2) * ampZ;

  // Instantaneous velocity along the side-to-side crescent stroll
  const vx = Math.cos(patrolTime * omega) * ampX * omega;
  const vz = -Math.sin(patrolTime * omega * 2) * ampZ * omega * 2;

  // Brief playful turn/look pause right at left/right turnarounds
  const isMoving = Math.abs(Math.cos(patrolTime * omega)) > 0.14;
  // Bias forward aim component positive so Alif struts in expressive 3/4 profile left <-> right
  const yaw = isMoving
    ? Math.atan2(vx, Math.max(vz * 0.35 + 0.42, 0.28))
    : Math.sin(patrolTime * omega) > 0
      ? -0.28
      : 0.28;

  return {
    x: clamp(x, PLAYGROUND_BOUNDS.minX, PLAYGROUND_BOUNDS.maxX),
    z: clamp(z, PLAYGROUND_BOUNDS.minZ, PLAYGROUND_BOUNDS.maxZ),
    yaw,
    isMoving,
  };
}

/**
 * Pure kinematic movement step supporting WASD/Arrow roaming, click-to-move
 * ground targets, and continuous side-to-side figure-8 patrol along scroll zones.
 */
export function stepRoamState(state: RoamState, input: RoamInput, dt: number): RoamState {
  const safeDt = clamp(dt, 0.0001, 0.05);
  const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const moveZ = (input.backward ? 1 : 0) - (input.forward ? 1 : 0);
  const hasKeyInput = moveX !== 0 || moveZ !== 0;

  let nextX = state.x;
  let nextZ = state.z;
  let nextYaw = state.yaw;
  let nextWalkSpeed = state.walkSpeed;
  let isManual = state.isManual;
  let targetX = state.targetX;
  let targetZ = state.targetZ;

  const maxWalkSpeed = 4.8;

  if (hasKeyInput) {
    isManual = true;
    targetX = null;
    targetZ = null;
    const len = Math.hypot(moveX, moveZ) || 1;
    const vx = (moveX / len) * maxWalkSpeed;
    const vz = (moveZ / len) * maxWalkSpeed;
    nextX += vx * safeDt;
    nextZ += vz * safeDt;
    const desiredYaw = Math.atan2(vx, vz);
    nextYaw = lerpAngle(nextYaw, desiredYaw, 1 - Math.exp(-12 * safeDt));
    nextWalkSpeed = dampValue(nextWalkSpeed, 1, 12, safeDt);
  } else if (targetX !== null && targetZ !== null) {
    isManual = true;
    const dx = targetX - nextX;
    const dz = targetZ - nextZ;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.14) {
      targetX = null;
      targetZ = null;
      nextWalkSpeed = dampValue(nextWalkSpeed, 0, 10, safeDt);
    } else {
      const stepDist = Math.min(dist, maxWalkSpeed * safeDt);
      nextX += (dx / dist) * stepDist;
      nextZ += (dz / dist) * stepDist;
      const desiredYaw = Math.atan2(dx, dz);
      nextYaw = lerpAngle(nextYaw, desiredYaw, 1 - Math.exp(-12 * safeDt));
      nextWalkSpeed = dampValue(nextWalkSpeed, 1, 12, safeDt);
    }
  } else if (!isManual) {
    const dx = input.scrollX - nextX;
    const dz = input.scrollZ - nextZ;
    const dist = Math.hypot(dx, dz);
    nextX = dampValue(nextX, input.scrollX, 7.5, safeDt);
    nextZ = dampValue(nextZ, input.scrollZ, 7.5, safeDt);
    if (dist > 0.18 || input.hasPatrolMotion) {
      const desiredYaw = dist > 1.25 ? Math.atan2(dx, dz) : input.scrollYaw;
      nextYaw = lerpAngle(nextYaw, desiredYaw, 1 - Math.exp(-13 * safeDt));
      nextWalkSpeed = dampValue(
        nextWalkSpeed,
        clamp(Math.max(dist * 0.65, input.hasPatrolMotion ? 0.72 : 0), 0, 1),
        9,
        safeDt,
      );
    } else {
      nextYaw = lerpAngle(nextYaw, input.scrollYaw, 1 - Math.exp(-10 * safeDt));
      nextWalkSpeed = dampValue(nextWalkSpeed, 0, 10, safeDt);
    }
  } else {
    nextWalkSpeed = dampValue(nextWalkSpeed, 0, 10, safeDt);
  }

  return {
    x: clamp(nextX, PLAYGROUND_BOUNDS.minX, PLAYGROUND_BOUNDS.maxX),
    z: clamp(nextZ, PLAYGROUND_BOUNDS.minZ, PLAYGROUND_BOUNDS.maxZ),
    yaw: nextYaw,
    walkSpeed: nextWalkSpeed,
    isManual,
    targetX,
    targetZ,
  };
}

export function computeHeadTarget(
  pointerX: number,
  pointerY: number,
  maxYaw = 0.48,
  maxPitch = 0.26,
): { yaw: number; pitch: number } {
  const nx = clamp(pointerX, -1, 1);
  const ny = clamp(pointerY, -1, 1);
  return {
    yaw: nx === 0 ? 0 : nx * maxYaw,
    pitch: ny === 0 ? 0 : -ny * maxPitch,
  };
}

export function stepSpring(
  state: SpringState,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): SpringState {
  const safeDt = clamp(dt, 0.0001, 0.05);
  const force = (target - state.value) * stiffness;
  const nextVelocity = (state.velocity + force * safeDt) * Math.exp(-damping * safeDt);
  const nextValue = state.value + nextVelocity * safeDt;
  return {
    value: nextValue,
    velocity: nextVelocity,
  };
}

export function dampValue(current: number, target: number, lambda: number, dt: number): number {
  const safeDt = clamp(dt, 0, 0.1);
  return lerp(current, target, 1 - Math.exp(-lambda * safeDt));
}

export function isValidGlbSource(source: string): boolean {
  const trimmed = source.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('blob:')) return true;
  if (/^data:model\/gltf-binary/i.test(trimmed)) return true;
  const withoutQuery = trimmed.split('?')[0].split('#')[0].toLowerCase();
  return withoutQuery.endsWith('.glb') || withoutQuery.endsWith('.gltf');
}
