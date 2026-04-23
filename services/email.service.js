import { Resend } from "resend";
import { welcomeEmail } from "../utils/emails/welcomeEmail.js";
import { resetPasswordEmail } from "../utils/emails/resetPasswordEmail.js";

//CONFIG RESEND
const resend = new Resend(process.env.RESEND_API_KEY);
const emailTo = process.env.EMAIL_TO;

//création + envoie du mail de bienvenue
export async function sendWelcomeEmail(username) {
  const { data, error } = await resend.emails.send({
    from: "Concorde <onboarding@resend.dev>",
    to: emailTo,
    subject: `Bienvenue sur Concorde, ${username} !`,
    html: welcomeEmail(username),
  });

  return { data, error };
}

//reset du password
export async function sendResetPasswordEmail(username, resetUrl) {
  const { data, error } = await resend.emails.send({
    from: "Concorde <onboarding@resend.dev>",
    to: emailTo,
    subject: `Demande de modification de votre mot de passe`,
    html: resetPasswordEmail(username, resetUrl),
  });

  return { data, error };
}