import express from 'express';
import authController from '../controllers/auth.controller';

const router = express.Router()

// Route auth
router.post('/login', authController.login);
router.post('/verifyTOTP', authController.verifyTOTP);
router.post('/signup', authController.signup);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.resetPassword);
router.post('/reset-password', authController.confirmResetPassword);

export default router;