export function resetPasswordEmail(username, resetUrl) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Réinitialisation de votre mot de passe</title>
  </head>
  <body style="font-family: sans-serif;">
    <h2>Bonjour, ${username} !</h2>
    <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
    <p>Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe :</p>
    <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">
      Réinitialiser mon mot de passe
    </a>
    <p>Ce lien expire dans <strong>1 heure</strong>.</p>
    <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
  </body>
</html>
  `;
}