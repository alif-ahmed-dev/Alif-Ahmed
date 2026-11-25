import React, { Component, Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { ThemePalette } from '../config/ThemeConfig';
import {
  RoamState,
  computeHeadTarget,
  dampValue,
  getWorldFloorY,
  lerpAngle,
  SpringState,
  stepSpring,
} from '../utils/sceneMath';

interface CharacterAvatarProps {
  theme: ThemePalette;
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
  roamStateRef: React.MutableRefObject<RoamState>;
  impulseCount: number;
  glbUrl: string | null;
  isSoftwareGl: boolean;
  onAvatarClick: () => void;
  onAvatarHover: () => void;
  onGlbStatusChange?: (status: 'procedural' | 'loading' | 'loaded' | 'error') => void;
}

class GlbErrorBoundary extends Component<
  {
    fallback: React.ReactNode;
    onError: () => void;
    resetKey: string;
    children: React.ReactNode;
  },
  { hasError: boolean }
> {
  constructor(props: {
    fallback: React.ReactNode;
    onError: () => void;
    resetKey: string;
    children: React.ReactNode;
  }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { resetKey: string }): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function GlbSlotContent({
  url,
  onLoaded,
}: {
  url: string;
  onLoaded: () => void;
}) {
  const gltf = useGLTF(url);

  const normalizedScene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const scale = 2.25 / maxDim;
    clone.scale.setScalar(scale);

    // Recompute bounds after scale so feet rest cleanly on floor plane
    const scaledBox = new THREE.Box3().setFromObject(clone);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);

    clone.position.x -= scaledCenter.x;
    clone.position.z -= scaledCenter.z;
    clone.position.y -= scaledBox.min.y + 0.95;

    clone.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return clone;
  }, [gltf.scene]);

  useEffect(() => {
    onLoaded();
  }, [onLoaded, normalizedScene]);

  return <primitive object={normalizedScene} />;
}

/**
 * Rim-lit stylized 3D character sculpture inspired by Alif Ahmed:
 * warm brown skin tone, dark short-cropped hair, neat mustache, midnight tailored suit
 * with cyan/amber edge sheen, crisp white shirt, maroon silk tie, and neon-trimmed sneakers.
 */
function ProceduralAlifSculpture({
  theme,
  pointerRef,
  roamStateRef,
  impulseCount,
  onAvatarClick,
  onAvatarHover,
}: Omit<CharacterAvatarProps, 'glbUrl' | 'onGlbStatusChange' | 'isSoftwareGl'>) {
  const rootGroupRef = useRef<THREE.Group>(null);
  const bodyGroupRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const leftPupilRef = useRef<THREE.Mesh>(null);
  const rightPupilRef = useRef<THREE.Mesh>(null);
  const leftLidRef = useRef<THREE.Mesh>(null);
  const rightLidRef = useRef<THREE.Mesh>(null);
  const leftBrowRef = useRef<THREE.Mesh>(null);
  const rightBrowRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const pulseRingRef = useRef<THREE.Mesh>(null);
  const pulseRingOuterRef = useRef<THREE.Mesh>(null);

  const springRef = useRef<SpringState>({ value: 1, velocity: 0 });
  const spinTargetRef = useRef(0);
  const pulseRef = useRef(0);
  const prevImpulseRef = useRef(impulseCount);
  const blinkTimerRef = useRef(0);
  const walkPhaseRef = useRef(0);

  // Trigger spring bounce, clean 360° spin & double neon pulse when clicked
  useEffect(() => {
    if (impulseCount !== prevImpulseRef.current) {
      prevImpulseRef.current = impulseCount;
      springRef.current = { value: 0.84, velocity: 4.8 };
      spinTargetRef.current += Math.PI * 2;
      pulseRef.current = 1;
    }
  }, [impulseCount]);

  // Procedural geometries for tailored suit lapels, tie, mustache, and eyebrows
  const geometries = useMemo(() => {
    const lapelShape = new THREE.Shape();
    lapelShape.moveTo(0, 0.24);
    lapelShape.lineTo(0.11, 0.21);
    lapelShape.lineTo(0.08, 0.08);
    lapelShape.lineTo(0.115, 0.03);
    lapelShape.lineTo(0.02, -0.2);
    lapelShape.lineTo(-0.015, -0.2);
    lapelShape.closePath();
    const lapelGeo = new THREE.ExtrudeGeometry(lapelShape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
    });
    lapelGeo.center();

    const tieShape = new THREE.Shape();
    tieShape.moveTo(-0.038, 0.19);
    tieShape.lineTo(0.038, 0.19);
    tieShape.lineTo(0.056, -0.12);
    tieShape.lineTo(0, -0.21);
    tieShape.lineTo(-0.056, -0.12);
    tieShape.closePath();
    const tieGeo = new THREE.ExtrudeGeometry(tieShape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.009,
      bevelSize: 0.008,
      bevelSegments: 3,
    });

    const mustacheCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.135, -0.024, 0.014),
      new THREE.Vector3(-0.072, 0.015, 0.048),
      new THREE.Vector3(0, 0.008, 0.055),
      new THREE.Vector3(0.072, 0.015, 0.048),
      new THREE.Vector3(0.135, -0.024, 0.014),
    ]);
    const mustacheGeo = new THREE.TubeGeometry(mustacheCurve, 24, 0.023, 12, false);

    const smileCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.082, 0.014, 0),
      new THREE.Vector3(-0.038, -0.01, 0.015),
      new THREE.Vector3(0, -0.015, 0.02),
      new THREE.Vector3(0.038, -0.01, 0.015),
      new THREE.Vector3(0.082, 0.014, 0),
    ]);
    const smileGeo = new THREE.TubeGeometry(smileCurve, 20, 0.01, 10, false);

    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.07, -0.007, 0),
      new THREE.Vector3(0, 0.016, 0.014),
      new THREE.Vector3(0.07, -0.004, 0),
    ]);
    const browGeo = new THREE.TubeGeometry(browCurve, 14, 0.016, 10, false);

    return { lapelGeo, tieGeo, mustacheGeo, smileGeo, browGeo };
  }, []);

  // Soft obsidian contact shadow + subtle cyan halo CanvasTexture
  const shadowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 124);
      grad.addColorStop(0, 'rgba(3, 5, 14, 0.85)');
      grad.addColorStop(0.5, 'rgba(34, 211, 238, 0.14)');
      grad.addColorStop(1, 'rgba(3, 5, 14, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useEffect(() => {
    return () => {
      geometries.lapelGeo.dispose();
      geometries.tieGeo.dispose();
      geometries.mustacheGeo.dispose();
      geometries.smileGeo.dispose();
      geometries.browGeo.dispose();
      shadowTexture.dispose();
    };
  }, [geometries, shadowTexture]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const roam = roamStateRef.current;
    const walkFactor = THREE.MathUtils.clamp(roam.walkSpeed, 0, 1);

    if (walkFactor > 0.04) {
      walkPhaseRef.current += dt * (5.4 + walkFactor * 8.2);
    }
    const walkSin = Math.sin(walkPhaseRef.current);
    const walkCos = Math.cos(walkPhaseRef.current);
    const strideBob = Math.abs(walkSin) * 0.095 * walkFactor;
    const floorY = getWorldFloorY(roam.x, roam.z);

    if (rootGroupRef.current) {
      rootGroupRef.current.position.x = roam.x;
      rootGroupRef.current.position.y = dampValue(
        rootGroupRef.current.position.y,
        floorY + 0.875,
        14,
        dt,
      );
      rootGroupRef.current.position.z = roam.z;
    }

    // 1. Spring squash-and-stretch + funky bouncy strut & groove twist
    springRef.current = stepSpring(springRef.current, 1, 190, 12, dt);
    const sy = springRef.current.value + Math.sin(t * 2.4) * 0.012;
    const sxz = 1 + (1 - springRef.current.value) * 0.45 - Math.sin(t * 2.4) * 0.006;

    if (bodyGroupRef.current) {
      bodyGroupRef.current.scale.set(sxz, sy, sxz);
      bodyGroupRef.current.position.y =
        strideBob + (1 - walkFactor) * Math.sin(t * 2.4) * 0.028;
      bodyGroupRef.current.rotation.x = dampValue(
        bodyGroupRef.current.rotation.x,
        walkFactor * 0.11,
        10,
        dt,
      );
      bodyGroupRef.current.rotation.z =
        (1 - walkFactor) * Math.sin(t * 1.35) * 0.032 + walkSin * 0.055 * walkFactor;
      bodyGroupRef.current.rotation.y = lerpAngle(
        bodyGroupRef.current.rotation.y,
        spinTargetRef.current + roam.yaw + (1 - walkFactor) * Math.sin(t * 0.9) * 0.08,
        1 - Math.exp(-10 * dt),
      );
    }

    // Alternating leg swing during walking
    if (leftLegRef.current && rightLegRef.current) {
      const targetLeftLeg = walkFactor > 0.04 ? walkSin * 0.62 * walkFactor : -0.04;
      const targetRightLeg = walkFactor > 0.04 ? -walkSin * 0.62 * walkFactor : 0.03;
      leftLegRef.current.rotation.x = dampValue(leftLegRef.current.rotation.x, targetLeftLeg, 14, dt);
      rightLegRef.current.rotation.x = dampValue(rightLegRef.current.rotation.x, targetRightLeg, 14, dt);
    }

    // 2. Pointer head tracking + cheerful head bob
    const { yaw, pitch } = computeHeadTarget(pointerRef.current.x, pointerRef.current.y, 0.48, 0.25);
    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = dampValue(headGroupRef.current.rotation.y, yaw * (1 - walkFactor * 0.5), 7, dt);
      headGroupRef.current.rotation.x = dampValue(
        headGroupRef.current.rotation.x,
        pitch + Math.sin(t * 2.1) * 0.025,
        7,
        dt,
      );
      headGroupRef.current.rotation.z = dampValue(
        headGroupRef.current.rotation.z,
        -pointerRef.current.x * 0.085 + Math.cos(t * 1.15) * 0.02,
        6,
        dt,
      );
    }

    // 3. Eye pupil gaze micro-tracking
    const px = THREE.MathUtils.clamp(pointerRef.current.x * 0.02, -0.022, 0.022);
    const py = THREE.MathUtils.clamp(pointerRef.current.y * 0.014, -0.016, 0.016);
    if (leftPupilRef.current && rightPupilRef.current) {
      leftPupilRef.current.position.x = dampValue(leftPupilRef.current.position.x, px, 12, dt);
      leftPupilRef.current.position.y = dampValue(leftPupilRef.current.position.y, py, 12, dt);
      rightPupilRef.current.position.x = dampValue(rightPupilRef.current.position.x, px, 12, dt);
      rightPupilRef.current.position.y = dampValue(rightPupilRef.current.position.y, py, 12, dt);
    }

    // 4. Blink cycle
    blinkTimerRef.current += dt;
    const blinkCycle = blinkTimerRef.current % 4.0;
    const isBlinking = blinkCycle > 3.84 && blinkCycle < 3.96;
    const targetLidRotX = isBlinking ? 0.08 : -1.42;
    if (leftLidRef.current && rightLidRef.current) {
      leftLidRef.current.rotation.x = dampValue(leftLidRef.current.rotation.x, targetLidRotX, 28, dt);
      rightLidRef.current.rotation.x = dampValue(
        rightLidRef.current.rotation.x,
        targetLidRotX,
        28,
        dt,
      );
    }

    const browLift = pulseRef.current * 0.028 + Math.abs(pointerRef.current.y) * 0.009;
    if (leftBrowRef.current && rightBrowRef.current) {
      leftBrowRef.current.position.y = dampValue(leftBrowRef.current.position.y, 0.135 + browLift, 10, dt);
      rightBrowRef.current.position.y = dampValue(
        rightBrowRef.current.position.y,
        0.135 + browLift,
        10,
        dt,
      );
    }

    // 5. Expressive arms
    if (leftArmRef.current && rightArmRef.current) {
      const groove = Math.sin(t * 2.1) * 0.06 * (1 - walkFactor);
      const bounceArm = pulseRef.current * 0.34;
      const walkSwing = -walkSin * 0.42 * walkFactor;
      leftArmRef.current.rotation.z = dampValue(
        leftArmRef.current.rotation.z,
        0.12 + groove + bounceArm,
        10,
        dt,
      );
      rightArmRef.current.rotation.z = dampValue(
        rightArmRef.current.rotation.z,
        -0.12 - groove - bounceArm,
        10,
        dt,
      );
      leftArmRef.current.rotation.x = dampValue(
        leftArmRef.current.rotation.x,
        walkSwing - 0.06 + walkCos * 0.04 * (1 - walkFactor) - pulseRef.current * 0.25,
        12,
        dt,
      );
      rightArmRef.current.rotation.x = dampValue(
        rightArmRef.current.rotation.x,
        -walkSwing + 0.05 - walkCos * 0.04 * (1 - walkFactor) - pulseRef.current * 0.25,
        12,
        dt,
      );
    }

    // 6. Double neon pulse ring decay
    if (pulseRef.current > 0.001) {
      pulseRef.current *= Math.exp(-3.0 * dt);
    } else {
      pulseRef.current = 0;
    }

    if (pulseRingRef.current) {
      const ringScale = 1 + (1 - pulseRef.current) * 1.1;
      pulseRingRef.current.scale.set(ringScale, ringScale, 1);
      const mat = pulseRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = pulseRef.current * 0.85;
    }
    if (pulseRingOuterRef.current) {
      const outerScale = 1 + (1 - pulseRef.current) * 1.65;
      pulseRingOuterRef.current.scale.set(outerScale, outerScale, 1);
      const mat = pulseRingOuterRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = pulseRef.current * 0.48;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onAvatarClick();
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    onAvatarHover();
  };

  const handlePointerOut = () => {
    document.body.style.cursor = 'auto';
  };

  const skinColor = '#a66b47';
  const hairColor = '#110e15';
  const suitColor = '#0c101c';
  const lapelColor = '#070a13';
  const maroonTieColor = '#921b35';
  const whiteShirtColor = '#f8fafc';

  return (
    <group ref={rootGroupRef} position={[0, 0.14, 0]}>
      {/* Grounded Contact Halo & Double Click Neon Energy Ripples */}
      <mesh position={[0, -0.87, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.84, 42]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} opacity={0.78} />
      </mesh>
      <mesh ref={pulseRingRef} position={[0, -0.864, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.92, 48]} />
        <meshBasicMaterial color={theme.pulseColor} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={pulseRingOuterRef} position={[0, -0.862, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.88, 1.0, 48]} />
        <meshBasicMaterial color={theme.propColors[1]} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Main Character Sculpture Group */}
      <group
        ref={bodyGroupRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {/* Legs & Neon-Trimmed Designer Sneakers */}
        {[-0.16, 0.16].map((xPos, idx) => (
          <group
            key={xPos}
            ref={idx === 0 ? leftLegRef : rightLegRef}
            position={[xPos, -0.52, idx === 0 ? 0.02 : -0.02]}
            rotation={[idx === 0 ? -0.04 : 0.03, idx === 0 ? 0.08 : -0.08, 0]}
          >
            {/* Tailored Midnight Wool Trouser Leg */}
            <mesh castShadow receiveShadow position={[0, 0.13, 0]}>
              <capsuleGeometry args={[0.105, 0.42, 12, 20]} />
              <meshPhysicalMaterial
                color={suitColor}
                roughness={0.62}
                metalness={0.12}
                sheen={0.28}
                sheenRoughness={0.55}
                sheenColor="#38bdf8"
              />
            </mesh>

            {/* Chunky Designer Sneaker */}
            <group position={[0, -0.25, 0.05]}>
              <mesh castShadow receiveShadow position={[0, -0.06, 0]}>
                <boxGeometry args={[0.2, 0.085, 0.34]} />
                <meshPhysicalMaterial color="#f8fafc" roughness={0.22} clearcoat={0.75} />
              </mesh>
              {/* Subtle Neon Midsole Accent Strip */}
              <mesh position={[0, -0.085, 0]}>
                <boxGeometry args={[0.205, 0.018, 0.345]} />
                <meshStandardMaterial
                  color="#22d3ee"
                  emissive="#22d3ee"
                  emissiveIntensity={1.1}
                  roughness={0.2}
                />
              </mesh>
              <mesh castShadow position={[0, 0.01, -0.01]}>
                <capsuleGeometry args={[0.095, 0.14, 12, 16]} />
                <meshPhysicalMaterial
                  color={maroonTieColor}
                  roughness={0.34}
                  metalness={0.14}
                  sheen={0.7}
                  sheenColor="#fb7185"
                />
              </mesh>
              <mesh castShadow position={[0, -0.01, 0.11]}>
                <sphereGeometry args={[0.095, 20, 16]} />
                <meshPhysicalMaterial color="#ffffff" roughness={0.16} clearcoat={1} />
              </mesh>
            </group>
          </group>
        ))}

        {/* Tailored Rim-Lit Suit Torso */}
        <group position={[0, 0.08, 0]}>
          <mesh castShadow receiveShadow position={[0, 0, 0]} scale={[1.15, 1.0, 0.7]}>
            <capsuleGeometry args={[0.31, 0.44, 16, 28]} />
            <meshPhysicalMaterial
              color={suitColor}
              roughness={0.62}
              metalness={0.14}
              sheen={0.32}
              sheenRoughness={0.55}
              sheenColor="#38bdf8"
            />
          </mesh>

          {/* Crisp White Dress Shirt V-Front */}
          <mesh
            castShadow
            position={[0, 0.155, 0.215]}
            rotation={[0.06, 0, 0]}
            scale={[0.84, 0.96, 0.22]}
          >
            <coneGeometry args={[0.175, 0.48, 24]} />
            <meshPhysicalMaterial color={whiteShirtColor} roughness={0.38} clearcoat={0.2} />
          </mesh>

          {/* Shirt Collars */}
          <mesh position={[-0.072, 0.335, 0.21]} rotation={[0.18, 0.25, -0.52]}>
            <boxGeometry args={[0.12, 0.072, 0.032]} />
            <meshStandardMaterial color={whiteShirtColor} roughness={0.38} />
          </mesh>
          <mesh position={[0.072, 0.335, 0.21]} rotation={[0.18, -0.25, 0.52]}>
            <boxGeometry args={[0.12, 0.072, 0.032]} />
            <meshStandardMaterial color={whiteShirtColor} roughness={0.38} />
          </mesh>

          {/* Maroon Silk Tie Knot & Sculpted Blade */}
          <mesh castShadow position={[0, 0.29, 0.242]} rotation={[0.1, 0, 0]}>
            <octahedronGeometry args={[0.048, 1]} />
            <meshPhysicalMaterial
              color={maroonTieColor}
              roughness={0.24}
              sheen={0.95}
              sheenColor="#fb7185"
              clearcoat={0.45}
            />
          </mesh>
          <mesh
            castShadow
            geometry={geometries.tieGeo}
            position={[0, 0.08, 0.236]}
            rotation={[0.03, 0, 0]}
          >
            <meshPhysicalMaterial
              color={maroonTieColor}
              roughness={0.24}
              sheen={0.95}
              sheenColor="#fb7185"
              clearcoat={0.45}
            />
          </mesh>

          {/* Tailored Flush Suit Lapels */}
          <mesh
            castShadow
            geometry={geometries.lapelGeo}
            position={[-0.112, 0.15, 0.204]}
            rotation={[0.05, -0.26, 0.16]}
          >
            <meshPhysicalMaterial
              color={lapelColor}
              roughness={0.44}
              metalness={0.22}
              clearcoat={0.25}
            />
          </mesh>
          <mesh
            castShadow
            geometry={geometries.lapelGeo}
            position={[0.112, 0.15, 0.204]}
            rotation={[0.05, 0.26, -0.16]}
            scale={[-1, 1, 1]}
          >
            <meshPhysicalMaterial
              color={lapelColor}
              roughness={0.44}
              metalness={0.22}
              clearcoat={0.25}
            />
          </mesh>

          {/* Glowing Cyan Lapel Pin */}
          <mesh position={[-0.138, 0.22, 0.248]}>
            <sphereGeometry args={[0.019, 14, 14]} />
            <meshPhysicalMaterial
              color={theme.pedestalRingColor}
              emissive={theme.pedestalRingColor}
              emissiveIntensity={1.8}
              roughness={0.1}
              metalness={0.85}
              clearcoat={1}
            />
          </mesh>

          {/* Jacket Buttons */}
          {[-0.08, -0.2].map((by) => (
            <mesh key={by} position={[0, by, 0.224]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.016, 16]} />
              <meshPhysicalMaterial color="#090d1a" roughness={0.14} metalness={0.75} clearcoat={1} />
            </mesh>
          ))}

          {/* Maroon Silk Pocket Square */}
          <mesh position={[0.19, 0.12, 0.198]} rotation={[0.08, 0.3, -0.22]}>
            <boxGeometry args={[0.075, 0.06, 0.02]} />
            <meshPhysicalMaterial color={maroonTieColor} roughness={0.28} sheen={0.95} />
          </mesh>
        </group>

        {/* Left & Right Anchored Shoulders, Arms & Hands */}
        <group ref={leftArmRef} position={[-0.295, 0.28, 0]}>
          <mesh castShadow position={[0, 0, 0]}>
            <sphereGeometry args={[0.094, 18, 16]} />
            <meshPhysicalMaterial
              color={suitColor}
              roughness={0.58}
              metalness={0.14}
              sheen={0.7}
              sheenColor="#38bdf8"
            />
          </mesh>
          <mesh castShadow position={[-0.045, -0.2, 0.025]} rotation={[0.14, 0, 0.14]}>
            <capsuleGeometry args={[0.084, 0.33, 12, 18]} />
            <meshPhysicalMaterial
              color={suitColor}
              roughness={0.58}
              metalness={0.14}
              sheen={0.7}
              sheenColor="#38bdf8"
            />
          </mesh>
          <mesh position={[-0.08, -0.39, 0.055]} rotation={[0.14, 0, 0.14]}>
            <cylinderGeometry args={[0.072, 0.072, 0.05, 18]} />
            <meshStandardMaterial color={whiteShirtColor} roughness={0.38} />
          </mesh>
          <mesh castShadow position={[-0.095, -0.46, 0.075]}>
            <sphereGeometry args={[0.078, 20, 16]} />
            <meshPhysicalMaterial color={skinColor} roughness={0.4} sheen={0.35} sheenColor="#f59e0b" />
          </mesh>
        </group>

        <group ref={rightArmRef} position={[0.295, 0.28, 0]}>
          <mesh castShadow position={[0, 0, 0]}>
            <sphereGeometry args={[0.094, 18, 16]} />
            <meshPhysicalMaterial
              color={suitColor}
              roughness={0.58}
              metalness={0.14}
              sheen={0.7}
              sheenColor="#38bdf8"
            />
          </mesh>
          <mesh castShadow position={[0.045, -0.2, 0.025]} rotation={[0.14, 0, -0.14]}>
            <capsuleGeometry args={[0.084, 0.33, 12, 18]} />
            <meshPhysicalMaterial
              color={suitColor}
              roughness={0.58}
              metalness={0.14}
              sheen={0.7}
              sheenColor="#38bdf8"
            />
          </mesh>
          <mesh position={[0.08, -0.39, 0.055]} rotation={[0.14, 0, -0.14]}>
            <cylinderGeometry args={[0.072, 0.072, 0.05, 18]} />
            <meshStandardMaterial color={whiteShirtColor} roughness={0.38} />
          </mesh>
          <mesh castShadow position={[0.095, -0.46, 0.075]}>
            <sphereGeometry args={[0.078, 20, 16]} />
            <meshPhysicalMaterial color={skinColor} roughness={0.4} sheen={0.35} sheenColor="#f59e0b" />
          </mesh>
        </group>

        {/* Neck */}
        <mesh castShadow position={[0, 0.48, 0.01]}>
          <cylinderGeometry args={[0.115, 0.135, 0.18, 24]} />
          <meshPhysicalMaterial color={skinColor} roughness={0.4} sheen={0.32} sheenColor="#f59e0b" />
        </mesh>

        {/* Head Assembly */}
        <group ref={headGroupRef} position={[0, 0.87, 0.02]}>
          <mesh castShadow receiveShadow scale={[0.94, 1.08, 0.96]}>
            <sphereGeometry args={[0.37, 36, 32]} />
            <meshPhysicalMaterial
              color={skinColor}
              roughness={0.38}
              metalness={0.04}
              sheen={0.42}
              sheenColor="#f59e0b"
              clearcoat={0.12}
              clearcoatRoughness={0.45}
            />
          </mesh>

          <mesh castShadow position={[0, -0.16, 0.06]} scale={[0.88, 0.72, 0.84]}>
            <sphereGeometry args={[0.25, 24, 20]} />
            <meshPhysicalMaterial color={skinColor} roughness={0.4} sheen={0.32} sheenColor="#f59e0b" />
          </mesh>

          {[-0.35, 0.35].map((ex) => (
            <group key={ex} position={[ex, -0.02, -0.02]}>
              <mesh castShadow scale={[0.55, 1, 0.7]}>
                <sphereGeometry args={[0.085, 16, 16]} />
                <meshPhysicalMaterial color={skinColor} roughness={0.44} />
              </mesh>
              <mesh position={[ex < 0 ? -0.012 : 0.012, 0, 0.01]} scale={[0.35, 0.65, 0.45]}>
                <sphereGeometry args={[0.06, 12, 12]} />
                <meshStandardMaterial color="#7d4a2d" roughness={0.62} />
              </mesh>
            </group>
          ))}

          {/* Modern Short-Cropped Dark Hair with subtle specular */}
          <group position={[0, 0.06, -0.015]}>
            <mesh castShadow position={[0, 0.06, 0]} scale={[0.96, 1.05, 0.98]}>
              <sphereGeometry args={[0.375, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
              <meshPhysicalMaterial color={hairColor} roughness={0.48} metalness={0.14} clearcoat={0.2} />
            </mesh>
            <mesh castShadow position={[0, 0.255, 0.135]} rotation={[-0.22, 0.08, 0]} scale={[0.98, 0.48, 0.68]}>
              <sphereGeometry args={[0.27, 24, 18]} />
              <meshPhysicalMaterial color={hairColor} roughness={0.46} metalness={0.14} clearcoat={0.2} />
            </mesh>
            <mesh castShadow position={[0, 0.04, -0.08]} scale={[0.965, 0.96, 0.88]}>
              <sphereGeometry args={[0.365, 24, 20, Math.PI * 0.65, Math.PI * 1.7, 0.3, Math.PI * 0.55]} />
              <meshStandardMaterial color="#1d1824" roughness={0.68} />
            </mesh>
          </group>

          {/* Expressive Cartoon Eyes */}
          {[-0.125, 0.125].map((eyeX, i) => (
            <group key={eyeX} position={[eyeX, 0.03, 0.295]}>
              <mesh scale={[1, 1.08, 0.72]}>
                <sphereGeometry args={[0.072, 20, 18]} />
                <meshPhysicalMaterial color="#ffffff" roughness={0.08} clearcoat={1} />
              </mesh>
              <mesh
                ref={i === 0 ? leftPupilRef : rightPupilRef}
                position={[0, 0, 0.045]}
                scale={[1, 1, 0.55]}
              >
                <sphereGeometry args={[0.038, 16, 16]} />
                <meshPhysicalMaterial color="#160f0c" roughness={0.06} clearcoat={1} />
              </mesh>
              <mesh position={[0.015, 0.016, 0.064]}>
                <sphereGeometry args={[0.011, 10, 10]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh
                ref={i === 0 ? leftLidRef : rightLidRef}
                rotation={[-1.42, 0, 0]}
                scale={[1.05, 1.12, 0.76]}
              >
                <sphereGeometry args={[0.074, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
                <meshStandardMaterial color="#8a5436" roughness={0.48} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}

          {/* Expressive Dark Eyebrows */}
          <mesh
            ref={leftBrowRef}
            geometry={geometries.browGeo}
            position={[-0.13, 0.135, 0.305]}
            rotation={[0, -0.14, 0.06]}
          >
            <meshStandardMaterial color={hairColor} roughness={0.55} />
          </mesh>
          <mesh
            ref={rightBrowRef}
            geometry={geometries.browGeo}
            position={[0.13, 0.135, 0.305]}
            rotation={[0, 0.14, -0.06]}
          >
            <meshStandardMaterial color={hairColor} roughness={0.55} />
          </mesh>

          {/* Stylized Nose */}
          <mesh castShadow position={[0, -0.035, 0.365]} scale={[0.85, 1.05, 1.05]}>
            <sphereGeometry args={[0.056, 18, 16]} />
            <meshPhysicalMaterial color="#965d3c" roughness={0.38} sheen={0.35} />
          </mesh>

          {/* Neat Signature Mustache */}
          <mesh
            castShadow
            geometry={geometries.mustacheGeo}
            position={[0, -0.105, 0.312]}
          >
            <meshPhysicalMaterial color={hairColor} roughness={0.5} metalness={0.08} />
          </mesh>

          {/* Warm Smile */}
          <mesh geometry={geometries.smileGeo} position={[0, -0.175, 0.328]}>
            <meshStandardMaterial color="#59281e" roughness={0.45} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function CharacterAvatar({
  theme,
  pointerRef,
  roamStateRef,
  impulseCount,
  glbUrl,
  isSoftwareGl,
  onAvatarClick,
  onAvatarHover,
  onGlbStatusChange,
}: CharacterAvatarProps) {
  const glbWrapperRef = useRef<THREE.Group>(null);
  const glbSpringRef = useRef<SpringState>({ value: 1, velocity: 0 });
  const prevImpulseRef = useRef(impulseCount);

  useEffect(() => {
    if (!glbUrl) {
      onGlbStatusChange?.('procedural');
    } else {
      onGlbStatusChange?.('loading');
    }
  }, [glbUrl, onGlbStatusChange]);

  useEffect(() => {
    if (impulseCount !== prevImpulseRef.current) {
      prevImpulseRef.current = impulseCount;
      glbSpringRef.current = { value: 0.86, velocity: 4.5 };
    }
  }, [impulseCount]);

  useFrame((state, delta) => {
    if (!glbUrl || !glbWrapperRef.current) return;
    const dt = Math.min(delta, 0.05);
    const roam = roamStateRef.current;
    const floorY = getWorldFloorY(roam.x, roam.z);
    glbSpringRef.current = stepSpring(glbSpringRef.current, 1, 180, 12, dt);
    const sy = glbSpringRef.current.value;
    const sxz = 1 + (1 - sy) * 0.4;
    glbWrapperRef.current.scale.set(sxz, sy, sxz);

    const hop = Math.abs(Math.sin(state.clock.elapsedTime * 9)) * roam.walkSpeed * 0.055;
    glbWrapperRef.current.position.x = roam.x;
    glbWrapperRef.current.position.y = dampValue(
      glbWrapperRef.current.position.y,
      floorY + 0.95 + hop,
      12,
      dt,
    );
    glbWrapperRef.current.position.z = roam.z;

    const { yaw, pitch } = computeHeadTarget(pointerRef.current.x, pointerRef.current.y, 0.35, 0.14);
    glbWrapperRef.current.rotation.y = lerpAngle(
      glbWrapperRef.current.rotation.y,
      yaw * (1 - roam.walkSpeed * 0.6) + roam.yaw,
      1 - Math.exp(-10 * dt),
    );
    glbWrapperRef.current.rotation.x = dampValue(glbWrapperRef.current.rotation.x, pitch, 6, dt);
  });

  const proceduralFallback = (
    <ProceduralAlifSculpture
      theme={theme}
      pointerRef={pointerRef}
      roamStateRef={roamStateRef}
      impulseCount={impulseCount}
      onAvatarClick={onAvatarClick}
      onAvatarHover={onAvatarHover}
    />
  );

  if (!glbUrl) {
    return proceduralFallback;
  }

  return (
    <GlbErrorBoundary
      resetKey={glbUrl}
      fallback={proceduralFallback}
      onError={() => onGlbStatusChange?.('error')}
    >
      <Suspense fallback={proceduralFallback}>
        <group
          ref={glbWrapperRef}
          onClick={(e) => {
            e.stopPropagation();
            onAvatarClick();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
            onAvatarHover();
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          <GlbSlotContent
            url={glbUrl}
            onLoaded={() => onGlbStatusChange?.('loaded')}
          />
        </group>
      </Suspense>
    </GlbErrorBoundary>
  );
}
