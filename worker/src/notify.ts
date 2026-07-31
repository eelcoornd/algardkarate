import { WorkerMailer } from "worker-mailer";
import type { Env, Order } from "./types";

// Sender Telegram-melding til klubbens chat. Stille feil for å ikke
// blokkere /order-respons hvis Telegram er nede.
export async function notifyTelegram(env: Env, order: Order): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CLUB_CHAT_ID) {
    console.warn("telegram notify skipped: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CLUB_CHAT_ID");
    return;
  }
  const lines = order.lines
    .map((l) => `• ${l.qty}× ${l.name} — kr ${l.line_total_nok.toFixed(0)},-`)
    .join("\n");
  const text =
    `🛒 *Ny shop-bestilling betalt*\n\n` +
    `Ordre: \`${order.id}\`\n` +
    `Kunde: ${order.customer.name} (${order.customer.phone})\n` +
    `E-post: ${order.customer.email}\n\n` +
    `${lines}\n\n` +
    (order.discount_code
      ? `Rabatt (${order.discount_code}): −kr ${order.discount_off_nok.toFixed(0)},-\n`
      : "") +
    `*Totalt: kr ${order.total_nok.toFixed(0)},-*`;
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CLUB_CHAT_ID,
          text,
          parse_mode: "Markdown",
        }),
      },
    );
    if (!resp.ok) {
      console.error("telegram notify http", resp.status, await resp.text());
    }
  } catch (e) {
    console.error("telegram notify failed", e);
  }
}

// Sender e-post via Gmail SMTP (smtp.gmail.com:465, implisitt TLS).
// Krever GMAIL_USER + GMAIL_APP_PASSWORD (App Password fra Google-kontoen
// med 2FA aktivert). MAIL_FROM overstyrer avsender-adressen hvis satt.
async function sendEmail(
  env: Env,
  to: { email: string; name: string },
  subject: string,
  htmlBody: string,
): Promise<void> {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    console.warn("email skipped: missing GMAIL_USER or GMAIL_APP_PASSWORD");
    return;
  }
  const fromEmail = env.MAIL_FROM || env.GMAIL_USER;
  try {
    await WorkerMailer.send(
      {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        credentials: {
          username: env.GMAIL_USER,
          password: env.GMAIL_APP_PASSWORD,
        },
        authType: "login",
      },
      {
        from: { name: env.CLUB_NAME, email: fromEmail },
        to: { name: to.name, email: to.email },
        subject,
        html: htmlBody,
      },
    );
  } catch (e) {
    console.error("gmail smtp send failed", e);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function orderHtml(order: Order, env: Env, isCustomer: boolean): string {
  const linesHtml = order.lines
    .map(
      (l) =>
        `<tr><td>${l.qty}× ${escapeHtml(l.name)}</td>` +
        `<td style="text-align:right">kr ${l.line_total_nok.toFixed(0)},-</td></tr>`,
    )
    .join("");
  const intro = isCustomer
    ? `Tusen takk for bestillingen din hos ${escapeHtml(env.CLUB_NAME)}!`
    : `Ny bestilling betalt via Vipps.`;
  return `
    <p>${intro}</p>
    <p><b>Ordre:</b> <code>${escapeHtml(order.id)}</code></p>
    <table style="border-collapse:collapse;width:100%;max-width:480px">
      ${linesHtml}
      ${
        order.discount_code
          ? `<tr><td>Rabatt (${escapeHtml(order.discount_code)})</td>
             <td style="text-align:right">−kr ${order.discount_off_nok.toFixed(0)},-</td></tr>`
          : ""
      }
      <tr><td><b>Totalt</b></td>
          <td style="text-align:right"><b>kr ${order.total_nok.toFixed(0)},-</b></td></tr>
    </table>
    <p><b>Henting:</b> ${escapeHtml(env.PICKUP_INFO)}</p>
    ${
      isCustomer
        ? `<p>Klubben tar kontakt på ${escapeHtml(order.customer.email)} eller ${escapeHtml(order.customer.phone)} for å avtale henting.</p>`
        : `<p>Kunde: ${escapeHtml(order.customer.name)} — ${escapeHtml(order.customer.email)} — ${escapeHtml(order.customer.phone)}</p>`
    }
  `;
}

export async function notifyEmail(env: Env, order: Order): Promise<void> {
  const subject = `Ordre ${order.id} — ${escapeHtml(env.CLUB_NAME)}`;
  await Promise.all([
    sendEmail(
      env,
      { email: order.customer.email, name: order.customer.name },
      subject,
      orderHtml(order, env, true),
    ),
    sendEmail(
      env,
      { email: env.CLUB_EMAIL, name: env.CLUB_NAME },
      `Ny ordre ${order.id}`,
      orderHtml(order, env, false),
    ),
  ]);
}

export async function notifyAll(env: Env, order: Order): Promise<void> {
  await Promise.all([notifyTelegram(env, order), notifyEmail(env, order)]);
}
