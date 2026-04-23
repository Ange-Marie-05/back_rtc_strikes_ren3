export function welcomeEmail(username) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Bienvenue sur Concorde</title>
  </head>
  <body style="font-family: sans-serif;">
    <h2>Bienvenue, ${username} !</h2>
    <p>Votre compte a été créé avec succès.</p>
  </body>
</html>
  `;
}