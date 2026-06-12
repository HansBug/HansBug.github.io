const COPY_RESET_DELAY_MS = 1600;

function findCopyButton(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return undefined;
  }

  return target.closest<HTMLButtonElement>("[data-code-copy-button]");
}

function setButtonState(button: HTMLButtonElement, label: string, state?: string) {
  button.textContent = label;
  if (state) {
    button.dataset.copyState = state;
  } else {
    delete button.dataset.copyState;
  }
}

async function copyCodeBlock(button: HTMLButtonElement) {
  const block = button.closest<HTMLElement>("[data-enhanced-code-block]");
  const rawCode = block?.dataset.codeRaw;

  if (!block || rawCode === undefined) {
    return;
  }

  if (!navigator.clipboard?.writeText) {
    setButtonState(button, "复制失败", "error");
    window.setTimeout(() => setButtonState(button, "复制"), COPY_RESET_DELAY_MS);
    return;
  }

  button.disabled = true;
  try {
    await navigator.clipboard.writeText(rawCode);
    setButtonState(button, "已复制", "success");
  } catch {
    setButtonState(button, "复制失败", "error");
  } finally {
    window.setTimeout(() => {
      button.disabled = false;
      setButtonState(button, "复制");
    }, COPY_RESET_DELAY_MS);
  }
}

document.addEventListener("click", (event) => {
  const button = findCopyButton(event.target);
  if (!button) {
    return;
  }

  event.preventDefault();
  void copyCodeBlock(button);
});
