// video/simcenter-promo/src/components/PdfExportScene.tsx
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fadeInOut } from "../lib/animation";
import { COLORS, FONT_FAMILY } from "../theme";
import type { PdfSceneProps } from "../scenes";

export const PdfExportScene: React.FC<PdfSceneProps> = ({ headline, screenshot }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = fadeInOut(frame, durationInFrames);

  const cueStart = Math.round(durationInFrames * 0.4);
  const cueOpacity = interpolate(frame, [cueStart, cueStart + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cueOffset = interpolate(frame, [cueStart, cueStart + 30], [0, 20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark, opacity }}>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 48,
          fontWeight: 600,
          color: COLORS.textPrimary,
          textAlign: "center",
          padding: "48px 96px 0",
        }}
      >
        {headline}
      </div>
      <AbsoluteFill style={{ top: 200, justifyContent: "center", alignItems: "center" }}>
        <Img
          src={staticFile(screenshot)}
          style={{
            maxWidth: "80%",
            maxHeight: "70%",
            borderRadius: 16,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          bottom: 96 - cueOffset,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: cueOpacity,
          fontFamily: FONT_FAMILY,
          fontSize: 32,
          fontWeight: 600,
          color: COLORS.primary,
          backgroundColor: COLORS.bgCard,
          padding: "16px 32px",
          borderRadius: 999,
        }}
      >
        ⬇ report.pdf
      </div>
    </AbsoluteFill>
  );
};
