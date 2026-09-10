/**
 * Neurovox Personalized Mask Geometry & Electrode Coordinate Transformation Engine
 * Converts 3D facial landmarks and 6-channel sEMG electrode placement profiles
 * into custom mask shell dimensions and 2D/3D electrode placement coordinates.
 */

import { MaskSize } from './mask-fit';
import { ElectrodePlacementProfile, ElectrodePlacementPoint } from './electrode-placement';

export interface MaskElectrodeCoord {
  channelId: string;
  name: string;
  targetMuscle: string;
  uMm: number; // Horizontal offset from mask centerline in mm (-80 to +80 mm)
  vMm: number; // Vertical offset from mask nose-bridge in mm (0 to +140 mm)
  uPercent: number; // Normalized u percentage (0 to 100%)
  vPercent: number; // Normalized v percentage (0 to 100%)
  confidence: number;
}

export interface PersonalizedMaskGeometry {
  recommendedSize: MaskSize;
  confidence: number; // 0.0 to 1.0
  maskWidthMm: number;
  maskHeightMm: number;
  jawAccommodationMm: number;
  cheekAccommodationMm: number;
  chinAccommodationMm: number;
  mouthAlignmentMm: number;
  electrodeCoordinates: Record<string, MaskElectrodeCoord>;
  orderedElectrodeCoordinates: MaskElectrodeCoord[];
  calibrationStatus: string;
}

/**
 * Transforms an ElectrodePlacementProfile into personalized Mask Geometry specifications.
 */
export function transformFaceToMaskGeometry(
  profile: ElectrodePlacementProfile,
  estimatedJawCm: number = 13.2,
  estimatedHeightCm: number = 11.9
): PersonalizedMaskGeometry {
  const isCalibrated = profile.calibration.isCalibrated;

  // Base mask dimensions in mm (converted from cm or estimated)
  const jawDist = profile.distances.find((d) => d.pairKey === 'CH1_CH2');
  const cheekDist = profile.distances.find((d) => d.pairKey === 'CH4_CH5');

  const jawMm = jawDist?.physicalDistanceMm || estimatedJawCm * 10;
  const cheekMm = cheekDist?.physicalDistanceMm || (estimatedJawCm * 1.05) * 10;
  const heightMm = estimatedHeightCm * 10;

  // Mask shell geometry calculations
  const maskWidthMm = Math.round(Math.max(125, Math.min(175, jawMm * 1.12)));
  const maskHeightMm = Math.round(Math.max(105, Math.min(150, heightMm * 1.08)));
  const jawAccommodationMm = Math.round(jawMm * 1.04);
  const cheekAccommodationMm = Math.round(cheekMm * 1.02);
  const chinAccommodationMm = Math.round(heightMm * 0.42);
  const mouthAlignmentMm = Math.round(cheekMm * 0.58);

  // Recommended size logic
  let recommendedSize: MaskSize = 'Medium';
  if (jawMm < 123 || heightMm < 113) {
    recommendedSize = 'Small';
  } else if (jawMm > 140 || heightMm > 126) {
    recommendedSize = 'Large';
  }

  // Generate 2D mask template electrode coordinates (u, v)
  // Mask origin (0,0) is top-center nose bridge apex
  const pts = profile.points;

  const ch1 = pts['CH1']; // Left Jaw
  const ch2 = pts['CH2']; // Right Jaw
  const ch3 = pts['CH3']; // Center Chin
  const ch4 = pts['CH4']; // Left Cheek
  const ch5 = pts['CH5']; // Right Cheek
  const ch6 = pts['CH6']; // Mouth Corner

  const electrodeCoordsRecord: Record<string, MaskElectrodeCoord> = {};
  const electrodeCoordsList: MaskElectrodeCoord[] = [];

  const rawMappings = [
    { key: 'CH1', name: 'Left Jaw', muscle: 'Masseter', u: -maskWidthMm * 0.42, v: maskHeightMm * 0.78, p: ch1 },
    { key: 'CH2', name: 'Right Jaw', muscle: 'Masseter', u: maskWidthMm * 0.42, v: maskHeightMm * 0.78, p: ch2 },
    { key: 'CH3', name: 'Center Chin', muscle: 'Mentalis', u: 0, v: maskHeightMm * 0.92, p: ch3 },
    { key: 'CH4', name: 'Left Cheek', muscle: 'Zygomaticus Major', u: -maskWidthMm * 0.35, v: maskHeightMm * 0.42, p: ch4 },
    { key: 'CH5', name: 'Right Cheek', muscle: 'Zygomaticus Major', u: maskWidthMm * 0.35, v: maskHeightMm * 0.42, p: ch5 },
    { key: 'CH6', name: 'Corner of Mouth', muscle: 'Depressor / Risorius region', u: -maskWidthMm * 0.22, v: maskHeightMm * 0.65, p: ch6 },
  ];

  rawMappings.forEach((item) => {
    // Convert u (horizontal offset -w/2 to +w/2) and v (vertical offset 0 to h) into percentage
    const uPercent = parseFloat((((item.u + maskWidthMm / 2) / maskWidthMm) * 100).toFixed(1));
    const vPercent = parseFloat(((item.v / maskHeightMm) * 100).toFixed(1));

    const coord: MaskElectrodeCoord = {
      channelId: item.key,
      name: item.name,
      targetMuscle: item.muscle,
      uMm: Math.round(item.u),
      vMm: Math.round(item.v),
      uPercent: Math.max(0, Math.min(100, uPercent)),
      vPercent: Math.max(0, Math.min(100, vPercent)),
      confidence: item.p ? item.p.confidence : 0.9,
    };

    electrodeCoordsRecord[item.key] = coord;
    electrodeCoordsList.push(coord);
  });

  return {
    recommendedSize,
    confidence: profile.overallConfidence,
    maskWidthMm,
    maskHeightMm,
    jawAccommodationMm,
    cheekAccommodationMm,
    chinAccommodationMm,
    mouthAlignmentMm,
    electrodeCoordinates: electrodeCoordsRecord,
    orderedElectrodeCoordinates: electrodeCoordsList,
    calibrationStatus: isCalibrated
      ? `Calibrated via ${profile.calibration.calibrationMethod}`
      : 'Uncalibrated (Estimated Scale)',
  };
}
