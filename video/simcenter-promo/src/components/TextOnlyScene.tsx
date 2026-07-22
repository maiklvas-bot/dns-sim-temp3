// video/simcenter-promo/src/components/TextOnlyScene.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { fadeInOut } from "../lib/animation";
import { COLORS, FONT_FAMILY } from "../theme";
import type { TextSceneProps } from "../scenes";

export const TextOnlyScene: React.FC<TextSceneProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = fadeInOut(frame, durationInFrames);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bgDark,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 56,
          fontWeight: 500,
          color: COLORS.textPrimary,
          textAlign: "center",
          maxWidth: "70%",
          lineHeight: 1.4,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
