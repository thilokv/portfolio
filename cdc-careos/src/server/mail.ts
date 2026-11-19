/**
 * Outbound e-mail. Development uses the console transport (the link is
 * printed in the server log). Production must configure a real transport
 * before enabling self-service password reset (see docs/DEPLOYMENT.md).
 */
import "server-only";

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const transport = process.env.MAIL_TRANSPORT ?? "console";
  if (transport === "console") {
    console.info(`[careos:mail] to=${to.replace(/(.{2}).*(@.*)/, "$1***$2")} subject="${subject}"\n${text}`);
    return;
  }
  throw new Error(`Mail transport "${transport}" is not configured`);
}
