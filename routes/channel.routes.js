import express from 'express';
import channelController from '../controllers/channel.controller.js';
import messageController from '../controllers/messages.controller.js';

const router = express.Router();

// GET
// Channels
router.get('/', channelController.getChannels);
router.get('/:id', channelController.getChannelInfoById);
// Messages
router.get('/:id/messages', messageController.getChannelMessages);

// POST
router.post('/:id/messages', messageController.createMessageREST);

// Routes Put
router.put('/:id', channelController.updateChannelById)


// Route Delete
router.delete('/:id', channelController.deleteChannelById)

export default router;