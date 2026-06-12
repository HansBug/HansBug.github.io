export const COPY_RESET_DELAY_MS = 1600;

type CopyButtonState = {
  dataset: DOMStringMap;
  disabled: boolean;
  textContent: string | null;
};

type ClipboardWriter = {
  writeText: (text: string) => Promise<void> | void;
};

type ResetScheduler = (handler: () => void, timeout: number) => unknown;

function getDefaultClipboard() {
  return typeof navigator === "undefined" ? undefined : navigator.clipboard;
}

function getDefaultResetScheduler(): ResetScheduler {
  if (typeof window === "undefined") {
    return (handler) => handler();
  }

  return window.setTimeout.bind(window);
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
) {
  const block = button.closest<HTMLElement>("[data-enhanced-code-block]");
  const rawCode = block?.dataset.codeRaw;

  if (!block || rawCode === undefined || rawCode.length === 0) {
    return;
  }

  await copyRawCodeToClipboard(button, rawCode, clipboard, scheduleReset);
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
