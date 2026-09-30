// Branded HTML e-mail for the lead-magnet template send. Inline styles and a
// table-based layout on purpose — external <style> tags and modern CSS are
// unreliable across e-mail clients (Outlook in particular), so this stays
// close to what actually renders consistently everywhere.

export function buildLeadMagnetEmailHtml(templateUrl: string): string {
  return `<!doctype html>
<html lang="cs">
  <body style="margin:0;padding:0;background-color:#F7F5F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F5F0;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#FFFFFF;border-radius:16px;border:1px solid #D3D1C7;">
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
                <h1 style="margin:0;font-size:22px;line-height:28px;font-weight:800;color:#2C2C2A;">
                  Vaše šablona je na cestě
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 40px 0 40px;">
                <p style="margin:0;font-size:15px;line-height:23px;color:#5F5E5A;">
                  Dobrý den,<br /><br />
                  posíláme šablonu pro evidenci pracovní doby, dovolené, sick days a home office pro rok
                  2027. Stačí vyplnit pár údajů v listu Předvolby a šablona se sama přizpůsobí na celý rok.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background-color:#085041;">
                      <a
                        href="${templateUrl}"
                        style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;"
                        >Stáhnout šablonu (.xlsx)</a
                      >
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 32px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EFEDE6;">
                  <tr>
                    <td style="padding-top:20px;font-size:13px;line-height:20px;color:#5F5E5A;">
                      Tým Dodio ·
                      <a href="https://dodio.cz" style="color:#0B7A60;text-decoration:none;">dodio.cz</a>
                      <br />
                      Tenhle e-mail jsme poslali, protože jste si o šablonu řekli na dodio.cz.
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

export function buildLeadMagnetEmailText(templateUrl: string): string {
  return [
    "Dobrý den,",
    "",
    "posíláme šablonu pro evidenci pracovní doby, dovolené, sick days a home office pro rok 2027.",
    "",
    `Stáhnout šablonu: ${templateUrl}`,
    "",
    "Tým Dodio — dodio.cz",
  ].join("\n");
}
