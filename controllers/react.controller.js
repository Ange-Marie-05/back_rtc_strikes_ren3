import * as reactsModel from '../models/reacts.models.js';
import { createError } from "../utils/errors.js";

//CREATE
async function createNewReact(req,res,next) {
  try {
    const messageId = req.params.id;
    const emoji = req.body.emoji;
    const userId = req.session.user?.id;

    if (!userId) {
      throw createError('USER_NOT_AUTHENTICATED');
    }

    const react = await reactsModel.createReact(userId, messageId, emoji);

    res.status(201).json({
        success: true,
        data: react
    });

  } catch (error) {
    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}

//DEL
async function deleteReactById(req,res,next) {
  try {
    // Extraction
    const reactId = req.body.reactId;
    const userId = req.session.user?.id;

    // Vérification
    if (!userId) {
      throw createError('USER_NOT_AUTHENTICATED');
    }

    await reactsModel.deleteReact(reactId);

    res.status(200).json({
      success: true, 
      message: "React supprimé avec succès"
    });

  } catch (error) {
    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}


export default {
  createNewReact,
  deleteReactById,
}