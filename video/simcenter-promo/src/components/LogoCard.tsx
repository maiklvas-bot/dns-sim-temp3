// video/simcenter-promo/src/components/LogoCard.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { fadeInOut } from "../lib/animation";
import { COLORS, FONT_FAMILY, GRADIENTS } from "../theme";
import type { LogoSceneProps } from "../scenes";

export const LogoCard: React.FC<LogoSceneProps> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = fadeInOut(frame, durationInFrames);

  return (
    <AbsoluteFill
      style={{
        background: GRADIENTS.hero,
        backgroundColor: COLORS.bgDark,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 96,
          fontWeight: 700,
          color: COLORS.textPrimary,
          textAlign: "center",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 36,
          fontWeight: 400,
          color: COLORS.primary,
          marginTop: 24,
          textAlign: "center",
        }}
      >
        {subtitle}
      </div>
    </AbsoluteFill>
  );
};
