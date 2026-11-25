import React, { useRef, useState } from 'react';
import {
  Box,
  ChevronDown,
  ChevronUp,
  Orbit,
  Upload,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import { ThemePalette } from '../config/ThemeConfig';
import { CameraMode, isValidGlbSource } from '../utils/sceneMath';

interface GlassHUDProps {
  theme: ThemePalette;
  cameraMode: CameraMode;
  soundEnabled: boolean;
  stageIndex: 0 | 1 | 2 | 3 | 4;
  glbUrl: string | null;
  glbStatus: 'procedural' | 'loading' | 'loaded' | 'error';
  onToggleCameraMode: () => void;
  onToggleSound: () => void;
  onSelectStage: (stageIndex: 0 | 1 | 2 | 3 | 4) => void;
  onSetGlbUrl: (url: string | null) => void;
}

export function GlassHUD({
  theme,
  cameraMode,
  soundEnabled,
  stageIndex,
  glbUrl,
  glbStatus,
  onToggleCameraMode,
  onToggleSound,
  onSelectStage,
  onSetGlbUrl,
}: GlassHUDProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [glbOpen, setGlbOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlInvalid, setUrlInvalid] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isValidGlbSource(file.name)) {
      setUrlInvalid(true);
      return;
    }
    setUrlInvalid(false);
    const objectUrl = URL.createObjectURL(file);
    onSetGlbUrl(objectUrl);
    setGlbOpen(false);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidGlbSource(urlInput)) {
      setUrlInvalid(true);
      return;
    }
    setUrlInvalid(false);
    onSetGlbUrl(urlInput.trim());
    setGlbOpen(false);
  };

  const spots: Array<{ index: 0 | 1 | 2 | 3 | 4; label: string }> = [
    { index: 0, label: '01' },
    { index: 1, label: '02' },
    { index: 2, label: '03' },
    { index: 3, label: '04' },
    { index: 4, label: '05' },
  ];

  return (
    <>
      {/* Unboxed floating 5-spot index rail on right margin */}
      <nav
        aria-label="Scroll stages"
        className="pointer-events-auto fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-end gap-2.5 select-none"
      >
        {spots.map((ch) => {
          const active = stageIndex === ch.index;
          return (
            <button
              key={ch.label}
              type="button"
              onClick={() => onSelectStage(ch.index)}
              aria-label={`Spot ${ch.index + 1}`}
              aria-current={active ? 'step' : undefined}
              className="group flex items-center gap-2 py-1 text-[11px] font-extrabold tracking-[0.2em] transition-all duration-200 focus-visible:outline-2"
              style={{
                color: active ? theme.titleAccent : theme.titleColor,
                opacity: active ? 1 : 0.45,
                textShadow: active
                  ? `0 0 14px ${theme.pulseColor}88`
                  : '0 2px 8px rgba(0,0,0,0.85)',
              }}
            >
              <span
                className="transition-transform duration-200"
                style={{ transform: active ? 'scale(1.12)' : 'scale(1)' }}
              >
                {ch.label}
              </span>
              <span
                aria-hidden="true"
                className="h-[2px] transition-all duration-200"
                style={{
                  width: active ? '22px' : '8px',
                  backgroundColor: active ? theme.titleAccent : theme.titleColor,
                  boxShadow: active ? `0 0 10px ${theme.pulseColor}` : 'none',
                }}
              />
            </button>
          );
        })}
      </nav>

      <div className="pointer-events-none fixed inset-x-0 bottom-3.5 sm:bottom-5 z-30 flex flex-col items-center px-3">
        {/* Compact .glb slot popover */}
        {glbOpen && !collapsed && (
          <div
            className="pointer-events-auto glass-surface mb-2.5 w-full max-w-sm rounded-2xl p-3 transition-all duration-200"
            style={{
              backgroundColor: theme.hudSurface,
              border: `1px solid ${theme.hudBorder}`,
              boxShadow: `0 22px 54px -12px rgba(0,0,0,0.65), inset 0 1px 0 ${theme.hudHighlight}`,
              color: theme.hudText,
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide">
                <Box className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                <span>.glb slot</span>
                {glbStatus === 'loaded' && (
                  <span className="text-cyan-300 opacity-85">· active</span>
                )}
                {glbStatus === 'error' && (
                  <span className="text-rose-400">· fallback</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setGlbOpen(false)}
                aria-label="Close .glb slot"
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-opacity hover:opacity-75 focus-visible:outline-2"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleUrlSubmit} className="flex items-center gap-1.5">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (urlInvalid) setUrlInvalid(false);
                }}
                placeholder="https://.../avatar.glb"
                aria-label=".glb URL"
                className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-xs outline-none focus-visible:ring-2"
                style={{
                  border: urlInvalid
                    ? '1px solid #f43f5e'
                    : `1px solid ${theme.hudBorder}`,
                  color: theme.hudText,
                }}
              />
              <button
                type="submit"
                className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-transform active:scale-95"
                style={{
                  backgroundColor: theme.hudActiveBg,
                  color: theme.hudActiveText,
                }}
              >
                Load
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".glb,.gltf"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload .glb file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-opacity hover:opacity-80"
                style={{
                  border: `1px solid ${theme.hudBorder}`,
                }}
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Upload .glb</span>
              </button>

              {glbUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onSetGlbUrl(null);
                    setUrlInput('');
                    setUrlInvalid(false);
                  }}
                  className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{
                    border: `1px solid ${theme.hudBorder}`,
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* Collapse / Expand toggle tab */}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? 'Show controls' : 'Hide controls'}
          aria-expanded={!collapsed}
          className="pointer-events-auto glass-surface mb-1.5 flex h-7 w-11 items-center justify-center rounded-full transition-transform duration-200 hover:scale-105 focus-visible:outline-2"
          style={{
            backgroundColor: theme.hudSurface,
            border: `1px solid ${theme.hudBorder}`,
            boxShadow: `0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 ${theme.hudHighlight}`,
            color: theme.hudText,
          }}
        >
          {collapsed ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Sleek Dark-Glass Pill Dock: Camera Mode, Sound Toggle, .glb Slot */}
        {!collapsed && (
          <nav
            aria-label="Scene Controls"
            className="pointer-events-auto glass-surface flex max-w-[94vw] items-center justify-center gap-1.5 sm:gap-2 rounded-full p-1.5 transition-all duration-300"
            style={{
              backgroundColor: theme.hudSurface,
              border: `1px solid ${theme.hudBorder}`,
              boxShadow: `0 20px 50px -10px rgba(0,0,0,0.68), 0 0 28px rgba(34,211,238,0.1), inset 0 1px 0 ${theme.hudHighlight}`,
              color: theme.hudText,
            }}
          >
            {/* 1. Camera / Motion Toggle */}
            <button
              type="button"
              onClick={onToggleCameraMode}
              aria-pressed={cameraMode === 'orbit'}
              className="flex min-h-[34px] sm:min-h-[36px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full px-3 sm:px-3.5 py-1 text-[11px] sm:text-xs font-semibold transition-all duration-150 hover:opacity-90 focus-visible:outline-2"
              style={{
                backgroundColor:
                  cameraMode === 'orbit' ? theme.hudActiveBg : 'rgba(255,255,255,0.07)',
                color: cameraMode === 'orbit' ? theme.hudActiveText : theme.hudText,
              }}
            >
              {cameraMode === 'orbit' ? (
                <Orbit className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Wind className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{cameraMode === 'orbit' ? 'Orbit' : 'Auto-Follow'}</span>
            </button>

            {/* 2. Sound Toggle */}
            <button
              type="button"
              onClick={onToggleSound}
              aria-pressed={soundEnabled}
              className="flex min-h-[34px] sm:min-h-[36px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full px-3 sm:px-3.5 py-1 text-[11px] sm:text-xs font-semibold transition-all duration-150 hover:opacity-90 focus-visible:outline-2"
              style={{
                backgroundColor: soundEnabled ? theme.hudActiveBg : 'rgba(255,255,255,0.07)',
                color: soundEnabled ? theme.hudActiveText : theme.hudText,
              }}
            >
              {soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
            </button>

            {/* 3. Subtle .glb Slot Trigger */}
            <button
              type="button"
              onClick={() => setGlbOpen((prev) => !prev)}
              aria-expanded={glbOpen}
              className="flex min-h-[34px] sm:min-h-[36px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full px-3 sm:px-3.5 py-1 text-[11px] sm:text-xs font-semibold transition-all duration-150 hover:opacity-90 focus-visible:outline-2"
              style={{
                backgroundColor:
                  glbOpen || glbUrl ? theme.hudActiveBg : 'rgba(255,255,255,0.07)',
                color: glbOpen || glbUrl ? theme.hudActiveText : theme.hudText,
              }}
            >
              <Box className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>.glb slot</span>
            </button>
          </nav>
        )}
      </div>
    </>
  );
}
