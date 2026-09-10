/**
 * Neurovox 6-Channel EMG Electrode Configuration Module
 * Centralized specifications for 6-channel surface EMG (sEMG) electrode placement,
 * target muscle anatomical references, and MediaPipe facial landmark mappings.
 */

export interface EmgChannelConfig {
  id: string; // 'CH1' | 'CH2' | 'CH3' | 'CH4' | 'CH5' | 'CH6'
  channelNumber: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  targetMuscle: string;
  facialRegion: string;
  side: 'left' | 'right' | 'center' | 'reference-dependent';
  primaryLandmarkIdx: number;
  secondaryLandmarkIndices: number[];
  anatomicalDescription: string;
  recommendedElectrodeSizeMm: number;
}

export const EMG_CHANNELS_CONFIG: Record<string, EmgChannelConfig> = {
  CH1: {
    id: 'CH1',
    channelNumber: 1,
    name: 'Left Jaw',
    targetMuscle: 'Masseter',
    facialRegion: 'Left Mandibular Angle',
    side: 'left',
    primaryLandmarkIdx: 172,
    secondaryLandmarkIndices: [136, 172, 58, 149],
    anatomicalDescription: 'Belly of the masseter muscle near the inferior-posterior border of the left mandible.',
    recommendedElectrodeSizeMm: 10,
  },
  CH2: {
    id: 'CH2',
    channelNumber: 2,
    name: 'Right Jaw',
    targetMuscle: 'Masseter',
    facialRegion: 'Right Mandibular Angle',
    side: 'right',
    primaryLandmarkIdx: 397,
    secondaryLandmarkIndices: [365, 397, 288, 378],
    anatomicalDescription: 'Belly of the masseter muscle near the inferior-posterior border of the right mandible.',
    recommendedElectrodeSizeMm: 10,
  },
  CH3: {
    id: 'CH3',
    channelNumber: 3,
    name: 'Center Chin',
    targetMuscle: 'Mentalis',
    facialRegion: 'Symphysis Mentis',
    side: 'center',
    primaryLandmarkIdx: 152,
    secondaryLandmarkIndices: [152, 175, 18, 200],
    anatomicalDescription: 'Central mentalis muscle prominence above the chin tip.',
    recommendedElectrodeSizeMm: 8,
  },
  CH4: {
    id: 'CH4',
    channelNumber: 4,
    name: 'Left Cheek',
    targetMuscle: 'Zygomaticus Major',
    facialRegion: 'Left Zygomatic Arch',
    side: 'left',
    primaryLandmarkIdx: 50,
    secondaryLandmarkIndices: [50, 117, 118, 123],
    anatomicalDescription: 'Course of zygomaticus major muscle extending from zygomatic arch toward cheek center.',
    recommendedElectrodeSizeMm: 8,
  },
  CH5: {
    id: 'CH5',
    channelNumber: 5,
    name: 'Right Cheek',
    targetMuscle: 'Zygomaticus Major',
    facialRegion: 'Right Zygomatic Arch',
    side: 'right',
    primaryLandmarkIdx: 280,
    secondaryLandmarkIndices: [280, 346, 347, 352],
    anatomicalDescription: 'Course of zygomaticus major muscle extending from zygomatic arch toward cheek center.',
    recommendedElectrodeSizeMm: 8,
  },
  CH6: {
    id: 'CH6',
    channelNumber: 6,
    name: 'Corner of Mouth',
    targetMuscle: 'Depressor / Risorius region',
    facialRegion: 'Oral Modiolus Anchor',
    side: 'reference-dependent',
    primaryLandmarkIdx: 61,
    secondaryLandmarkIndices: [61, 291, 17, 84, 314],
    anatomicalDescription: 'Modiolus hub junction lateral to labial commissure, sensing risorius and depressor anguli oris activity.',
    recommendedElectrodeSizeMm: 8,
  },
};

export const ORDERED_CHANNEL_KEYS = ['CH1', 'CH2', 'CH3', 'CH4', 'CH5', 'CH6'] as const;
