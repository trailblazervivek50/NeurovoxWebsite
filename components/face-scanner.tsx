'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Info,
  Database,
  BarChart2,
  Sliders,
  Upload,
  FileImage,
  Terminal,
  Activity,
  Ruler,
} from 'lucide-react';
import { MaskSize, ModelPrediction, MASK_SIZE_GUIDELINES } from '@/lib/mask-fit';
import {
  extractFacialFeatures,
  calculateStabilityMetrics,
  ExtractedFrameFeatures,
  HeadPoseEstimation,
  MultiFrameStabilityMetrics,
  REFERENCE_INTER_EYE_CM,
  LandmarkPoint,
} from '@/lib/facial-features';
import { runLocalModelInference, getOrInitOnnxSession, ModelInferenceResult } from '@/lib/model-runner';
import { saveGuestScan } from '@/lib/storage';
import { ModelEvaluationModal } from './model-evaluation-modal';
import { DatasetCollectorModal } from './dataset-collector-modal';
import { installConsoleGuard } from './console-guard';

import {
  mapLandmarksToElectrodePlacement,
  ElectrodePlacementProfile,
} from '@/lib/electrode-placement';
import {
  transformFaceToMaskGeometry,
  PersonalizedMaskGeometry,
} from '@/lib/mask-geometry-transform';
import { EMG_CHANNELS_CONFIG, ORDERED_CHANNEL_KEYS } from '@/lib/emg-channels';
import { EmgScanReport } from './emg-scan-report';

interface FaceScannerProps {
  onScanComplete: (result: {
    measurements: {
      jawWidth: number;
      faceHeight: number;
      faceWidth?: number;
      referenceInterEyeDistanceCm: number;
    };
    prediction: ModelPrediction;
  }) => void;
  onNavigateToStore?: (recommendedSize: MaskSize) => void;
  userId?: string;
  userName?: string;
}

const TARGET_FRAME_COUNT = 35;

export function FaceScanner({
  onScanComplete,
  onNavigateToStore,
  userId = 'guest',
  userName = 'User',
}: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const landmarkerRef = useRef<any>(null);

  // Input Mode: Camera vs Photo
  const [inputMode, setInputMode] = useState<'camera' | 'photo'>('camera');

  const [cameraState, setCameraState] = useState<'idle' | 'initializing' | 'active' | 'denied'>('idle');
  const [isScanning, setIsScanning] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState<ExtractedFrameFeatures[]>([]);
  const [currentPose, setCurrentPose] = useState<HeadPoseEstimation>({
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    isValidPose: true,
    guidanceMessage: 'Position face within the calibration guide',
  });
  const [liveMeasurements, setLiveMeasurements] = useState<{
    jawWidthCm: number;
    faceHeightCm: number;
    aspectRatio: number;
  } | null>(null);

  // 6-Channel EMG Profiles
  const [currentPlacementProfile, setCurrentPlacementProfile] = useState<ElectrodePlacementProfile | null>(null);
  const [currentMaskGeometry, setCurrentMaskGeometry] = useState<PersonalizedMaskGeometry | null>(null);

  const [scanResult, setScanResult] = useState<{
    metrics: MultiFrameStabilityMetrics;
    inference: ModelInferenceResult;
    isDemoSimulation: boolean;
    sourceType: 'Camera' | 'Photo Upload';
  } | null>(null);

  const [isDemoMode, setIsDemoMode] = useState(false);
  const [savingScan, setSavingScan] = useState(false);
  const [savedScanId, setSavedScanId] = useState<string | null>(null);

  // Photo Upload & Calibration States
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoCalibrationMethod, setPhotoCalibrationMethod] = useState<'eye_reference' | 'manual_scale' | 'uncalibrated'>('eye_reference');
  const [manualRefMm, setManualRefMm] = useState<number>(63);

  // Debug View Mode
  const [showDebugView, setShowDebugView] = useState(false);

  // Modals
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [showCollectorModal, setShowCollectorModal] = useState(false);

  // Initialize MediaPipe Face Landmarker
  useEffect(() => {
    let active = true;

    async function initMediaPipe() {
      try {
        installConsoleGuard();
        const vision = await import('@mediapipe/tasks-vision');
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
        );
        const faceLandmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
        });

        if (active) {
          landmarkerRef.current = faceLandmarker;
        }
      } catch (err) {
        console.warn('MediaPipe initialization warning (demo mode available):', err);
      }
    }

    initMediaPipe();
    getOrInitOnnxSession().catch((err) => {
      console.warn('ONNX Runtime Web preloading note:', err);
    });

    return () => {
      active = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, []);

  // Camera stream handler
  const startCamera = async () => {
    setCameraState('initializing');
    setScanResult(null);
    setCapturedFrames([]);
    setIsDemoMode(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraState('active');
        startDetectionLoop();
      }
    } catch (err: any) {
      console.warn('Camera access denied or unreadable:', err);
      setCameraState('denied');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    setCameraState('idle');
    setIsScanning(false);
  };

  // Continuous Landmark Detection Loop
  const startDetectionLoop = useCallback(() => {
    let lastVideoTime = -1;

    const render = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (landmarkerRef.current && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            try {
              installConsoleGuard();
              const startTimeMs = performance.now();
              const results = landmarkerRef.current.detectForVideo(video, startTimeMs);

              if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
                const rawLandmarks = results.faceLandmarks[0];
                const landmarksMap: Record<number, LandmarkPoint> = {};
                rawLandmarks.forEach((pt: any, idx: number) => {
                  landmarksMap[idx] = { x: pt.x, y: pt.y, z: pt.z };
                });

                const vWidth = video.videoWidth || 640;
                const vHeight = video.videoHeight || 480;
                const frameFeatures = extractFacialFeatures(landmarksMap, vWidth, vHeight);
                setCurrentPose(frameFeatures.headPose);
                setLiveMeasurements({
                  jawWidthCm: frameFeatures.estimatedMeasurements.jawWidthCm,
                  faceHeightCm: frameFeatures.estimatedMeasurements.faceHeightCm,
                  aspectRatio: frameFeatures.estimatedMeasurements.aspectRatio,
                });

                // Generate 6-channel electrode placement profile for live overlay
                const profile = mapLandmarksToElectrodePlacement(landmarksMap, vWidth, vHeight, frameFeatures.headPose);
                setCurrentPlacementProfile(profile);

                // Draw 6-channel electrode placement overlay on canvas
                drawFacialOverlay(ctx, canvas.width, canvas.height, landmarksMap, frameFeatures.headPose.isValidPose, profile);

                // If actively scanning and pose is valid, accumulate frame
                if (isScanning && frameFeatures.headPose.isValidPose) {
                  setCapturedFrames((prev) => {
                    const next = [...prev, frameFeatures];
                    if (next.length >= TARGET_FRAME_COUNT) {
                      completeScan(next, false, landmarksMap, vWidth, vHeight, 'Camera');
                    }
                    return next;
                  });
                }
              } else {
                setCurrentPose({
                  yawDeg: 0,
                  pitchDeg: 0,
                  rollDeg: 0,
                  isValidPose: false,
                  guidanceMessage: 'Align face inside the viewport guide',
                });
              }
            } catch (err) {
              console.warn('Detection iteration note:', err);
            }
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);
  }, [isScanning]);

  // Draw 6-Channel Electrode Placement Nodes & Guidance Overlay
  const drawFacialOverlay = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    landmarks: Record<number, LandmarkPoint>,
    isValid: boolean,
    profile?: ElectrodePlacementProfile
  ) => {
    const strokeColor = isValid ? 'rgba(99, 112, 77, 0.85)' : 'rgba(194, 132, 50, 0.85)';
    const pointColor = isValid ? '#63704D' : '#C28432';

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = pointColor;
    ctx.lineWidth = 1.5;

    // 1. Jawline contour wireframe (234 -> 152 -> 454)
    const jawIndices = [234, 127, 50, 152, 280, 356, 454];
    ctx.beginPath();
    jawIndices.forEach((idx, i) => {
      const p = landmarks[idx];
      if (p) {
        const px = p.x * w;
        const py = p.y * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    });
    ctx.stroke();

    // 2. Draw 6 Surface EMG Electrode Nodes (CH1–CH6)
    if (profile && profile.orderedPoints) {
      profile.orderedPoints.forEach((pt) => {
        const px = pt.faceCoordinate.x * w;
        const py = pt.faceCoordinate.y * h;

        // Glowing outer electrode ring
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, 2 * Math.PI);
        ctx.fillStyle = pt.status === 'ready' ? 'rgba(56, 67, 35, 0.25)' : 'rgba(194, 132, 50, 0.3)';
        ctx.fill();
        ctx.strokeStyle = pt.status === 'ready' ? '#384323' : '#C28432';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner solid node core
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fillStyle = pt.status === 'ready' ? '#384323' : '#C28432';
        ctx.fill();

        // Channel ID Badge Text Label
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#FFFFFF';
        const labelText = `${pt.channelId} ${pt.name}`;
        const textWidth = ctx.measureText(labelText).width;

        // Label background pill
        ctx.fillStyle = 'rgba(30, 32, 24, 0.85)';
        ctx.beginPath();
        ctx.roundRect(px - textWidth / 2 - 4, py - 20, textWidth + 8, 14, 4);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(labelText, px - textWidth / 2, py - 9);
      });
    }

    ctx.restore();
  };

  // Process Uploaded Face Photo
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    setIsProcessingPhoto(true);
    setScanResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setPhotoUrl(dataUrl);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = dataUrl;

      img.onload = async () => {
        try {
          if (!landmarkerRef.current) {
            setPhotoError('Landmark detector initializing. Please try again in 2 seconds.');
            setIsProcessingPhoto(false);
            return;
          }

          // Run MediaPipe Face Landmarker on static image element
          const results = landmarkerRef.current.detect(img);

          if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
            setPhotoError('No face detected in the photo. Please upload a clear frontal face image.');
            setIsProcessingPhoto(false);
            return;
          }

          if (results.faceLandmarks.length > 1) {
            setPhotoError('Multiple faces detected. Please upload an image containing a single face.');
            setIsProcessingPhoto(false);
            return;
          }

          const rawLandmarks = results.faceLandmarks[0];
          const landmarksMap: Record<number, LandmarkPoint> = {};
          rawLandmarks.forEach((pt: any, idx: number) => {
            landmarksMap[idx] = { x: pt.x, y: pt.y, z: pt.z };
          });

          const pWidth = img.naturalWidth || 640;
          const pHeight = img.naturalHeight || 480;

          const frameFeatures = extractFacialFeatures(landmarksMap, pWidth, pHeight);

          if (!frameFeatures.headPose.isValidPose) {
            setPhotoError(`Pose warning: ${frameFeatures.headPose.guidanceMessage}. Please use a straight frontal face photo.`);
            setIsProcessingPhoto(false);
            return;
          }

          // Complete analysis for single photo
          await completeScan([frameFeatures], false, landmarksMap, pWidth, pHeight, 'Photo Upload');
        } catch (err: any) {
          setPhotoError(`Photo analysis error: ${err.message || 'Unable to process photo.'}`);
        } finally {
          setIsProcessingPhoto(false);
        }
      };

      img.onerror = () => {
        setPhotoError('Failed to load image file.');
        setIsProcessingPhoto(false);
      };
    };

    reader.readAsDataURL(file);
  };

  // Complete Multi-Frame / Photo Analysis & Run Model Inference
  const completeScan = async (
    frames: ExtractedFrameFeatures[],
    isDemo: boolean,
    landmarksMap?: Record<number, LandmarkPoint>,
    w: number = 640,
    h: number = 480,
    sourceType: 'Camera' | 'Photo Upload' = 'Camera'
  ) => {
    setIsScanning(false);
    const metrics = calculateStabilityMetrics(frames);
    const inference = await runLocalModelInference(metrics.meanFeatureVector);

    // Map 6-Channel Electrode Placement Profile & Mask Geometry
    let profile: ElectrodePlacementProfile;
    if (landmarksMap) {
      const customScale = photoCalibrationMethod === 'manual_scale' ? 1 / manualRefMm : undefined;
      profile = mapLandmarksToElectrodePlacement(
        landmarksMap,
        w,
        h,
        frames[0]?.headPose,
        customScale,
        manualRefMm
      );
    } else {
      // Fallback synthetic profile for simulation
      profile = mapLandmarksToElectrodePlacement({}, w, h);
    }

    const maskGeo = transformFaceToMaskGeometry(profile, metrics.jawWidth.mean, metrics.faceHeight.mean);

    setCurrentPlacementProfile(profile);
    setCurrentMaskGeometry(maskGeo);

    const result = {
      metrics,
      inference,
      isDemoSimulation: isDemo,
      sourceType,
    };

    setScanResult(result);

    // Provide parent callback
    const avgJaw = metrics.jawWidth.mean;
    const avgHeight = metrics.faceHeight.mean;

    onScanComplete({
      measurements: {
        jawWidth: avgJaw,
        faceHeight: avgHeight,
        referenceInterEyeDistanceCm: REFERENCE_INTER_EYE_CM,
      },
      prediction: {
        predictedSize: inference.predictedSize,
        confidence: inference.confidence,
        probabilities: inference.probabilities,
        scanQuality: metrics.scanQuality,
        coefficientOfVariation: metrics.jawWidth.cvPercent,
        isDemoSimulation: isDemo,
      },
    });

    // Save to server database / local guest storage
    persistScan(result, avgJaw, avgHeight);
  };

  // Persist Scan Record
  const persistScan = async (
    result: { metrics: MultiFrameStabilityMetrics; inference: ModelInferenceResult; isDemoSimulation: boolean; sourceType: string },
    jawWidthCm: number,
    faceHeightCm: number
  ) => {
    setSavingScan(true);
    const payload = {
      userId,
      userName,
      jawWidthCm,
      faceHeightCm,
      referenceInterEyeCm: REFERENCE_INTER_EYE_CM,
      recommendedSize: result.inference.predictedSize,
      confidence: result.inference.confidence,
      scanQuality: result.metrics.scanQuality,
      probabilities: result.inference.probabilities,
      headPose: currentPose,
      stabilityMetrics: {
        sampleCount: result.metrics.sampleCount,
        acceptedCount: result.metrics.acceptedCount,
        rejectedCount: result.metrics.rejectedCount,
        jawCvPercent: result.metrics.jawWidth.cvPercent,
        heightCvPercent: result.metrics.faceHeight.cvPercent,
        stabilityScore: result.metrics.overallStabilityScore,
      },
      normalizedFeatures: result.metrics.meanFeatureVector,
      isDemoSimulation: result.isDemoSimulation,
      sourceType: result.sourceType,
    };

    saveGuestScan({ ...payload, id: `local_${Date.now()}`, createdAt: new Date().toISOString() });

    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.scan?.id) {
          setSavedScanId(data.scan.id);
        }
      }
    } catch (e) {
      console.warn('Background scan sync note:', e);
    } finally {
      setSavingScan(false);
    }
  };

  // Explicit Synthetic Demo Simulation
  const runDemoSimulation = async (profileType: 'Small' | 'Medium' | 'Large' | 'random' = 'random') => {
    setIsDemoMode(true);
    setCameraState('active');
    setIsScanning(true);
    setCapturedFrames([]);

    let targetProfile: 'Small' | 'Medium' | 'Large' = 'Medium';
    if (profileType === 'random') {
      const types: ('Small' | 'Medium' | 'Large')[] = ['Small', 'Medium', 'Large'];
      targetProfile = types[Math.floor(Math.random() * types.length)];
    } else {
      targetProfile = profileType;
    }

    let baseJaw = 13.2;
    let baseHeight = 11.9;
    let baseJawNorm = 2.08;
    let baseHeightNorm = 1.88;

    if (targetProfile === 'Small') {
      baseJaw = 11.4;
      baseHeight = 10.6;
      baseJawNorm = 1.80;
      baseHeightNorm = 1.67;
    } else if (targetProfile === 'Large') {
      baseJaw = 14.8;
      baseHeight = 13.2;
      baseJawNorm = 2.32;
      baseHeightNorm = 2.09;
    }

    const demoFrames: ExtractedFrameFeatures[] = [];

    for (let i = 0; i < TARGET_FRAME_COUNT; i++) {
      await new Promise((r) => setTimeout(r, 40));
      const jitterJaw = baseJaw + Math.sin(i * 0.45) * 0.14;
      const jitterHeight = baseHeight + Math.cos(i * 0.45) * 0.11;
      const aspect = jitterJaw / jitterHeight;

      const liveJaw = parseFloat(jitterJaw.toFixed(1));
      const liveHeight = parseFloat(jitterHeight.toFixed(1));
      const liveAspect = parseFloat(aspect.toFixed(2));

      setLiveMeasurements({
        jawWidthCm: liveJaw,
        faceHeightCm: liveHeight,
        aspectRatio: liveAspect,
      });

      const f: ExtractedFrameFeatures = {
        featureVector: [
          parseFloat((baseJawNorm + Math.sin(i * 0.3) * 0.015).toFixed(4)),
          parseFloat((baseHeightNorm + Math.cos(i * 0.3) * 0.012).toFixed(4)),
          parseFloat((baseJawNorm * 1.05).toFixed(4)),
          parseFloat((baseJawNorm * 0.92).toFixed(4)),
          parseFloat((baseJawNorm * 0.82).toFixed(4)),
          0.72, 0.54, 1.58, 0.15,
          liveAspect,
          0.95, 0.86, 0.38,
          parseFloat((Math.sin(i * 0.2) * 1.5).toFixed(1)),
          parseFloat((Math.cos(i * 0.2) * 1.2).toFixed(1)),
          0.4,
        ],
        featureMap: {},
        headPose: {
          yawDeg: parseFloat((Math.sin(i * 0.2) * 1.5).toFixed(1)),
          pitchDeg: parseFloat((Math.cos(i * 0.2) * 1.2).toFixed(1)),
          rollDeg: 0.4,
          isValidPose: true,
          guidanceMessage: `Simulating ${targetProfile} profile • Sampling frame buffer`,
        },
        estimatedMeasurements: {
          jawWidthCm: liveJaw,
          faceHeightCm: liveHeight,
          faceWidthCm: parseFloat((liveJaw * 1.06).toFixed(1)),
          chinToNoseCm: parseFloat((liveHeight * 0.45).toFixed(1)),
          interEyeReferenceCm: REFERENCE_INTER_EYE_CM,
          aspectRatio: liveAspect,
        },
        isValidForAggregation: true,
      };

      demoFrames.push(f);
      setCapturedFrames([...demoFrames]);
    }

    completeScan(demoFrames, true, undefined, 640, 480, 'Camera');
  };

  const handleResetScan = () => {
    setScanResult(null);
    setCapturedFrames([]);
    setSavedScanId(null);
    setPhotoUrl(null);
    setPhotoError(null);
    if (cameraState === 'active' && !isDemoMode) {
      setIsScanning(false);
    } else if (inputMode === 'camera') {
      startCamera();
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Action Bar & Input Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white/75 border border-[#DCD6C8] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#4E5B31] text-white">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#2E3019]">
              6-Channel sEMG Facial Sizing & Electrode Mapper
            </h1>
            <p className="text-xs text-[#5D6346]">
              Personalized mask geometry transformation • Fixed CH1–CH6 anatomical placement mapping
            </p>
          </div>
        </div>

        {/* Input Mode Navigation Tabs & Debug Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#EAE5D8] p-1 rounded-xl border border-[#DCD6C8]">
            <button
              onClick={() => {
                setInputMode('camera');
                setScanResult(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                inputMode === 'camera'
                  ? 'bg-white text-[#2E3019] shadow-xs'
                  : 'text-[#5D6346] hover:text-[#2E3019]'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-[#4E5B31]" />
              <span>Live Camera</span>
            </button>

            <button
              onClick={() => {
                setInputMode('photo');
                stopCamera();
                setScanResult(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                inputMode === 'photo'
                  ? 'bg-white text-[#2E3019] shadow-xs'
                  : 'text-[#5D6346] hover:text-[#2E3019]'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-[#4E5B31]" />
              <span>Upload Photo</span>
            </button>
          </div>

          <button
            onClick={() => setShowDebugView(!showDebugView)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl transition-colors border ${
              showDebugView
                ? 'bg-[#384323] text-white border-[#384323]'
                : 'bg-[#EAE5D8] text-[#2E3019] border-[#C4BDB0] hover:bg-[#DCD6C8]'
            }`}
            title="Toggle Engineering Debug View"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Debug</span>
          </button>
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Viewport / Video / Photo Area (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          {inputMode === 'camera' ? (
            /* Live Camera Viewport */
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[#1E2018] shadow-lg border border-[#DCD6C8] flex items-center justify-center">
              {/* Real Video & Overlay Canvas */}
              <video
                ref={videoRef}
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${
                  cameraState === 'active' && !isDemoMode ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${
                  cameraState === 'active' && !isDemoMode ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />

              {/* Inactive or Initializing State */}
              {cameraState !== 'active' && (
                <div className="p-8 text-center text-white/90 space-y-4 max-w-sm">
                  <div className="w-16 h-16 mx-auto rounded-full bg-white/10 flex items-center justify-center text-white">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Live 6-Channel sEMG Scan</h3>
                    <p className="text-xs text-white/70 mt-1">
                      Grant camera access for real-time MediaPipe facial tracking and 6-channel electrode mapping.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={startCamera}
                      className="w-full py-2.5 px-4 text-xs font-bold rounded-xl bg-[#63704D] hover:bg-[#525E3E] text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Enable Camera & Begin Scan</span>
                    </button>

                    <div className="space-y-1.5 pt-1">
                      <button
                        onClick={() => runDemoSimulation('random')}
                        className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/20 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Run Dynamic Simulation</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Mode Face Guide Wireframe */}
              {cameraState === 'active' && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  {/* Oval Guide */}
                  <div
                    className={`w-52 h-72 rounded-[48%] border-2 transition-colors duration-200 ${
                      currentPose.isValidPose
                        ? 'border-[#63704D]/70 shadow-[0_0_20px_rgba(99,112,77,0.3)]'
                        : 'border-amber-500/80 shadow-[0_0_20px_rgba(194,132,50,0.4)]'
                    }`}
                  />

                  {/* Top Status & 6-Channel Readiness Pill */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md ${
                          currentPose.isValidPose ? 'bg-[#384323]/90 text-white' : 'bg-amber-600/90 text-white'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span>
                          {currentPlacementProfile
                            ? currentPlacementProfile.overallStatus
                            : '6 / 6 ELECTRODE LOCATIONS READY'}
                        </span>
                      </span>
                    </div>

                    {/* Head-Pose Angles */}
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/90 bg-black/50 px-2.5 py-1 rounded-lg backdrop-blur-md">
                      <span>Y: {currentPose.yawDeg > 0 ? `+${currentPose.yawDeg}` : currentPose.yawDeg}°</span>
                      <span>P: {currentPose.pitchDeg > 0 ? `+${currentPose.pitchDeg}` : currentPose.pitchDeg}°</span>
                      <span>R: {currentPose.rollDeg > 0 ? `+${currentPose.rollDeg}` : currentPose.rollDeg}°</span>
                    </div>
                  </div>

                  {/* Guidance Banner */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="px-4 py-2 rounded-xl bg-black/65 backdrop-blur-md text-white text-xs text-center border border-white/10 font-medium">
                      {currentPose.guidanceMessage}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Upload Face Photo Viewport */
            <div className="w-full space-y-4">
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[#1E2018] shadow-lg border border-[#DCD6C8] flex flex-col items-center justify-center p-6 text-center">
                {photoUrl ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={photoUrl}
                      alt="Uploaded face target"
                      className="max-h-full max-w-full object-contain rounded-xl"
                    />
                  </div>
                ) : (
                  <div className="space-y-4 text-white/90 max-w-sm">
                    <div className="w-16 h-16 mx-auto rounded-full bg-white/10 flex items-center justify-center text-white">
                      <FileImage className="w-8 h-8 text-amber-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Upload Face Photograph</h3>
                      <p className="text-xs text-white/70 mt-1">
                        Select a clear frontal face image for 6-channel sEMG electrode placement analysis.
                      </p>
                    </div>

                    <label className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-[#63704D] hover:bg-[#525E3E] text-white text-xs font-bold shadow-md cursor-pointer transition-all">
                      <Upload className="w-4 h-4" />
                      <span>Select Face Image File</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {photoError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                  <span>{photoError}</span>
                </div>
              )}

              {/* Photo Scale Calibration Widget */}
              <div className="p-4 rounded-2xl bg-white border border-[#DCD6C8] shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#2E3019] flex items-center gap-1.5">
                    <Ruler className="w-4 h-4 text-[#4E5B31]" />
                    <span>Photo Scale Calibration Method</span>
                  </div>
                  <span className="text-[11px] text-[#7C8264]">Physical mm dimensions</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPhotoCalibrationMethod('eye_reference')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition-all border ${
                      photoCalibrationMethod === 'eye_reference'
                        ? 'bg-[#EAE5D8] text-[#2E3019] border-[#4E5B31]'
                        : 'bg-white text-[#5D6346] border-[#DCD6C8]'
                    }`}
                  >
                    <div className="font-bold text-[11px]">Eye Reference</div>
                    <div className="text-[10px] text-[#7C8264]">Assumed 6.3 cm IPD</div>
                  </button>

                  <button
                    onClick={() => setPhotoCalibrationMethod('manual_scale')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition-all border ${
                      photoCalibrationMethod === 'manual_scale'
                        ? 'bg-[#EAE5D8] text-[#2E3019] border-[#4E5B31]'
                        : 'bg-white text-[#5D6346] border-[#DCD6C8]'
                    }`}
                  >
                    <div className="font-bold text-[11px]">Manual Scale</div>
                    <div className="text-[10px] text-[#7C8264]">Custom mm ruler</div>
                  </button>

                  <button
                    onClick={() => setPhotoCalibrationMethod('uncalibrated')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition-all border ${
                      photoCalibrationMethod === 'uncalibrated'
                        ? 'bg-[#EAE5D8] text-[#2E3019] border-[#4E5B31]'
                        : 'bg-white text-[#5D6346] border-[#DCD6C8]'
                    }`}
                  >
                    <div className="font-bold text-[11px]">Uncalibrated</div>
                    <div className="text-[10px] text-[#7C8264]">Relative ratios only</div>
                  </button>
                </div>

                {photoCalibrationMethod === 'manual_scale' && (
                  <div className="pt-1 space-y-1">
                    <label className="block text-[11px] font-semibold text-[#5D6346]">
                      Reference Calibration Length (mm):
                    </label>
                    <input
                      type="number"
                      value={manualRefMm}
                      onChange={(e) => setManualRefMm(parseFloat(e.target.value) || 63)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#DCD6C8] bg-[#F5F2EA] font-mono focus:outline-none"
                      placeholder="e.g. 63"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Camera Controls Below Viewport */}
          {inputMode === 'camera' && (
            <div className="w-full flex items-center justify-between mt-3 px-1">
              <div className="text-xs text-[#5D6346]">
                Scale Calibration: <strong>6.3 cm</strong> inter-eye reference
              </div>

              {cameraState === 'active' && !scanResult && (
                <div className="flex items-center gap-2">
                  {!isScanning ? (
                    <button
                      onClick={() => {
                        setCapturedFrames([]);
                        setIsScanning(true);
                      }}
                      disabled={!currentPose.isValidPose}
                      className="px-5 py-2 text-xs font-bold rounded-xl bg-[#4E5B31] text-white hover:bg-[#3E4924] disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                    >
                      Start 35-Frame Scan
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsScanning(false)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-800 text-white hover:bg-red-900 transition-colors cursor-pointer"
                    >
                      Cancel Scan
                    </button>
                  )}

                  <button
                    onClick={stopCamera}
                    className="px-3 py-2 text-xs font-medium rounded-xl bg-[#EAE5D8] hover:bg-[#DCD6C8] text-[#2E3019] transition-colors cursor-pointer"
                  >
                    Turn Off
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Real-time Diagnostics & 6-Channel Telemetry (5 Columns) */}
        <div className="lg:col-span-5 space-y-4">
          {!scanResult ? (
            <div className="p-6 rounded-2xl bg-white/80 border border-[#DCD6C8] shadow-sm space-y-5">
              <div>
                <h3 className="text-xs font-bold text-[#7C8264] uppercase tracking-wider">
                  6-Channel sEMG Telemetry
                </h3>
                <p className="text-xs text-[#5D6346] mt-0.5">
                  Anatomical electrode location readiness status
                </p>
              </div>

              {/* 6 Electrode Readiness Checklist */}
              <div className="space-y-2 p-3.5 rounded-xl bg-[#F5F2EA] border border-[#DCD6C8]">
                {ORDERED_CHANNEL_KEYS.map((key) => {
                  const cfg = EMG_CHANNELS_CONFIG[key];
                  const pt = currentPlacementProfile?.points[key];
                  const isReady = pt ? pt.status === 'ready' : true;

                  return (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 font-mono font-bold text-[#384323]">{key}</span>
                        <span className="font-semibold text-[#2E3019]">{cfg.name}</span>
                        <span className="text-[11px] text-[#7C8264]">({cfg.targetMuscle})</span>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Ready</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Protocol Instructions */}
              <div className="p-4 rounded-xl bg-[#F5F2EA] border border-[#DCD6C8] space-y-2 text-xs text-[#5D6346]">
                <div className="font-bold text-[#2E3019] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#4E5B31]" />
                  <span>sEMG Placement Guidelines</span>
                </div>
                <ul className="space-y-1 text-[11px] list-disc list-inside">
                  <li>Maintain neutral facial expression with lips closed.</li>
                  <li>Ensure jaw angle (CH1/CH2) and chin (CH3) are visible.</li>
                  <li>Keep cheek arches (CH4/CH5) and mouth corner (CH6) unobstructed.</li>
                </ul>
              </div>
            </div>
          ) : (
            /* Completed Result Quick Card */
            <div className="p-6 rounded-2xl bg-white border border-[#DCD6C8] shadow-md space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C8264]">
                    AI Sizing Output
                  </span>
                  <h3 className="text-xl font-black text-[#2E3019]">
                    Size {scanResult.inference.predictedSize}
                  </h3>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-[#4E5B31]">
                    {(scanResult.inference.confidence * 100).toFixed(1)}% Match
                  </div>
                  <div className="text-[11px] text-[#7C8264]">Softmax probability</div>
                </div>
              </div>

              {onNavigateToStore && (
                <button
                  onClick={() => onNavigateToStore(scanResult.inference.predictedSize)}
                  className="w-full py-3 px-4 rounded-xl bg-[#4E5B31] hover:bg-[#3E4924] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span>Shop Fitted Masks in Store</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleResetScan}
                className="w-full py-2.5 px-3 rounded-xl bg-[#EAE5D8] hover:bg-[#DCD6C8] text-[#2E3019] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>New Scan / Upload</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. Complete 6-Channel EMG Scan Report */}
      {scanResult && currentPlacementProfile && currentMaskGeometry && (
        <EmgScanReport
          scanId={savedScanId || 'local_scan'}
          sourceType={scanResult.sourceType}
          scanQuality={scanResult.metrics.scanQuality}
          placementProfile={currentPlacementProfile}
          maskGeometry={currentMaskGeometry}
        />
      )}

      {/* 6. Collapsible Engineering Debug View */}
      {showDebugView && currentPlacementProfile && (
        <div className="p-5 rounded-2xl bg-[#1C1D18] text-emerald-400 font-mono text-xs space-y-3 shadow-xl border border-emerald-900/50">
          <div className="flex items-center justify-between border-b border-emerald-900/80 pb-2 text-white">
            <span className="font-bold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Engineering & Anatomical Telemetry Debug Console</span>
            </span>
            <span className="text-[10px] text-emerald-500">Live 3D Coordinates</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] text-emerald-300 font-bold mb-1">Normalized Landmark Coordinates (0.0 to 1.0)</div>
              <pre className="p-3 rounded-lg bg-black/60 overflow-x-auto text-[10px] leading-relaxed text-emerald-400 border border-emerald-950">
                {JSON.stringify(currentPlacementProfile.points, null, 2)}
              </pre>
            </div>

            <div>
              <div className="text-[11px] text-emerald-300 font-bold mb-1">Calibrated Distance Pairs (mm & px)</div>
              <pre className="p-3 rounded-lg bg-black/60 overflow-x-auto text-[10px] leading-relaxed text-emerald-400 border border-emerald-950">
                {JSON.stringify(currentPlacementProfile.distances, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ModelEvaluationModal
        isOpen={showEvaluationModal}
        onClose={() => setShowEvaluationModal(false)}
      />

      <DatasetCollectorModal
        isOpen={showCollectorModal}
        onClose={() => setShowCollectorModal(false)}
        collectedFrames={capturedFrames}
      />
    </div>
  );
}
