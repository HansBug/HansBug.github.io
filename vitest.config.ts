import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/utils/codeBlockCopy.ts", "src/utils/markdownFeatures.ts", "src/utils/mermaidViewport.ts"],
    },
  },
});
