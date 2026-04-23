import express from 'express';
import dmController from '../controllers/dm.controller.js';

const router = express.Router();

router.get('/:contactId', dmController.getDMHistory);

export default router;