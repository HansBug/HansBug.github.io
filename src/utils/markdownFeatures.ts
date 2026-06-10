const FENCE_OPEN_RE = /^(\s*)(`{3,}|~{3,})(.*)$/;

function isFenceClose(line: string, marker: string) {
  const closePattern = new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`);
  return closePattern.test(line);
}

export function hasMermaidFence(markdown: string): boolean {
  let activeFence: string | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    if (activeFence) {
      if (isFenceClose(line, activeFence)) {
        activeFence = undefined;
      }
      continue;
    }

    const match = line.match(FENCE_OPEN_RE);
    if (!match) {
      continue;
    }

    const [, indent, marker, info] = match;
    if (indent.length > 3) {
      continue;
    }

    if (marker.startsWith("`") && info === "mermaid") {
      return true;
    }

    activeFence = marker;
  }

  return false;
}
