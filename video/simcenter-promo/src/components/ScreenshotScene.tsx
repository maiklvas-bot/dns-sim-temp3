// video/simcenter-promo/src/components/ScreenshotScene.tsx
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fadeInOut, kenBurnsScale } from "../lib/animation";
import { COLORS, FONT_FAMILY } from "../theme";
import type { ScreenshotSceneProps } from "../scenes";

export const ScreenshotScene: React.FC<ScreenshotSceneProps> = ({
  headline,
  subheadline,
  screenshot,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = fadeInOut(frame, durationInFrames);
  const scale = kenBurnsScale(frame, durationInFrames);

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
      {subheadline ? (
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 28,
            color: COLORS.primary,
            textAlign: "center",
            marginTop: 16,
          }}
        >
          {subheadline}
        </div>
      ) : null}
      <AbsoluteFill
        style={{
          top: subheadline ? 260 : 200,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Img
          src={staticFile(screenshot)}
          style={{
            maxWidth: "80%",
            maxHeight: "70%",
            transform: `scale(${scale})`,
            borderRadius: 16,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
