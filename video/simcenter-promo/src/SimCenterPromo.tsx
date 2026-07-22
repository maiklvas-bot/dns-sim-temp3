// video/simcenter-promo/src/SimCenterPromo.tsx
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { SCENES, type Scene } from "./scenes";
import { COLORS } from "./theme";
import { LogoCard } from "./components/LogoCard";
import { TextOnlyScene } from "./components/TextOnlyScene";
import { ScreenshotScene } from "./components/ScreenshotScene";
import { PdfExportScene } from "./components/PdfExportScene";

/** Returns the `from` frame for each scene, in order. */
export function computeSequenceOffsets(scenes: Scene[]): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const scene of scenes) {
    offsets.push(cursor);
    cursor += scene.durationInFrames;
  }
  return offsets;
}

function renderScene(scene: Scene) {
  switch (scene.kind) {
    case "logo":
      return <LogoCard {...scene.props} />;
    case "text":
      return <TextOnlyScene {...scene.props} />;
    case "screenshot":
      return <ScreenshotScene {...scene.props} />;
    case "pdf":
      return <PdfExportScene {...scene.props} />;
  }
}

export const SimCenterPromo: React.FC = () => {
  const offsets = computeSequenceOffsets(SCENES);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      <Audio src={staticFile("audio/bg-music.wav")} volume={0.5} />
      {SCENES.map((scene, index) => (
        <Sequence key={scene.id} from={offsets[index]} durationInFrames={scene.durationInFrames}>
          {renderScene(scene)}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
