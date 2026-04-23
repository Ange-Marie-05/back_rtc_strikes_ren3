import express from 'express'
import serversController from '../controllers/servers.controller.js'
import channelController from '../controllers/channel.controller.js';



const router = express.Router()

// Routes get
// Servers
router.get('/not_banned', serversController.getAvailableServers)
router.get('/:id', serversController.getServerInfoById)
router.get('/:id/members', serversController.getMembersServerById)
router.get('/:id/role', serversController.getRoleOnServerById)

// Channel
router.get('/:id/channels', channelController.getChannelsByServer);

// Routes post
// Servers
router.post('/', serversController.createServer)
router.post('/:id/join', serversController.joinServerById)
// Channels
router.post('/:id/channels', channelController.createChannel);

// Routes Put

router.put('/:id', serversController.updateServerById)
router.put('/:id/members/:userId', serversController.updateMemberServerById)

//Routes Delete
router.delete('/:id', serversController.deleteServerById)
router.delete('/:id/leave', serversController.leaveServerById)
router.delete('/:id/members/:userId/kick', serversController.kickMemberById)

router.post('/:id/:userId/permBan',serversController.banMemberPermanently)
router.post('/:id/:userId/unban',serversController.unbanMember)
router.post('/:id/:userId/tempBan', serversController.banMemberTemporarily)

router.get('/:id/:userId/isBanned',serversController.isBanned)

export default router;