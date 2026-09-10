'use client';

import React, { useState } from 'react';
import { PersonalizedMaskGeometry, MaskElectrodeCoord } from '@/lib/mask-geometry-transform';
import { ElectrodePlacementProfile } from '@/lib/electrode-placement';
import { Activity, Info, CheckCircle2 } from 'lucide-react';

interface ElectrodePlacementMapProps {
  maskGeometry: PersonalizedMaskGeometry;
  placementProfile: ElectrodePlacementProfile;
}

export function ElectrodePlacementMap({
  maskGeometry,
  placementProfile,
}: ElectrodePlacementMapProps) {
  const [selectedChannel, setSelectedChannel] = useState<string | null>('CH1');

  const coords = maskGeometry.electrodeCoordinates;
  const activeCoord = selectedChannel ? coords[selectedChannel] : null;
  const activePoint = selectedChannel ? placementProfile.points[selectedChannel] : null;

  return (
    <div className="p-5 rounded-2xl bg-white border border-[#DCD6C8] shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE5D8] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#384323] text-white">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#2E3019]">
              Personalized Mask Electrode Placement Map
            </h3>
            <p className="text-xs text-[#5D6346]">
              6-Channel sEMG sensor kit positioning on custom mask shell
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EAE5D8] border border-[#DCD6C8] text-[11px] font-bold text-[#384323]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          <span>Size {maskGeometry.recommendedSize} Geometry ({maskGeometry.maskWidthMm} × {maskGeometry.maskHeightMm} mm)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Interactive SVG Diagram (7 Columns) */}
        <div className="md:col-span-7 flex flex-col items-center justify-center p-4 bg-[#F5F2EA] rounded-xl border border-[#DCD6C8] relative min-h-[280px]">
          {/* Mask Contour Blueprint SVG */}
          <svg viewBox="0 0 400 320" className="w-full max-w-[340px] h-auto drop-shadow-xs">
            <defs>
              <linearGradient id="maskGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#EAE5D8" stopOpacity="0.8" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Outer Mask Contour Pattern */}
            <path
              d="M 200 35 
                 C 235 35, 275 48, 325 80 
                 C 355 105, 365 145, 355 190 
                 C 345 235, 305 265, 260 278 
                 C 230 287, 215 290, 200 290 
                 C 185 290, 170 287, 140 278 
                 C 95 265, 55 235, 45 190 
                 C 35 145, 45 105, 75 80 
                 C 125 48, 165 35, 200 35 Z"
              fill="url(#maskGrad)"
              stroke="#384323"
              strokeWidth="2.5"
              strokeDasharray="none"
            />

            {/* Nasal Notch & Seal Ridge */}
            <path
              d="M 175 42 C 190 32, 210 32, 225 42"
              fill="none"
              stroke="#4E5B31"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Chin Cup Apex Guide */}
            <path
              d="M 160 275 C 185 285, 215 285, 240 275"
              fill="none"
              stroke="#7C8264"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />

            {/* Centerline Axis */}
            <line x1="200" y1="35" x2="200" y2="290" stroke="#C4BDB0" strokeWidth="1" strokeDasharray="4 4" />

            {/* 6 Electrode Placement Nodes */}
            {maskGeometry.orderedElectrodeCoordinates.map((c) => {
              // Convert uPercent (0-100) & vPercent (0-100) to SVG viewbox (0-400, 0-320)
              const cx = 50 + (c.uPercent / 100) * 300;
              const cy = 40 + (c.vPercent / 100) * 230;
              const isSelected = selectedChannel === c.channelId;

              return (
                <g
                  key={c.channelId}
                  onClick={() => setSelectedChannel(c.channelId)}
                  className="cursor-pointer group"
                >
                  {/* Outer pulse ring */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 16 : 12}
                    className={`transition-all duration-300 ${
                      isSelected
                        ? 'fill-[#4E5B31]/20 stroke-[#384323] stroke-2 animate-pulse'
                        : 'fill-white/60 stroke-[#7C8264] stroke-1 hover:stroke-[#384323]'
                    }`}
                  />

                  {/* Inner Node Circle */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 8 : 6}
                    fill={isSelected ? '#384323' : '#63704D'}
                    filter={isSelected ? 'url(#glow)' : undefined}
                  />

                  {/* Channel Label Badge */}
                  <text
                    x={cx}
                    y={cy - (isSelected ? 20 : 15)}
                    textAnchor="middle"
                    className={`text-[11px] font-extrabold font-mono select-none ${
                      isSelected ? 'fill-[#2E3019] font-black' : 'fill-[#5D6346]'
                    }`}
                  >
                    {c.channelId}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="text-[10px] text-[#7C8264] mt-2 font-mono text-center">
            Click any channel node (CH1–CH6) to view physical placement coordinates
          </div>
        </div>

        {/* Channel Specification Card (5 Columns) */}
        <div className="md:col-span-5 space-y-3">
          {activeCoord && activePoint ? (
            <div className="p-4 rounded-xl bg-[#F5F2EA] border border-[#DCD6C8] space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#DCD6C8] pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#384323] text-white font-mono font-bold text-xs">
                    {activeCoord.channelId}
                  </span>
                  <span className="font-bold text-xs text-[#2E3019]">
                    {activeCoord.name}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {Math.round(activePoint.confidence * 100)}% Confidence
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="text-[#5D6346]">
                  <strong>Target Muscle:</strong> {activeCoord.targetMuscle}
                </div>
                <div className="text-[#5D6346]">
                  <strong>Facial Region:</strong> {activePoint.facialRegion}
                </div>
                <div className="text-[#5D6346]">
                  <strong>Anatomical Side:</strong> {activePoint.side}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white border border-[#DCD6C8] space-y-1.5 text-xs">
                <div className="font-bold text-[#2E3019] text-[11px] uppercase tracking-wider text-[#7C8264]">
                  Mask Shell Coordinates (Origin: Nose Apex)
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-[#7C8264] block">Horizontal (u)</span>
                    <span className="font-mono font-bold text-[#2E3019]">
                      {activeCoord.uMm > 0 ? `+${activeCoord.uMm}` : activeCoord.uMm} mm
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7C8264] block">Vertical (v)</span>
                    <span className="font-mono font-bold text-[#2E3019]">
                      +{activeCoord.vMm} mm
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-[#7C8264] flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-[#4E5B31] shrink-0" />
                <span>Primary MediaPipe Anchor: Landmark #{activePoint.primaryLandmarkIdx}</span>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-[#7C8264] bg-[#F5F2EA] rounded-xl border border-[#DCD6C8]">
              Select a channel node to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
