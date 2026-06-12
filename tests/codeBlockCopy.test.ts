import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COPY_RESET_DELAY_MS,
  copyCodeBlock,
  copyRawCodeToClipboard,
  expandCopyPlaceholders,
  handleCodeBlockCopyClick,
  replaceCodeBlockPageUrlPlaceholders,
} from "../src/utils/codeBlockCopy";

function createButton() {
  return {
    dataset: {} as DOMStringMap,
    disabled: false,
    textContent: "复制" as string | null,
  };
}

function createImmediateResetScheduler() {
  return vi.fn((handler: () => void, timeout: number) => {
    expect(timeout).toBe(COPY_RESET_DELAY_MS);
    handler();
  });
}

describe("code block copy behavior", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expands page URL placeholders with an injected URL provider", () => {
    const rawCode = "请阅读 {{PAGE_URL}} 后照办";

    expect(expandCopyPlaceholders(rawCode, () => "https://hansbug.github.io/blog/demo/")).toBe(
      "请阅读 https://hansbug.github.io/blog/demo/ 后照办",
    );
  });

  it("expands every page URL placeholder in the copied text", () => {
    const rawCode = "先看 {{PAGE_URL}}\n然后再把 {{PAGE_URL}} 丢给 agent";

    expect(expandCopyPlaceholders(rawCode, () => "https://hansbug.github.io/blog/demo/")).toBe(
      "先看 https://hansbug.github.io/blog/demo/\n然后再把 https://hansbug.github.io/blog/demo/ 丢给 agent",
    );
  });

  it("leaves regular copy text unchanged when no placeholder exists", () => {
    const rawCode = "echo '{{NOT_PAGE_URL}}'\nplain text";

    expect(expandCopyPlaceholders(rawCode, () => "https://hansbug.github.io/blog/demo/")).toBe(rawCode);
  });

  it("leaves placeholders unchanged when no page URL can be resolved", () => {
    const rawCode = "请阅读 {{PAGE_URL}} 后照办";

    expect(expandCopyPlaceholders(rawCode, () => undefined)).toBe(rawCode);
    expect(expandCopyPlaceholders(rawCode, () => "")).toBe(rawCode);
  });

  it("supports current-page URL providers for placeholder expansion", () => {
    const currentUrl = "http://127.0.0.1:4321/blog/current/";
    const pageUrlProvider = vi.fn(() => currentUrl);

    expect(expandCopyPlaceholders("url={{PAGE_URL}}", pageUrlProvider)).toBe("url=http://127.0.0.1:4321/blog/current/");
    expect(pageUrlProvider).toHaveBeenCalledTimes(1);
  });

  it("supports location fallback URL providers for placeholder expansion", () => {
    const currentUrl = "http://127.0.0.1:4321/blog/fallback/";

    expect(expandCopyPlaceholders("url={{PAGE_URL}}", () => currentUrl)).toBe(
      "url=http://127.0.0.1:4321/blog/fallback/",
    );
  });

  it("uses the actual browser location by default even when canonical URLs are available", () => {
    const querySelector = vi.fn(() => ({
      href: "https://hansbug.github.io/blog/default-canonical/",
      getAttribute: vi.fn(() => "https://hansbug.github.io/blog/default-canonical/"),
    }));
    vi.stubGlobal("document", { querySelector });
    vi.stubGlobal("window", { location: { href: "http://127.0.0.1:4321/blog/default-current/?draft=1#copy" } });

    expect(expandCopyPlaceholders("url={{PAGE_URL}}")).toBe(
      "url=http://127.0.0.1:4321/blog/default-current/?draft=1#copy",
    );
    expect(querySelector).not.toHaveBeenCalled();
  });

  it("uses window.location.href by default", () => {
    vi.stubGlobal("window", { location: { href: "http://127.0.0.1:4321/blog/default-fallback/" } });

    expect(expandCopyPlaceholders("url={{PAGE_URL}}")).toBe("url=http://127.0.0.1:4321/blog/default-fallback/");
  });

  it("keeps placeholders unchanged by default when browser location is unavailable", () => {
    vi.stubGlobal("window", {});

    expect(expandCopyPlaceholders("url={{PAGE_URL}}")).toBe("url={{PAGE_URL}}");
  });

  it("replaces visible code block placeholders and copy source with the current page URL", () => {
    const lineNodes = [{ textContent: "请阅读 {{PAGE_URL}}" }, { textContent: "然后继续" }];
    const block = {
      dataset: { codeRaw: "请阅读 {{PAGE_URL}}\n然后继续" },
      querySelectorAll: vi.fn(() => lineNodes),
    };
    const root = {
      querySelectorAll: vi.fn(() => [block]),
    };

    expect(
      replaceCodeBlockPageUrlPlaceholders(root, () => "http://127.0.0.1:4321/blog/demo/?preview=1"),
    ).toBe(1);
    expect(root.querySelectorAll).toHaveBeenCalledWith("[data-enhanced-code-block]");
    expect(block.querySelectorAll).toHaveBeenCalledWith(".code-block__line-code");
    expect(block.dataset.codeRaw).toBe("请阅读 http://127.0.0.1:4321/blog/demo/?preview=1\n然后继续");
    expect(lineNodes[0].textContent).toBe("请阅读 http://127.0.0.1:4321/blog/demo/?preview=1");
    expect(lineNodes[1].textContent).toBe("然后继续");
  });

  it("does not replace visible placeholders for literal page URL code blocks", () => {
    const lineNodes = [{ textContent: "{{PAGE_URL}}" }];
    const block = {
      dataset: { codeRaw: "{{PAGE_URL}}", codeLiteralPageUrl: "true" },
      querySelectorAll: vi.fn(() => lineNodes),
    };
    const root = {
      querySelectorAll: vi.fn(() => [block]),
    };

    expect(replaceCodeBlockPageUrlPlaceholders(root, () => "http://127.0.0.1:4321/blog/demo/")).toBe(0);
    expect(block.dataset.codeRaw).toBe("{{PAGE_URL}}");
    expect(lineNodes[0].textContent).toBe("{{PAGE_URL}}");
  });

  it("copies the exact raw code and resets the button state", async () => {
    const button = createButton();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const reset = createImmediateResetScheduler();
    const rawCode = 'two\n<raw attr="&amp;">\nliteral entity: &#x22;';

    await copyRawCodeToClipboard(button, rawCode, { writeText }, reset);

    expect(writeText).toHaveBeenCalledWith(rawCode);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe("复制");
    expect(button.dataset.copyState).toBeUndefined();
  });

  it("shows an error state when clipboard writing fails", async () => {
    const button = createButton();
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const reset = createImmediateResetScheduler();

    await copyRawCodeToClipboard(button, "echo fail", { writeText }, reset);

    expect(writeText).toHaveBeenCalledWith("echo fail");
    expect(reset).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe("复制");
    expect(button.dataset.copyState).toBeUndefined();
  });

  it("handles missing Clipboard API without throwing", async () => {
    const button = createButton();
    const reset = createImmediateResetScheduler();

    await expect(copyRawCodeToClipboard(button, "echo fallback", undefined, reset)).resolves.toBeUndefined();

    expect(reset).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe("复制");
    expect(button.dataset.copyState).toBeUndefined();
  });

  it("does not report success for an empty code block", async () => {
    const button = createButton();
    const writeText = vi.fn();
    const reset = createImmediateResetScheduler();

    await copyRawCodeToClipboard(button, "", { writeText }, reset);

    expect(writeText).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe("复制");
    expect(button.dataset.copyState).toBeUndefined();
  });

  it("copies the raw code from the closest enhanced code block", async () => {
    const button = {
      ...createButton(),
      closest: vi.fn(() => ({ dataset: { codeRaw: "second\n{{PAGE_URL}}" } })),
    };
    const writeText = vi.fn().mockResolvedValue(undefined);
    const reset = createImmediateResetScheduler();

    await copyCodeBlock(button, { writeText }, reset, () => "https://hansbug.github.io/blog/copied/");

    expect(button.closest).toHaveBeenCalledWith("[data-enhanced-code-block]");
    expect(writeText).toHaveBeenCalledWith("second\nhttps://hansbug.github.io/blog/copied/");
  });

  it("copies page URL placeholders literally when the code block opts out of replacement", async () => {
    const button = {
      ...createButton(),
      closest: vi.fn(() => ({
        dataset: {
          codeRaw: "literal {{PAGE_URL}}",
          codeLiteralPageUrl: "true",
        },
      })),
    };
    const writeText = vi.fn().mockResolvedValue(undefined);
    const reset = createImmediateResetScheduler();

    await copyCodeBlock(button, { writeText }, reset, () => "https://hansbug.github.io/blog/copied/");

    expect(writeText).toHaveBeenCalledWith("literal {{PAGE_URL}}");
  });

  it("does nothing when the closest enhanced code block is missing or empty", async () => {
    const writeText = vi.fn();
    const reset = createImmediateResetScheduler();
    const missingBlockButton = {
      ...createButton(),
      closest: vi.fn(() => undefined),
    };
    const emptyBlockButton = {
      ...createButton(),
      closest: vi.fn(() => ({ dataset: { codeRaw: "" } })),
    };

    await copyCodeBlock(missingBlockButton, { writeText }, reset);
    await copyCodeBlock(emptyBlockButton, { writeText }, reset);

    expect(writeText).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it("ignores clicks that do not originate from a copy button", () => {
    const preventDefault = vi.fn();
    const target = {
      closest: vi.fn(() => undefined),
    } as unknown as Element;

    expect(handleCodeBlockCopyClick({ preventDefault, target })).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("handles delegated clicks from nested copy button content", () => {
    class FakeElement {}
    vi.stubGlobal("Element", FakeElement);
    const button = new FakeElement() as HTMLButtonElement;
    const target = new FakeElement() as Element & { closest: ReturnType<typeof vi.fn> };
    target.closest = vi.fn(() => button);
    const preventDefault = vi.fn();
    const copy = vi.fn();

    expect(handleCodeBlockCopyClick({ preventDefault, target }, copy)).toBe(true);

    expect(target.closest).toHaveBeenCalledWith("[data-code-copy-button]");
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledWith(button);
  });
});
