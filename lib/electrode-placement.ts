/**
 * Neurovox 6-Channel EMG Electrode Placement & Measurement Mapper
 * Maps MediaPipe facial landmarks to anatomical sEMG electrode placement points (CH1–CH6).
 * Computes point placement confidence, channel readiness, and calibrated physical/pixel distances.
 */

import { LandmarkPoint, HeadPoseEstimation, REFERENCE_INTER_EYE_CM } from './facial-features';
import { EMG_CHANNELS_CONFIG, ORDERED_CHANNEL_KEYS, EmgChannelConfig } from './emg-channels';

export interface ElectrodePlacementPoint {
  channelId: string; // 'CH1' | 'CH2' | 'CH3' | 'CH4' | 'CH5' | 'CH6'
  channelNumber: number;
  name: string;
  targetMuscle: string;
  facialRegion: string;
  side: 'left' | 'right' | 'center' | 'reference-dependent';
  faceCoordinate: { x: number; y: number; z?: number }; // 0.0 - 1.0 normalized
  pixelCoordinate: { x: number; y: number };
  confidence: number; // 0.0 to 1.0
  status: 'ready' | 'warning' | 'unreliable';
  warningReason?: string;
  primaryLandmarkIdx: number;
}

export interface ElectrodeDistanceMeasurement {
  pairKey: string; // e.g. 'CH1_CH2'
  chA: string;
  chB: string;
  label: string;
  description: string;
  pixelDistance: number;
  normalizedDistance: number;
  physicalDistanceMm: number | null;
  physicalDistanceFormatted: string;
  isCalibrated: boolean;
  calibrationMethod: 'eye_reference' | 'manual_scale' | 'uncalibrated';
}

export interface ScaleCalibrationInfo {
  isCalibrated: boolean;
  calibrationMethod: 'eye_reference' | 'manual_scale' | 'uncalibrated';
  referenceLengthMm: number;
  pixelsPerMm: number;
}

export interface ElectrodePlacementProfile {
  points: Record<string, ElectrodePlacementPoint>; // CH1..CH6
  orderedPoints: ElectrodePlacementPoint[];
  distances: ElectrodeDistanceMeasurement[];
  calibration: ScaleCalibrationInfo;
  readyCount: number;
  overallStatus: '6/6 ELECTRODE LOCATIONS READY' | 'PARTIAL ELECTRODE COVERAGE' | 'UNRELIABLE PLACEMENT';
  overallConfidence: number; // 0.0 to 1.0
}

/**
 * Calculates isotropic distance between two 2D points considering aspect ratio.
 */

export function calculateDistance2D(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  aspectRatio: number = 1.0
): number {
  const dx = p1.x - p2.x;
  const dy = (p1.y - p2.y) / (aspectRatio || 1.0);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Maps 3D facial landmarks to 6 EMG electrode placement locations.
 */
export function mapLandmarksToElectrodePlacement(
  landmarks: Record<number, LandmarkPoint>,
  width: number = 640,
  height: number = 480,
  headPose?: HeadPoseEstimation,
  customScaleMmPerPixel?: number,
  manualRefLengthMm?: number
): ElectrodePlacementProfile {
  const aspectRatio = width && height ? width / height : 4 / 3;

  // Inter-eye scale reference anchors (33/133 left eye, 263/362 right eye)
  const p33 = landmarks[33] || { x: 0.35, y: 0.42 };
  const p133 = landmarks[133] || { x: 0.43, y: 0.42 };
  const p263 = landmarks[263] || { x: 0.65, y: 0.42 };
  const p362 = landmarks[362] || { x: 0.57, y: 0.42 };

  const leftEyeCenter = { x: (p33.x + p133.x) / 2, y: (p33.y + p133.y) / 2 };
  const rightEyeCenter = { x: (p263.x + p362.x) / 2, y: (p263.y + p362.y) / 2 };

  const interEyePixelDist = calculateDistance2D(
    { x: leftEyeCenter.x * width, y: leftEyeCenter.y * height },
    { x: rightEyeCenter.x * width, y: rightEyeCenter.y * height }
  );

  // Determine Scale Calibration
  let calibration: ScaleCalibrationInfo;
  const eyeRefMm = REFERENCE_INTER_EYE_CM * 10; // 63 mm

  if (customScaleMmPerPixel && customScaleMmPerPixel > 0) {
    calibration = {
      isCalibrated: true,
      calibrationMethod: 'manual_scale',
      referenceLengthMm: manualRefLengthMm || 63,
      pixelsPerMm: 1 / customScaleMmPerPixel,
    };
  } else if (interEyePixelDist > 10) {
    calibration = {
      isCalibrated: true,
      calibrationMethod: 'eye_reference',
      referenceLengthMm: eyeRefMm,
      pixelsPerMm: interEyePixelDist / eyeRefMm,
    };
  } else {
    calibration = {
      isCalibrated: false,
      calibrationMethod: 'uncalibrated',
      referenceLengthMm: 0,
      pixelsPerMm: 1,
    };
  }

  // Derive points for CH1–CH6
  const pointsRecord: Record<string, ElectrodePlacementPoint> = {};
  const pointsList: ElectrodePlacementPoint[] = [];

  const poseValid = headPose ? headPose.isValidPose : true;
  const posePenalty = headPose
    ? Math.max(0, (Math.abs(headPose.yawDeg) + Math.abs(headPose.pitchDeg) + Math.abs(headPose.rollDeg)) / 60)
    : 0;

  ORDERED_CHANNEL_KEYS.forEach((key) => {
    const config = EMG_CHANNELS_CONFIG[key];
    const primaryPt = landmarks[config.primaryLandmarkIdx];

    let coord = { x: 0.5, y: 0.5, z: 0 };
    let confidence = 0.95 - posePenalty;
    let status: 'ready' | 'warning' | 'unreliable' = 'ready';
    let warningReason: string | undefined = undefined;

    if (primaryPt) {
      // Calculate centroid with secondary landmarks for anatomical precision
      const secPoints = config.secondaryLandmarkIndices
        .map((idx) => landmarks[idx])
        .filter((pt): pt is LandmarkPoint => pt !== undefined);

      if (secPoints.length > 0) {
        const sumX = secPoints.reduce((acc, pt) => acc + pt.x, 0);
        const sumY = secPoints.reduce((acc, pt) => acc + pt.y, 0);
        const sumZ = secPoints.reduce((acc, pt) => acc + (pt.z || 0), 0);
        coord = {
          x: (primaryPt.x * 2 + sumX) / (2 + secPoints.length),
          y: (primaryPt.y * 2 + sumY) / (2 + secPoints.length),
          z: (primaryPt.z || 0 + sumZ) / (1 + secPoints.length),
        };
      } else {
        coord = { x: primaryPt.x, y: primaryPt.y, z: primaryPt.z || 0 };
      }
    } else {
      confidence = 0.4;
      status = 'unreliable';
      warningReason = 'Primary landmark unobserved';
    }

    if (!poseValid) {
      confidence = Math.max(0.3, confidence - 0.25);
      status = 'warning';
      warningReason = headPose?.guidanceMessage || 'Excessive head pose rotation';
    }

    if (confidence < 0.6) {
      status = 'unreliable';
    }

    const point: ElectrodePlacementPoint = {
      channelId: config.id,
      channelNumber: config.channelNumber,
      name: config.name,
      targetMuscle: config.targetMuscle,
      facialRegion: config.facialRegion,
      side: config.side,
      faceCoordinate: {
        x: parseFloat(coord.x.toFixed(4)),
        y: parseFloat(coord.y.toFixed(4)),
        z: parseFloat(coord.z.toFixed(4)),
      },
      pixelCoordinate: {
        x: Math.round(coord.x * width),
        y: Math.round(coord.y * height),
      },
      confidence: parseFloat(Math.min(1.0, Math.max(0, confidence)).toFixed(2)),
      status,
      warningReason,
      primaryLandmarkIdx: config.primaryLandmarkIdx,
    };

    pointsRecord[key] = point;
    pointsList.push(point);
  });

  // Calculate 8 key electrode pair distances
  const pairSpecs = [
    { chA: 'CH1', chB: 'CH2', label: 'CH1 ↔ CH2', desc: 'Left Jaw to Right Jaw (Inter-Masseter Span)' },
    { chA: 'CH1', chB: 'CH3', label: 'CH1 ↔ CH3', desc: 'Left Jaw to Chin (Mandibular Contour)' },
    { chA: 'CH2', chB: 'CH3', label: 'CH2 ↔ CH3', desc: 'Right Jaw to Chin (Mandibular Contour)' },
    { chA: 'CH4', chB: 'CH5', label: 'CH4 ↔ CH5', desc: 'Left Cheek to Right Cheek (Bizygomatic Span)' },
    { chA: 'CH3', chB: 'CH4', label: 'CH3 ↔ CH4', desc: 'Chin to Left Cheek (Zygomatic-Mental Angle)' },
    { chA: 'CH3', chB: 'CH5', label: 'CH3 ↔ CH5', desc: 'Chin to Right Cheek (Zygomatic-Mental Angle)' },
    { chA: 'CH4', chB: 'CH6', label: 'CH4 ↔ CH6', desc: 'Left Cheek to Mouth Corner (Risorius Course)' },
    { chA: 'CH5', chB: 'CH6', label: 'CH5 ↔ CH6', desc: 'Right Cheek to Mouth Corner (Risorius Course)' },
  ];

  const distances: ElectrodeDistanceMeasurement[] = pairSpecs.map((spec) => {
    const ptA = pointsRecord[spec.chA];
    const ptB = pointsRecord[spec.chB];

    if (!ptA || !ptB) {
      return {
        pairKey: `${spec.chA}_${spec.chB}`,
        chA: spec.chA,
        chB: spec.chB,
        label: spec.label,
        description: spec.desc,
        pixelDistance: 0,
        normalizedDistance: 0,
        physicalDistanceMm: null,
        physicalDistanceFormatted: 'Not Available',
        isCalibrated: false,
        calibrationMethod: calibration.calibrationMethod,
      };
    }

    const normDist = calculateDistance2D(ptA.faceCoordinate, ptB.faceCoordinate, aspectRatio);
    const pxDist = calculateDistance2D(ptA.pixelCoordinate, ptB.pixelCoordinate, 1.0);

    let mmDist: number | null = null;
    let mmFormatted = 'Not Available';

    if (calibration.isCalibrated && calibration.pixelsPerMm > 0) {
      mmDist = parseFloat((pxDist / calibration.pixelsPerMm).toFixed(1));
      mmFormatted = `${mmDist} mm`;
    }

    return {
      pairKey: `${spec.chA}_${spec.chB}`,
      chA: spec.chA,
      chB: spec.chB,
      label: spec.label,
      description: spec.desc,
      pixelDistance: Math.round(pxDist),
      normalizedDistance: parseFloat(normDist.toFixed(4)),
      physicalDistanceMm: mmDist,
      physicalDistanceFormatted: mmFormatted,
      isCalibrated: calibration.isCalibrated,
      calibrationMethod: calibration.calibrationMethod,
    };
  });

  // Calculate overall status & readiness
  const readyCount = pointsList.filter((p) => p.status === 'ready' || p.status === 'warning').length;
  const avgConfidence = pointsList.reduce((acc, p) => acc + p.confidence, 0) / pointsList.length;

  let overallStatus: '6/6 ELECTRODE LOCATIONS READY' | 'PARTIAL ELECTRODE COVERAGE' | 'UNRELIABLE PLACEMENT';
  if (readyCount === 6 && avgConfidence >= 0.8) {
    overallStatus = '6/6 ELECTRODE LOCATIONS READY';
  } else if (readyCount >= 4) {
    overallStatus = 'PARTIAL ELECTRODE COVERAGE';
  } else {
    overallStatus = 'UNRELIABLE PLACEMENT';
  }

  return {
    points: pointsRecord,
    orderedPoints: pointsList,
    distances,
    calibration,
    readyCount,
    overallStatus,
    overallConfidence: parseFloat(avgConfidence.toFixed(2)),
  };
}
