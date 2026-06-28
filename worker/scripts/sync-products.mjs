// Kopierer ../data/shop_products.json til src/products.json slik at Workeren
// kan prise ordrer server-side mot samme katalog som Hugo-shoppen.
//
// Kjør etter at Hugo-katalogen er oppdatert, og før wrangler deploy.

import { copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../data/shop_products.json");
const dst = resolve(here, "../src/products.json");

copyFileSync(src, dst);
console.log(`Synced ${src} → ${dst}`);
