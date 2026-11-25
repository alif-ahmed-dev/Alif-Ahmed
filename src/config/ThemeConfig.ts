export interface ThemePalette {
  id: 'neon';
  label: string;
  background: string;
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  skyGlow: string;
  stageFloorColor: string;
  stageGridColor: string;
  archColor: string;
  backdropGradient: string;
  fogColor: string;
  fogDensity: number;
  keyLightColor: string;
  keyLightIntensity: number;
  fillSkyColor: string;
  fillGroundColor: string;
  fillIntensity: number;
  rimLightColor: string;
  rimLightIntensity: number;
  amberRimColor: string;
  amberRimIntensity: number;
  envIntensity: number;
  pedestalColor: string;
  pedestalRingColor: string;
  propColors: [string, string, string, string];
  pulseColor: string;
  bloomIntensity: number;
  bloomThreshold: number;
  titleColor: string;
  titleAccent: string;
  titleGradient: string;
  titleGlow: string;
  hudSurface: string;
  hudBorder: string;
  hudHighlight: string;
  hudText: string;
  hudMuted: string;
  hudActiveBg: string;
  hudActiveText: string;
}

export const NEON_NIGHT_THEME: ThemePalette = {
  id: 'neon',
  label: 'Neon Night',
  background: '#04050d',
  skyTop: '#03040a',
  skyMid: '#090d22',
  skyHorizon: '#16113a',
  skyGlow: '#22d3ee',
  stageFloorColor: '#070a18',
  stageGridColor: '#22d3ee',
  archColor: '#22d3ee',
  backdropGradient:
    'radial-gradient(ellipse at 50% 24%, #181743 0%, #090d21 48%, #04050d 100%)',
  fogColor: '#060816',
  fogDensity: 0.017,
  keyLightColor: '#ffe7cf',
  keyLightIntensity: 2.15,
  fillSkyColor: '#38bdf8',
  fillGroundColor: '#4c1d95',
  fillIntensity: 0.56,
  rimLightColor: '#22d3ee',
  rimLightIntensity: 5.8,
  amberRimColor: '#f59e0b',
  amberRimIntensity: 3.6,
  envIntensity: 0.58,
  pedestalColor: '#0c1122',
  pedestalRingColor: '#22d3ee',
  propColors: ['#22d3ee', '#f43f5e', '#a855f7', '#f59e0b'],
  pulseColor: '#22d3ee',
  bloomIntensity: 0.92,
  bloomThreshold: 0.64,
  titleColor: '#ffffff',
  titleAccent: '#67e8f9',
  titleGradient: 'linear-gradient(125deg, #67e8f9 0%, #c084fc 50%, #fb7185 100%)',
  titleGlow: 'rgba(18, 28, 66, 0.85)',
  hudSurface: 'rgba(9, 13, 28, 0.72)',
  hudBorder: 'rgba(103, 232, 249, 0.22)',
  hudHighlight: 'rgba(255, 255, 255, 0.18)',
  hudText: '#f8fafc',
  hudMuted: '#94a3b8',
  hudActiveBg: '#22d3ee',
  hudActiveText: '#060913',
};
