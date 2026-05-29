// send-confirmation-email
//
// Triggered by an AFTER INSERT webhook on `public.orders` (pg_net). Sends the
// order-confirmation email via IONOS SMTP and records the outcome back on the
// row (`confirmation_email_sent` / `confirmation_email_error`).
//
// Deployed with verify_jwt = false (the DB trigger is the caller), so access is
// gated by a shared `x-webhook-secret` header instead. An SMTP failure is
// caught and logged — it must NEVER bubble up and disturb the order insert.
//
// NOTE: the email wording is duplicated from src/lib/email-templates.ts on
// purpose (different runtime, no shared import). Keep the two in sync.

import { SMTPClient } from "denomailer";
import { createClient } from "@supabase/supabase-js";

interface OrderRecord {
  id: string;
  order_ref: string;
  payment_method: "stripe" | "invoice_30d";
  first_name: string;
  email: string;
  confirmation_email_sent?: boolean;
}

interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

const FROM_NAME = Deno.env.get("SMTP_FROM_NAME") ?? "Swiss Arena";
const FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL") ?? "contact@swiss-arena-avis.ch";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Wrap body paragraphs in the sober, Outlook-safe HTML shell from the brief. */
function renderHtml(heading: string, paragraphs: string[]): string {
  const ps = paragraphs
    .map(
      (p) =>
        `<p style="font-size: 15px; line-height: 1.6; color: #333; margin: 0 0 16px;">${escapeHtml(
          p,
        ).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  return `<div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
  <h2 style="font-weight: 500; font-size: 18px; margin: 0 0 20px;">${escapeHtml(heading)}</h2>
  ${ps}
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="font-size: 12px; color: #999; margin: 0;">Swiss Arena · Designed in Switzerland<br>contact@swiss-arena-avis.ch</p>
</div>`;
}

function buildEmail(order: OrderRecord): BuiltEmail {
  const name = order.first_name || "";
  if (order.payment_method === "stripe") {
    const paragraphs = [
      `Bonjour ${name},`,
      `Votre paiement a bien été reçu. Merci.`,
      `Votre plaque NFC Swiss Arena sera expédiée sous 24h. Vous recevrez un email dès l'expédition.`,
    ];
    const subject = `Commande ${order.order_ref} confirmée — Swiss Arena`;
    return {
      subject,
      text: [...paragraphs, "Swiss Arena"].join("\n\n"),
      html: renderHtml(`Commande ${order.order_ref} confirmée`, paragraphs),
    };
  }
  // invoice_30d
  const paragraphs = [
    `Bonjour ${name},`,
    `Votre commande ${order.order_ref} est bien enregistrée.`,
    `Nous vérifions votre éligibilité à la facture 30 jours et revenons vers vous sous 24h avec votre facture et les détails de livraison.`,
  ];
  const subject = `Commande ${order.order_ref} enregistrée — Swiss Arena`;
  return {
    subject,
    text: [...paragraphs, "Swiss Arena"].join("\n\n"),
    html: renderHtml(`Commande ${order.order_ref} enregistrée`, paragraphs),
  };
}

async function sendSmtp(to: string, email: BuiltEmail): Promise<void> {
  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get("SMTP_HOST")!,
      port: Number(Deno.env.get("SMTP_PORT") ?? "465"),
      tls: true, // port 465 = implicit SSL
      auth: {
        username: Deno.env.get("SMTP_USER")!,
        password: Deno.env.get("SMTP_PASSWORD")!,
      },
    },
  });
  try {
    await client.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      replyTo: FROM_EMAIL,
      subject: email.subject,
      content: email.text,
      html: email.html,
    });
  } finally {
    await client.close();
  }
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  // Auth: shared-secret header (function is verify_jwt=false).
  const expected = Deno.env.get("WEBHOOK_SECRET");
  if (expected && req.headers.get("x-webhook-secret") !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let order: OrderRecord;
  try {
    const body = await req.json();
    order = (body.record ?? body) as OrderRecord;
  } catch {
    return new Response(JSON.stringify({ error: "invalid payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!order?.id || !order.email) {
    return new Response(JSON.stringify({ error: "missing order id/email" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Idempotency — never send twice for the same row.
  if (order.confirmation_email_sent === true) {
    return new Response(JSON.stringify({ skipped: "already sent" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = adminClient();
  const email = buildEmail(order);

  try {
    await sendSmtp(order.email, email);
    await supabase
      .from("orders")
      .update({ confirmation_email_sent: true, confirmation_email_error: null })
      .eq("id", order.id);
    console.log(`confirmation email sent for ${order.order_ref} -> ${order.email}`);
    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`SMTP send failed for ${order.order_ref}: ${message}`);
    // Record the error but DO NOT fail — the order insert must stay intact.
    await supabase
      .from("orders")
      .update({ confirmation_email_sent: false, confirmation_email_error: message })
      .eq("id", order.id);
    return new Response(JSON.stringify({ sent: false, error: message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
