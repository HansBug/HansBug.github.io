import fs from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve("node_modules/katex/dist");
const targetDir = path.resolve("public/vendor/katex");

async function main() {
  await fs.access(sourceDir);
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });
  await fs.copyFile(path.join(sourceDir, "katex.min.css"), path.join(targetDir, "katex.min.css"));
  await fs.cp(path.join(sourceDir, "fonts"), path.join(targetDir, "fonts"), { recursive: true });
  console.log(`Synced KaTeX assets to ${targetDir}`);
}

await main();
