export interface BangdreamDeskPetCharacter {
  code: string;
  name: string;
  band: string;
  motionGroupCount: number;
  expressionsCount: number;
  variants: string[];
}

export interface BangdreamDeskPetPoolData {
  version: string;
  pool: {
    id: string;
    ip: string;
    sourceRepo: string;
    sourceRepoUrl: string;
    runtime: string;
    validatedAt: string;
    qualifiedVariantCount: number;
    qualifiedCharacterCount: number;
    manifestBaseTemplate: string;
    rawManifestBaseTemplate: string;
    desktopSlot: {
      width: number;
      height: number;
      right: number;
      bottom: number;
    };
    mobileSlot: {
      width: number;
      height: number;
      right: number;
      bottom: number;
    };
  };
  defaultTopPickKeys: string[];
  topPickReasons: Record<string, string>;
  commonMotionAliases: Record<string, string[]>;
  characters: BangdreamDeskPetCharacter[];
}

export interface BangdreamDeskPetVariant {
  key: string;
  modelKey: string;
  characterCode: string;
  characterName: string;
  band: string;
  variant: string;
  season: "regular" | "summer" | "winter";
  resourceType: string;
  runtime: string;
  motionGroupCount: number;
  expressionsCount: number;
  manifestUrl: string;
  rawManifestUrl: string;
}

function buildLocalManifestUrl(modelKey: string) {
  const basePath = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");
  const rootPath = import.meta.env.DEV
    ? "/src/vendor/deskpet/bangdream-models"
    : "/assets/bangdream-models";
  return `${basePath}${rootPath}/${modelKey}/model.json`;
}

export function variantSeason(variant: string): BangdreamDeskPetVariant["season"] {
  if (variant.endsWith("_summer")) return "summer";
  if (variant.endsWith("_winter")) return "winter";
  return "regular";
}

export function variantResourceType(variant: string) {
  if (variant.endsWith("_summer")) return "半身 / 夏日便服立绘";
  if (variant.endsWith("_winter")) return "半身 / 冬季便服立绘";
  return "半身 / 日常便服立绘";
}

export function variantLabel(variant: string) {
  if (variant.endsWith("_summer")) return "夏服";
  if (variant.endsWith("_winter")) return "冬服";
  return "常服";
}

export function buildBangdreamVariants(pool: BangdreamDeskPetPoolData): BangdreamDeskPetVariant[] {
  return pool.characters.flatMap((character) =>
    character.variants.map((variant) => {
      const modelKey = `${character.code}_${variant}`;
      const manifestUrl = buildLocalManifestUrl(modelKey);
      return {
        key: `bangdream_${modelKey}`,
        modelKey,
        characterCode: character.code,
        characterName: character.name,
        band: character.band,
        variant,
        season: variantSeason(variant),
        resourceType: variantResourceType(variant),
        runtime: pool.pool.runtime,
        motionGroupCount: character.motionGroupCount,
        expressionsCount: character.expressionsCount,
        manifestUrl,
        rawManifestUrl: manifestUrl,
      };
    }),
  );
}
