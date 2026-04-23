import * as dmModel from '../models/dm.models.js'
import { createError } from '../utils/errors.js'

async function getDMHistory(req,res,next) {
    try {
        const userId = req.session.user?.id;
        const { contactId } = req.params;

        if (!userId) {
            throw createError('USER_NOT_AUTHENTICATED');
        }

        const messages = await dmModel.getDirectMessages(userId, contactId);

        res.status(200).json({
            success: true,
            messages
        });
    } catch (error) {
        if (!error.type) {
            error.type = 'DATABASE_ERROR';
        }
        next(error);
    }
}

export default { getDMHistory };