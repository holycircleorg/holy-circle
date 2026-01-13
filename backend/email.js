// FILE: backend/services/email.js
import nodemailer from "nodemailer";
import "dotenv/config";

const FROM_EMAIL = process.env.FROM_EMAIL || "donations@holycircle.org";

export function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    }
    ,
  });
}

export async function sendDonationReceiptEmail({
  to,
  pdfBuffer,
  amount,
  currency = "usd",
  donationDate,
}) {
  const transporter = createTransporter();

  const formattedAmount = (amount / 100).toFixed(2);
  const upperCurrency = currency.toUpperCase();
  const dateStr =
    donationDate instanceof Date
      ? donationDate.toLocaleString()
      : new Date(donationDate).toLocaleString();

  const mailOptions = {
   from: process.env.FROM_EMAIL,
    to,
    subject: "Your Holy Circle Donation Receipt",
    text: `
Thank you for your generous gift to Holy Circle.

Amount: $${formattedAmount} ${upperCurrency}
Date: ${dateStr}

Your official donation receipt is attached as a PDF. 
Please keep it for your records and for tax purposes.

Holy Circle is a registered 501(c)(3) nonprofit organization (EIN: 33-3661912).
No goods or services were provided in exchange for this contribution.

With gratitude,
Holy Circle
    `.trim(),
    html: `
      <p>Hi,</p>
      <p>Thank you for your generous gift to <strong>Holy Circle</strong>.</p>
      <p>
        <strong>Amount:</strong> $${formattedAmount} ${upperCurrency}<br/>
        <strong>Date:</strong> ${dateStr}
      </p>
      <p>Your official donation receipt is attached as a PDF. Please keep it for your records and for tax purposes.</p>
      <p>
        Holy Circle is a registered 501(c)(3) nonprofit organization (EIN: <strong>33-3661912</strong>).<br/>
        No goods or services were provided in exchange for this contribution.
      </p>
      <p>With gratitude,<br/>Holy Circle</p>
    `,
    attachments: [
      {
        filename: "Holy-Circle-Donation-Receipt.pdf",
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };

  

  await transporter.sendMail(mailOptions);
}

// =============================================
// SEND FORUM ALERT EMAIL (New Prayer Request)
// =============================================
export async function sendForumAlertEmail({ to, threadTitle }) {
  const transporter = createTransporter();

  const mailOptions = {
    from: `Holy Circle <${FROM_EMAIL}>`,
    to,
    subject: "New Prayer Request Posted on Holy Circle",
    text: `
A new Prayer Request was posted:

"${threadTitle}"

Visit your Holy Circle account to read and respond.

https://holycircle.org/forum.html
    `.trim(),
  };

  await transporter.sendMail(mailOptions);
}

export async function sendGenericEmail({ to, subject, html, text }) {
  const transporter = createTransporter();

  const mailOptions = {
    from: `Holy Circle <${FROM_EMAIL}>`,
    to,
    subject,
    text: text || (html ? html.replace(/<[^>]+>/g, "") : ""),
    html: html || undefined,
  };

  await transporter.sendMail(mailOptions);
}
