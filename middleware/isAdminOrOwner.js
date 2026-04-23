import prisma from '../config/prisma.js';
import { createError } from '../utils/errors.js';

async function isAdminOrOwner(req,res,next) {
    try {
        if (!req.session || !req.session.userId) {
            throw createError('USER_NOT_AUTHENTICATED');
        }

        const userId = req.session.userId;
        const serverId = req.params.id;

        const membership = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId: userId,
                    serverId: serverId
                }
            }
        });

        if (!membership) {
            throw createError('USER_NOT_MEMBER');
        }
        if (membership.role !== 'Admin' && membership.role !== 'Owner') {
            throw createError('CHANNEL_UNAUTHORIZED');
        }
        
        next();
    } catch (error) {
        next(error);
    }
}

export default isAdminOrOwner;