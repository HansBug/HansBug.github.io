import * as PIXI from "pixi.js-legacy";
import "../vendor/deskpet/live2d.min.js";
import { Live2DModel, MotionPreloadStrategy, MotionPriority } from "pixi-live2d-display/cubism2";

export interface BangdreamDeskPetRuntime {
  PIXI: typeof PIXI;
  Live2DModel: typeof Live2DModel;
  MotionPreloadStrategy: typeof MotionPreloadStrategy;
  MotionPriority: typeof MotionPriority;
}

type RuntimeWindow = Window & {
  Live2D?: unknown;
  PIXI?: typeof PIXI;
  __bangdreamDeskPetRuntime?: BangdreamDeskPetRuntime;
};

let tickerRegistered = false;

export async function ensureBangdreamDeskPetRuntime(): Promise<BangdreamDeskPetRuntime> {
  const runtimeWindow = window as RuntimeWindow;

  runtimeWindow.PIXI = PIXI;

  if (!tickerRegistered) {
    Live2DModel.registerTicker(PIXI.Ticker);
    tickerRegistered = true;
  }

  if (!runtimeWindow.Live2D) {
    throw new Error("Cubism 2 runtime did not initialize.");
  }

  if (!runtimeWindow.__bangdreamDeskPetRuntime) {
    runtimeWindow.__bangdreamDeskPetRuntime = {
      PIXI,
      Live2DModel,
      MotionPreloadStrategy,
      MotionPriority,
    };
  }

  return runtimeWindow.__bangdreamDeskPetRuntime;
}
