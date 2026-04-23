import prisma from '../config/prisma.js';
import { createError } from "../utils/errors.js";
import * as dmModel from "../models/dm.models.js";

async function getMe(req, res, next) {
  try {
    // Vérifier si l'utilisateur est connecté
    if (!req.session.user) {
      throw createError('USER_NOT_AUTHENTICATED');
    }

    // Récupérer les infos à jour depuis la DB
    const user = await prisma.user.findUnique({
      where: { 
        id: req.session.user.id 
      },
      select: { 
        id: true, 
        username: true
      }
    });

    if (!user) {
      throw createError('USER_NOT_FOUND');
    }

    res.json({
      success: true,
      user: user
    });

  } catch (error) {
    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}

async function updateMe(req, res, next) {
  try {
    if (!req.session.user) {
      throw createError('USER_NOT_AUTHENTICATED');
    }

    // Validation et trim
    if (!req.body.username || typeof req.body.username !== 'string') {
      throw createError('USER_INPUT_EMPTY');
    }

    const usernameUpdate = req.body.username.trim();

    if (usernameUpdate.length < 3) {
      throw createError('USER_USERNAME_INCORRECT');
    }

    // Vérifier si le username est différent de l'actuel
    if (usernameUpdate === req.session.user.username) {
      return res.status(200).json({
        success: true,
        message: "Aucun changement détecté",
        data: {
          id: req.session.user.id,
          username: req.session.user.username
        }
      });
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { 
        id: req.session.user.id 
      },
      data: { 
        username: usernameUpdate 
      },
      select: { 
        id: true, 
        username: true 
      }
    });

    // Mettre à jour la session
    req.session.user.username = updatedUser.username;

    // Sauvegarder la session
    req.session.save((err) => {
      if (err) {
        return next(err);
      }

      res.status(200).json({
        success: true,
        message: "Username mis à jour avec succès",
        data: updatedUser
      });
    });

  } catch (error) {
    if (error.code === 'P2002') {
      return next(createError('USER_USERNAME_ALREADY_USED'));
    }

    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}

async function getMyContacts(req, res, next) {
  try {
    if (!req.session.user) {
      throw createError('USER_NOT_AUTHENTICATED');
    }

    const contacts = await dmModel.getContacts(req.session.user.id);

    res.status(200).json({
      success: true,
      contacts
    });

  } catch (error) {
    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}


export default { 
  getMe,
  updateMe,
  getMyContacts
};