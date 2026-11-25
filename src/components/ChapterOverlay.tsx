import React from 'react';
import { ArrowDown, ArrowUp, Sparkles } from 'lucide-react';
import { ThemePalette } from '../config/ThemeConfig';
import { WORLD_CHAPTERS } from '../config/WorldChapters';
import { CameraMode, computeScrollCameraRig } from '../utils/sceneMath';

interface BackgroundTypographyProps {
  theme: ThemePalette;
  pointer: { x: number; y: number };
  scrollProgress: number;
  cameraMode: CameraMode;
  impulseBurst: boolean;
}

export function BackgroundTypography({
  theme,
  pointer,
  scrollProgress,
  cameraMode,
  impulseBurst,
}: BackgroundTypographyProps) {
  const rig = computeScrollCameraRig(scrollProgress, cameraMode);
  const spot = WORLD_CHAPTERS[rig.stageIndex];

  return (
    <div
      aria-hidden="true"
      data-testid="background-typography"
      className="pointer-events-none fixed inset-0 z-[2] flex items-center justify-center overflow-hidden select-none"
    >
      <div
        className="flex w-full items-center justify-center transition-transform duration-500 ease-out"
        style={{
          transform: `translate3d(calc(${rig.bgParallaxX}vw + ${pointer.x * 32}px), calc(${-18 + rig.bgParallaxY * 0.7}vh + ${pointer.y * 18}px), 0) scale(${rig.bgScale * (impulseBurst ? 1.05 : 1)}) rotate(${rig.bgRotateDeg}deg)`,
        }}
      >
        <span
          key={spot.index}
          className="font-display max-w-[92vw] text-center font-black uppercase leading-[0.86] tracking-[-0.03em] bg-clip-text text-transparent transition-opacity duration-500"
          style={{
            fontSize: 'clamp(4.4rem, 15.5vw, 14.5rem)',
            backgroundImage:
              'linear-gradient(180deg, rgba(165, 243, 252, 0.34) 0%, rgba(168, 85, 247, 0.16) 65%, rgba(244, 63, 94, 0.08) 100%)',
            filter: `drop-shadow(0 0 42px ${theme.pulseColor}44)`,
          }}
        >
          {spot.bgWord}
        </span>
      </div>
    </div>
  );
}

interface ChapterOverlayProps {
  theme: ThemePalette;
  pointer: { x: number; y: number };
  scrollProgress: number;
  cameraMode: CameraMode;
  impulseBurst: boolean;
  isManualRoam: boolean;
  onPulseWorld: () => void;
  onSelectStage: (stageIndex: 0 | 1 | 2 | 3 | 4) => void;
}

export function ChapterOverlay({
  theme,
  pointer,
  scrollProgress,
  cameraMode,
  impulseBurst,
  isManualRoam,
  onPulseWorld,
  onSelectStage,
}: ChapterOverlayProps) {
  const rig = computeScrollCameraRig(scrollProgress, cameraMode);
  const spot = WORLD_CHAPTERS[rig.stageIndex];

  const rotateY = pointer.x * 8;
  const rotateX = -pointer.y * 6;
  const scale = rig.titleScale * (isManualRoam ? 0.74 : 1) * (impulseBurst ? 1.05 : 1);
  const skewX = isManualRoam ? 0 : rig.titleSkewDeg * 0.72;
  const rotateZ = isManualRoam ? 0 : rig.titleRotateDeg;

  const isLeftSpot = spot.align === 'left';
  const isRightSpot = spot.align === 'right';
  const nextStage = ((spot.index + 1) % 5) as 0 | 1 | 2 | 3 | 4;
  const desktopShiftVw = isManualRoam ? 0 : rig.titleOffsetXPercent * 0.78;

  return (
    <header
      data-testid="foreground-typography"
      className="pointer-events-none fixed inset-x-0 top-0 z-20 flex justify-center px-4 sm:px-8 select-none"
      style={{ perspective: '1200px' }}
    >
      <div
        className={`relative flex flex-col items-center text-center transition-transform duration-500 ease-out md:[--x-shift:var(--desktop-x)] [--x-shift:0vw] md:[--y-shift:var(--desktop-y)] [--y-shift:2.75vh] ${
          isLeftSpot
            ? 'md:items-start md:text-left'
            : isRightSpot
              ? 'md:items-end md:text-right'
              : 'md:items-center md:text-center'
        }`}
        style={
          {
            '--desktop-x': `${desktopShiftVw}vw`,
            '--desktop-y': isManualRoam ? '1.8vh' : `${rig.titleTopVh}vh`,
            transform: `translate3d(calc(var(--x-shift) + ${pointer.x * -14}px), calc(var(--y-shift) + ${pointer.y * -8}px), 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotate(${rotateZ}deg) skewX(${skewX}deg) scale(${scale})`,
          } as React.CSSProperties
        }
      >
        {/* Atmospheric luminous aura behind unboxed foreground display type */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-24 -inset-y-12 -z-10 rounded-full blur-3xl transition-opacity duration-500"
          style={{
            background: `radial-gradient(ellipse at center, rgba(34, 211, 238, 0.18) 0%, rgba(168, 85, 247, 0.12) 42%, transparent 72%)`,
            opacity: impulseBurst ? 1 : 0.8,
          }}
        />

        {/* Unboxed Eyebrow Index + Echo */}
        <div
          className="mb-1.5 flex items-center gap-2.5 text-[10px] sm:text-xs font-extrabold tracking-[0.28em] uppercase"
          style={{
            color: theme.titleAccent,
            textShadow: `0 0 18px ${theme.pulseColor}88, 0 2px 12px rgba(0,0,0,0.9)`,
          }}
        >
          <span>{spot.code}</span>
          <span
            aria-hidden="true"
            className="h-[1.5px] w-6 opacity-75"
            style={{
              backgroundColor: theme.titleAccent,
              boxShadow: `0 0 10px ${theme.pulseColor}`,
            }}
          />
          <span>{spot.bgWord}</span>
        </div>

        {/* Monumental Unboxed Neon Display Headline */}
        <h1
          className="font-display font-black uppercase leading-[0.9] whitespace-nowrap transition-[letter-spacing] duration-300"
          style={{
            fontSize:
              spot.index === 0
                ? 'clamp(2.35rem, 6.6vw, 5.6rem)'
                : 'clamp(2.1rem, 5.6vw, 4.9rem)',
            letterSpacing: `${rig.titleLetterSpacingEm}em`,
            color: theme.titleColor,
            textShadow: `0 10px 36px rgba(0,0,0,0.9), 0 0 32px ${theme.pulseColor}55`,
          }}
        >
          {spot.index === 0 ? (
            <>
              <span>ALIF</span>{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: theme.titleGradient,
                  filter: `drop-shadow(0 8px 26px rgba(0,0,0,0.9)) drop-shadow(0 0 22px rgba(34,211,238,0.45))`,
                }}
              >
                AHMED
              </span>
            </>
          ) : (
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: theme.titleGradient,
                filter: `drop-shadow(0 8px 26px rgba(0,0,0,0.9)) drop-shadow(0 0 22px rgba(34,211,238,0.45))`,
              }}
            >
              {spot.title}
            </span>
          )}
        </h1>

        {/* Unboxed Kinetic Subtitle */}
        <p
          className="mt-2 max-w-[86vw] text-[10px] sm:text-xs font-bold tracking-[0.22em] uppercase text-slate-200/90"
          style={{
            textShadow: '0 2px 14px rgba(0,0,0,0.95)',
          }}
        >
          {spot.subtitle}
        </p>

        {/* Unboxed Editorial Text Links */}
        {!isManualRoam && (
          <div className="pointer-events-auto mt-3 flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={onPulseWorld}
              className="group inline-flex items-center gap-1.5 py-1 text-[11px] font-extrabold tracking-[0.2em] uppercase transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2"
              style={{
                color: theme.titleAccent,
                textShadow: `0 0 14px ${theme.pulseColor}77, 0 2px 10px rgba(0,0,0,0.9)`,
              }}
            >
              <Sparkles className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" aria-hidden="true" />
              <span className="border-b border-current/45 pb-0.5 transition-colors group-hover:border-current">
                BOUNCE
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectStage(nextStage)}
              aria-label={`Advance to Spot ${nextStage + 1}`}
              className="group inline-flex items-center gap-1.5 py-1 text-[11px] font-extrabold tracking-[0.2em] uppercase transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2"
              style={{
                color: theme.titleColor,
                textShadow: '0 2px 10px rgba(0,0,0,0.9)',
              }}
            >
              <span className="border-b border-current/45 pb-0.5 transition-colors group-hover:border-current">
                {spot.actionLabel}
              </span>
              {spot.index === 4 ? (
                <ArrowUp className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
