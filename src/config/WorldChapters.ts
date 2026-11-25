export interface WorldSpotMeta {
  index: 0 | 1 | 2 | 3 | 4;
  code: string;
  bgWord: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  align: 'hero' | 'left' | 'right' | 'center-low' | 'finale';
}

export const WORLD_CHAPTERS: readonly WorldSpotMeta[] = [
  {
    index: 0,
    code: '01',
    bgWord: 'ALIF',
    title: 'ALIF AHMED',
    subtitle: 'BUNGCHONG BANGCHONG · WASD OR CLICK GROUND',
    actionLabel: 'KEEP WALKING',
    align: 'hero',
  },
  {
    index: 1,
    code: '02',
    bgWord: 'SIDE TO SIDE',
    title: 'ROAM',
    subtitle: 'STRUT · TURN AROUND · BOUNCE ARCHES',
    actionLabel: 'NEXT VIBE',
    align: 'left',
  },
  {
    index: 2,
    code: '03',
    bgWord: 'SNACKS',
    title: 'EAT & CHILL',
    subtitle: 'DONUTS · BOBA · BURGERS · ICE CREAM',
    actionLabel: 'KEEP DRIFTING',
    align: 'right',
  },
  {
    index: 3,
    code: '04',
    bgWord: 'NO RUSH',
    title: 'CHILL',
    subtitle: 'PUFFY CLOUDS · ZERO STRESS · VIBES',
    actionLabel: 'FLOAT ON',
    align: 'left',
  },
  {
    index: 4,
    code: '05',
    bgWord: 'NOTHING',
    title: 'DOING NOTHING',
    subtitle: 'SLOW BUBBLES · ENDLESS LOOP',
    actionLabel: 'LOOP BACK',
    align: 'finale',
  },
];
