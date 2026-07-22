import { Composition } from "remotion";
import { VIDEO_CONFIG } from "./videoConfig";

// Placeholder component until Task 11 wires up the real timeline.
const Placeholder: React.FC = () => null;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={VIDEO_CONFIG.id}
      component={Placeholder}
      durationInFrames={VIDEO_CONFIG.durationInFrames}
      fps={VIDEO_CONFIG.fps}
      width={VIDEO_CONFIG.width}
      height={VIDEO_CONFIG.height}
      defaultProps={{}}
    />
  );
};
