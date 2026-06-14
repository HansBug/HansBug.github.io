<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

import {
  buildBangdreamVariantMap,
  buildBangdreamVariants,
  buildBangdreamVariantsByCharacter,
  pickBangdreamSwitchVariant,
  pickFairBangdreamInitialVariant,
  resolveBangdreamVariantRequest,
  sampleBangdreamItem,
  variantLabel,
  type BangdreamDeskPetInteractionZone,
  type BangdreamDeskPetMotionAlias,
  type BangdreamDeskPetPoolData,
  type BangdreamDeskPetVariant,
} from "../utils/bangdreamDeskPet";
import type { BangdreamDeskPetRuntime } from "../utils/bangdreamDeskPetRuntime";

const props = defineProps<{
  pool: BangdreamDeskPetPoolData;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isBooting = ref(true);
const isDeparting = ref(false);
const isSwitching = ref(false);
const isMaterializing = ref(false);
const isMobile = ref(false);
const hasError = ref(false);
const isPetHovered = ref(false);
const isRouterHovered = ref(false);
const isPanelPinned = ref(false);
const isProfileExpanded = ref(false);
const statusTitle = ref("BOOT LINK");
const statusLine = ref("正在建立乐队信道");
const currentVariant = ref<BangdreamDeskPetVariant | null>(null);
const currentLoadedMotionCount = ref(0);
const currentLoadedExpressionCount = ref(0);
const switchCount = ref(1);

const variants = buildBangdreamVariants(props.pool);
const variantMap = buildBangdreamVariantMap(variants);
const variantsByCharacter = buildBangdreamVariantsByCharacter(variants);

let app: any = null;
let currentModel: any = null;
let currentMotionGroups: string[] = [];
let currentModelBounds:
  | {
      left: number;
      top: number;
      right: number;
      bottom: number;
      width: number;
      height: number;
    }
  | null = null;
let runtime: BangdreamDeskPetRuntime | null = null;
let pointerHandler: ((event: PointerEvent) => void) | null = null;
let resizeHandler: (() => void) | null = null;
let ambientTimer: number | null = null;
let panelTimer: number | null = null;
let statusTimer: number | null = null;
let destroyed = false;

type PreparedVariantModel = {
  model: any;
  motionGroups: string[];
  expressionCount: number;
};

const motionAliasKeys: BangdreamDeskPetMotionAlias[] = [
  "idle",
  "follow",
  "greet",
  "farewell",
  "react",
  "pose",
];

const currentBox = computed(() =>
  isMobile.value ? props.pool.pool.mobileSlot : props.pool.pool.desktopSlot,
);

const stageStyle = computed(() => ({
  width: `${currentBox.value.width}px`,
  height: `${currentBox.value.height}px`,
}));
const isPanelOpen = computed(
  () =>
    isBooting.value ||
    isDeparting.value ||
    isSwitching.value ||
    hasError.value ||
    isRouterHovered.value ||
    isPanelPinned.value,
);

const routerTitle = computed(() => currentVariant.value?.characterNameJa ?? "LIVE LINK");
const routerMeta = computed(() => {
  if (!currentVariant.value) return "signal waiting";
  return `${compactBandLabel(currentVariant.value)} // ${variantLabel(currentVariant.value.variant)}`;
});
const routerStats = computed(() => {
  if (!currentVariant.value) return "-- // --";
  const motionCount = currentLoadedMotionCount.value || currentVariant.value.motionGroupCount;
  const expressionCount = currentLoadedExpressionCount.value || currentVariant.value.expressionsCount;
  return `${compactPartLabel(currentVariant.value)} // ${motionCount}M ${expressionCount}E`;
});
const routerBadge = computed(() =>
  currentVariant.value && props.pool.defaultTopPickKeys.includes(currentVariant.value.key)
    ? "CORE PICK"
    : "OPEN POOL",
);
const routerSerial = computed(() =>
  currentVariant.value ? `S-${currentVariant.value.characterCode}` : "S-??",
);
const routerToggleLabel = computed(() => (isProfileExpanded.value ? "STATUS" : "PROFILE"));
const routerProfileItems = computed(() => {
  if (!currentVariant.value) return [];

  const variant = currentVariant.value;
  return [
    { label: "BAND", value: compactBandLabel(variant) },
    { label: "PART", value: variant.partEn },
    { label: "BDAY", value: `${variant.birthdayEn} / ${variant.zodiac}` },
    { label: "AGE", value: `${variant.age} / H${variant.heightCm}` },
    { label: "SCHOOL", value: compactSchoolLabel(variant) },
    { label: "CV", value: variant.cvJa || variant.cv },
    {
      label: "MOTION",
      value: `${currentLoadedMotionCount.value || variant.motionGroupCount}G / ${currentLoadedExpressionCount.value || variant.expressionsCount}E`,
    },
    { label: "ACT", value: compactActionLabel(variant) },
  ];
});

function compactBandLabel(variant: BangdreamDeskPetVariant) {
  if (variant.band === "Hello, Happy World!") {
    return "ハロハピ";
  }

  return variant.bandJa;
}

function compactPartLabel(variant: BangdreamDeskPetVariant) {
  switch (variant.partEn) {
    case "Guitar & Vocals":
      return "Gt.&Vo.";
    case "Vocals":
      return "Vo.";
    case "Guitar":
      return "Gt.";
    case "Bass":
      return "Ba.";
    case "Bass & Vocals":
      return "Ba.&Vo.";
    case "Drums":
      return "Dr.";
    case "DJ":
      return "DJ";
    case "Keyboard":
      return "Key.";
    case "Violin":
      return "Vn.";
    default:
      return variant.partEn;
  }
}

function compactSchoolName(school: string) {
  switch (school) {
    case "Hanasakigawa Girls' Academy":
      return "Hanasakigawa";
    case "Haneoka Girls' Academy":
      return "Haneoka";
    case "Tsukinomori Girls' Academy":
      return "Tsukinomori";
    case "Yotsuba Women's University":
      return "Yotsuba U";
    case "Keiho Women's University":
      return "Keiho U";
    case "Geijutsu High School of Fine Arts":
      return "Geijutsu";
    default:
      return school;
  }
}

function compactSchoolLabel(variant: BangdreamDeskPetVariant) {
  const school = compactSchoolName(variant.school);
  const slot = variant.schoolClass || variant.academicStatus;
  return slot ? `${school} / ${slot}` : school;
}

function birthdayCode(variant: BangdreamDeskPetVariant) {
  const match = variant.birthday.match(/(\d+)月(\d+)日/);
  if (!match) return variant.birthday;
  const [, month, day] = match;
  return `${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function compactActionLabel(variant: BangdreamDeskPetVariant) {
  const semanticCount = motionAliasKeys.length - variant.interactionMissingAliases.length;
  const { head, upper, lower } = variant.interactionZoneCounts;
  return `${semanticCount}A / H${head} U${upper} L${lower}`;
}

function signalLockLine(variant: BangdreamDeskPetVariant) {
  return `${variant.characterNameRomaji} / H${variant.heightCm} / ${birthdayCode(variant)}`;
}

function currentPixi() {
  if (!runtime) {
    throw new Error("Live2D runtime is not ready.");
  }

  return runtime.PIXI;
}

function setLockedStatus(variant: BangdreamDeskPetVariant) {
  statusTitle.value = "SIGNAL LOCK";
  statusLine.value = signalLockLine(variant);
}

function clearPanelTimer() {
  if (panelTimer !== null) {
    window.clearTimeout(panelTimer);
    panelTimer = null;
  }
}

function pinPanel(timeout = isMobile.value ? 4200 : 2800) {
  isPanelPinned.value = true;
  clearPanelTimer();

  if (timeout <= 0) return;

  panelTimer = window.setTimeout(() => {
    panelTimer = null;
    if (
      !isRouterHovered.value &&
      !isDeparting.value &&
      !isSwitching.value &&
      !hasError.value
    ) {
      isPanelPinned.value = false;
    }
  }, timeout);
}

function collapsePanel(delay = 140) {
  clearPanelTimer();
  panelTimer = window.setTimeout(() => {
    panelTimer = null;
    if (
      !isRouterHovered.value &&
      !isDeparting.value &&
      !isSwitching.value &&
      !hasError.value
    ) {
      isPanelPinned.value = false;
    }
  }, delay);
}

function handlePetEnter() {
  clearPanelTimer();
  isPetHovered.value = true;
}

function handlePetLeave() {
  isPetHovered.value = false;
  collapsePanel();
}

function handleRouterEnter() {
  clearPanelTimer();
  isRouterHovered.value = true;
}

function handleRouterLeave() {
  isRouterHovered.value = false;
  collapsePanel();
}

function handleRouterFocusIn() {
  clearPanelTimer();
  isRouterHovered.value = true;
  pinPanel(0);
}

function handleRouterFocusOut(event: FocusEvent) {
  const currentTarget = event.currentTarget;
  const nextTarget = event.relatedTarget;

  if (
    currentTarget instanceof HTMLElement &&
    nextTarget instanceof Node &&
    currentTarget.contains(nextTarget)
  ) {
    return;
  }

  isRouterHovered.value = false;
  collapsePanel();
}

function toggleProfilePanel() {
  if (isBooting.value || isDeparting.value || isSwitching.value || !currentVariant.value) return;

  isProfileExpanded.value = !isProfileExpanded.value;
  pinPanel(isMobile.value ? 7600 : 5400);
}

async function toggleSignalPanel() {
  if (isBooting.value || isDeparting.value || isSwitching.value) return;

  if (isMobile.value && isPanelOpen.value && currentVariant.value) {
    await handleRandomSwitch();
    return;
  }

  if (isPanelPinned.value || (isPanelOpen.value && !isRouterHovered.value)) {
    isPanelPinned.value = false;
    return;
  }

  pinPanel(isMobile.value ? 5600 : 3600);
}

function setTransientStatus(title: string, line: string, timeout = 1400) {
  statusTitle.value = title;
  statusLine.value = line;

  if (statusTimer !== null) {
    window.clearTimeout(statusTimer);
  }

  statusTimer = window.setTimeout(() => {
    statusTimer = null;
    if (!hasError.value && currentVariant.value && !isSwitching.value) {
      setLockedStatus(currentVariant.value);
    }
  }, timeout);
}

function updateViewportState() {
  isMobile.value = window.innerWidth <= 520;

  if (!app) return;
  app.renderer.resize(currentBox.value.width, currentBox.value.height);
  void relayoutCurrentModel();
}

async function relayoutCurrentModel() {
  if (!currentModel) return;
  await layoutModel(currentModel, currentVariant.value?.resourceType ?? "半身 / 日常便服立绘");
}

async function ensureRuntime() {
  const { ensureBangdreamDeskPetRuntime } = await import("../utils/bangdreamDeskPetRuntime");
  runtime = await ensureBangdreamDeskPetRuntime();
}

function initApp() {
  if (app || !canvasRef.value) return;

  const PIXI = currentPixi();
  app = new PIXI.Application({
    view: canvasRef.value,
    width: currentBox.value.width,
    height: currentBox.value.height,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
    backgroundAlpha: 0,
    antialias: true,
  });
}

function normalizeMotionGroups(settings: Record<string, unknown>) {
  const motions = (settings.motions || settings.Motions || {}) as Record<string, unknown>;
  return Object.keys(motions).filter((name) => !/^sys-/i.test(name));
}

function normalizeExpressionCount(settings: Record<string, unknown>) {
  const expressions = (settings.expressions || settings.Expressions || []) as unknown[];
  return expressions.length;
}

function availableAliasGroups(alias: BangdreamDeskPetMotionAlias) {
  const variantMatches = (currentVariant.value?.interactionMotions[alias] ?? []).filter((name) =>
    currentMotionGroups.includes(name),
  );
  if (variantMatches.length > 0) return variantMatches;

  return (props.pool.commonMotionAliases[alias] ?? []).filter((name) =>
    currentMotionGroups.includes(name),
  );
}

function availableZoneGroups(zone: BangdreamDeskPetInteractionZone) {
  return (currentVariant.value?.interactionZones[zone] ?? []).filter((name) =>
    currentMotionGroups.includes(name),
  );
}

async function triggerMotion(groupName: string) {
  if (!currentModel || typeof currentModel.motion !== "function") return false;
  const priority = runtime?.MotionPriority?.FORCE ?? 3;
  await Promise.resolve(currentModel.motion(groupName, 0, priority));
  return true;
}

async function triggerAlias(
  alias: BangdreamDeskPetMotionAlias,
  fallbackToRandom = true,
) {
  const matches = availableAliasGroups(alias);
  if (matches.length > 0) {
    return triggerMotion(sampleBangdreamItem(matches));
  }

  if (!fallbackToRandom) return false;
  const motionPool = currentMotionGroups.filter((name) => !/^idle/i.test(name));
  if (motionPool.length === 0) return false;
  return triggerMotion(sampleBangdreamItem(motionPool));
}

async function triggerExactMotionNames(names: string[]) {
  const matches = names.filter((name) => currentMotionGroups.includes(name));
  if (matches.length === 0) return false;
  return triggerMotion(sampleBangdreamItem(matches));
}

async function triggerZoneMotion(zone: BangdreamDeskPetInteractionZone) {
  const matches = availableZoneGroups(zone);
  if (matches.length === 0) return false;
  return triggerMotion(sampleBangdreamItem(matches));
}

async function triggerArrivalMotion() {
  return (
    (await triggerAlias("greet", false)) ||
    (await triggerExactMotionNames(["wink01", "talk01", "smile01", "smile02", "smile03"])) ||
    (await triggerAlias("pose", false)) ||
    triggerAlias("pose")
  );
}

async function triggerDepartureMotion() {
  return (
    (await triggerAlias("farewell", false)) ||
    (await triggerExactMotionNames(["bye01", "shame01", "sad01"])) ||
    (await triggerAlias("pose", false)) ||
    triggerAlias("pose")
  );
}

function stagePointToModelRegion(event: MouseEvent) {
  if (!currentModelBounds) return null;

  const stage = event.currentTarget as HTMLElement | null;
  if (!stage) return null;

  const stageRect = stage.getBoundingClientRect();
  const x = event.clientX - stageRect.left;
  const y = event.clientY - stageRect.top;
  const bounds = currentModelBounds;
  const paddingX = Math.max(10, bounds.width * 0.04);
  const paddingY = Math.max(10, bounds.height * 0.04);

  if (
    x < bounds.left - paddingX ||
    x > bounds.right + paddingX ||
    y < bounds.top - paddingY ||
    y > bounds.bottom + paddingY
  ) {
    return null;
  }

  const localX = (x - bounds.left) / Math.max(bounds.width, 1);
  const localY = (y - bounds.top) / Math.max(bounds.height, 1);
  const horizontal = localX < 0.34 ? "left" : localX > 0.66 ? "right" : "center";
  const vertical = localY < 0.3 ? "head" : localY < 0.68 ? "upper" : "lower";

  return {
    x,
    y,
    localX,
    localY,
    horizontal,
    vertical,
  };
}

async function triggerRegionInteraction(region: NonNullable<ReturnType<typeof stagePointToModelRegion>>) {
  if (region.vertical === "head") {
    setTransientStatus(
      "FACE LINK",
      region.horizontal === "center" ? "已触发视线互动" : "已触发表情互动",
      1700,
    );
    return (
      ((region.horizontal !== "center" && (await triggerAlias("follow", false))) ||
        (region.horizontal === "center" && (await triggerAlias("greet", false)))) ||
      (await triggerZoneMotion("head")) ||
      (await triggerAlias("greet"))
    );
  }

  if (region.vertical === "upper") {
    setTransientStatus(
      "LIVE REACT",
      region.horizontal === "center" ? "已触发舞台互动" : "已触发侧向舞台动作",
      1700,
    );
    return (
      (await triggerZoneMotion("upper")) ||
      (await triggerAlias(region.horizontal === "center" ? "pose" : "greet", false)) ||
      (await triggerAlias("pose"))
    );
  }

  setTransientStatus(
    "BAND REACT",
    region.horizontal === "center" ? "已触发下段反馈" : "已触发边侧反馈",
    1700,
  );
  return (
    (await triggerZoneMotion("lower")) ||
    (await triggerAlias("react", false)) ||
    (await triggerAlias("farewell", false)) ||
    triggerAlias("react")
  );
}

function stopAmbientLoop() {
  if (ambientTimer !== null) {
    window.clearTimeout(ambientTimer);
    ambientTimer = null;
  }
}

function startAmbientLoop() {
  stopAmbientLoop();
  ambientTimer = window.setTimeout(async () => {
    ambientTimer = null;
    if (!destroyed && !isSwitching.value && currentModel) {
      await triggerAlias(sampleBangdreamItem(["idle", "pose", "react"] as const));
    }
    if (!destroyed) startAmbientLoop();
  }, 7000 + Math.random() * 6000);
}

function layoutScale(box: { width: number; height: number }, bounds: any, resourceType: string) {
  const halfLike = /半身|桌宠|挂件|吉祥物|小挂件/.test(resourceType);
  const wide = /横构图|超宽/.test(resourceType);
  const fullBody = /全身/.test(resourceType);
  const targetHeight = halfLike
    ? box.height * 0.94
    : wide
      ? box.height * 1.06
      : fullBody
        ? box.height * 1.32
        : box.height * 1.12;
  const hardMaxWidth = halfLike ? box.width * 0.9 : wide ? box.width * 1.02 : box.width * 0.92;
  let scale = targetHeight / bounds.height;

  if (bounds.width * scale > hardMaxWidth) {
    scale = hardMaxWidth / bounds.width;
  }

  return scale;
}

async function layoutModel(model: any, resourceType: string) {
  const box = currentBox.value;
  const bounds = model.getLocalBounds();
  const halfLike = /半身|桌宠|挂件|吉祥物|小挂件/.test(resourceType);
  const wide = /横构图|超宽/.test(resourceType);
  const fullBody = /全身/.test(resourceType);
  const scale = layoutScale(box, bounds, resourceType);

  model.scale.set(scale);
  model.pivot.set(
    bounds.x + bounds.width * (wide ? 0.52 : 0.5),
    bounds.y + bounds.height * (halfLike ? 0.97 : wide ? 0.78 : fullBody ? 0.86 : 0.9),
  );
  model.position.set(box.width * (wide ? 0.72 : 0.68), box.height * 1.02);

  await new Promise((resolve) => requestAnimationFrame(resolve));

  const fitted = model.getBounds();
  model.position.x += box.width - 2 - fitted.right;
  model.position.y += box.height - 1 - fitted.bottom;
  const finalBounds = model.getBounds();
  currentModelBounds = {
    left: finalBounds.left,
    top: finalBounds.top,
    right: finalBounds.right,
    bottom: finalBounds.bottom,
    width: finalBounds.width,
    height: finalBounds.height,
  };
}

async function prepareModel(variant: BangdreamDeskPetVariant) {
  const options: Record<string, unknown> = { autoUpdate: true };

  if (!runtime) {
    throw new Error("Live2D runtime is not ready.");
  }

  if (runtime.MotionPreloadStrategy) {
    options.motionPreload = runtime.MotionPreloadStrategy.ALL;
  }

  let lastError: unknown = null;
  for (const manifestUrl of [variant.manifestUrl, variant.rawManifestUrl]) {
    try {
      const model = await runtime.Live2DModel.from(manifestUrl, options);
      const settings = (model.internalModel?.settings ?? {}) as Record<string, unknown>;
      return {
        model,
        motionGroups: normalizeMotionGroups(settings),
        expressionCount: normalizeExpressionCount(settings),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to load variant");
}

async function activatePreparedVariant(
  nextVariant: BangdreamDeskPetVariant,
  prepared: PreparedVariantModel,
) {
  if (destroyed) {
    releaseModel(prepared.model);
    return;
  }

  const previousModel = currentModel;
  currentModel = prepared.model;
  currentMotionGroups = prepared.motionGroups;
  currentLoadedMotionCount.value = prepared.motionGroups.length;
  currentLoadedExpressionCount.value = prepared.expressionCount;

  app.stage.addChild(currentModel);
  await layoutModel(currentModel, nextVariant.resourceType);

  if (previousModel) {
    releaseModel(previousModel);
  }

  currentVariant.value = nextVariant;
  isProfileExpanded.value = false;
  switchCount.value += 1;
  setLockedStatus(nextVariant);
  startAmbientLoop();
}

function releaseModel(model: any) {
  if (!model) return;
  if (model === currentModel) {
    currentModelBounds = null;
  }
  try {
    model.parent?.removeChild(model);
  } catch {}
  try {
    model.destroy?.({ children: true });
  } catch {}
}

function pickInitialVariant() {
  if (typeof window !== "undefined") {
    const requested = new URL(window.location.href).searchParams.get("deskpet")?.trim();
    if (requested) {
      const resolved = resolveBangdreamVariantRequest(requested, variantMap, variants);
      if (resolved) return resolved;
    }
  }

  return pickFairBangdreamInitialVariant(variantsByCharacter);
}

function pickRandomSwitchTarget() {
  const currentCode = currentVariant.value?.characterCode;
  return pickBangdreamSwitchVariant(variantsByCharacter, currentCode);
}

async function swapVariant(nextVariant: BangdreamDeskPetVariant) {
  const prepared = await prepareModel(nextVariant);
  await activatePreparedVariant(nextVariant, prepared);
}

async function handlePetInteract(event?: MouseEvent) {
  if (!currentModel || isBooting.value || isDeparting.value || isSwitching.value) return;

  if (event) {
    const region = stagePointToModelRegion(event);
    if (!region) return;
    await triggerRegionInteraction(region);
  } else {
    setTransientStatus("LIVE REACT", "已触发中心互动", 1700);
    await triggerArrivalMotion();
  }

  startAmbientLoop();
}

async function handleRandomSwitch() {
  if (isBooting.value || isDeparting.value || isSwitching.value || !app) return;
  const nextVariant = pickRandomSwitchTarget();
  if (!nextVariant) return;

  if (statusTimer !== null) {
    window.clearTimeout(statusTimer);
    statusTimer = null;
  }

  pinPanel(isMobile.value ? 6200 : 4200);
  hasError.value = false;
  statusTitle.value = "CHANNEL REROUTE";
  statusLine.value = `正在切换至 ${nextVariant.characterNameJa}`;

  try {
    isDeparting.value = true;
    await triggerDepartureMotion();
    await new Promise((resolve) => window.setTimeout(resolve, 760));
    statusTitle.value = "CHANNEL SYNC";
    statusLine.value = `正在接入 ${nextVariant.characterNameJa}`;
    const prepared = await prepareModel(nextVariant);
    isDeparting.value = false;
    isSwitching.value = true;
    await activatePreparedVariant(nextVariant, prepared);
    isMaterializing.value = true;
    await new Promise((resolve) => window.setTimeout(resolve, 620));
    isMaterializing.value = false;
    isSwitching.value = false;
    await triggerArrivalMotion();
    setTransientStatus("SIGNAL LOCK", `已切换至 ${nextVariant.characterNameJa}`, 1700);
  } catch (error) {
    hasError.value = true;
    statusTitle.value = "SIGNAL LOST";
    statusLine.value = error instanceof Error ? error.message : "角色通道切换失败";
  } finally {
    isDeparting.value = false;
    isSwitching.value = false;
  }
}

function attachListeners() {
  pointerHandler = (event) => {
    if (!currentModel || !app || !canvasRef.value || typeof currentModel.focus !== "function") return;

    const rect = canvasRef.value.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const focusX = ((event.clientX - rect.left) / rect.width) * app.renderer.width;
    const focusY = ((event.clientY - rect.top) / rect.height) * app.renderer.height;
    currentModel.focus(focusX, focusY);
  };

  resizeHandler = () => {
    updateViewportState();
  };

  window.addEventListener("pointermove", pointerHandler, { passive: true });
  window.addEventListener("resize", resizeHandler, { passive: true });
}

function detachListeners() {
  if (pointerHandler) {
    window.removeEventListener("pointermove", pointerHandler);
    pointerHandler = null;
  }

  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }
}

onMounted(async () => {
  destroyed = false;
  updateViewportState();
  await nextTick();

  try {
    statusTitle.value = "BOOT LINK";
    statusLine.value = "正在装载乐队运行时";
    await ensureRuntime();
    statusLine.value = "运行时已就绪，正在装配 Band Link";
    initApp();
    attachListeners();
    await swapVariant(pickInitialVariant());
    isBooting.value = false;
    isMaterializing.value = true;
    await new Promise((resolve) => window.setTimeout(resolve, 620));
    isMaterializing.value = false;
    await triggerArrivalMotion();
  } catch (error) {
    hasError.value = true;
    statusTitle.value = "BOOT FAILED";
    statusLine.value = error instanceof Error ? error.message : "Band Link 初始化失败";
  } finally {
    isBooting.value = false;
  }
});

onBeforeUnmount(() => {
  destroyed = true;
  stopAmbientLoop();
  clearPanelTimer();
  if (statusTimer !== null) {
    window.clearTimeout(statusTimer);
    statusTimer = null;
  }
  detachListeners();
  releaseModel(currentModel);
  currentModel = null;
  currentMotionGroups = [];
  currentLoadedMotionCount.value = 0;
  currentLoadedExpressionCount.value = 0;
  currentModelBounds = null;
  if (app) {
    try {
      app.destroy(true, { children: true, texture: false, baseTexture: false });
    } catch {}
    app = null;
  }
  runtime = null;
});
</script>

<template>
  <aside
    class="deskpet-overlay"
    :class="{
      'is-booting': isBooting,
      'is-switching': isSwitching,
      'is-materializing': isMaterializing,
      'is-panel-open': isPanelOpen,
      'has-error': hasError,
      'is-mobile': isMobile,
    }"
    aria-label="右下角 Live2D Band Link"
  >
    <button
      type="button"
      class="deskpet-signal-node"
      :class="{ 'is-active': isPanelOpen }"
      :aria-expanded="isPanelOpen ? 'true' : 'false'"
      aria-label="展开 Band Signal 面板"
      @click="toggleSignalPanel"
    >
      <span class="deskpet-signal-node__ring"></span>
      <span class="deskpet-signal-node__core"></span>
    </button>

    <div
      class="deskpet-router shell-card"
      tabindex="0"
      role="button"
      aria-label="切换当前桌宠角色"
      @click="handleRandomSwitch"
      @pointerenter="handleRouterEnter"
      @pointerleave="handleRouterLeave"
      @focusin="handleRouterFocusIn"
      @focusout="handleRouterFocusOut"
      @keydown.enter.prevent="handleRandomSwitch"
      @keydown.space.prevent="handleRandomSwitch"
    >
      <div class="deskpet-router__header">
        <span class="eyebrow">BAND SIGNAL</span>
        <div class="deskpet-router__header-actions">
          <button
            type="button"
            class="deskpet-router__toggle"
            :aria-expanded="isProfileExpanded ? 'true' : 'false'"
            :aria-label="isProfileExpanded ? '切换为状态视图' : '展开角色资料'"
            @click.stop="toggleProfilePanel"
          >
            {{ routerToggleLabel }}
          </button>
          <strong class="tech-digits tech-digits--mini">{{ routerSerial }}</strong>
        </div>
      </div>

      <div class="deskpet-router__body">
        <div class="deskpet-router__copy">
          <span class="deskpet-router__badge">{{ routerBadge }}</span>
          <strong class="deskpet-router__title" :title="currentVariant?.characterNameRomaji ?? routerTitle">
            {{ routerTitle }}
          </strong>
          <span class="deskpet-router__meta">{{ routerMeta }}</span>
          <span class="deskpet-router__stats">{{ routerStats }}</span>
        </div>

        <span class="deskpet-router__dial" aria-hidden="true">
          <span class="deskpet-router__ring deskpet-router__ring--outer"></span>
          <span class="deskpet-router__ring deskpet-router__ring--inner"></span>
          <span class="deskpet-router__core"></span>
        </span>
      </div>

      <template v-if="!isProfileExpanded">
        <div class="deskpet-router__footer">
          <span>{{ statusTitle }}</span>
          <span>{{ statusLine }}</span>
        </div>

        <div class="deskpet-router__hint">
          <span>card / reroute</span>
          <span>pet / react</span>
        </div>
      </template>

      <div v-else class="deskpet-router__profile" @click.stop>
        <div
          v-for="item in routerProfileItems"
          :key="item.label"
          class="deskpet-router__profile-item"
        >
          <span class="deskpet-router__profile-label">{{ item.label }}</span>
          <span class="deskpet-router__profile-value" :title="item.value">{{ item.value }}</span>
        </div>
      </div>
    </div>

    <div
      class="deskpet-stage"
      :style="stageStyle"
      role="button"
      tabindex="0"
      @pointerenter="handlePetEnter"
      @pointerleave="handlePetLeave"
      @click="handlePetInteract($event)"
      @keydown.enter.prevent="handlePetInteract"
      @keydown.space.prevent="handlePetInteract"
    >
      <canvas ref="canvasRef" class="deskpet-stage__canvas"></canvas>
      <div class="deskpet-stage__scan" aria-hidden="true"></div>
      <div class="deskpet-stage__base" aria-hidden="true"></div>
    </div>
  </aside>
</template>

<style scoped>
.deskpet-overlay {
  position: fixed;
  right: 0;
  bottom: 0;
  z-index: 80;
  display: block;
  pointer-events: none;
}

.deskpet-signal-node,
.deskpet-router,
.deskpet-stage {
  pointer-events: auto;
}

.deskpet-signal-node {
  position: absolute;
  right: calc(100% - 0.75rem);
  bottom: 1.15rem;
  z-index: 82;
  width: 2.35rem;
  height: 2.35rem;
  border: 1px solid rgba(119, 199, 215, 0.22);
  border-radius: 999px;
  background:
    radial-gradient(circle at 50% 50%, rgba(119, 199, 215, 0.2), rgba(10, 14, 18, 0.94) 66%),
    rgba(10, 14, 18, 0.94);
  box-shadow:
    0 10px 18px rgba(0, 0, 0, 0.24),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition:
    transform 220ms ease,
    border-color 220ms ease,
    opacity 220ms ease,
    box-shadow 220ms ease;
}

.deskpet-signal-node:hover {
  transform: translate3d(0, -1px, 0);
  border-color: rgba(119, 199, 215, 0.38);
}

.deskpet-signal-node__ring,
.deskpet-signal-node__core {
  position: absolute;
  inset: 50%;
  border-radius: 999px;
  transform: translate(-50%, -50%);
}

.deskpet-signal-node__ring {
  width: 1.5rem;
  height: 1.5rem;
  border: 1px solid rgba(119, 199, 215, 0.32);
}

.deskpet-signal-node__core {
  width: 0.45rem;
  height: 0.45rem;
  background: radial-gradient(circle, rgba(119, 199, 215, 0.94), rgba(119, 199, 215, 0.18));
  box-shadow: 0 0 12px rgba(119, 199, 215, 0.48);
}

.deskpet-overlay.is-panel-open .deskpet-signal-node {
  border-color: rgba(119, 199, 215, 0.44);
  box-shadow:
    0 10px 18px rgba(0, 0, 0, 0.24),
    0 0 18px rgba(119, 199, 215, 0.14),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.deskpet-overlay.is-panel-open .deskpet-signal-node__ring {
  animation: deskpet-spin 3.1s linear infinite;
}

.deskpet-router {
  position: absolute;
  right: calc(100% - 0.45rem);
  bottom: 0.95rem;
  z-index: 83;
  width: 13.2rem;
  padding: 0.85rem 0.9rem 0.8rem;
  border-color: rgba(119, 199, 215, 0.16);
  background:
    linear-gradient(180deg, rgba(119, 199, 215, 0.08), rgba(255, 255, 255, 0)),
    linear-gradient(135deg, rgba(255, 255, 255, 0.04), transparent 46%),
    rgba(18, 23, 28, 0.96);
  box-shadow: 0 16px 26px rgba(0, 0, 0, 0.26);
  color: var(--heading);
  text-align: left;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transform: translate3d(20px, 0, 0) scale(0.96);
  pointer-events: none;
  transition:
    transform 220ms ease,
    border-color 220ms ease,
    background 220ms ease,
    opacity 220ms ease,
    visibility 220ms ease;
}

.deskpet-overlay.is-panel-open .deskpet-router {
  opacity: 1;
  visibility: visible;
  transform: translate3d(0, 0, 0) scale(1);
  pointer-events: auto;
}

.deskpet-router:hover {
  transform: translate3d(0, -1px, 0) scale(1);
  border-color: rgba(119, 199, 215, 0.38);
  background:
    linear-gradient(180deg, rgba(119, 199, 215, 0.08), rgba(255, 255, 255, 0)),
    linear-gradient(135deg, rgba(255, 255, 255, 0.04), transparent 46%),
    rgba(18, 23, 28, 0.96);
}

.deskpet-router__header,
.deskpet-router__footer,
.deskpet-router__hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.deskpet-router__header-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.deskpet-router__body {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.8rem 0 0.72rem;
}

.deskpet-router__copy {
  display: grid;
  gap: 0.18rem;
  min-width: 0;
}

.deskpet-router__badge,
.deskpet-router__stats,
.deskpet-router__hint,
.deskpet-router__footer,
.deskpet-router__profile-label {
  font-family: var(--font-meta);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.deskpet-router__toggle {
  border: 1px solid rgba(119, 199, 215, 0.2);
  border-radius: 999px;
  background: rgba(119, 199, 215, 0.08);
  color: var(--text-muted);
  font-family: var(--font-meta);
  font-size: 0.54rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  line-height: 1;
  padding: 0.24rem 0.38rem;
  cursor: pointer;
  transition:
    border-color 180ms ease,
    color 180ms ease,
    background 180ms ease;
}

.deskpet-router__toggle:hover,
.deskpet-router__toggle:focus-visible {
  border-color: rgba(119, 199, 215, 0.38);
  background: rgba(119, 199, 215, 0.12);
  color: var(--heading);
  outline: none;
}

.deskpet-router__badge {
  color: var(--accent);
}

.deskpet-router__title {
  line-height: 1.08;
  font-size: 1.02rem;
}

.deskpet-router__meta {
  color: var(--text-muted);
  line-height: 1.3;
  font-size: 0.8rem;
}

.deskpet-router__stats {
  color: var(--text-faint);
}

.deskpet-router__footer {
  padding-top: 0.7rem;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  color: var(--text-muted);
  flex-direction: column;
  align-items: flex-start;
}

.deskpet-router__hint {
  margin-top: 0.58rem;
  color: var(--text-faint);
}

.deskpet-router__profile {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.46rem 0.6rem;
  padding-top: 0.7rem;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.deskpet-router__profile-item {
  display: grid;
  gap: 0.08rem;
  min-width: 0;
}

.deskpet-router__profile-label {
  font-size: 0.52rem;
  color: var(--accent);
}

.deskpet-router__profile-value {
  min-width: 0;
  color: var(--text-muted);
  font-size: 0.66rem;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.deskpet-router__dial {
  position: relative;
  width: 3.2rem;
  height: 3.2rem;
  flex: none;
}

.deskpet-router__ring,
.deskpet-router__core {
  position: absolute;
  inset: 50%;
  border-radius: 999px;
  transform: translate(-50%, -50%);
}

.deskpet-router__ring--outer {
  width: 100%;
  height: 100%;
  border: 1px solid rgba(119, 199, 215, 0.28);
  box-shadow: inset 0 0 0 1px rgba(119, 199, 215, 0.08);
}

.deskpet-router__ring--inner {
  width: 2.05rem;
  height: 2.05rem;
  border: 1px solid rgba(119, 199, 215, 0.42);
  animation: deskpet-pulse 2.8s ease-in-out infinite;
}

.deskpet-router__core {
  width: 0.72rem;
  height: 0.72rem;
  background: radial-gradient(circle, rgba(119, 199, 215, 0.95), rgba(119, 199, 215, 0.18));
  box-shadow: 0 0 18px rgba(119, 199, 215, 0.48);
}

.deskpet-stage {
  position: relative;
  display: block;
  overflow: visible;
  flex: none;
  cursor: pointer;
  outline: none;
}

.deskpet-stage__canvas {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 18px 22px rgba(0, 0, 0, 0.36));
  transition:
    transform 320ms ease,
    filter 320ms ease,
    opacity 320ms ease;
}

.deskpet-stage__scan,
.deskpet-stage__base {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
}

.deskpet-stage__scan {
  inset: 0;
  opacity: 0;
  background:
    linear-gradient(180deg, transparent 0%, rgba(119, 199, 215, 0.16) 46%, transparent 100%),
    repeating-linear-gradient(
      180deg,
      transparent 0 18px,
      rgba(149, 219, 255, 0.065) 18px 19px,
      transparent 19px 38px
    );
  mix-blend-mode: screen;
}

.deskpet-stage__base {
  bottom: 0;
  height: 3.6rem;
  background:
    radial-gradient(circle at 84% 100%, rgba(119, 199, 215, 0.22), transparent 48%),
    linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.16));
}

.deskpet-stage__base::before {
  content: "";
  position: absolute;
  right: 0.35rem;
  bottom: 0.55rem;
  width: 72%;
  height: 0.42rem;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(119, 199, 215, 0), rgba(119, 199, 215, 0.34) 40%, rgba(119, 199, 215, 0.06));
  filter: blur(1px);
}

.deskpet-overlay.is-booting .deskpet-stage__scan,
.deskpet-overlay.is-switching .deskpet-stage__scan,
.deskpet-overlay.is-materializing .deskpet-stage__scan {
  opacity: 1;
  animation: deskpet-scan 820ms linear infinite;
}

.deskpet-overlay.is-switching .deskpet-stage__canvas {
  opacity: 0.2;
  filter: blur(5px) saturate(1.15) drop-shadow(0 18px 24px rgba(0, 0, 0, 0.18));
  transform: translate3d(0, 24px, 0) scale(0.96);
}

.deskpet-overlay.is-materializing .deskpet-stage__canvas {
  animation: deskpet-materialize 520ms ease both;
}

.deskpet-overlay.is-switching .deskpet-router__ring--outer {
  animation: deskpet-spin 0.95s linear infinite;
}

.deskpet-overlay.has-error .deskpet-router {
  border-color: rgba(181, 104, 93, 0.38);
}

.deskpet-overlay.has-error .deskpet-router__badge,
.deskpet-overlay.has-error .deskpet-router__core {
  color: var(--accent-red);
  background: radial-gradient(circle, rgba(181, 104, 93, 0.95), rgba(181, 104, 93, 0.18));
  box-shadow: 0 0 18px rgba(181, 104, 93, 0.42);
}

@keyframes deskpet-pulse {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(0.92);
    opacity: 0.72;
  }

  50% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

@keyframes deskpet-spin {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }

  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes deskpet-scan {
  from {
    transform: translate3d(0, -100%, 0);
  }

  to {
    transform: translate3d(0, 100%, 0);
  }
}

@keyframes deskpet-materialize {
  from {
    opacity: 0.2;
    transform: translate3d(10px, 24px, 0) scale(0.94);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@media (max-width: 900px) {
  .deskpet-signal-node {
    right: calc(100% - 0.5rem);
  }

  .deskpet-router {
    width: 11.6rem;
    padding: 0.78rem 0.8rem 0.74rem;
  }

  .deskpet-router__profile-value {
    font-size: 0.62rem;
  }
}

@media (max-width: 520px) {
  .deskpet-overlay {
    right: -0.1rem;
    bottom: -0.7rem;
  }

  .deskpet-signal-node {
    right: calc(100% - 2.4rem);
    bottom: 0.5rem;
    width: 2.1rem;
    height: 2.1rem;
  }

  .deskpet-signal-node__ring {
    width: 1.32rem;
    height: 1.32rem;
  }

  .deskpet-router {
    right: 0.2rem;
    bottom: calc(100% - 0.5rem);
    width: 9.4rem;
    padding: 0.66rem 0.72rem 0.64rem;
    transform: translate3d(0, 12px, 0) scale(0.96);
  }

  .deskpet-router__body {
    gap: 0.55rem;
    padding: 0.56rem 0 0.5rem;
  }

  .deskpet-router__title {
    font-size: 0.86rem;
  }

  .deskpet-router__meta {
    font-size: 0.72rem;
  }

  .deskpet-router__stats,
  .deskpet-router__hint,
  .deskpet-router__footer,
  .deskpet-router__profile-label {
    font-size: 0.6rem;
  }

  .deskpet-router__toggle {
    font-size: 0.48rem;
    padding: 0.18rem 0.28rem;
  }

  .deskpet-router__profile {
    grid-template-columns: 1fr;
    gap: 0.3rem;
    max-height: 4.3rem;
    overflow: auto;
  }

  .deskpet-router__profile-value {
    font-size: 0.58rem;
  }

  .deskpet-router__dial {
    width: 2.4rem;
    height: 2.4rem;
  }

  .deskpet-stage__base::before {
    width: 80%;
  }
}
</style>
