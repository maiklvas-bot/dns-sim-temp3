import { Composition } from "remotion";
import { VIDEO_CONFIG } from "./videoConfig";
import { SimCenterPromo } from "./SimCenterPromo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={VIDEO_CONFIG.id}
      component={SimCenterPromo}
      durationInFrames={VIDEO_CONFIG.durationInFrames}
      fps={VIDEO_CONFIG.fps}
      width={VIDEO_CONFIG.width}
      height={VIDEO_CONFIG.height}
      defaultProps={{}}
    />
  );
};
