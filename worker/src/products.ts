// Server-side produktkatalog.
//
// Vi bundler en kopi av Hugo-sidens data/shop_products.json slik at Workeren
// kan prise hver linje uten å stole på frontend. Resync via:
//
//     npm run sync-products   (cp ../data/shop_products.json src/products.json)
//
// og deploy på nytt når Hugo-katalogen endres.

import rawProducts from "./products.json";

export type CatalogProduct = {
  id: number;
  name: string;
  slug: string;
  type: string;
  price: number;
  currency: string;
  image?: string;
  categories?: string[];
  variants?: CatalogVariant[];
};

export type CatalogVariant = {
  id: string;
  label: string;
  stock?: number;
  in_stock?: boolean;
  price_delta?: number;
};

const PRODUCTS: CatalogProduct[] = rawProducts as CatalogProduct[];
const BY_ID = new Map<number, CatalogProduct>(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id: number): CatalogProduct | undefined {
  return BY_ID.get(id);
}

export function allProducts(): CatalogProduct[] {
  return PRODUCTS;
}
