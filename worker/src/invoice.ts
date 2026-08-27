import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Env, Order } from "./types";

// Genererer en enkel pakkseddel/ordrebekreftelse som PDF for klubbens eget
// arkiv (vedlegg i e-posten til CLUB_EMAIL). Dette er IKKE en formell faktura
// (ingen org.nr/bankkonto) siden betaling allerede er gjort via Vipps —
// den er ment som et internt følgeskriv til pakking/utlevering.
export async function generateOrderPdf(env: Env, order: Order): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const pageWidth = page.getWidth();
  let y = page.getHeight() - margin;

  const drawText = (
    text: string,
    x: number,
    size: number,
    useBold = false,
    color = rgb(0, 0, 0),
  ) => {
    page.drawText(text, { x, y, size, font: useBold ? bold : font, color });
  };

  drawText(env.CLUB_NAME, margin, 20, true);
  y -= 26;
  drawText("Ordrebekreftelse / pakkseddel", margin, 12);
  y -= 30;

  const orderDate = new Date(order.created_at).toLocaleDateString("nb-NO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  drawText(`Ordre: ${order.id}`, margin, 11, true);
  y -= 16;
  drawText(`Dato: ${orderDate}`, margin, 11);
  y -= 24;

  drawText("Kunde", margin, 11, true);
  y -= 16;
  drawText(order.customer.name, margin, 11);
  y -= 14;
  drawText(order.customer.email, margin, 11);
  y -= 14;
  drawText(order.customer.phone, margin, 11);
  y -= 28;

  // Tabellhode
  const colProduct = margin;
  const colQty = pageWidth - margin - 220;
  const colUnit = pageWidth - margin - 150;
  const colTotal = pageWidth - margin - 70;
  drawText("Produkt", colProduct, 11, true);
  drawText("Antall", colQty, 11, true);
  drawText("Pris", colUnit, 11, true);
  drawText("Sum", colTotal, 11, true);
  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 16;

  for (const line of order.lines) {
    const variant = line.variant_label ?? line.variant_id;
    const name = variant ? `${line.name} (${variant})` : line.name;
    drawText(name, colProduct, 10);
    drawText(String(line.qty), colQty, 10);
    drawText(`kr ${line.unit_price_nok.toFixed(0)},-`, colUnit, 10);
    drawText(`kr ${line.line_total_nok.toFixed(0)},-`, colTotal, 10);
    y -= 18;
  }

  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 20;

  drawText("Delsum", colUnit, 10);
  drawText(`kr ${order.subtotal_nok.toFixed(0)},-`, colTotal, 10);
  y -= 16;

  if (order.discount_code) {
    drawText(`Rabatt (${order.discount_code})`, colUnit, 10);
    drawText(`-kr ${order.discount_off_nok.toFixed(0)},-`, colTotal, 10);
    y -= 16;
  }

  drawText("Totalt", colUnit, 12, true);
  drawText(`kr ${order.total_nok.toFixed(0)},-`, colTotal, 12, true);
  y -= 30;

  drawText("Henting", margin, 11, true);
  y -= 16;
  drawText(env.PICKUP_INFO, margin, 10);
  y -= 14;
  drawText("Betalt via Vipps.", margin, 10);

  return doc.save();
}

// Enkel, avhengighetsfri base64-encoding av binærdata (btoa krever en
// "binary string", og store Uint8Array-er må derfor chunkes for å unngå
// stack-overflow i String.fromCharCode.apply).
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
