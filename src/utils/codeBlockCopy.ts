export const COPY_RESET_DELAY_MS = 1600;
export const PAGE_URL_PLACEHOLDER = "{{PAGE_URL}}";

type CopyButtonState = {
  dataset: DOMStringMap;
  disabled: boolean;
  textContent: string | null;
};

type ClipboardWriter = {
  writeText: (text: string) => Promise<void> | void;
};

type ResetScheduler = (handler: () => void, timeout: number) => unknown;
type PageUrlProvider = () => string | undefined;
type PlaceholderRoot = {
  querySelectorAll: (selector: string) => Iterable<unknown>;
};

function getDefaultClipboard() {
  return typeof navigator === "undefined" ? undefined : navigator.clipboard;
}

function getDefaultResetScheduler(): ResetScheduler {
  if (typeof window === "undefined") {
    return (handler) => handler();
  }

  return window.setTimeout.bind(window);
}

function getDefaultPageUrl() {
  if (typeof window !== "undefined" && window.location?.href) {
    return window.location.href;
  }

  return undefined;
}

function isElementLike(node: unknown): node is HTMLElement {
  return typeof HTMLElement === "undefined" ? Boolean(node) : node instanceof HTMLElement;
}

function replaceTextNodePlaceholders(node: unknown, pageUrl: string): boolean {
  const textNode = node as {
    nodeType?: number;
    textContent?: string | null;
    childNodes?: Iterable<unknown>;
  };

  if (textNode.nodeType === 3 || (textNode.nodeType === undefined && !textNode.childNodes)) {
    if (!textNode.textContent?.includes(PAGE_URL_PLACEHOLDER)) {
      return false;
    }

    textNode.textContent = textNode.textContent?.split(PAGE_URL_PLACEHOLDER).join(pageUrl) ?? "";
    return true;
  }

  if (!textNode.childNodes) {
    return false;
  }

  let replaced = false;
  for (const childNode of textNode.childNodes ?? []) {
    replaced = replaceTextNodePlaceholders(childNode, pageUrl) || replaced;
  }

  return replaced;
}

function setNodeTextContent(node: unknown, text: string) {
  if (!node || typeof node !== "object") {
    return;
  }

  const textNode = node as { textContent?: string | null };
  if ("textContent" in textNode) {
    textNode.textContent = text;
  }
}

function findCopyButton(target: EventTarget | null) {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return undefined;
  }

  return target.closest<HTMLButtonElement>("[data-code-copy-button]");
}

function setButtonState(button: CopyButtonState, label: string, state?: string) {
  button.textContent = label;
  if (state) {
    button.dataset.copyState = state;
  } else {
    delete button.dataset.copyState;
  }
}

function scheduleButtonReset(button: CopyButtonState, scheduleReset: ResetScheduler) {
  scheduleReset(() => {
    button.disabled = false;
    setButtonState(button, "复制");
  }, COPY_RESET_DELAY_MS);
}

export function expandCopyPlaceholders(rawCode: string, pageUrlProvider: PageUrlProvider = getDefaultPageUrl) {
  if (!rawCode.includes(PAGE_URL_PLACEHOLDER)) {
    return rawCode;
  }

  const pageUrl = pageUrlProvider()?.trim();
  if (!pageUrl) {
    return rawCode;
  }

  return rawCode.split(PAGE_URL_PLACEHOLDER).join(pageUrl);
}

export function replaceCodeBlockPageUrlPlaceholders(
  root: PlaceholderRoot = document,
  pageUrlProvider: PageUrlProvider = getDefaultPageUrl,
) {
  const pageUrl = pageUrlProvider()?.trim();
  if (!pageUrl) {
    return 0;
  }

  let replacedBlockCount = 0;

  for (const block of root.querySelectorAll("[data-enhanced-code-block]")) {
    if (!isElementLike(block) || block.dataset.codeLiteralPageUrl === "true") {
      continue;
    }

    const rawCode = block.dataset.codeRaw;
    if (!rawCode?.includes(PAGE_URL_PLACEHOLDER)) {
      continue;
    }

    const expandedCode = rawCode.split(PAGE_URL_PLACEHOLDER).join(pageUrl);
    block.dataset.codeRaw = expandedCode;

    const rawLines = rawCode.split("\n");
    const expandedLines = expandedCode.split("\n");

    block.querySelectorAll(".code-block__line-code").forEach((lineCodeNode, lineIndex) => {
      if (rawLines[lineIndex]?.includes(PAGE_URL_PLACEHOLDER)) {
        const replacedVisibleTextNode = replaceTextNodePlaceholders(lineCodeNode, pageUrl);
        if (!replacedVisibleTextNode) {
          setNodeTextContent(lineCodeNode, expandedLines[lineIndex] ?? "");
        }
      }
    });

    replacedBlockCount += 1;
  }

  return replacedBlockCount;
}

export async function copyRawCodeToClipboard(
  button: CopyButtonState,
  rawCode: string,
  clipboard: ClipboardWriter | undefined = getDefaultClipboard(),
  scheduleReset: ResetScheduler = getDefaultResetScheduler(),
) {
  if (rawCode.length === 0) {
    return;
  }

  button.disabled = true;

  if (!clipboard?.writeText) {
    setButtonState(button, "复制失败", "error");
    scheduleButtonReset(button, scheduleReset);
    return;
  }

  try {
    await clipboard.writeText(rawCode);
    setButtonState(button, "已复制", "success");
  } catch {
    setButtonState(button, "复制失败", "error");
  } finally {
    scheduleButtonReset(button, scheduleReset);
  }
}

export async function copyCodeBlock(
  button: Pick<HTMLButtonElement, "closest"> & CopyButtonState,
  clipboard?: ClipboardWriter,
  scheduleReset?: ResetScheduler,
  pageUrlProvider?: PageUrlProvider,
) {
  const block = button.closest<HTMLElement>("[data-enhanced-code-block]");
  const rawCode = block?.dataset.codeRaw;

  if (!block || rawCode === undefined || rawCode.length === 0) {
    return;
  }

  const copyText =
    block.dataset.codeLiteralPageUrl === "true" ? rawCode : expandCopyPlaceholders(rawCode, pageUrlProvider);

  await copyRawCodeToClipboard(button, copyText, clipboard, scheduleReset);
}

export function handleCodeBlockCopyClick(
  event: Pick<MouseEvent, "preventDefault" | "target">,
  copy: (button: HTMLButtonElement) => Promise<void> | void = copyCodeBlock,
) {
  const button = findCopyButton(event.target);
  if (!button) {
    return false;
  }

  event.preventDefault();
  void copy(button);
  return true;
}

if (typeof document !== "undefined") {
  const initializeCodeBlocks = () => {
    replaceCodeBlockPageUrlPlaceholders(document);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCodeBlocks, { once: true });
  } else {
    initializeCodeBlocks();
  }

  document.addEventListener("astro:page-load", initializeCodeBlocks);
  document.addEventListener("astro:after-swap", initializeCodeBlocks);
  document.addEventListener("click", handleCodeBlockCopyClick);
}
