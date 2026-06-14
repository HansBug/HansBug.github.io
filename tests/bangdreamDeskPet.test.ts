import { describe, expect, it } from "vitest";

import pool from "../src/data/bangdreamDeskPetPool.json";
import {
  buildBangdreamVariantMap,
  buildBangdreamVariants,
  buildBangdreamVariantsByCharacter,
  pickBangdreamSwitchVariant,
  pickFairBangdreamInitialVariant,
  resolveBangdreamVariantRequest,
  type BangdreamDeskPetVariant,
} from "../src/utils/bangdreamDeskPet";

function createVariant(characterCode: string, variant: string): BangdreamDeskPetVariant {
  return {
    key: `bangdream_${characterCode}_${variant}`,
    modelKey: `${characterCode}_${variant}`,
    characterCode,
    characterName: characterCode,
    characterNameJa: characterCode,
    characterNameRomaji: characterCode,
    band: "fixture",
    bandJa: "fixture",
    part: "fixture",
    partEn: "fixture",
    birthday: "1月1日",
    birthdayEn: "Jan 1",
    age: "unknown",
    ageNote: "",
    heightCm: 160,
    zodiac: "fixture",
    academicStatus: "",
    school: "",
    schoolClass: "",
    schoolYear: "",
    cv: "",
    cvJa: "",
    description: "",
    motionGroups: [],
    variant,
    season: "regular",
    resourceType: "半身 / 测试立绘",
    runtime: "Cubism 2.1",
    motionGroupCount: 0,
    expressionsCount: 0,
    interactionMotions: {
      idle: [],
      follow: [],
      greet: [],
      farewell: [],
      react: [],
      pose: [],
    },
    interactionZones: {
      head: [],
      upper: [],
      lower: [],
    },
    interactionZoneCounts: {
      head: 0,
      upper: 0,
      lower: 0,
    },
    interactionMissingAliases: [],
    manifestUrl: `/fixtures/${characterCode}_${variant}/model.json`,
    rawManifestUrl: `/fixtures/${characterCode}_${variant}/model.json`,
  };
}

function fixedRandom(values: number[]) {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    if (value === undefined) {
      throw new Error("Test random sequence exhausted.");
    }
    return value;
  };
}

describe("Bang Dream deskpet variant selection", () => {
  it("builds a complete character index from the current pool", () => {
    const variants = buildBangdreamVariants(pool);
    const variantsByCharacter = buildBangdreamVariantsByCharacter(variants);
    const expectedCharacterCodes = new Set(pool.characters.map((character) => character.code));
    const expectedVariantCount = pool.characters.reduce(
      (total, character) => total + character.variants.length,
      0,
    );

    expect(new Set(variantsByCharacter.keys())).toEqual(expectedCharacterCodes);
    expect([...variantsByCharacter.values()].flat()).toHaveLength(expectedVariantCount);
    expect(variants).toHaveLength(expectedVariantCount);

    for (const character of pool.characters) {
      const characterVariants = variantsByCharacter.get(character.code) ?? [];
      expect(characterVariants.map((variant) => variant.variant).sort()).toEqual(
        [...character.variants].sort(),
      );
    }
  });

  it("picks an initial variant by sampling a character first and then every variant for that character", () => {
    const variants = [
      createVariant("001", "casual"),
      createVariant("001", "event_accessory"),
      createVariant("002", "casual"),
      createVariant("003", "casual"),
      createVariant("003", "collabo"),
      createVariant("003", "story"),
    ];
    const variantsByCharacter = buildBangdreamVariantsByCharacter(variants);

    const selected = pickFairBangdreamInitialVariant(
      variantsByCharacter,
      fixedRandom([
        0.99, // character 003, despite 003 having more variants than the other characters.
        0.99, // story variant inside character 003.
      ]),
    );

    expect(selected.characterCode).toBe("003");
    expect(selected.variant).toBe("story");
  });

  it("keeps every current-pool character and variant reachable without using defaultTopPickKeys as the pool", () => {
    const variants = buildBangdreamVariants(pool);
    const variantsByCharacter = buildBangdreamVariantsByCharacter(variants);
    const topPickKeys = new Set(pool.defaultTopPickKeys);
    const topPickCharacterCodes = new Set(
      variants.filter((variant) => topPickKeys.has(variant.key)).map((variant) => variant.characterCode),
    );

    expect(topPickCharacterCodes.size).toBeLessThan(variantsByCharacter.size);

    for (const [characterCode, characterVariants] of variantsByCharacter) {
      const characterIndex = [...variantsByCharacter.keys()].indexOf(characterCode);
      const variantIndex = characterVariants.length - 1;
      const selected = pickFairBangdreamInitialVariant(
        variantsByCharacter,
        fixedRandom([
          (characterIndex + 0.1) / variantsByCharacter.size,
          (variantIndex + 0.1) / characterVariants.length,
        ]),
      );

      expect(selected.characterCode).toBe(characterCode);
      expect(selected.key).toBe(characterVariants[variantIndex].key);
    }
  });

  it("keeps all supported URL parameter forms resolving before random selection", () => {
    const variants = buildBangdreamVariants(pool);
    const variantMap = buildBangdreamVariantMap(variants);
    const selected = variants.find((variant) => !pool.defaultTopPickKeys.includes(variant.key));

    expect(selected).toBeDefined();
    expect(resolveBangdreamVariantRequest(selected!.key, variantMap, variants)?.key).toBe(selected!.key);
    expect(resolveBangdreamVariantRequest(selected!.modelKey, variantMap, variants)?.key).toBe(
      selected!.key,
    );
    expect(
      resolveBangdreamVariantRequest(selected!.key.replace(/^bangdream_/, ""), variantMap, variants)
        ?.key,
    ).toBe(selected!.key);
  });

  it("switches by sampling a different character first and then that character's variants", () => {
    const variants = [
      createVariant("001", "casual"),
      createVariant("001", "event"),
      createVariant("002", "casual"),
      createVariant("003", "casual"),
      createVariant("003", "dream_festival"),
    ];
    const variantsByCharacter = buildBangdreamVariantsByCharacter(variants);
    const selected = pickBangdreamSwitchVariant(
      variantsByCharacter,
      "001",
      fixedRandom([
        0.99, // among [002, 003], pick 003.
        0.99, // inside 003, pick dream_festival.
      ]),
    );

    expect(selected?.characterCode).toBe("003");
    expect(selected?.variant).toBe("dream_festival");
  });

  it("returns no switch target when there is no other character", () => {
    const variantsByCharacter = buildBangdreamVariantsByCharacter([createVariant("001", "casual")]);

    expect(pickBangdreamSwitchVariant(variantsByCharacter, "001", fixedRandom([]))).toBeNull();
  });
});
