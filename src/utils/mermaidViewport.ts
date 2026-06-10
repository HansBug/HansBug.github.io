export const DEFAULT_MERMAID_SVG_WIDTH = 720;
export const DEFAULT_MERMAID_SVG_HEIGHT = 420;
export const MIN_MERMAID_SCALE = 0.2;
export const MAX_MERMAID_SCALE = 5;
export const MERMAID_SCALE_STEP = 1.2;
export const MERMAID_PAN_STEP = 120;

export type MermaidSvgSize = {
  width: number;
  height: number;
};

export function parseSvgViewBox(viewBox: string | null | undefined): MermaidSvgSize | undefined {
  const values = viewBox
    ?.trim()
    .split(/\s+/)
    .map(Number);

  if (!values || values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) {
    return undefined;
  }

  return {
    width: Math.abs(values[2]),
    height: Math.abs(values[3]),
  };
}

export function parseSvgSizeAttributes(attributes: {
  viewBox?: string | null;
  width?: string | null;
  height?: string | null;
}): MermaidSvgSize {
  const viewBoxSize = parseSvgViewBox(attributes.viewBox);
  if (viewBoxSize) {
    return viewBoxSize;
  }

  const width = Number.parseFloat(attributes.width ?? "");
  const height = Number.parseFloat(attributes.height ?? "");

  return {
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_MERMAID_SVG_WIDTH,
    height: Number.isFinite(height) && height > 0 ? height : DEFAULT_MERMAID_SVG_HEIGHT,
  };
}

export function calculateFitScale(viewportWidth: number, intrinsicWidth: number): number {
  const safeViewportWidth = Math.max(viewportWidth, 1);
  const safeIntrinsicWidth = Math.max(intrinsicWidth, 1);

  return Math.min(1, Math.max(MIN_MERMAID_SCALE, safeViewportWidth / safeIntrinsicWidth));
}

export function clampMermaidScale(nextScale: number, fitScale: number): number {
  return Math.min(MAX_MERMAID_SCALE, Math.max(fitScale, nextScale));
}

export function getMermaidZoomState(scale: number, fitScale: number): "fit" | "zoomed" {
  return scale > fitScale + 0.001 ? "zoomed" : "fit";
}

export function formatMermaidScale(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}
