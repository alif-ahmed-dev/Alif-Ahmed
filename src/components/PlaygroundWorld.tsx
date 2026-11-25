import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial } from '@react-three/drei';
import { ThemePalette } from '../config/ThemeConfig';
import {
  PLAYGROUND_BOUNDS,
  RoamState,
  SPOT_PLAZAS,
  computeScrollCameraRig,
  getWorldFloorY,
} from '../utils/sceneMath';

interface PlaygroundWorldProps {
  theme: ThemePalette;
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
  scrollRef: React.MutableRefObject<number>;
  roamStateRef: React.MutableRefObject<RoamState>;
  impulseCount: number;
  isSoftwareGl: boolean;
  onGroundClick: (x: number, z: number) => void;
  onSnackClick: () => void;
  onPropHover: () => void;
}

const MOTE_COUNT = 108;
const _dummy = new THREE.Object3D();

const HOPSCOTCH_ARCHES = [
  { x: -1.2, z: -9.2, rotY: 0.35, radius: 1.95 },
  { x: -2.3, z: -10.8, rotY: 0.28, radius: 2.15 },
  { x: -3.2, z: -12.4, rotY: -0.22, radius: 2.05 },
  { x: -1.8, z: -14.2, rotY: -0.4, radius: 1.95 },
  { x: -0.6, z: -15.8, rotY: -0.38, radius: 2.05 },
];

const CHILL_CLOUDS = [
  { pos: [-4.6, 2.55, -29.2] as [number, number, number], scale: 1.05, phase: 0.4 },
  { pos: [1.1, 3.05, -31.8] as [number, number, number], scale: 1.15, phase: 1.6 },
  { pos: [-3.4, 2.85, -37.2] as [number, number, number], scale: 1.1, phase: 2.5 },
  { pos: [3.2, 3.1, -37.6] as [number, number, number], scale: 1.2, phase: 3.6 },
  { pos: [0.0, 3.55, -41.5] as [number, number, number], scale: 1.35, phase: 4.7 },
  { pos: [-2.4, 2.35, -42.0] as [number, number, number], scale: 0.92, phase: 5.5 },
];

const DREAM_BUBBLES = [
  { x: -4.2, y: 0.85, z: -30.5, r: 0.32, speed: 0.58, phase: 0.2 },
  { x: -0.4, y: 1.25, z: -32.2, r: 0.38, speed: 0.5, phase: 1.1 },
  { x: -3.1, y: 0.75, z: -38.0, r: 0.36, speed: 0.55, phase: 0.3 },
  { x: 3.1, y: 1.05, z: -38.3, r: 0.42, speed: 0.48, phase: 1.4 },
  { x: -2.6, y: 1.65, z: -40.5, r: 0.3, speed: 0.62, phase: 2.2 },
  { x: 2.8, y: 1.75, z: -40.8, r: 0.34, speed: 0.52, phase: 3.3 },
  { x: -1.5, y: 2.25, z: -42.2, r: 0.25, speed: 0.68, phase: 4.1 },
  { x: 1.5, y: 2.35, z: -41.9, r: 0.28, speed: 0.58, phase: 5.0 },
  { x: -4.6, y: 1.35, z: -39.6, r: 0.24, speed: 0.72, phase: 1.9 },
  { x: 4.5, y: 1.45, z: -39.7, r: 0.26, speed: 0.64, phase: 2.8 },
];

function createPromenadeRibbonShape(width: number, depth: number, radius: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.min(radius, hw, hd);
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd);
  s.quadraticCurveTo(hw, -hd, hw, -hd + r);
  s.lineTo(hw, hd - r);
  s.quadraticCurveTo(hw, hd, hw - r, hd);
  s.lineTo(-hw + r, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - r);
  s.lineTo(-hw, -hd + r);
  s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return s;
}

export function PlaygroundWorld({
  theme,
  pointerRef,
  roamStateRef,
  impulseCount,
  isSoftwareGl,
  onGroundClick,
  onSnackClick,
  onPropHover,
}: PlaygroundWorldProps) {
  const originArch1Ref = useRef<THREE.Mesh>(null);
  const originArch2Ref = useRef<THREE.Mesh>(null);
  const hopArchRefs = useRef<(THREE.Group | null)[]>([]);
  const pinwheelRefs = useRef<(THREE.Group | null)[]>([]);
  const cloudRefs = useRef<(THREE.Group | null)[]>([]);
  const bubbleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const beamRefs = useRef<(THREE.Mesh | null)[]>([]);
  const targetMarkerRef = useRef<THREE.Group>(null);
  const targetRingInnerRef = useRef<THREE.Mesh>(null);
  const motesRef = useRef<THREE.InstancedMesh>(null);

  // 4 Clickable Snack Props
  const donutRef = useRef<THREE.Group>(null);
  const bobaRef = useRef<THREE.Group>(null);
  const burgerRef = useRef<THREE.Group>(null);
  const coneRef = useRef<THREE.Group>(null);
  const snackBoosts = useRef([0, 0, 0, 0]);
  const snackYVel = useRef([0, 0, 0, 0]);
  const snackYOffset = useRef([0, 0, 0, 0]);

  const pulseRef = useRef(0);
  const prevImpulseRef = useRef(impulseCount);

  useEffect(() => {
    if (impulseCount !== prevImpulseRef.current) {
      prevImpulseRef.current = impulseCount;
      pulseRef.current = 1;
    }
  }, [impulseCount]);

  // Curved wide glowing obsidian stepping pads weaving between all 5 plazas
  const steppingStones = useMemo(() => {
    const stones: Array<{ x: number; y: number; z: number; yaw: number; idx: number }> = [];
    const count = 34;
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const rig = computeScrollCameraRig(t, 'drift');
      const sx = rig.characterPosition[0];
      const sz = rig.characterPosition[2];
      const insidePlaza = SPOT_PLAZAS.some(
        (p) => Math.hypot(sx - p.x, sz - p.z) < p.radius - 0.35,
      );
      if (!insidePlaza) {
        stones.push({
          x: sx,
          y: getWorldFloorY(sx, sz) + 0.015,
          z: sz,
          yaw: rig.characterYaw,
          idx: i,
        });
      }
    }
    return stones;
  }, []);

  // Deterministic luminous starlight particles wide across X and Z
  const moteSeeds = useMemo(() => {
    return Array.from({ length: MOTE_COUNT }, (_, i) => {
      const t = i / MOTE_COUNT;
      return {
        xBase: Math.sin(i * 2.17) * (3.8 + (i % 5) * 1.45),
        yBase: 0.35 + ((i * 37) % 100) / 20,
        zBase: 4 - t * 49,
        speed: 0.4 + (i % 7) * 0.09,
        scale: 0.024 + (i % 5) * 0.012,
        phase: i * 0.67,
        colorHex: theme.propColors[i % theme.propColors.length],
      };
    });
  }, [theme.propColors]);

  // Extruded dark obsidian deck base + flush top planar reflector surface
  const { deckGeo, topReflectorGeo } = useMemo(() => {
    const shape = createPromenadeRibbonShape(17.5, 51, 5.5);
    const extruded = new THREE.ExtrudeGeometry(shape, {
      depth: 0.52,
      bevelEnabled: true,
      bevelThickness: 0.2,
      bevelSize: 0.26,
      bevelSegments: 4,
    });
    extruded.rotateX(Math.PI / 2);

    const topPlane = new THREE.ShapeGeometry(shape, 24);
    topPlane.rotateX(-Math.PI / 2);
    return { deckGeo: extruded, topReflectorGeo: topPlane };
  }, []);

  // Sleek architectural dark-obsidian floor micro-grid CanvasTexture
  const cyberWalkwayTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#070b1a';
      ctx.fillRect(0, 0, 512, 512);

      // Subtle architectural seam grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 128) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }

      // Micro-node intersection glints
      ctx.fillStyle = 'rgba(168, 85, 247, 0.28)';
      for (let x = 0; x <= 512; x += 128) {
        for (let y = 0; y <= 512; y += 128) {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(0.32, 0.32);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // Soft vertical + bottom-faded alpha gradient CanvasTexture for volumetric-style light beams
  const beamTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 256, 0, 0);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      grad.addColorStop(0.14, 'rgba(255, 255, 255, 0.16)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 256);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useEffect(() => {
    return () => {
      deckGeo.dispose();
      topReflectorGeo.dispose();
      cyberWalkwayTexture.dispose();
      beamTexture.dispose();
    };
  }, [deckGeo, topReflectorGeo, cyberWalkwayTexture, beamTexture]);

  useEffect(() => {
    if (!motesRef.current) return;
    const color = new THREE.Color();
    moteSeeds.forEach((m, idx) => {
      color.set(m.colorHex);
      motesRef.current!.setColorAt(idx, color);
    });
    if (motesRef.current.instanceColor) {
      motesRef.current.instanceColor.needsUpdate = true;
    }
  }, [moteSeeds]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const px = pointerRef.current.x;
    const py = pointerRef.current.y;

    if (pulseRef.current > 0.001) {
      pulseRef.current *= Math.exp(-3.0 * dt);
    } else {
      pulseRef.current = 0;
    }

    // Spot 1 wide entrance neon arches
    if (originArch1Ref.current) {
      originArch1Ref.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.018 + pulseRef.current * 0.08);
    }
    if (originArch2Ref.current) {
      originArch2Ref.current.scale.setScalar(1 + Math.cos(t * 1.1) * 0.018 + pulseRef.current * 0.1);
    }

    // Spot 2 hopscotch neon arches sway
    hopArchRefs.current.forEach((grp, idx) => {
      if (!grp) return;
      grp.position.y = Math.sin(t * 1.7 + idx * 0.85) * 0.07;
      grp.scale.setScalar(1 + pulseRef.current * 0.07);
    });

    // Pinwheel energy spinners
    pinwheelRefs.current.forEach((grp, idx) => {
      if (!grp) return;
      grp.rotation.z += dt * (idx % 2 === 0 ? 1.85 : -1.55);
    });

    // Volumetric light beam breath
    beamRefs.current.forEach((mesh, idx) => {
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.075 + Math.sin(t * 1.2 + idx * 1.3) * 0.02 + pulseRef.current * 0.1;
      mesh.rotation.y += dt * 0.14;
    });

    // Spot 3 clickable neon food props bounce & spin physics
    [donutRef.current, bobaRef.current, burgerRef.current, coneRef.current].forEach((grp, idx) => {
      if (!grp) return;
      const force = -snackYOffset.current[idx] * 95;
      snackYVel.current[idx] = (snackYVel.current[idx] + force * dt) * Math.exp(-5.8 * dt);
      snackYOffset.current[idx] += snackYVel.current[idx] * dt;
      snackBoosts.current[idx] *= Math.exp(-3.2 * dt);

      const hoverBob = Math.sin(t * 2.0 + idx * 1.3) * 0.085;
      const baseH = idx === 0 ? 0.62 : 0.44;
      grp.position.y = baseH + hoverBob + snackYOffset.current[idx];
      grp.rotation.y += (0.65 + snackBoosts.current[idx]) * dt;
      const sc = 1 + Math.max(0, snackYOffset.current[idx]) * 0.35;
      grp.scale.setScalar(sc);
    });

    // Spot 4 & 5 luminous clouds drift
    cloudRefs.current.forEach((grp, idx) => {
      const spec = CHILL_CLOUDS[idx];
      if (!grp || !spec) return;
      grp.position.y = spec.pos[1] + Math.sin(t * 0.6 + spec.phase) * 0.16;
      grp.position.x = spec.pos[0] + Math.cos(t * 0.38 + spec.phase) * 0.28;
    });

    // Dreamy rising bubbles
    bubbleRefs.current.forEach((mesh, idx) => {
      const spec = DREAM_BUBBLES[idx];
      if (!mesh || !spec) return;
      mesh.position.y = spec.y + Math.sin(t * spec.speed + spec.phase) * 0.28;
      mesh.position.x = spec.x + Math.cos(t * spec.speed * 0.8 + spec.phase) * 0.18;
    });

    // Click-to-move ground destination ring indicator
    const roam = roamStateRef.current;
    if (targetMarkerRef.current) {
      if (roam.targetX !== null && roam.targetZ !== null) {
        targetMarkerRef.current.visible = true;
        targetMarkerRef.current.position.set(
          roam.targetX,
          getWorldFloorY(roam.targetX, roam.targetZ) + 0.025,
          roam.targetZ,
        );
        if (targetRingInnerRef.current) {
          targetRingInnerRef.current.scale.setScalar(1 + Math.sin(t * 7) * 0.16);
        }
      } else {
        targetMarkerRef.current.visible = false;
      }
    }

    // Luminous starlight motes
    if (motesRef.current) {
      for (let i = 0; i < MOTE_COUNT; i++) {
        const m = moteSeeds[i];
        const x = m.xBase + Math.sin(t * m.speed + m.phase) * 0.42 + px * 0.26;
        const y = m.yBase + Math.cos(t * m.speed * 1.2 + m.phase) * 0.32 + py * 0.16;
        const z = m.zBase + Math.sin(t * 0.4 + m.phase) * 0.35;
        _dummy.position.set(x, y, z);
        _dummy.scale.setScalar(m.scale * (1 + Math.sin(t * 2 + m.phase) * 0.3 + pulseRef.current * 0.65));
        _dummy.updateMatrix();
        motesRef.current.setMatrixAt(i, _dummy.matrix);
      }
      motesRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const handleGroundPointerClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    const cx = THREE.MathUtils.clamp(e.point.x, PLAYGROUND_BOUNDS.minX, PLAYGROUND_BOUNDS.maxX);
    const cz = THREE.MathUtils.clamp(e.point.z, PLAYGROUND_BOUNDS.minZ, PLAYGROUND_BOUNDS.maxZ);
    onGroundClick(cx, cz);
  };

  const triggerSnackBounce = (e: ThreeEvent<MouseEvent>, idx: number) => {
    e.stopPropagation();
    snackYVel.current[idx] = 5.6;
    snackBoosts.current[idx] = 10.0;
    onSnackClick();
  };

  const accentA = theme.propColors[0]; // electric cyan
  const accentB = theme.propColors[1]; // neon magenta
  const accentC = theme.propColors[2]; // deep violet
  const accentD = theme.propColors[3]; // warm amber

  return (
    <group>
      {/* Sleek Extruded Dark Obsidian Island Base */}
      <mesh
        receiveShadow
        geometry={deckGeo}
        position={[0, -0.895, -19.5]}
        onClick={handleGroundPointerClick}
      >
        <meshStandardMaterial
          color="#050814"
          roughness={0.42}
          metalness={0.78}
        />
      </mesh>

      {/* Real-Time Reflective Obsidian Walkway Surface */}
      <mesh
        geometry={topReflectorGeo}
        position={[0, -0.875, -19.5]}
        onClick={handleGroundPointerClick}
      >
        <MeshReflectorMaterial
          resolution={isSoftwareGl ? 256 : 512}
          blur={isSoftwareGl ? [0, 0] : [260, 80]}
          mixBlur={isSoftwareGl ? 0.12 : 0.85}
          mixStrength={2.15}
          mixContrast={1.15}
          mirror={0.78}
          roughness={0.16}
          metalness={0.42}
          envMapIntensity={0.12}
          depthScale={0.35}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#050712"
          map={cyberWalkwayTexture}
        />
      </mesh>

      {/* Invisible Wide Clickable Ground Plane Extension */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.9, -19.5]}
        onClick={handleGroundPointerClick}
      >
        <planeGeometry args={[60, 75]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Click-to-Move Animated Neon Ground Destination Marker */}
      <group ref={targetMarkerRef} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.26, 0.36, 32]} />
          <meshBasicMaterial color={accentA} transparent opacity={0.95} depthWrite={false} />
        </mesh>
        <mesh ref={targetRingInnerRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <circleGeometry args={[0.14, 24]} />
          <meshBasicMaterial color={accentB} transparent opacity={0.75} depthWrite={false} />
        </mesh>
      </group>

      {/* 5 Wide Reflective Plazas with Double Neon Rim Rings & Volumetric Light Beams */}
      {SPOT_PLAZAS.map((plaza, idx) => {
        const plazaRim = theme.propColors[idx % theme.propColors.length];
        const innerRim = theme.propColors[(idx + 2) % theme.propColors.length];
        return (
          <group
            key={`plaza-${idx}`}
            position={[plaza.x, -0.88, plaza.z]}
            onClick={handleGroundPointerClick}
          >
            <mesh receiveShadow position={[0, plaza.lift * 0.5, 0]}>
              <cylinderGeometry args={[plaza.radius - 0.14, plaza.radius + 0.48, plaza.lift, 48]} />
              <meshPhysicalMaterial
                color="#090d1e"
                roughness={0.18}
                metalness={0.72}
                clearcoat={0.9}
                clearcoatRoughness={0.1}
              />
            </mesh>
            {/* Outer Glowing Neon Ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, plaza.lift + 0.01, 0]}>
              <torusGeometry args={[plaza.radius - 0.18, 0.042, 14, 64]} />
              <meshStandardMaterial
                color={plazaRim}
                emissive={plazaRim}
                emissiveIntensity={2.1}
                roughness={0.14}
                metalness={0.5}
              />
            </mesh>
            {/* Inner Subtle Concentric Neon Halo */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, plaza.lift + 0.006, 0]}>
              <torusGeometry args={[plaza.radius * 0.62, 0.018, 10, 52]} />
              <meshStandardMaterial
                color={innerRim}
                emissive={innerRim}
                emissiveIntensity={1.45}
                roughness={0.18}
              />
            </mesh>
            {/* Volumetric-Style Soft Atmospheric Light Column */}
            <mesh
              ref={(el) => {
                beamRefs.current[idx] = el;
              }}
              position={[0, plaza.lift + 3.6, 0]}
            >
              <cylinderGeometry args={[0.48, plaza.radius * 0.42, 7.2, 24, 1, true]} />
              <meshBasicMaterial
                map={beamTexture}
                color={plazaRim}
                transparent
                opacity={0.075}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}

      {/* Wide Serpentine Obsidian Stepping Pads Connecting Left <-> Right Zones */}
      {steppingStones.map((stone) => {
        const padColor = theme.propColors[stone.idx % theme.propColors.length];
        return (
          <group
            key={`stone-${stone.idx}`}
            position={[stone.x, stone.y, stone.z]}
            rotation={[0, stone.yaw, 0]}
            onClick={handleGroundPointerClick}
          >
            <mesh receiveShadow>
              <cylinderGeometry args={[0.72, 0.84, 0.05, 24]} />
              <meshPhysicalMaterial
                color="#0b1022"
                roughness={0.22}
                metalness={0.65}
                clearcoat={0.8}
              />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
              <ringGeometry args={[0.5, 0.58, 24]} />
              <meshBasicMaterial color={padColor} transparent opacity={0.92} />
            </mesh>
          </group>
        );
      })}

      {/* SPOT 1 (z = 0): Wide Entrance Neon Gateway Arches & Sleek Dark-Glass Monolith Pillars */}
      <group position={[0, -0.88, -3.4]}>
        <mesh ref={originArch1Ref} position={[0, 0.14, 0]}>
          <torusGeometry args={[2.95, 0.085, 18, 72, Math.PI]} />
          <meshStandardMaterial
            color={accentA}
            emissive={accentA}
            emissiveIntensity={2.1}
            roughness={0.14}
          />
        </mesh>
        <mesh ref={originArch2Ref} position={[0, 0.14, -0.65]}>
          <torusGeometry args={[3.45, 0.075, 18, 72, Math.PI]} />
          <meshStandardMaterial
            color={accentC}
            emissive={accentC}
            emissiveIntensity={1.85}
            roughness={0.14}
          />
        </mesh>
        {[-3.95, 3.95].map((tx, i) => {
          const beamColor = i === 0 ? accentA : accentB;
          return (
            <group key={`monolith-${i}`} position={[tx, 0.14, 1.3]}>
              {/* Dark Obsidian Glass Pillar */}
              <mesh castShadow position={[0, 0.72, 0]}>
                <boxGeometry args={[0.38, 1.44, 0.38]} />
                <meshPhysicalMaterial
                  color="#0a0f22"
                  roughness={0.08}
                  metalness={0.45}
                  clearcoat={1}
                  iridescence={0.8}
                />
              </mesh>
              {/* Glowing Neon Edge Strip */}
              <mesh position={[0, 0.72, 0.195]}>
                <boxGeometry args={[0.06, 1.24, 0.025]} />
                <meshStandardMaterial
                  color={beamColor}
                  emissive={beamColor}
                  emissiveIntensity={2.2}
                />
              </mesh>
              {/* Levitating Glowing Diamond Capstone */}
              <mesh castShadow position={[0, 1.72, 0]} rotation={[0.4, Math.PI / 4, 0.35]}>
                <octahedronGeometry args={[0.24, 0]} />
                <meshStandardMaterial
                  color={beamColor}
                  emissive={beamColor}
                  emissiveIntensity={2.0}
                  roughness={0.1}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* SPOT 2 (x = -2.4, z = -11): Wide Zig-Zag Neon Arches & Kinetic Spinners */}
      {HOPSCOTCH_ARCHES.map((arch, idx) => {
        const col = theme.propColors[idx % theme.propColors.length];
        return (
          <group
            key={`hop-arch-${idx}`}
            ref={(el) => {
              hopArchRefs.current[idx] = el;
            }}
            position={[arch.x, -0.88, arch.z]}
            rotation={[0, arch.rotY, 0]}
          >
            <mesh position={[0, 0.14, 0]}>
              <torusGeometry args={[arch.radius, 0.08, 16, 56, Math.PI]} />
              <meshStandardMaterial
                color={col}
                emissive={col}
                emissiveIntensity={1.95}
                roughness={0.14}
              />
            </mesh>
          </group>
        );
      })}

      {[
        { x: -5.4, z: -10.5 },
        { x: 0.9, z: -12.2 },
        { x: -4.8, z: -14.0 },
        { x: 4.8, z: -18.5 },
      ].map((pw, idx) => (
        <group key={`pinwheel-${idx}`} position={[pw.x, -0.88, pw.z]}>
          <mesh castShadow position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.048, 0.065, 1.6, 12]} />
            <meshStandardMaterial color="#0c1226" roughness={0.28} metalness={0.75} />
          </mesh>
          <group
            ref={(el) => {
              pinwheelRefs.current[idx] = el;
            }}
            position={[0, 1.64, 0.05]}
          >
            {[0, 1, 2, 3].map((blade) => {
              const bladeCol = theme.propColors[(idx + blade) % theme.propColors.length];
              return (
                <mesh
                  key={blade}
                  rotation={[0, 0, (blade * Math.PI) / 2]}
                  position={[
                    Math.cos((blade * Math.PI) / 2) * 0.24,
                    Math.sin((blade * Math.PI) / 2) * 0.24,
                    0,
                  ]}
                >
                  <capsuleGeometry args={[0.088, 0.28, 8, 12]} />
                  <meshStandardMaterial
                    color={bladeCol}
                    emissive={bladeCol}
                    emissiveIntensity={1.35}
                    roughness={0.16}
                  />
                </mesh>
              );
            })}
            <mesh>
              <sphereGeometry args={[0.11, 16, 16]} />
              <meshStandardMaterial color="#ffffff" emissive="#22d3ee" emissiveIntensity={1.2} />
            </mesh>
          </group>
        </group>
      ))}

      {/* SPOT 3 (x = 2.4, z = -21.5): Wide EAT & CHILL Midnight Snack Plaza */}
      <group position={[2.4, -0.68, -21.5]}>
        {/* 1. Giant Glazed Neon Donut */}
        <group
          position={[2.0, 0, 0.4]}
          onClick={(e) => triggerSnackBounce(e, 0)}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
            onPropHover();
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          <mesh receiveShadow position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.52, 0.58, 0.12, 32]} />
            <meshPhysicalMaterial color="#0b1022" roughness={0.22} metalness={0.68} clearcoat={0.8} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.125, 0]}>
            <torusGeometry args={[0.5, 0.02, 10, 32]} />
            <meshStandardMaterial color={accentB} emissive={accentB} emissiveIntensity={1.8} />
          </mesh>
          <group ref={donutRef} position={[0, 0.62, 0]}>
            <mesh castShadow rotation={[0.55, 0.2, 0]}>
              <torusGeometry args={[0.36, 0.155, 20, 42]} />
              <meshPhysicalMaterial color="#e6a25e" roughness={0.42} clearcoat={0.25} />
            </mesh>
            <mesh castShadow position={[0, 0.032, 0.025]} rotation={[0.55, 0.2, 0]}>
              <torusGeometry args={[0.36, 0.145, 18, 42]} />
              <meshPhysicalMaterial
                color="#fb7185"
                roughness={0.12}
                clearcoat={1}
                emissive="#f43f5e"
                emissiveIntensity={0.75}
              />
            </mesh>
            {[
              [0.24, 0.26, 0.14, 0.4, '#fde047'],
              [-0.24, 0.25, 0.12, -0.5, '#22d3ee'],
              [0.04, 0.34, -0.06, 0.9, '#ffffff'],
              [-0.28, -0.08, 0.22, 0.2, '#4ade80'],
              [0.26, -0.08, 0.2, -0.7, '#c084fc'],
            ].map(([sx, sy, sz, rot, col], i) => (
              <mesh
                key={`sprinkle-${i}`}
                position={[sx as number, sy as number, sz as number]}
                rotation={[0.45, 0.3, rot as number]}
              >
                <capsuleGeometry args={[0.024, 0.07, 6, 8]} />
                <meshStandardMaterial
                  color={col as string}
                  emissive={col as string}
                  emissiveIntensity={0.85}
                />
              </mesh>
            ))}
          </group>
        </group>

        {/* 2. Luminous Iced Boba Cup */}
        <group
          position={[-2.3, 0, 0.5]}
          onClick={(e) => triggerSnackBounce(e, 1)}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
            onPropHover();
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          <mesh receiveShadow position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.46, 0.52, 0.12, 28]} />
            <meshPhysicalMaterial color="#0b1022" roughness={0.22} metalness={0.68} clearcoat={0.8} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.125, 0]}>
            <torusGeometry args={[0.44, 0.02, 10, 28]} />
            <meshStandardMaterial color={accentA} emissive={accentA} emissiveIntensity={1.8} />
          </mesh>
          <group ref={bobaRef} position={[0, 0.44, 0]}>
            <mesh castShadow position={[0, 0.28, 0]}>
              <cylinderGeometry args={[0.25, 0.19, 0.64, 24]} />
              <meshPhysicalMaterial color="#e8c39e" roughness={0.24} clearcoat={0.85} />
            </mesh>
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.275, 0.21, 0.72, 24]} />
              <meshPhysicalMaterial
                color="#c4b5fd"
                roughness={0.08}
                clearcoat={1}
                transmission={isSoftwareGl ? 0 : 0.75}
                transparent
                opacity={isSoftwareGl ? 0.34 : 1}
              />
            </mesh>
            <mesh position={[0, 0.66, 0]}>
              <sphereGeometry args={[0.272, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
              <meshStandardMaterial color={accentA} emissive={accentA} emissiveIntensity={1.1} />
            </mesh>
            <mesh castShadow position={[0.05, 0.88, 0]} rotation={[0.08, 0, -0.18]}>
              <cylinderGeometry args={[0.036, 0.036, 0.62, 14]} />
              <meshStandardMaterial color={accentB} emissive={accentB} emissiveIntensity={1.3} />
            </mesh>
            {[0, 1, 2, 3, 4, 5].map((p) => {
              const ang = (p / 6) * Math.PI * 2;
              return (
                <mesh
                  key={`boba-${p}`}
                  position={[Math.cos(ang) * 0.14, 0.03 + (p % 2) * 0.05, Math.sin(ang) * 0.14]}
                >
                  <sphereGeometry args={[0.048, 12, 12]} />
                  <meshStandardMaterial color="#181216" roughness={0.22} />
                </mesh>
              );
            })}
          </group>
        </group>

        {/* 3. Stacked Cartoon Burger */}
        <group
          position={[2.4, 0, -1.6]}
          onClick={(e) => triggerSnackBounce(e, 2)}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
            onPropHover();
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          <mesh receiveShadow position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.46, 0.52, 0.12, 28]} />
            <meshPhysicalMaterial color="#0b1022" roughness={0.22} metalness={0.68} clearcoat={0.8} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.125, 0]}>
            <torusGeometry args={[0.44, 0.02, 10, 28]} />
            <meshStandardMaterial color={accentD} emissive={accentD} emissiveIntensity={1.8} />
          </mesh>
          <group ref={burgerRef} position={[0, 0.44, 0]}>
            <mesh castShadow position={[0, 0.06, 0]}>
              <cylinderGeometry args={[0.31, 0.29, 0.12, 24]} />
              <meshPhysicalMaterial color="#e69d45" roughness={0.48} />
            </mesh>
            <mesh castShadow position={[0, 0.17, 0]}>
              <cylinderGeometry args={[0.32, 0.32, 0.11, 24]} />
              <meshStandardMaterial color="#5c2d1d" roughness={0.68} />
            </mesh>
            <mesh castShadow position={[0, 0.24, 0]} rotation={[0, 0.35, 0]}>
              <boxGeometry args={[0.48, 0.04, 0.48]} />
              <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.45} />
            </mesh>
            <mesh castShadow position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.25, 0.065, 10, 24]} />
              <meshStandardMaterial color="#22c55e" emissive="#10b981" emissiveIntensity={0.35} />
            </mesh>
            <mesh castShadow position={[0, 0.31, 0]} scale={[1, 0.72, 1]}>
              <sphereGeometry args={[0.31, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
              <meshPhysicalMaterial color="#ea9f47" roughness={0.44} clearcoat={0.25} />
            </mesh>
          </group>
        </group>

        {/* 4. Luminous Soft-Serve Cone */}
        <group
          position={[-1.95, 0, -1.75]}
          onClick={(e) => triggerSnackBounce(e, 3)}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
            onPropHover();
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          <mesh receiveShadow position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.44, 0.5, 0.12, 28]} />
            <meshPhysicalMaterial color="#0b1022" roughness={0.22} metalness={0.68} clearcoat={0.8} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.125, 0]}>
            <torusGeometry args={[0.42, 0.02, 10, 28]} />
            <meshStandardMaterial color={accentC} emissive={accentC} emissiveIntensity={1.8} />
          </mesh>
          <group ref={coneRef} position={[0, 0.44, 0]}>
            <mesh castShadow position={[0, 0.26, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.22, 0.54, 18]} />
              <meshStandardMaterial color="#e09f5a" roughness={0.55} />
            </mesh>
            <mesh castShadow position={[0, 0.56, 0]}>
              <sphereGeometry args={[0.23, 20, 18]} />
              <meshPhysicalMaterial
                color="#67e8f9"
                emissive="#22d3ee"
                emissiveIntensity={0.45}
                roughness={0.18}
                clearcoat={0.85}
              />
            </mesh>
            <mesh castShadow position={[0, 0.74, 0]}>
              <sphereGeometry args={[0.17, 18, 16]} />
              <meshPhysicalMaterial
                color="#f0abfc"
                emissive="#c084fc"
                emissiveIntensity={0.55}
                roughness={0.18}
                clearcoat={0.85}
              />
            </mesh>
            <mesh castShadow position={[0, 0.9, 0]}>
              <sphereGeometry args={[0.075, 14, 14]} />
              <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={1.6} />
            </mesh>
          </group>
        </group>

        {/* Cozy Dark-Velvet Lounge Beanbag */}
        <group position={[0.4, -0.02, 2.2]} rotation={[0, -0.5, 0]}>
          <mesh castShadow receiveShadow scale={[1.18, 0.6, 1.05]} position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.44, 24, 18]} />
            <meshPhysicalMaterial color="#1e1b4b" roughness={0.62} sheen={0.85} sheenColor={accentA} />
          </mesh>
        </group>
      </group>

      {/* SPOT 4 (x = -2.1, z = -31): CHILL Neon Arc & Midnight Cushions */}
      <group position={[-2.1, -0.66, -31]}>
        <mesh position={[0, 0.14, 0]} rotation={[0, 0.25, 0]}>
          <torusGeometry args={[3.2, 0.082, 16, 64, Math.PI]} />
          <meshStandardMaterial color={accentD} emissive={accentD} emissiveIntensity={1.9} />
        </mesh>
        {[
          [-1.6, 0.18, 1.1, accentA],
          [1.6, 0.18, -0.9, accentB],
        ].map(([px, py, pz, col], i) => (
          <mesh
            key={`chill-pad-${i}`}
            castShadow
            receiveShadow
            position={[px as number, py as number, pz as number]}
            scale={[1.25, 0.44, 1.0]}
          >
            <sphereGeometry args={[0.46, 20, 16]} />
            <meshPhysicalMaterial
              color="#11162b"
              roughness={0.65}
              sheen={0.9}
              sheenColor={col as string}
            />
          </mesh>
        ))}
      </group>

      {/* SPOT 5 (x = 0, z = -40): DOING NOTHING Obsidian Ring & Neon Cushions */}
      <group position={[0, -0.64, -40]}>
        <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.6, 0.11, 18, 72]} />
          <meshStandardMaterial color={accentA} emissive={accentA} emissiveIntensity={2.0} />
        </mesh>

        {[
          [-2.2, 0.18, 1.2, accentB],
          [2.2, 0.18, 1.2, accentD],
          [0, 0.18, -2.5, accentC],
        ].map(([px, py, pz, col], i) => (
          <mesh
            key={`pillow-${i}`}
            castShadow
            receiveShadow
            position={[px as number, py as number, pz as number]}
            scale={[1.25, 0.45, 1.0]}
          >
            <sphereGeometry args={[0.48, 22, 16]} />
            <meshPhysicalMaterial
              color="#11162b"
              roughness={0.65}
              sheen={0.95}
              sheenColor={col as string}
            />
          </mesh>
        ))}
      </group>

      {/* Luminous Midnight Clouds Drifting Across Spots 4 & 5 */}
      {CHILL_CLOUDS.map((cl, idx) => (
        <group
          key={`cloud-${idx}`}
          ref={(el) => {
            cloudRefs.current[idx] = el;
          }}
          position={cl.pos}
          scale={cl.scale}
        >
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.52, 20, 18]} />
            <meshPhysicalMaterial
              color="#3b2d7a"
              roughness={0.32}
              clearcoat={0.5}
              emissive="#6366f1"
              emissiveIntensity={0.65}
            />
          </mesh>
          <mesh position={[-0.44, -0.08, 0.05]}>
            <sphereGeometry args={[0.38, 18, 16]} />
            <meshPhysicalMaterial
              color="#3b2d7a"
              roughness={0.32}
              emissive="#22d3ee"
              emissiveIntensity={0.45}
            />
          </mesh>
          <mesh position={[0.46, -0.06, -0.04]}>
            <sphereGeometry args={[0.4, 18, 16]} />
            <meshPhysicalMaterial
              color="#3b2d7a"
              roughness={0.32}
              emissive="#a855f7"
              emissiveIntensity={0.48}
            />
          </mesh>
        </group>
      ))}

      {/* Iridescent Dark-Glass Bubbles */}
      {DREAM_BUBBLES.map((b, idx) => (
        <mesh
          key={`bubble-${idx}`}
          ref={(el) => {
            bubbleRefs.current[idx] = el;
          }}
          position={[b.x, b.y, b.z]}
        >
          <sphereGeometry args={[b.r, 24, 20]} />
          <meshPhysicalMaterial
            color={theme.propColors[idx % theme.propColors.length]}
            roughness={0.04}
            metalness={0.1}
            clearcoat={1}
            iridescence={1}
            transmission={isSoftwareGl ? 0 : 0.88}
            transparent
            opacity={isSoftwareGl ? 0.5 : 1}
          />
        </mesh>
      ))}

      {/* Instanced Multi-Color Starlight / Luminous Particles */}
      <instancedMesh ref={motesRef} args={[undefined, undefined, MOTE_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.88}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}
