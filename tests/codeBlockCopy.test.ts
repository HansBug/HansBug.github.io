import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COPY_RESET_DELAY_MS,
  copyCodeBlock,
  copyRawCodeToClipboard,
  handleCodeBlockCopyClick,
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
      closest: vi.fn(() => ({ dataset: { codeRaw: "second\nblock" } })),
    };
    const writeText = vi.fn().mockResolvedValue(undefined);
    const reset = createImmediateResetScheduler();

    await copyCodeBlock(button, { writeText }, reset);

    expect(button.closest).toHaveBeenCalledWith("[data-enhanced-code-block]");
    expect(writeText).toHaveBeenCalledWith("second\nblock");
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
