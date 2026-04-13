import fs from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve("src/vendor/deskpet/bangdream-models");
const targetDir = path.resolve("dist/assets/bangdream-models");

async function main() {
  await fs.access(sourceDir);
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(targetDir), { recursive: true });
  await fs.cp(sourceDir, targetDir, { recursive: true });
  console.log(`Copied BanG Dream model assets to ${targetDir}`);
}

await main();
