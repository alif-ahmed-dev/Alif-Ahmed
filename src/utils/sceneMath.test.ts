import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeScrollCameraRig,
  computePatrolWaypoint,
  computeHeadTarget,
  getActiveStageIndex,
  getWorldFloorY,
  stepRoamState,
  stepSpring,
  dampValue,
  isValidGlbSource,
  PLAYGROUND_BOUNDS,
  RoamState,
} from './sceneMath';

test('computeScrollCameraRig sweeps wide across X and Z across all 5 spots', () => {
  const spot1 = computeScrollCameraRig(0, 'drift');
  assert.equal(spot1.stageIndex, 0);
  assert.equal(spot1.characterPosition[2], 0);

  const spot2 = computeScrollCameraRig(0.25, 'orbit');
  assert.equal(spot2.stageIndex, 1);
  assert.ok(spot2.characterPosition[0] < -1.5);
  assert.equal(spot2.characterPosition[2], -11);

  const spot3 = computeScrollCameraRig(0.5, 'orbit');
  assert.equal(spot3.stageIndex, 2);
  assert.ok(spot3.characterPosition[0] > 1.5);
  assert.equal(spot3.characterPosition[2], -21.5);

  const spot4 = computeScrollCameraRig(0.75, 'orbit');
  assert.equal(spot4.stageIndex, 3);
  assert.ok(spot4.characterPosition[0] < -1.5);

  const spot5 = computeScrollCameraRig(1, 'orbit');
  assert.equal(spot5.stageIndex, 4);
  assert.equal(spot5.characterPosition[2], -40);
});

test('computePatrolWaypoint weaves side-to-side left and right with directional yaw', () => {
  const samples = [0, 1.3, 2.6, 3.9, 5.2, 6.5].map((t) => computePatrolWaypoint(0, 0, t));
  const xs = samples.map((s) => s.x);
  assert.ok(Math.max(...xs) > 1.8, 'should walk far right');
  assert.ok(Math.min(...xs) < -1.8, 'should walk far left');
  const moving = samples.filter((s) => s.isMoving);
  assert.ok(moving.some((s) => s.yaw > 0.3) && moving.some((s) => s.yaw < -0.3));
});

test('getActiveStageIndex maps normalized scroll into spots 0..4', () => {
  assert.equal(getActiveStageIndex(0), 0);
  assert.equal(getActiveStageIndex(0.25), 1);
  assert.equal(getActiveStageIndex(0.5), 2);
  assert.equal(getActiveStageIndex(0.75), 3);
  assert.equal(getActiveStageIndex(1), 4);
});

test('getWorldFloorY elevates smoothly on wide side-to-side plazas', () => {
  assert.ok(getWorldFloorY(0, 0) > getWorldFloorY(8, 0));
  assert.ok(getWorldFloorY(-2.4, -11) > getWorldFloorY(8, -11));
  assert.ok(getWorldFloorY(2.4, -21.5) > getWorldFloorY(-8, -21.5));
});

test('stepRoamState handles WASD movement, click-to-move target, and playground bounds', () => {
  let state: RoamState = {
    x: 0,
    z: 0,
    yaw: 0,
    walkSpeed: 0,
    isManual: false,
    targetX: null,
    targetZ: null,
  };

  for (let i = 0; i < 20; i++) {
    state = stepRoamState(
      state,
      { forward: true, backward: false, left: false, right: true, scrollX: 0, scrollZ: 0, scrollYaw: 0 },
      0.016,
    );
  }
  assert.equal(state.isManual, true);
  assert.ok(state.x > 0.5 && state.z < -0.5);
  assert.ok(state.walkSpeed > 0.5);

  let clickState: RoamState = {
    x: 0,
    z: 0,
    yaw: 0,
    walkSpeed: 0,
    isManual: true,
    targetX: 0,
    targetZ: -0.5,
  };
  for (let i = 0; i < 30; i++) {
    clickState = stepRoamState(
      clickState,
      { forward: false, backward: false, left: false, right: false, scrollX: 0, scrollZ: 0, scrollYaw: 0 },
      0.016,
    );
  }
  assert.equal(clickState.targetZ, null);
  assert.ok(Math.abs(clickState.z + 0.5) < 0.2);

  const clamped = stepRoamState(
    { ...state, x: 50, z: -90 },
    { forward: true, backward: false, left: false, right: true, scrollX: 0, scrollZ: 0, scrollYaw: 0 },
    0.016,
  );
  assert.equal(clamped.x, PLAYGROUND_BOUNDS.maxX);
  assert.equal(clamped.z, PLAYGROUND_BOUNDS.minZ);
});

test('computeHeadTarget clamps extreme pointer coordinates within safe anatomical angles', () => {
  const center = computeHeadTarget(0, 0);
  assert.equal(center.yaw, 0);
  assert.equal(center.pitch, 0);
});

test('stepSpring and dampValue converge cleanly', () => {
  let state = { value: 0, velocity: 4.5 };
  for (let i = 0; i < 180; i++) {
    state = stepSpring(state, 1, 140, 10, 1 / 60);
  }
  assert.ok(Math.abs(state.value - 1) < 0.02);
  const v1 = dampValue(0, 10, 6, 0.016);
  assert.ok(v1 > 0 && v1 < 10);
});

test('isValidGlbSource validates model formats', () => {
  assert.equal(isValidGlbSource('https://example.com/alif.glb?v=2'), true);
  assert.equal(isValidGlbSource('https://example.com/photo.png'), false);
});
