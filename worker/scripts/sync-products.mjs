// Bygger src/products.json fra data/shop_products.json + varianter parsed fra
// content/shop/*.md frontmatter, slik at Workeren kan prise OG validere
// (variant_id, lager) server-side. Kjør før wrangler deploy.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const productsJsonPath = join(repoRoot, "data/shop_products.json");
const contentDir = join(repoRoot, "content/shop");
const dst = resolve(here, "../src/products.json");

const products = JSON.parse(readFileSync(productsJsonPath, "utf8"));

// Minimal frontmatter+variants-parser. Holder oss til den begrensede YAML-en
// vi bruker i content/shop/*.md (ingen quotes/multiline scalars i variants).
function parseVariants(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = m[1];
  const lines = fm.split(/\r?\n/);
  // Finn "  variants:" linja (2-space indent under params).
  let i = lines.findIndex((l) => /^\s{2}variants\s*:\s*$/.test(l));
  if (i < 0) return null;
  i++;
  const variants = [];
  let current = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s{0,3}\S/.test(line) && !/^\s{4}-\s/.test(line) && !/^\s{6}\S/.test(line)) {
      // Tilbake til et grunnere nivå → variants-listen er ferdig.
      break;
    }
    const itemMatch = line.match(/^\s{4}-\s+(\w+)\s*:\s*(.*)$/);
    const propMatch = line.match(/^\s{6}(\w+)\s*:\s*(.*)$/);
    if (itemMatch) {
      if (current) variants.push(current);
      current = {};
      setProp(current, itemMatch[1], itemMatch[2]);
    } else if (propMatch && current) {
      setProp(current, propMatch[1], propMatch[2]);
    }
  }
  if (current) variants.push(current);
  return variants.length ? variants : null;
}

function setProp(obj, key, rawVal) {
  let v = rawVal.trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  else if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
  else if (v === "true") v = true;
  else if (v === "false") v = false;
  else if (/^-?\d+$/.test(v)) v = parseInt(v, 10);
  else if (/^-?\d+\.\d+$/.test(v)) v = parseFloat(v);
  obj[key] = v;
}

const variantsBySlug = new Map();
for (const file of readdirSync(contentDir)) {
  if (!file.endsWith(".md")) continue;
  const slug = file.replace(/\.md$/, "");
  const md = readFileSync(join(contentDir, file), "utf8");
  const variants = parseVariants(md);
  if (variants) variantsBySlug.set(slug, variants);
}

let merged = 0;
for (const p of products) {
  const v = variantsBySlug.get(p.slug);
  if (v) {
    p.variants = v;
    merged++;
  }
}

writeFileSync(dst, JSON.stringify(products, null, 2) + "\n");
console.log(`Wrote ${dst} (${products.length} produkter, ${merged} med varianter)`);
