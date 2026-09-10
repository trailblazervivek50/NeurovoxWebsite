'use client';

import React from 'react';
import { ElectrodePlacementProfile } from '@/lib/electrode-placement';
import { PersonalizedMaskGeometry } from '@/lib/mask-geometry-transform';
import { ElectrodePlacementMap } from './electrode-placement-map';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  Ruler,
  Activity,
  UserCheck,
} from 'lucide-react';

interface EmgScanReportProps {
  scanId: string;
  sourceType: 'Camera' | 'Photo Upload';
  scanQuality: string;
  placementProfile: ElectrodePlacementProfile;
  maskGeometry: PersonalizedMaskGeometry;
}

export function EmgScanReport({
  scanId,
  sourceType,
  scanQuality,
  placementProfile,
  maskGeometry,
}: EmgScanReportProps) {
  const isCalibrated = placementProfile.calibration.isCalibrated;

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-[#384323] text-white flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/10 text-white backdrop-blur-md">
            <FileText className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                SCAN REPORT #{scanId.slice(-8)}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white/20 text-white">
                {sourceType}
              </span>
            </div>
            <h2 className="text-lg font-black text-white mt-0.5">
              Personalized 6-Channel sEMG Mask Sizing Report
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-xs font-bold text-amber-300">
              Recommended: Size {maskGeometry.recommendedSize}
            </div>
            <div className="text-[11px] text-white/80">
              {Math.round(maskGeometry.confidence * 100)}% Match Confidence
            </div>
          </div>
        </div>
      </div>

      {/* 1. Facial Scan Metadata Card */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-[#DCD6C8] shadow-2xs">
          <span className="text-[11px] font-semibold text-[#7C8264] block">Capture Source</span>
          <span className="text-sm font-bold text-[#2E3019] mt-0.5 block">{sourceType}</span>
          <span className="text-[10px] text-[#7C8264]">Live telemetry pipeline</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#DCD6C8] shadow-2xs">
          <span className="text-[11px] font-semibold text-[#7C8264] block">Scan Quality</span>
          <span className="text-sm font-bold text-[#384323] mt-0.5 block">{scanQuality}</span>
          <span className="text-[10px] text-[#7C8264]">
            Stability {placementProfile.overallConfidence * 100}%
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#DCD6C8] shadow-2xs">
          <span className="text-[11px] font-semibold text-[#7C8264] block">Calibration Status</span>
          <span className="text-sm font-bold text-[#2E3019] mt-0.5 block">
            {isCalibrated ? 'Calibrated Scale' : 'Uncalibrated'}
          </span>
          <span className="text-[10px] text-[#7C8264]">
            {placementProfile.calibration.calibrationMethod}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#DCD6C8] shadow-2xs">
          <span className="text-[11px] font-semibold text-[#7C8264] block">Electrode Readiness</span>
          <span className="text-sm font-bold text-emerald-800 mt-0.5 block">
            {placementProfile.overallStatus}
          </span>
          <span className="text-[10px] text-[#7C8264]">Fixed CH1–CH6 ordering</span>
        </div>
      </div>

      {/* Uncalibrated Warning Alert if applicable */}
      {!isCalibrated && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center gap-2.5 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Calibration Notice:</strong> Physical mask dimensions and electrode distances require scale calibration (e.g., inter-eye reference or manual scale mm). Displaying relative anthropometric estimates.
          </span>
        </div>
      )}

      {/* 2. Six EMG Channels Summary Table */}
      <div className="p-5 rounded-2xl bg-white border border-[#DCD6C8] shadow-sm space-y-3">
        <div className="flex justify-between items-center pb-2 border-b border-[#EAE5D8]">
          <div>
            <h3 className="text-sm font-bold text-[#2E3019] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#4E5B31]" />
              <span>Six Surface EMG (sEMG) Electrode Channels</span>
            </h3>
            <p className="text-xs text-[#5D6346] mt-0.5">
              Fixed channel indexing mapped to target facial muscular regions
            </p>
          </div>

          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            {placementProfile.readyCount} / 6 Channels Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#DCD6C8] text-[#7C8264] font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">Channel</th>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Target Muscle</th>
                <th className="py-2.5 px-3">Anatomical Region</th>
                <th className="py-2.5 px-3 text-right">Confidence</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE5D8]">
              {placementProfile.orderedPoints.map((pt) => (
                <tr key={pt.channelId} className="hover:bg-[#F5F2EA]/60 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-black text-[#384323]">{pt.channelId}</td>
                  <td className="py-2.5 px-3 font-bold text-[#2E3019]">{pt.name}</td>
                  <td className="py-2.5 px-3 text-[#5D6346]">{pt.targetMuscle}</td>
                  <td className="py-2.5 px-3 text-[#5D6346]">{pt.facialRegion}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#2E3019]">
                    {Math.round(pt.confidence * 100)}%
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        pt.status === 'ready'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {pt.status === 'ready' ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-700" />
                      )}
                      <span className="capitalize">{pt.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Calibrated Electrode Pair Distances */}
      <div className="p-5 rounded-2xl bg-white border border-[#DCD6C8] shadow-sm space-y-3">
        <div className="flex justify-between items-center pb-2 border-b border-[#EAE5D8]">
          <h3 className="text-sm font-bold text-[#2E3019] flex items-center gap-2">
            <Ruler className="w-4 h-4 text-[#4E5B31]" />
            <span>Calibrated Inter-Electrode Distances</span>
          </h3>
          <span className="text-xs text-[#5D6346]">
            Scale: {isCalibrated ? `${placementProfile.calibration.referenceLengthMm} mm Reference` : 'Uncalibrated'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {placementProfile.distances.map((dist) => (
            <div key={dist.pairKey} className="p-3 rounded-xl bg-[#F5F2EA] border border-[#DCD6C8] space-y-1">
              <span className="font-mono font-bold text-[#384323] text-xs block">{dist.label}</span>
              <span className="text-[11px] text-[#5D6346] block line-clamp-1">{dist.description}</span>
              <div className="pt-1 flex items-baseline justify-between">
                <span className="text-base font-black text-[#2E3019]">
                  {dist.physicalDistanceFormatted}
                </span>
                <span className="text-[10px] font-mono text-[#7C8264]">
                  ({dist.pixelDistance} px)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. 2D Visual Electrode Placement Map */}
      <ElectrodePlacementMap
        maskGeometry={maskGeometry}
        placementProfile={placementProfile}
      />
    </div>
  );
}
