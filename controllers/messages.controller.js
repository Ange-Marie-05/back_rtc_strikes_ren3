import * as messagesModel from '../models/messages.models.js'
import { createError } from "../utils/errors.js";

async function getChannelMessages(req,res,next) {
  try {
    //Extraction données
    const channelId = req.params.id;
    const limit = parseInt(req.query.limit) || 50;
    

    // Authentification
    const userId = req.session.user?.id
    if (!userId) {
      throw createError('USER_NOT_AUTHENTICATED');
    }

    // Appel model
    const result = await messagesModel.getMessagesByChannel(channelId, limit, userId);

    // Réponse
    res.status(200).json(result);

  } catch (error) {
    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}

async function createMessageREST(req,res,next) {
  try {
    const channelId = req.params.id;
    const content = req.body.content;
    const isGif = req.body.isGif || false;
    const userId = req.session.user?.id;

    if (!userId) {
      throw createError('USER_NOT_AUTHENTICATED');
    }

    if (!content || content.trim() === '') {
      throw createError('MESSAGE_CONTENT_EMPTY');
    }

    const message = await messagesModel.createMessage(userId, channelId, content, isGif); // ✅ FIX

    res.status(201).json(message);

  } catch (error) {
    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}

async function deleteMessageById(req,res,next) {
  try {
    // Extraction
    const messageId = req.params.messageId;
    const userId = req.session.user?.id;

    // Vérification
    if (!userId) {
      throw createError('USER_NOT_AUTHENTICATED');
    }

    await messagesModel.deleteMessage(userId, messageId);

    res.status(200).json({
      success: true, message: "Message supprimé avec succès"
    });

  } catch (error) {
    if (!error.type) {
      error.type = 'DATABASE_ERROR';
    }
    next(error);
  }
}


export default {
  getChannelMessages,
  createMessageREST,
  deleteMessageById,
}