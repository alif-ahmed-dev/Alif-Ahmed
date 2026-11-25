import React, { Component, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ThemePalette } from '../config/ThemeConfig';
import {
  CameraMode,
  RoamState,
  computePatrolWaypoint,
  computeScrollCameraRig,
  dampValue,
  getWorldFloorY,
  lerp,
  stepRoamState,
} from '../utils/sceneMath';
import { CharacterAvatar } from './CharacterAvatar';
import { FloatingProps } from './FloatingProps';
import { PlaygroundWorld } from './PlaygroundWorld';

interface RoamKeys {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

interface SceneProps {
  theme: ThemePalette;
  cameraMode: CameraMode;
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
  scrollRef: React.MutableRefObject<number>;
  resetRoamNonce: number;
  impulseCount: number;
  glbUrl: string | null;
  isSoftwareGl: boolean;
  hasWebGL: boolean;
  onSceneClick: () => void;
  onGroundMove: () => void;
  onPropHover: () => void;
  onGlbStatusChange: (status: 'procedural' | 'loading' | 'loaded' | 'error') => void;
  onRoamSnapshot?: (x: number, z: number, isManual: boolean) => void;
}

class SceneErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function StudioEnvironment({ intensity }: { intensity: number }) {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    return () => {
      if (scene.environment === envTarget.texture) {
        scene.environment = null;
      }
      envTarget.dispose();
    };
  }, [gl, scene]);

  useEffect(() => {
    scene.environmentIntensity = intensity;
  }, [scene, intensity]);

  return null;
}

function SoftwareGlPacer({ enabled }: { enabled: boolean }) {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timerId = 0;

    const scheduleNext = () => {
      if (!active) return;
      const context = gl.getContext() as WebGL2RenderingContext | null;
      if (context && typeof context.fenceSync === 'function') {
        const sync = context.fenceSync(context.SYNC_GPU_COMMANDS_COMPLETE, 0);
        context.flush();
        const poll = () => {
          if (!active) {
            if (sync) context.deleteSync(sync);
            return;
          }
          const status = sync
            ? context.getSyncParameter(sync, context.SYNC_STATUS)
            : context.SIGNALED;
          if (status === context.UNSIGNALED) {
            timerId = window.setTimeout(poll, 8);
          } else {
            if (sync) context.deleteSync(sync);
            timerId = window.setTimeout(() => {
              if (active) {
                invalidate();
                scheduleNext();
              }
            }, 80);
          }
        };
        timerId = window.setTimeout(poll, 8);
      } else {
        timerId = window.setTimeout(() => {
          if (active) {
            invalidate();
            scheduleNext();
          }
        }, 90);
      }
    };

    invalidate();
    scheduleNext();

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [enabled, gl, invalidate]);

  return null;
}

const _lookAtTarget = new THREE.Vector3();
const _chromaticOffset = new THREE.Vector2(0.00055, 0.00055);

function CameraRigController({
  cameraMode,
  pointerRef,
  scrollRef,
  roamStateRef,
  keysRef,
  resetRoamNonce,
  impulseCount,
  isSoftwareGl,
  onRoamSnapshot,
}: {
  cameraMode: CameraMode;
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
  scrollRef: React.MutableRefObject<number>;
  roamStateRef: React.MutableRefObject<RoamState>;
  keysRef: React.MutableRefObject<RoamKeys>;
  resetRoamNonce: number;
  impulseCount: number;
  isSoftwareGl: boolean;
  onRoamSnapshot?: (x: number, z: number, isManual: boolean) => void;
}) {
  const { camera, size } = useThree();
  const controlsRef = useRef<any>(null);
  const isOrbitDraggingRef = useRef(false);
  const patrolTimeRef = useRef(0);
  const lastScrollFollowRef = useRef(scrollRef.current);
  const prevScrollForManualRef = useRef(scrollRef.current);
  const prevScrollForVelRef = useRef(scrollRef.current);
  const scrollVelocityRef = useRef(0);
  const kickRef = useRef(0);
  const prevImpulseRef = useRef(impulseCount);
  const lastNotifyRef = useRef({ x: 0, z: 0, isManual: false });

  useEffect(() => {
    if (impulseCount !== prevImpulseRef.current) {
      prevImpulseRef.current = impulseCount;
      kickRef.current = 1;
    }
  }, [impulseCount]);

  useEffect(() => {
    if (resetRoamNonce > 0) {
      roamStateRef.current = {
        ...roamStateRef.current,
        isManual: false,
        targetX: null,
        targetZ: null,
      };
    }
  }, [resetRoamNonce, roamStateRef]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;

    // Smooth scroll velocity for subtle cinematic FOV breath
    const scrollStep = Math.abs(scrollRef.current - prevScrollForVelRef.current);
    prevScrollForVelRef.current = scrollRef.current;
    scrollVelocityRef.current = dampValue(
      scrollVelocityRef.current,
      Math.min(scrollStep / Math.max(dt, 0.008), 2.5),
      7.5,
      dt,
    );

    if (Math.abs(scrollRef.current - prevScrollForManualRef.current) > 0.0025) {
      prevScrollForManualRef.current = scrollRef.current;
      if (roamStateRef.current.isManual) {
        roamStateRef.current.isManual = false;
        roamStateRef.current.targetX = null;
        roamStateRef.current.targetZ = null;
      }
    }

    const rig = computeScrollCameraRig(scrollRef.current, cameraMode);

    if (!roamStateRef.current.isManual) {
      patrolTimeRef.current += dt;
    }

    const patrol = computePatrolWaypoint(
      rig.characterPosition[0],
      rig.characterPosition[2],
      patrolTimeRef.current,
    );

    const prevX = roamStateRef.current.x;
    const prevZ = roamStateRef.current.z;

    const nextRoam = stepRoamState(
      roamStateRef.current,
      {
        forward: keysRef.current.forward,
        backward: keysRef.current.backward,
        left: keysRef.current.left,
        right: keysRef.current.right,
        scrollX: patrol.x,
        scrollZ: patrol.z,
        scrollYaw: patrol.yaw,
        hasPatrolMotion: patrol.isMoving,
      },
      dt,
    );
    roamStateRef.current = nextRoam;

    if (
      onRoamSnapshot &&
      (Math.hypot(nextRoam.x - lastNotifyRef.current.x, nextRoam.z - lastNotifyRef.current.z) > 0.15 ||
        nextRoam.isManual !== lastNotifyRef.current.isManual)
    ) {
      lastNotifyRef.current = { x: nextRoam.x, z: nextRoam.z, isManual: nextRoam.isManual };
      onRoamSnapshot(nextRoam.x, nextRoam.z, nextRoam.isManual);
    }

    const aspect = size.width / Math.max(size.height, 1);
    const portraitBoost = aspect < 1 ? (1 - aspect) * 3.0 : 0;
    const horizontalSpread = aspect < 1 ? 0 : 1;

    if (kickRef.current > 0.001) {
      kickRef.current *= Math.exp(-5.0 * dt);
    } else {
      kickRef.current = 0;
    }

    const floorY = getWorldFloorY(nextRoam.x, nextRoam.z);
    const patrolOffsetX = nextRoam.x - rig.characterPosition[0];
    const patrolOffsetZ = nextRoam.z - rig.characterPosition[2];

    const desiredPosX = nextRoam.isManual
      ? nextRoam.x
      : horizontalSpread
        ? rig.position[0] + patrolOffsetX * 0.34
        : lerp(nextRoam.x, rig.position[0], 0.28);
    const desiredPosY = nextRoam.isManual ? floorY + 1.58 : rig.position[1];
    const desiredPosZ = nextRoam.isManual
      ? nextRoam.z + 5.9
      : rig.position[2] + patrolOffsetZ * 0.25;

    const desiredTargetX = nextRoam.isManual
      ? nextRoam.x
      : horizontalSpread
        ? rig.target[0] + patrolOffsetX * 0.42
        : lerp(nextRoam.x, rig.target[0], 0.32);
    const desiredTargetY = nextRoam.isManual ? floorY + 0.92 : rig.target[1];
    const desiredTargetZ = nextRoam.isManual
      ? nextRoam.z
      : rig.target[2] + patrolOffsetZ * 0.35;

    if (cameraMode === 'drift') {
      const driftAmp = aspect < 1 ? 0.1 : 0.24;
      const driftX =
        (nextRoam.isManual ? 0 : Math.sin(t * 0.45) * driftAmp) +
        pointerRef.current.x * (aspect < 1 ? 0.14 : 0.24);
      const driftY = Math.cos(t * 0.34) * 0.08 + pointerRef.current.y * 0.14;

      camera.position.x = dampValue(camera.position.x, desiredPosX + driftX, 8.0, dt);
      camera.position.y = dampValue(camera.position.y, desiredPosY + driftY - 0.04, 8.0, dt);
      camera.position.z = dampValue(
        camera.position.z,
        desiredPosZ + portraitBoost - kickRef.current * 0.18,
        8.0,
        dt,
      );

      _lookAtTarget.set(
        desiredTargetX + pointerRef.current.x * 0.09,
        desiredTargetY + pointerRef.current.y * 0.06 - 0.04,
        desiredTargetZ,
      );
      camera.lookAt(_lookAtTarget);
    } else if (!isOrbitDraggingRef.current) {
      const stepDx = nextRoam.x - prevX;
      const stepDz = nextRoam.z - prevZ;
      if (nextRoam.isManual && (Math.abs(stepDx) > 0.0001 || Math.abs(stepDz) > 0.0001)) {
        camera.position.x += stepDx;
        camera.position.z += stepDz;
        if (controlsRef.current) {
          controlsRef.current.target.x = nextRoam.x;
          controlsRef.current.target.y = floorY + 0.56;
          controlsRef.current.target.z = nextRoam.z;
          controlsRef.current.update();
        }
      } else {
        const scrollDelta = Math.abs(scrollRef.current - lastScrollFollowRef.current);
        if (scrollDelta > 0.001) {
          camera.position.x = dampValue(camera.position.x, desiredPosX, 5, dt);
          camera.position.y = dampValue(camera.position.y, desiredPosY - 0.04, 5, dt);
          camera.position.z = dampValue(camera.position.z, desiredPosZ + portraitBoost, 5, dt);
          if (controlsRef.current) {
            controlsRef.current.target.x = dampValue(controlsRef.current.target.x, desiredTargetX, 5.5, dt);
            controlsRef.current.target.y = dampValue(controlsRef.current.target.y, desiredTargetY, 5.5, dt);
            controlsRef.current.target.z = dampValue(controlsRef.current.target.z, desiredTargetZ, 5.5, dt);
            controlsRef.current.update();
          }
          if (
            Math.abs(camera.position.x - desiredPosX) < 0.02 &&
            Math.abs(camera.position.z - (desiredPosZ + portraitBoost)) < 0.02
          ) {
            lastScrollFollowRef.current = scrollRef.current;
          }
        }
      }
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      const velocityFov = Math.min(scrollVelocityRef.current * 1.4, 2.4);
      const nextFov = dampValue(camera.fov, rig.fov + kickRef.current * 1.8 + velocityFov, 5.5, dt);
      if (Math.abs(nextFov - camera.fov) > 0.04) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
    }
  });

  if (cameraMode === 'orbit') {
    return (
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableZoom={false}
        target={[0, 0.45, 0]}
        minPolarAngle={Math.PI * 0.16}
        maxPolarAngle={Math.PI * 0.62}
        enableDamping={!isSoftwareGl}
        dampingFactor={0.07}
        rotateSpeed={0.75}
        onStart={() => {
          isOrbitDraggingRef.current = true;
        }}
        onEnd={() => {
          isOrbitDraggingRef.current = false;
        }}
      />
    );
  }

  return null;
}

function ReactiveLightRig({
  theme,
  pointerRef,
  scrollRef,
  roamStateRef,
  isSoftwareGl,
}: {
  theme: ThemePalette;
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
  scrollRef: React.MutableRefObject<number>;
  roamStateRef: React.MutableRefObject<RoamState>;
  isSoftwareGl: boolean;
}) {
  const { scene } = useThree();
  const rigAnchorRef = useRef<THREE.Group>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const cyanRimRef = useRef<THREE.SpotLight>(null);
  const amberRimRef = useRef<THREE.SpotLight>(null);
  const accentLightRef = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const scroll = scrollRef.current;
    const roam = roamStateRef.current;
    const floorY = getWorldFloorY(roam.x, roam.z);
    const charY = floorY + 0.88;
    const scrollBoost = Math.sin(scroll * Math.PI);

    if (rigAnchorRef.current) {
      rigAnchorRef.current.position.x = dampValue(rigAnchorRef.current.position.x, roam.x, 8, dt);
      rigAnchorRef.current.position.y = dampValue(rigAnchorRef.current.position.y, charY, 8, dt);
      rigAnchorRef.current.position.z = dampValue(rigAnchorRef.current.position.z, roam.z, 8, dt);
    }

    if (keyRef.current) {
      keyRef.current.target.position.set(roam.x, charY, roam.z);
      keyRef.current.target.updateMatrixWorld();
    }

    if (cyanRimRef.current) {
      cyanRimRef.current.intensity = dampValue(
        cyanRimRef.current.intensity,
        theme.rimLightIntensity * 6.5 * (1 + scrollBoost * 0.45),
        5.5,
        dt,
      );
      cyanRimRef.current.target.position.set(roam.x, charY + 0.5, roam.z);
      cyanRimRef.current.target.updateMatrixWorld();
    }

    if (amberRimRef.current) {
      amberRimRef.current.intensity = dampValue(
        amberRimRef.current.intensity,
        theme.amberRimIntensity * 5.2 * (1 + scrollBoost * 0.35),
        5.5,
        dt,
      );
      amberRimRef.current.target.position.set(roam.x, charY + 0.4, roam.z);
      amberRimRef.current.target.updateMatrixWorld();
    }

    if (accentLightRef.current) {
      accentLightRef.current.position.x = dampValue(
        accentLightRef.current.position.x,
        pointerRef.current.x * 3.1,
        6,
        dt,
      );
      accentLightRef.current.position.y = dampValue(
        accentLightRef.current.position.y,
        1.15 + pointerRef.current.y * 1.5,
        6,
        dt,
      );
    }

    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = dampValue(
        scene.fog.density,
        theme.fogDensity * (1 - scrollBoost * 0.1),
        5.5,
        dt,
      );
    }
  });

  return (
    <>
      <hemisphereLight
        args={[theme.fillSkyColor, theme.fillGroundColor, theme.fillIntensity]}
      />
      <group ref={rigAnchorRef}>
        <directionalLight
          ref={keyRef}
          position={[4.2, 6.2, 5.2]}
          color={theme.keyLightColor}
          intensity={theme.keyLightIntensity}
          castShadow={!isSoftwareGl}
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0005}
          shadow-normalBias={0.02}
          shadow-camera-near={0.5}
          shadow-camera-far={24}
          shadow-camera-left={-5.5}
          shadow-camera-right={5.5}
          shadow-camera-top={5.5}
          shadow-camera-bottom={-5.5}
        />
        {/* Electric Cyan Back-Left Rim Light */}
        <spotLight
          ref={cyanRimRef}
          position={[-3.8, 3.2, -3.2]}
          angle={0.72}
          penumbra={0.8}
          color={theme.rimLightColor}
          intensity={theme.rimLightIntensity * 6.5}
        />
        {/* Warm Amber Back-Right Kicker Light */}
        <spotLight
          ref={amberRimRef}
          position={[3.8, 2.8, -2.8]}
          angle={0.76}
          penumbra={0.85}
          color={theme.amberRimColor}
          intensity={theme.amberRimIntensity * 5.2}
        />
        {/* Pointer-Reactive Violet/Magenta Accent Light */}
        <pointLight
          ref={accentLightRef}
          position={[0, 1.15, 2.8]}
          color={theme.propColors[2]}
          intensity={2.6}
          distance={13}
          decay={2}
        />
      </group>
    </>
  );
}

export function Scene({
  theme,
  cameraMode,
  pointerRef,
  scrollRef,
  resetRoamNonce,
  impulseCount,
  glbUrl,
  isSoftwareGl,
  hasWebGL,
  onSceneClick,
  onGroundMove,
  onPropHover,
  onGlbStatusChange,
  onRoamSnapshot,
}: SceneProps) {
  const [contextLost, setContextLost] = useState(false);

  const roamStateRef = useRef<RoamState>({
    x: 0,
    z: 0,
    yaw: 0,
    walkSpeed: 0,
    isManual: false,
    targetX: null,
    targetZ: null,
  });

  const keysRef = useRef<RoamKeys>({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  useEffect(() => {
    const updateKey = (code: string, pressed: boolean, e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (code === 'KeyW' || code === 'ArrowUp') {
        if (code === 'ArrowUp') e.preventDefault();
        keysRef.current.forward = pressed;
      } else if (code === 'KeyS' || code === 'ArrowDown') {
        if (code === 'ArrowDown') e.preventDefault();
        keysRef.current.backward = pressed;
      } else if (code === 'KeyA' || code === 'ArrowLeft') {
        if (code === 'ArrowLeft') e.preventDefault();
        keysRef.current.left = pressed;
      } else if (code === 'KeyD' || code === 'ArrowRight') {
        if (code === 'ArrowRight') e.preventDefault();
        keysRef.current.right = pressed;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => updateKey(e.code, true, e);
    const handleKeyUp = (e: KeyboardEvent) => updateKey(e.code, false, e);
    const handleBlur = () => {
      keysRef.current.forward = false;
      keysRef.current.backward = false;
      keysRef.current.left = false;
      keysRef.current.right = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handleGroundClick = useCallback(
    (x: number, z: number) => {
      roamStateRef.current = {
        ...roamStateRef.current,
        isManual: true,
        targetX: x,
        targetZ: z,
      };
      onGroundMove();
    },
    [onGroundMove],
  );

  const fallbackView = (
    <div className="flex h-full w-full items-center justify-center">
      <p
        className="font-display text-3xl font-black tracking-wide uppercase"
        style={{ color: theme.titleColor }}
      >
        ALIF AHMED
      </p>
    </div>
  );

  if (!hasWebGL || contextLost) {
    return fallbackView;
  }

  return (
    <SceneErrorBoundary fallback={fallbackView}>
      <div data-testid="scene-canvas-wrapper" className="h-full w-full">
        <Canvas
          shadows={!isSoftwareGl}
          dpr={isSoftwareGl ? 1 : [1, 2]}
          frameloop={isSoftwareGl ? 'demand' : 'always'}
          camera={{ position: [0.35, 1.35, 6.4], fov: 43, near: 0.1, far: 140 }}
          gl={{
            antialias: !isSoftwareGl,
            alpha: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.15,
          }}
          onPointerMissed={() => onSceneClick()}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.setClearColor(0x000000, 0);
            const canvas = gl.domElement;
            const handleLost = (e: Event) => {
              e.preventDefault();
              setContextLost(true);
            };
            const handleRestored = () => {
              setContextLost(false);
            };
            canvas.addEventListener('webglcontextlost', handleLost, false);
            canvas.addEventListener('webglcontextrestored', handleRestored, false);
          }}
        >
          <fogExp2 attach="fog" args={[theme.fogColor, theme.fogDensity]} />

          <StudioEnvironment intensity={theme.envIntensity} />
          <SoftwareGlPacer enabled={isSoftwareGl} />
          <ReactiveLightRig
            theme={theme}
            pointerRef={pointerRef}
            scrollRef={scrollRef}
            roamStateRef={roamStateRef}
            isSoftwareGl={isSoftwareGl}
          />
          <CameraRigController
            cameraMode={cameraMode}
            pointerRef={pointerRef}
            scrollRef={scrollRef}
            roamStateRef={roamStateRef}
            keysRef={keysRef}
            resetRoamNonce={resetRoamNonce}
            impulseCount={impulseCount}
            isSoftwareGl={isSoftwareGl}
            onRoamSnapshot={onRoamSnapshot}
          />

          <PlaygroundWorld
            theme={theme}
            pointerRef={pointerRef}
            scrollRef={scrollRef}
            roamStateRef={roamStateRef}
            impulseCount={impulseCount}
            isSoftwareGl={isSoftwareGl}
            onGroundClick={handleGroundClick}
            onSnackClick={onSceneClick}
            onPropHover={onPropHover}
          />

          <CharacterAvatar
            theme={theme}
            pointerRef={pointerRef}
            roamStateRef={roamStateRef}
            impulseCount={impulseCount}
            glbUrl={glbUrl}
            isSoftwareGl={isSoftwareGl}
            onAvatarClick={onSceneClick}
            onAvatarHover={onPropHover}
            onGlbStatusChange={onGlbStatusChange}
          />

          <FloatingProps
            theme={theme}
            pointerRef={pointerRef}
            scrollRef={scrollRef}
            impulseCount={impulseCount}
            isSoftwareGl={isSoftwareGl}
            onPropClick={onSceneClick}
            onPropHover={onPropHover}
          />

          {!isSoftwareGl && (
            <EffectComposer multisampling={0}>
              <Bloom
                mipmapBlur
                intensity={theme.bloomIntensity}
                luminanceThreshold={theme.bloomThreshold}
              />
              <ChromaticAberration
                blendFunction={BlendFunction.NORMAL}
                offset={_chromaticOffset}
                radialModulation
                modulationOffset={0.35}
              />
              <Noise opacity={0.025} />
              <Vignette eskil={false} offset={0.26} darkness={0.42} />
            </EffectComposer>
          )}
        </Canvas>
      </div>
    </SceneErrorBoundary>
  );
}
