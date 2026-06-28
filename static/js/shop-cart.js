/* Ålgård Karate – shop cart (localStorage)
 *
 * Cart-format: array av cart items i localStorage.
 *   key  = "algardkarate_cart_v1"
 *   item = { product_id, slug, name, variant_id, variant_label, qty, unit_price, image }
 *
 * Brukes av:
 *   - layouts/shop/single.html  (legg til)
 *   - layouts/kurv/list.html    (vis/endre/fjern)
 *   - layouts/checkout/list.html (oppsummering + send til API)
 *   - layouts/partials/bottom-nav.html (badge)
 */
(function (global) {
  const KEY = "algardkarate_cart_v1";

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent("cart:changed", { detail: { count: count(items) } }));
  }

  function count(items) {
    items = items || read();
    return items.reduce((sum, it) => sum + (it.qty || 0), 0);
  }

  function total(items) {
    items = items || read();
    return items.reduce((sum, it) => sum + (it.qty || 0) * (it.unit_price || 0), 0);
  }

  function lineKey(it) {
    return it.product_id + "::" + (it.variant_id || "");
  }

  function add(item) {
    const items = read();
    const k = lineKey(item);
    const existing = items.find((x) => lineKey(x) === k);
    if (existing) {
      existing.qty += item.qty || 1;
    } else {
      items.push(Object.assign({ qty: 1 }, item));
    }
    write(items);
  }

  function setQty(productId, variantId, qty) {
    const items = read();
    const k = productId + "::" + (variantId || "");
    const idx = items.findIndex((x) => lineKey(x) === k);
    if (idx === -1) return;
    if (qty <= 0) {
      items.splice(idx, 1);
    } else {
      items[idx].qty = qty;
    }
    write(items);
  }

  function clear() {
    write([]);
  }

  function formatPrice(n) {
    return "kr " + (Math.round(n * 100) / 100).toLocaleString("nb-NO") + ",-";
  }

  global.AlgardCart = { read, write, count, total, add, setQty, clear, formatPrice, KEY };

  document.addEventListener("DOMContentLoaded", updateBadges);
  document.addEventListener("cart:changed", updateBadges);
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) updateBadges();
  });

  function updateBadges() {
    const n = count();
    document.querySelectorAll("[data-cart-badge]").forEach(function (el) {
      el.textContent = String(n);
      el.hidden = n === 0;
    });
  }
})(window);
