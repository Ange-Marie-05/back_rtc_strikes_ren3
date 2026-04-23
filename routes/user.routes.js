import express from 'express';
import userController from '../controllers/user.controller';

const router = express.Router();

// Routes user
router.get('/me', userController.getMe);
router.put('/me', userController.updateMe);
router.get('/contacts', userController.getMyContacts);


export default router;