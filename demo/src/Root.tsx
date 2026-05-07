import React from "react";
import { Composition } from "remotion";
import { Demo } from "./Demo";

const FPS = 30;
const DURATION = 600; // 20 seconds @ 30fps

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="coding-drives-demo"
      component={Demo}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
