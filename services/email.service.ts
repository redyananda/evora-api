import nodemailer from "nodemailer";

export type TransactionEmailStatus = "DONE" | "REJECTED";

interface TransactionEmailPayload {
  recipientEmail: string;
  customerName: string;
  eventName: string;
  transactionId: number;
  status: TransactionEmailStatus;
  quantity: number;
  finalPrice: number;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatIDR = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
};

export const sendTransactionStatusEmail = async (
  payload: TransactionEmailPayload
): Promise<boolean> => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(
      `[Email skipped] SMTP is not configured for transaction #${payload.transactionId}`
    );
    return false;
  }

  const accepted = payload.status === "DONE";
  const statusLabel = accepted ? "disetujui" : "ditolak";
  const detail = accepted
    ? "Pembayaran Anda telah terverifikasi. Tiket Anda sekarang aktif."
    : "Kursi serta poin, voucher, atau kupon yang digunakan telah dikembalikan ke akun Anda.";

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? `Evora <${process.env.SMTP_USER}>`,
    to: payload.recipientEmail,
    subject: `Transaksi #${payload.transactionId} ${statusLabel} — Evora`,
    text: [
      `Halo ${payload.customerName},`,
      "",
      `Transaksi #${payload.transactionId} untuk ${payload.eventName} telah ${statusLabel}.`,
      detail,
      `Jumlah tiket: ${payload.quantity}`,
      `Total: ${formatIDR(payload.finalPrice)}`,
      "",
      "Terima kasih,",
      "Evora",
    ].join("\n"),
    html: `
      <div style="font-family:Inter,Arial,sans-serif;color:#211333;line-height:1.6;max-width:560px;margin:auto">
        <div style="background:#6d28d9;color:white;padding:20px 24px;border-radius:16px 16px 0 0">
          <h1 style="font-size:22px;margin:0">Status transaksi Evora</h1>
        </div>
        <div style="border:1px solid #e9ddff;border-top:0;padding:24px;border-radius:0 0 16px 16px">
          <p>Halo ${escapeHtml(payload.customerName)},</p>
          <p>Transaksi <strong>#${payload.transactionId}</strong> untuk <strong>${escapeHtml(payload.eventName)}</strong> telah <strong>${statusLabel}</strong>.</p>
          <p>${detail}</p>
          <div style="background:#f7f1ff;padding:14px 16px;border-radius:10px">
            <div>Jumlah tiket: <strong>${payload.quantity}</strong></div>
            <div>Total: <strong>${formatIDR(payload.finalPrice)}</strong></div>
          </div>
          <p style="margin-top:24px">Terima kasih,<br><strong>Evora</strong></p>
        </div>
      </div>
    `,
  });

  return true;
};
