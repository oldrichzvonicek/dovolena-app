// Internal notification e-mail for a contact-form submission. Inline styles
// and a table-based layout on purpose — see lead-magnet-email.ts for why.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildContactNotificationEmailHtml(params: { name: string; email: string; message: string }): string {
  const name = escapeHtml(params.name);
  const email = escapeHtml(params.email);
  const escapedMessage = escapeHtml(params.message).replace(/\n/g, "<br />");

  return `<!doctype html>
<html lang="cs">
  <body style="margin:0;padding:0;background-color:#F7F5F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F5F0;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border-radius:16px;border:1px solid #D3D1C7;">
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:32px;height:32px;background-color:#0F9D7C;border-radius:8px;font-size:0;line-height:0;">&nbsp;</td>
                    <td style="padding-left:10px;font-size:20px;font-weight:700;color:#2C2C2A;">dodio</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <h1 style="margin:0;font-size:20px;line-height:26px;font-weight:800;color:#2C2C2A;">
                  Nová zpráva z kontaktního formuláře
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 0 40px;">
                <p style="margin:0;font-size:14px;line-height:21px;color:#5F5E5A;">
                  <strong style="color:#2C2C2A;">Jméno:</strong> ${name}<br />
                  <strong style="color:#2C2C2A;">E-mail:</strong> ${email}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 32px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EFEDE6;">
                  <tr>
                    <td style="padding-top:20px;font-size:15px;line-height:23px;color:#2C2C2A;">
                      ${escapedMessage}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildContactNotificationEmailText(params: { name: string; email: string; message: string }): string {
  const { name, email, message } = params;
  return [`Jméno: ${name}`, `E-mail: ${email}`, "", message].join("\n");
}
