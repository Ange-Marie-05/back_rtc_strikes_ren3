import express from 'express';
import messageController from '../controllers/messages.controller.js';

const router = express.Router();

// DELETE
router.delete('/:messageId', messageController.deleteMessageById);

export default router;