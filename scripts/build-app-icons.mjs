import sharp from "sharp";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../public/icons/app.svg", import.meta.url));
for (const size of [180, 192, 512]) {
  await sharp(source).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/icons/app-${size}.png`, import.meta.url)));
}
// The mark stays within the maskable icon's central safe area.
await sharp(source).png().toFile(fileURLToPath(new URL("../public/icons/app-maskable-512.png", import.meta.url)));
