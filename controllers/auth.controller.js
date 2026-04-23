import prisma from "../config/prisma.js";
import email_validator from 'email-validator';
import password_validator from 'password-validator';
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import bcrypt from 'bcryptjs';
import { createError } from "../utils/errors.js";
import { sendWelcomeEmail, sendResetPasswordEmail } from "../services/email.service.js";
import { isProduction } from "../config/env.js";
import crypto from 'crypto';

//VÉRIFICATION DE L'ENCODAGE DU PASSWORD
// créer un schema de password
const passwordSchema = new password_validator();
// ajout des propriétés souhaitées
passwordSchema
.is().min(8)              //taille min
.is().max(100)            //taille max
.has().uppercase(2)       //au moins deux caractères en majuscules
.has().lowercase(2)       //au moins deux caractères en minuscules
.has().digits(2)          //au moins deux chiffres
.has().symbols(2)         //au moins deux caractères spéciaux
.has().not().spaces()     //sans espace


//DOUBLE AUTHENTIFICATION TOTP
//setup du secret
async function setupTwoFactorSecret() {
  //générer un nouveau secret
  const secret = generateSecret();

  return secret;
}

//générer le qrcode
async function generateQRCode(secret, userEmail) {
  //créer otpauth:// URI (c'est le chemin derrière le qrcode)
  const uri = generateURI({
    issuer: "Concorde", //nom du service
    label: userEmail,
    secret,
  });

  //générer le QR code version url
  const qrDataUrl = await QRCode.toDataURL(uri);

  return qrDataUrl;
}

//vérifier le coe TOTP reçu
async function verifyTOTP(req, res, next) {
  try {
    //récupération des données sur le user actuel
    const userId = req.session.pendingUserId;
    if (!userId) {
      throw createError('USER_NOT_AUTHENTICATED');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw createError('USER_NOT_FOUND');
    }

    //vérifier
    const { token } = req.body;
    console.log('token reçu:', token);
    if (!token) {
      throw createError('USER_INPUT_EMPTY');
    }

    const result = await verify({secret: user.twoFactorSecret, token});
    console.log('result:', result);

    //gestion code incorrect
    //verify retourne un objet et non un boolean:
    // result: {
    //    valid: false | true
    //  }
    if(!result.valid) {
      throw createError('USER_INVALID_CODE_TOTP');
    }

    //rallonger le cookie en fonction du remember me
    if (req.session.pendingRememberMe) {
      // 30 jours
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    }

    //Stocker l'utilisateur dans la session
    req.session.pendingUserId = null;
    req.session.pendingRememberMe = null;
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email
    };

    //Sauvegarder la session avant de répondre
    req.session.save((err) => {
      if (err) {
        return next(err);
      }
      res.status(200).json({
        success: true,
        message: "Connexion réussie",
        data: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    });
  } catch (error) {
    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}

// Login
async function login(req, res, next) {
  try {
    const { username_OR_email, password, rememberMe } = req.body;

    // Validation des entrées
    if (!username_OR_email || !password) {
      throw createError('USER_INPUT_EMPTY');
    }

    // Rechercher l'utilisateur
    let user = await prisma.user.findFirst({
      where: { 
        OR: [
          { username: username_OR_email.trim() },
          { email: username_OR_email.trim() }
        ]
      }
    });

    // Utilisateur non trouvé
    if (!user) {
      throw createError('USER_NOT_FOUND');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw createError('USER_INVALID_DATA');
    }

    //vérifier si le user n'a pas son twoFactorSecret
    if (!user.twoFactorSecret) {
      const secret = await setupTwoFactorSecret();
      user = await prisma.user.update({
        where: { 
          id: user.id 
        },
        data: { 
          twoFactorSecret: secret 
        }
      });
    }

    //générer le qrcode
    const qrCode = await generateQRCode(user.twoFactorSecret, user.email);

    //sauvegarde de l'id user dans la session et la valeur du remember me
    req.session.pendingUserId = user.id;
    req.session.pendingRememberMe = rememberMe;

    //réponse du serveur
    req.session.save((err) => {
      if (err) {
        return next(err);
      }
    
      res.status(200).json({
        success: true,
        message: "Connexion presque réussie, validez votre TOTP",
        codeQR: qrCode
      });
    });
  } catch (error) {
    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}

// Signup
async function signup(req, res, next) {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      throw createError('USER_INPUT_EMPTY');
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (trimmedUsername.length < 3) {
      throw createError('USER_USERNAME_INCORRECT');
    }

    if (email_validator.validate(trimmedEmail) != true) {
      throw createError('USER_EMAIL_INCORRECT');
    }

    if (passwordSchema.validate(password) != true) {
      throw createError('USER_PASSWORD_INCORRECT');
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 14);
    const secret = await setupTwoFactorSecret();

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        email: trimmedEmail,
        password: hashedPassword,
        twoFactorSecret: secret
      },
      select: { 
        id: true,
        username: true,
        email: true,
        twoFactorSecret: true
      }
    });

    const { error } = await sendWelcomeEmail(trimmedUsername);

    if (error) {
      console.error(error);
    }

    res.status(201).json({
      success: true,
      message: "Utilisateur créé avec succès",
      data: user
    });
  } catch (error) {
    // Username déjà existant
    if (error.code === 'P2002') {
      return next(createError('USER_EXISTS_ALREADY'));
    }

    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}

//forgot password
async function resetPassword(req, res, next) {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      throw createError('USER_INPUT_EMPTY');
    }

    const trimmedEmail = email.trim();

    if (email_validator.validate(trimmedEmail) != true) {
      throw createError('USER_EMAIL_INCORRECT');
    }

    // Rechercher l'utilisateur
    let user = await prisma.user.findUnique({
      where: { 
          email: trimmedEmail
      }
    });

    // Utilisateur non trouvé
    if (!user) {
      throw createError('USER_NOT_FOUND');
    }

    //générer un token pour la section mot de passe oublié
    const token = crypto.randomBytes(32).toString('hex')

    user = await prisma.user.update({
      where: { 
        id: user.id 
      },
      data: { 
        PasswordResetToken: token,
        PasswordResetTokenExp: new Date(Date.now() + 60 * 60 * 1000) // 1h
      }
    });

    const resetUrl = process.env.FRONTEND_URL + "/reset-password?token=" + token;

    const { error } = await sendResetPasswordEmail(user.username, resetUrl);

    if (error) {
      console.error(error);
    }

    res.status(200).json({
      success: true,
      message: "Email de réinitialisation envoyé"
    });
    
  } catch (error) {
    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}

async function confirmResetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      throw createError('USER_INPUT_EMPTY');
    }

    // Vérifier que le token existe en base
    const user = await prisma.user.findFirst({
      where: { PasswordResetToken: token }
    });

    if (!user) {
      throw createError('USER_INVALID_TOKEN');
    }

    // Vérifier que le token n'est pas expiré
    if (user.PasswordResetTokenExp < new Date()) {
      throw createError('USER_TOKEN_EXPIRED');
    }

    // Valider le nouveau mot de passe
    if (passwordSchema.validate(newPassword) != true) {
      throw createError('USER_PASSWORD_INCORRECT');
    }

    // Hasher et sauvegarder le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 14);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        PasswordResetToken: null,    // invalider le token après usage
        PasswordResetTokenExp: null
      }
    });

    res.status(200).json({
      success: true,
      message: "Mot de passe réinitialisé avec succès"
    });

  } catch (error) {
    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}

// Logout
async function logout(req, res, next) {
  try {
    // Vérifier si l'utilisateur est connecté
    if (!req.session.user) {
      throw createError('USER_NOT_AUTHENTICATED');
    }

    // Détruire la session
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }

      res.clearCookie('connect.sid', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax'
      });

      res.status(200).json({
        success: true,
        message: "Déconnexion réussie"
      });
    });
  } catch (error) {
    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}

export default {
  login,
  verifyTOTP,
  signup,
  logout,
  resetPassword,
  confirmResetPassword
};