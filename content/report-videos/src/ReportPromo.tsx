import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { QRCodeSVG } from "qrcode.react";

export interface ReportPromoProps {
  title: string;
  eyebrow: string;
  subtitle: string;
  accentColor: string;
  locationCount: number;
  appPath: string;
  /** One narrative paragraph (≤250 chars): Austin context → report scope → store list. */
  narrative: string;
  /** URL the QR code points to. Defaults to https://austin.chat{appPath}. */
  reportUrl?: string;
}

const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const Cityscape: React.FC<{ width: number; height: number; accent: string }> = ({ width, height, accent }) => {
  const bldgs = [
    [0,55,95],[45,70,140],[105,50,110],[148,60,162],[198,45,130],
    [232,80,196],[302,55,218],[348,72,252],
    [410,92,282],[495,58,238],[542,82,262],
    [614,104,308],
    [706,62,278],[758,88,258],
    [836,72,232],[898,56,205],[944,82,182],
    [1016,60,156],[1066,76,172],[1132,50,132],[1172,66,116],[1228,52,142],
  ];
  const ground = height;
  const buildingColor = "#c8cdd8";
  const windowColor = "#dde2ec";
  const accentGlow = accent + "18";
  return (
    <svg style={{ position: "absolute", bottom: 0, left: 0 }} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eef1f8" />
          <stop offset="100%" stopColor="#f8f9fc" />
        </linearGradient>
        <linearGradient id="groundfade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={buildingColor} />
          <stop offset="100%" stopColor="#b8bdc8" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="url(#sky)" />
      <rect x={0} y={ground - 3} width={width} height={3} fill="#b8bdc8" opacity={0.5} />
      {bldgs.map(([x, w, h], i) => {
        const isLandmark = h > 270;
        return (
          <g key={i}>
            <rect x={x} y={ground - h} width={w} height={h} fill={isLandmark ? "url(#groundfade)" : buildingColor} />
            {isLandmark && <rect x={x} y={ground - h} width={w} height={h} fill={accentGlow} />}
            {h > 150 && (() => {
              const winW = 5, winH = 4, colGap = 13, rowGap = 16;
              const cols = Math.floor((w - 10) / colGap);
              const rows = Math.floor((h - 24) / rowGap);
              const wins: React.ReactNode[] = [];
              for (let r = 0; r < rows; r++)
                for (let c = 0; c < cols; c++)
                  wins.push(<rect key={`${r}-${c}`} x={x + 5 + c * colGap} y={ground - h + 12 + r * rowGap} width={winW} height={winH} fill={windowColor} opacity={0.7} />);
              return wins;
            })()}
          </g>
        );
      })}
    </svg>
  );
};

export const ReportPromo: React.FC<ReportPromoProps> = ({
  title, eyebrow, accentColor, appPath, narrative, reportUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const barW   = interpolate(frame, [0, 18],  [0, width], cl);
  const eyeOp  = interpolate(frame, [12, 32], [0, 1],     cl);
  const cityOp = interpolate(frame, [0, 40],  [0, 1],     cl);
  const qrOp   = interpolate(frame, [20, 42], [0, 1],     cl);

  const titleS = spring({ fps, frame: frame - 18, config: { damping: 18, stiffness: 80, mass: 0.8 }, from: 0, to: 1, durationInFrames: 35 });
  const titleY = interpolate(titleS, [0, 1], [26, 0]);

  const divW   = interpolate(frame, [48, 74], [0, width - 140], cl);
  const paraOp = interpolate(frame, [72, 95], [0, 1],  cl);
  const paraY  = interpolate(frame, [72, 95], [20, 0], cl);

  const qrUrl = reportUrl ?? `https://austin.chat${appPath}`;

  return (
    <AbsoluteFill style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", overflow: "hidden", background: "#f8f9fc" }}>

      <div style={{ position: "absolute", inset: 0, opacity: cityOp }}>
        <Cityscape width={width} height={height} accent={accentColor} />
      </div>

      <div style={{ position: "absolute", top: 0, left: 0, width: barW, height: 7, background: accentColor }} />

      <div style={{ position: "absolute", inset: 0, padding: "44px 70px 36px", display: "flex", flexDirection: "column" }}>

        {/* Top row: QR left + Eyebrow right */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 28, marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, opacity: qrOp, flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(0,0,0,0.45)", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              Scan to get report
            </div>
            <div style={{ background: "#ffffff", padding: 7, borderRadius: 6, border: `2px solid ${accentColor}`, lineHeight: 0 }}>
              <QRCodeSVG value={qrUrl} size={96} fgColor="#111111" bgColor="#ffffff" level="M" />
            </div>
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.15, color: accentColor, opacity: eyeOp }}>
            {eyebrow}
          </div>
        </div>

        {/* Title */}
        <div style={{ fontSize: 96, fontWeight: 800, color: "#111827", lineHeight: 1.08, letterSpacing: "-0.015em", transform: `translateY(${titleY}px)`, opacity: titleS, marginBottom: 20 }}>
          {title}
        </div>

        {/* Divider */}
        <div style={{ width: divW, height: 2, background: `linear-gradient(90deg, ${accentColor}, transparent)`, marginBottom: 24, borderRadius: 1 }} />

        {/* Narrative */}
        <div style={{ fontSize: 40, fontWeight: 700, color: "#1f2937", lineHeight: 1.45, opacity: paraOp, transform: `translateY(${paraY}px)`, maxWidth: "90%" }}>
          {narrative}
        </div>

      </div>
    </AbsoluteFill>
  );
};
