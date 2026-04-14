export type BangdreamDeskPetMotionAlias =
  | "idle"
  | "follow"
  | "greet"
  | "farewell"
  | "react"
  | "pose";

export type BangdreamDeskPetInteractionZone = "head" | "upper" | "lower";

export type BangdreamDeskPetInteractionMotionMap = Record<
  BangdreamDeskPetMotionAlias,
  string[]
>;

export type BangdreamDeskPetInteractionZoneMap = Record<
  BangdreamDeskPetInteractionZone,
  string[]
>;

export type BangdreamDeskPetInteractionZoneCounts = Record<
  BangdreamDeskPetInteractionZone,
  number
>;

export interface BangdreamDeskPetCharacter {
  code: string;
  name: string;
  nameJa: string;
  nameRomaji: string;
  band: string;
  bandJa: string;
  part: string;
  partEn: string;
  birthday: string;
  birthdayEn: string;
  age: string;
  ageNote: string;
  heightCm: number;
  zodiac: string;
  academicStatus: string;
  school: string;
  schoolClass: string;
  schoolYear: string;
  cv: string;
  cvJa: string;
  description: string;
  motionGroups: string[];
  motionGroupCount: number;
  expressionsCount: number;
  interactionMotions: BangdreamDeskPetInteractionMotionMap;
  interactionZones: BangdreamDeskPetInteractionZoneMap;
  interactionZoneCounts: BangdreamDeskPetInteractionZoneCounts;
  interactionMissingAliases: BangdreamDeskPetMotionAlias[];
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
  commonMotionAliases: BangdreamDeskPetInteractionMotionMap;
  characters: BangdreamDeskPetCharacter[];
}

export interface BangdreamDeskPetVariant {
  key: string;
  modelKey: string;
  characterCode: string;
  characterName: string;
  characterNameJa: string;
  characterNameRomaji: string;
  band: string;
  bandJa: string;
  part: string;
  partEn: string;
  birthday: string;
  birthdayEn: string;
  age: string;
  ageNote: string;
  heightCm: number;
  zodiac: string;
  academicStatus: string;
  school: string;
  schoolClass: string;
  schoolYear: string;
  cv: string;
  cvJa: string;
  description: string;
  motionGroups: string[];
  variant: string;
  season: "regular" | "summer" | "winter";
  resourceType: string;
  runtime: string;
  motionGroupCount: number;
  expressionsCount: number;
  interactionMotions: BangdreamDeskPetInteractionMotionMap;
  interactionZones: BangdreamDeskPetInteractionZoneMap;
  interactionZoneCounts: BangdreamDeskPetInteractionZoneCounts;
  interactionMissingAliases: BangdreamDeskPetMotionAlias[];
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
  if (/summer/i.test(variant)) return "summer";
  if (/winter/i.test(variant)) return "winter";
  return "regular";
}

export function variantResourceType(variant: string) {
  if (/sumimi/i.test(variant)) return "半身 / 偶像舞台装";
  if (/event_\d+_story_/i.test(variant)) return "半身 / 剧情立绘";
  if (/casual.*summer|school_summer/i.test(variant)) return "半身 / 夏装立绘";
  if (/casual.*winter|school_winter/i.test(variant)) return "半身 / 冬装立绘";
  if (/casual/i.test(variant)) return "半身 / 私服立绘";
  if (/school/i.test(variant)) return "半身 / 校服立绘";
  if (/kirameki_festival/i.test(variant)) return "半身 / 辉彩祭立绘";
  if (/dream_festival/i.test(variant)) return "半身 / 梦祭立绘";
  if (/live_event_|live_default|live_sr_|live_ssr_/i.test(variant)) return "半身 / 活动立绘";
  if (/collabo/i.test(variant)) return "半身 / 联动立绘";
  if (/birthday/i.test(variant)) return "半身 / 生日立绘";
  if (/furisode/i.test(variant)) return "半身 / 振袖立绘";
  if (/arbeit/i.test(variant)) return "半身 / 打工立绘";
  return "半身 / 角色立绘";
}

export function variantLabel(variant: string) {
  if (/sumimi/i.test(variant)) return "sumimi";
  if (/event_\d+_story_/i.test(variant)) return "剧情";
  if (/casual.*summer|school_summer/i.test(variant)) return "夏装";
  if (/casual.*winter|school_winter/i.test(variant)) return "冬装";
  if (/casual/i.test(variant)) return "私服";
  if (/school/i.test(variant)) return "校服";
  if (/kirameki_festival/i.test(variant)) return "辉彩祭";
  if (/dream_festival/i.test(variant)) return "梦祭";
  if (/live_event_|live_default|live_sr_|live_ssr_/i.test(variant)) return "活动";
  if (/collabo/i.test(variant)) return "联动";
  if (/birthday/i.test(variant)) return "生日";
  if (/furisode/i.test(variant)) return "振袖";
  if (/arbeit/i.test(variant)) return "打工";
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
        characterNameJa: character.nameJa,
        characterNameRomaji: character.nameRomaji,
        band: character.band,
        bandJa: character.bandJa,
        part: character.part,
        partEn: character.partEn,
        birthday: character.birthday,
        birthdayEn: character.birthdayEn,
        age: character.age,
        ageNote: character.ageNote,
        heightCm: character.heightCm,
        zodiac: character.zodiac,
        academicStatus: character.academicStatus,
        school: character.school,
        schoolClass: character.schoolClass,
        schoolYear: character.schoolYear,
        cv: character.cv,
        cvJa: character.cvJa,
        description: character.description,
        motionGroups: character.motionGroups,
        variant,
        season: variantSeason(variant),
        resourceType: variantResourceType(variant),
        runtime: pool.pool.runtime,
        motionGroupCount: character.motionGroupCount,
        expressionsCount: character.expressionsCount,
        interactionMotions: character.interactionMotions,
        interactionZones: character.interactionZones,
        interactionZoneCounts: character.interactionZoneCounts,
        interactionMissingAliases: character.interactionMissingAliases,
        manifestUrl,
        rawManifestUrl: manifestUrl,
      };
    }),
  );
}
