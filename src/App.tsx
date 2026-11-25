/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NEON_NIGHT_THEME } from './config/ThemeConfig';
import {
  CameraMode,
  STAGE_SCROLL_STOPS,
  clamp,
  getActiveStageIndex,
} from './utils/sceneMath';
import { detectWebGLCapabilities } from './utils/webglDetector';
import { SoundEngine } from './audio/SoundEngine';
import { Scene } from './components/Scene';
import { BackgroundTypography, ChapterOverlay } from './components/ChapterOverlay';
import { GlassHUD } from './components/GlassHUD';

export default function App() {
  const { hasWebGL, isSoftwareGl } = useMemo(() => detectWebGLCapabilities(), []);
  const [cameraMode, setCameraMode] = useState<CameraMode>('drift');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [glbStatus, setGlbStatus] = useState<'procedural' | 'loading' | 'loaded' | 'error'>(
    'procedural',
  );
  const [impulseCount, setImpulseCount] = useState(0);
  const [impulseBurst, setImpulseBurst] = useState(false);
  const [resetRoamNonce, setResetRoamNonce] = useState(0);
  const [roamSnapshot, setRoamSnapshot] = useState({ x: 0, z: 0, isManual: false });

  // Throttled React pointer & scroll state for DOM kinetic typography, plus zero-lag refs for 3D loop
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const scrollRef = useRef<number>(0);
  const [domPointer, setDomPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scrollProgress, setScrollProgress] = useState(0);
  const burstTimeoutRef = useRef<number | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const theme = NEON_NIGHT_THEME;

  useEffect(() => {
    document.documentElement.dataset.softwareGl = isSoftwareGl ? 'true' : 'false';
  }, [isSoftwareGl]);

  // Pointer & scroll tracking across viewport
  useEffect(() => {
    let rafId = 0;
    let pendingDomUpdate = false;

    const updatePointer = (clientX: number, clientY: number) => {
      const nx = clamp((clientX / Math.max(window.innerWidth, 1)) * 2 - 1, -1, 1);
      const ny = clamp(-((clientY / Math.max(window.innerHeight, 1)) * 2 - 1), -1, 1);
      pointerRef.current.x = nx;
      pointerRef.current.y = ny;

      if (!pendingDomUpdate) {
        pendingDomUpdate = true;
        rafId = window.requestAnimationFrame(() => {
          pendingDomUpdate = false;
          setDomPointer({ x: pointerRef.current.x, y: pointerRef.current.y });
        });
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      updatePointer(e.clientX, e.clientY);
    };

    const onScroll = () => {
      const maxScroll = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1,
      );
      const progress = clamp(window.scrollY / maxScroll, 0, 1);
      scrollRef.current = progress;
      setScrollProgress(progress);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const triggerImpulse = useCallback(() => {
    setImpulseCount((c) => c + 1);
    setImpulseBurst(true);
    SoundEngine.playImpulseWhoosh();

    if (burstTimeoutRef.current) {
      window.clearTimeout(burstTimeoutRef.current);
    }
    burstTimeoutRef.current = window.setTimeout(() => {
      setImpulseBurst(false);
    }, 260);
  }, []);

  const handleGroundMove = useCallback(() => {
    SoundEngine.playClickPop();
  }, []);

  const handleSelectStage = useCallback((idx: 0 | 1 | 2 | 3 | 4) => {
    setResetRoamNonce((n) => n + 1);
    const maxScroll = Math.max(
      document.documentElement.scrollHeight - window.innerHeight,
      1,
    );
    const targetTop = STAGE_SCROLL_STOPS[idx] * maxScroll;
    window.scrollTo({ top: targetTop, behavior: 'smooth' });
    SoundEngine.playClickPop();
  }, []);

  const handleToggleCameraMode = useCallback(() => {
    setCameraMode((prev) => (prev === 'drift' ? 'orbit' : 'drift'));
    SoundEngine.playClickPop();
  }, []);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      SoundEngine.setEnabled(next);
      return next;
    });
  }, []);

  const handleSetGlbUrl = useCallback((nextUrl: string | null) => {
    if (blobUrlRef.current && blobUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (nextUrl && nextUrl.startsWith('blob:')) {
      blobUrlRef.current = nextUrl;
    }
    setGlbUrl(nextUrl);
    SoundEngine.playClickPop();
  }, []);

  const handleRoamSnapshot = useCallback((x: number, z: number, isManual: boolean) => {
    setRoamSnapshot({
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
      isManual,
    });
  }, []);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      if (burstTimeoutRef.current) {
        window.clearTimeout(burstTimeoutRef.current);
      }
    };
  }, []);

  const stageIndex = getActiveStageIndex(scrollProgress);

  return (
    <main
      data-theme="neon"
      data-camera-mode={cameraMode}
      data-sound={soundEnabled ? 'on' : 'off'}
      data-glb-status={glbStatus}
      data-stage={stageIndex + 1}
      data-roam-x={roamSnapshot.x}
      data-roam-z={roamSnapshot.z}
      data-roam-manual={roamSnapshot.isManual ? 'true' : 'false'}
      className="relative w-full"
      style={{ height: '520vh', backgroundColor: theme.background }}
    >
      {/* Fixed 100vw x 100dvh Layered Neon Night 3D Stage */}
      <div className="fixed inset-0 h-dvh w-screen overflow-hidden">
        {/* Layer 1: Deep Obsidian & Midnight Neon Sky Backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{ background: theme.backdropGradient }}
        />

        {/* Layer 2: Unboxed Kinetic Deep-Background Typography behind 3D world */}
        <BackgroundTypography
          theme={theme}
          pointer={domPointer}
          scrollProgress={scrollProgress}
          cameraMode={cameraMode}
          impulseBurst={impulseBurst}
        />

        {/* Layer 3: Transparent-Sky Reflective 3D World & Walking Alif */}
        <div className="relative z-10 h-full w-full">
          <Scene
            theme={theme}
            cameraMode={cameraMode}
            pointerRef={pointerRef}
            scrollRef={scrollRef}
            resetRoamNonce={resetRoamNonce}
            impulseCount={impulseCount}
            glbUrl={glbUrl}
            isSoftwareGl={isSoftwareGl}
            hasWebGL={hasWebGL}
            onSceneClick={triggerImpulse}
            onGroundMove={handleGroundMove}
            onPropHover={() => SoundEngine.playHoverChime()}
            onGlbStatusChange={setGlbStatus}
            onRoamSnapshot={handleRoamSnapshot}
          />
        </div>

        {/* Layer 4: Unboxed Glowing Foreground Display Typography */}
        <ChapterOverlay
          theme={theme}
          pointer={domPointer}
          scrollProgress={scrollProgress}
          cameraMode={cameraMode}
          impulseBurst={impulseBurst}
          isManualRoam={roamSnapshot.isManual}
          onPulseWorld={triggerImpulse}
          onSelectStage={handleSelectStage}
        />

        {/* Layer 5: Unboxed Right Rail & Sleek Dark-Glass Pill Controls */}
        <GlassHUD
          theme={theme}
          cameraMode={cameraMode}
          soundEnabled={soundEnabled}
          stageIndex={stageIndex}
          glbUrl={glbUrl}
          glbStatus={glbStatus}
          onToggleCameraMode={handleToggleCameraMode}
          onToggleSound={handleToggleSound}
          onSelectStage={handleSelectStage}
          onSetGlbUrl={handleSetGlbUrl}
        />
      </div>
    </main>
  );
}
