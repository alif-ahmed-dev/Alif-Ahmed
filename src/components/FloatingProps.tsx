import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { ThemePalette } from '../config/ThemeConfig';
import { dampValue } from '../utils/sceneMath';

type PropKind = 'monolith' | 'prism' | 'torus' | 'knot' | 'icosa';

interface PropConfig {
  id: number;
  kind: PropKind;
  basePos: [number, number, number];
  scale: number;
  orbitRadius: number;
  orbitSpeed: number;
  speed: number;
  phase: number;
  colorIdx: number;
}

const PROP_CONFIGS: PropConfig[] = [
  // Spot 1: ALIF AHMED Wide Neon Promenade (z = 0)
  { id: 0, kind: 'monolith', basePos: [-4.2, 1.15, -0.4], scale: 0.28, orbitRadius: 0.16, orbitSpeed: 0.55, speed: 0.85, phase: 0.2, colorIdx: 0 },
  { id: 1, kind: 'prism', basePos: [4.1, 1.2, -0.3], scale: 0.27, orbitRadius: 0.18, orbitSpeed: 0.48, speed: 0.75, phase: 1.4, colorIdx: 1 },
  { id: 2, kind: 'torus', basePos: [-3.2, 0.08, 1.4], scale: 0.23, orbitRadius: 0.14, orbitSpeed: 0.62, speed: 1.05, phase: 2.3, colorIdx: 2 },
  // Spot 2: ROAM Left Terrace & Arches (x = -2.4, z = -11)
  { id: 3, kind: 'icosa', basePos: [-5.5, 1.48, -10.4], scale: 0.28, orbitRadius: 0.16, orbitSpeed: 0.52, speed: 0.85, phase: 3.1, colorIdx: 3 },
  { id: 4, kind: 'monolith', basePos: [0.85, 1.42, -11.4], scale: 0.26, orbitRadius: 0.18, orbitSpeed: 0.46, speed: 0.78, phase: 4.0, colorIdx: 0 },
  { id: 5, kind: 'prism', basePos: [-4.9, 0.35, -12.6], scale: 0.22, orbitRadius: 0.15, orbitSpeed: 0.65, speed: 0.95, phase: 4.8, colorIdx: 1 },
  // Spot 3: EAT & CHILL Right Snack Deck (x = 2.4, z = -21.5)
  { id: 6, kind: 'prism', basePos: [5.4, 1.65, -20.8], scale: 0.27, orbitRadius: 0.16, orbitSpeed: 0.58, speed: 1.05, phase: 5.5, colorIdx: 2 },
  { id: 7, kind: 'torus', basePos: [-0.8, 1.55, -21.6], scale: 0.23, orbitRadius: 0.14, orbitSpeed: 0.6, speed: 0.82, phase: 0.9, colorIdx: 3 },
  { id: 8, kind: 'knot', basePos: [5.1, 0.58, -23.0], scale: 0.2, orbitRadius: 0.13, orbitSpeed: 0.68, speed: 1.1, phase: 2.8, colorIdx: 0 },
  // Spot 4: CHILL Left Cloud Terrace (x = -2.1, z = -31)
  { id: 9, kind: 'icosa', basePos: [-5.2, 1.75, -30.5], scale: 0.27, orbitRadius: 0.18, orbitSpeed: 0.58, speed: 0.95, phase: 3.7, colorIdx: 1 },
  { id: 10, kind: 'monolith', basePos: [1.1, 1.6, -31.4], scale: 0.26, orbitRadius: 0.16, orbitSpeed: 0.66, speed: 1.02, phase: 1.8, colorIdx: 2 },
  // Spot 5: DOING NOTHING Horizon Loop (x = 0, z = -40)
  { id: 11, kind: 'torus', basePos: [-3.6, 1.9, -39.2], scale: 0.26, orbitRadius: 0.18, orbitSpeed: 0.52, speed: 0.88, phase: 4.5, colorIdx: 3 },
  { id: 12, kind: 'prism', basePos: [3.6, 1.95, -39.4], scale: 0.26, orbitRadius: 0.18, orbitSpeed: 0.5, speed: 0.9, phase: 2.1, colorIdx: 0 },
  { id: 13, kind: 'knot', basePos: [0, 2.85, -41.5], scale: 0.24, orbitRadius: 0.2, orbitSpeed: 0.62, speed: 1.05, phase: 3.4, colorIdx: 1 },
];

interface FloatingPropsProps {
  theme: ThemePalette;
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
  scrollRef: React.MutableRefObject<number>;
  impulseCount: number;
  isSoftwareGl: boolean;
  onPropClick: () => void;
  onPropHover: () => void;
}

export function FloatingProps({
  theme,
  pointerRef,
  scrollRef,
  impulseCount,
  isSoftwareGl,
  onPropClick,
  onPropHover,
}: FloatingPropsProps) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const impulseOffsets = useRef<number[]>(PROP_CONFIGS.map(() => 0));
  const impulseVelocities = useRef<number[]>(PROP_CONFIGS.map(() => 0));
  const spinBoosts = useRef<number[]>(PROP_CONFIGS.map(() => 0));
  const prevImpulseRef = useRef(impulseCount);
  const prevScrollRef = useRef(scrollRef.current);
  const scrollEnergyRef = useRef(0);

  useEffect(() => {
    if (impulseCount !== prevImpulseRef.current) {
      prevImpulseRef.current = impulseCount;
      PROP_CONFIGS.forEach((_, idx) => {
        impulseVelocities.current[idx] = 3.4 + (idx % 3) * 0.8;
        spinBoosts.current[idx] = 5.8 + (idx % 4) * 0.9;
      });
    }
  }, [impulseCount]);

  // Shared dark-glass prism and neon energy ring geometries
  const sharedGeos = useMemo(() => {
    return {
      monolith: new THREE.BoxGeometry(0.85, 2.15, 0.52),
      prism: new THREE.OctahedronGeometry(1.05, 0),
      torus: new THREE.TorusGeometry(0.85, 0.28, 18, 36),
      knot: new THREE.TorusKnotGeometry(0.68, 0.2, 64, 14),
      icosa: new THREE.IcosahedronGeometry(0.95, 0),
      coreOrb: new THREE.OctahedronGeometry(0.34, 0),
      halo: new THREE.TorusGeometry(1.48, 0.042, 12, 42),
    };
  }, []);

  useEffect(() => {
    return () => {
      sharedGeos.monolith.dispose();
      sharedGeos.prism.dispose();
      sharedGeos.torus.dispose();
      sharedGeos.knot.dispose();
      sharedGeos.icosa.dispose();
      sharedGeos.coreOrb.dispose();
      sharedGeos.halo.dispose();
    };
  }, [sharedGeos]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const px = pointerRef.current.x;
    const py = pointerRef.current.y;
    const aspectScaleX = THREE.MathUtils.clamp(state.viewport.aspect / 1.45, 0.56, 1.06);

    // Measure scroll velocity so dark-glass prisms & neon rings react dynamically to scrolling
    const scrollDelta = Math.abs(scrollRef.current - prevScrollRef.current);
    prevScrollRef.current = scrollRef.current;
    const instantVel = Math.min(scrollDelta / Math.max(dt, 0.008), 3.0);
    scrollEnergyRef.current = dampValue(scrollEnergyRef.current, instantVel, 8, dt);
    const scrollBoost = scrollEnergyRef.current;

    PROP_CONFIGS.forEach((cfg, idx) => {
      const grp = groupRefs.current[idx];
      if (!grp) return;

      const force = -impulseOffsets.current[idx] * 92;
      impulseVelocities.current[idx] =
        (impulseVelocities.current[idx] + force * dt) * Math.exp(-6.0 * dt);
      impulseOffsets.current[idx] += impulseVelocities.current[idx] * dt;

      const radial = 1 + impulseOffsets.current[idx] * 0.28 + scrollBoost * 0.08;
      const orbitAngle = t * cfg.orbitSpeed + cfg.phase;
      const floatY = Math.sin(t * cfg.speed + cfg.phase) * 0.2;
      const floatX = Math.cos(orbitAngle) * cfg.orbitRadius;
      const floatZ = Math.sin(orbitAngle) * cfg.orbitRadius;

      const targetX =
        cfg.basePos[0] * aspectScaleX * radial + floatX + px * (0.28 + (idx % 3) * 0.07);
      const targetY =
        cfg.basePos[1] + floatY + py * 0.2 + impulseOffsets.current[idx] * 0.24;
      const targetZ =
        cfg.basePos[2] + floatZ + (idx % 2 === 0 ? -1 : 1) * impulseOffsets.current[idx] * 0.2;

      grp.position.x = dampValue(grp.position.x, targetX, 7.5, dt);
      grp.position.y = dampValue(grp.position.y, targetY, 7.5, dt);
      grp.position.z = dampValue(grp.position.z, targetZ, 7.5, dt);

      spinBoosts.current[idx] *= Math.exp(-3.4 * dt);
      const totalBoost = spinBoosts.current[idx] + scrollBoost * 2.2;
      grp.rotation.x += (0.26 * cfg.speed + totalBoost * 0.52) * dt;
      grp.rotation.y += (0.48 * cfg.speed + totalBoost * 0.85) * dt;

      const ring = ringRefs.current[idx];
      if (ring) {
        ring.rotation.z += (1.15 + totalBoost * 1.1) * dt;
        ring.rotation.x = Math.PI * 0.35 + Math.sin(t * 1.4 + cfg.phase) * 0.28;
      }

      const pulseScale =
        cfg.scale * (1 + Math.max(0, impulseOffsets.current[idx]) * 0.24 + scrollBoost * 0.06);
      grp.scale.setScalar(pulseScale);
    });
  });

  const handleSinglePropClick = (e: ThreeEvent<MouseEvent>, idx: number) => {
    e.stopPropagation();
    impulseVelocities.current[idx] = 6.5;
    spinBoosts.current[idx] = 9.6;
    onPropClick();
  };

  return (
    <group>
      {PROP_CONFIGS.map((cfg, idx) => {
        const neonColor = theme.propColors[cfg.colorIdx % theme.propColors.length];
        const accentColor = theme.propColors[(cfg.colorIdx + 1) % theme.propColors.length];
        const geo = sharedGeos[cfg.kind];

        return (
          <group
            key={cfg.id}
            ref={(el) => {
              groupRefs.current[idx] = el;
            }}
            position={cfg.basePos}
            scale={cfg.scale}
            onClick={(e) => handleSinglePropClick(e, idx)}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
              impulseVelocities.current[idx] = Math.max(impulseVelocities.current[idx], 2.4);
              onPropHover();
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'auto';
            }}
          >
            {/* Outer Translucent Dark-Glass Monolith / Prism Shell */}
            <mesh geometry={geo} castShadow={!isSoftwareGl}>
              <meshPhysicalMaterial
                color="#0d152e"
                attenuationColor={neonColor}
                attenuationDistance={1.6}
                roughness={0.05}
                metalness={0.14}
                clearcoat={1}
                clearcoatRoughness={0.04}
                ior={1.62}
                thickness={1.4}
                iridescence={1}
                iridescenceIOR={1.38}
                transmission={isSoftwareGl ? 0 : 0.86}
                transparent
                opacity={isSoftwareGl ? 0.66 : 1}
              />
            </mesh>

            {/* Glowing Inner Energy Core inside Dark-Glass Prism */}
            <mesh geometry={sharedGeos.coreOrb}>
              <meshStandardMaterial
                color={neonColor}
                emissive={neonColor}
                emissiveIntensity={2.0}
                roughness={0.15}
              />
            </mesh>

            {/* Reactive Neon Energy Ring */}
            <mesh
              ref={(el) => {
                ringRefs.current[idx] = el;
              }}
              geometry={sharedGeos.halo}
              rotation={[Math.PI * 0.35, 0.4, 0]}
            >
              <meshStandardMaterial
                color={accentColor}
                emissive={accentColor}
                emissiveIntensity={1.65}
                roughness={0.14}
                metalness={0.75}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
