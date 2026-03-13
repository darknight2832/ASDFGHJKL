const ensureWhatsAppPrefix = (value: string) =>
  value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;

export const sendEmail = async ({
  to,
  subject,
  html,
  text
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) => {
  const from = process.env.ALERT_FROM_EMAIL;
  if (!from) {
    throw new Error("Missing ALERT_FROM_EMAIL environment variable.");
  }

  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from, to, subject, html, text })
    });

    if (!response.ok) {
      const data = await response.text();
      throw new Error(`Resend failed: ${data}`);
    }
    return;
  }

  if (process.env.SENDGRID_API_KEY) {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [{ type: "text/html", value: html }]
      })
    });

    if (!response.ok) {
      const data = await response.text();
      throw new Error(`SendGrid failed: ${data}`);
    }
    return;
  }

  throw new Error("No email provider configured (RESEND_API_KEY or SENDGRID_API_KEY).");
};

export const sendWhatsApp = async ({
  to,
  message
}: {
  to: string;
  message: string;
}) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    throw new Error("Missing Twilio WhatsApp environment variables.");
  }

  const body = new URLSearchParams({
    To: ensureWhatsAppPrefix(to),
    From: ensureWhatsAppPrefix(from),
    Body: message
  });

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }
  );

  if (!response.ok) {
    const data = await response.text();
    throw new Error(`Twilio WhatsApp failed: ${data}`);
  }
};
