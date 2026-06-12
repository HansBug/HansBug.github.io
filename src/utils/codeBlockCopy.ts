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
  if (typeof document !== "undefined") {
    const canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const rawCanonicalHref = canonicalLink?.getAttribute("href")?.trim();
    if (rawCanonicalHref) {
      const resolvedCanonicalHref = canonicalLink?.href?.trim();
      if (resolvedCanonicalHref) {
        return resolvedCanonicalHref;
      }

      if (typeof window !== "undefined" && window.location?.href) {
        return new URL(rawCanonicalHref, window.location.href).toString();
      }

      return rawCanonicalHref;
    }
  }

  if (typeof window !== "undefined" && window.location?.href) {
    return window.location.href;
  }

  return undefined;
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
  document.addEventListener("click", handleCodeBlockCopyClick);
}
