import prisma from '../config/prisma.js';
import { createError } from '../utils/errors.js';

async function checkMessageAndUser(userId, messageId) {
    // Vérification que le message existe
    const message = await prisma.message.findUnique({
        where: {id: messageId},
        include: {
            channel: {
                select: {
                    id: true,
                    serverId: true
                }
            }
        }
    });

    if (!message) {
        throw createError('MESSAGE_NOT_FOUND');
    }

    const membership = await prisma.serverMember.findUnique({
        where: {
            userId_serverId: {
                userId,
                serverId: message.channel.serverId
            }
        },
        select: { role: true }
    });

    if (!membership) {
        throw createError('USER_NOT_MEMBER');
    }
}

export async function createReact(userId, messageId, emoji) {
    //le check sur l'existence du message 
    //et si le user est un membre du channel 
    //où se trouve le message auquel il veut réact
    await checkMessageAndUser(userId, messageId);
    return prisma.react.create({
        data: {
            emoji: emoji,
            user: { connect: { id: userId } },
            message: { connect: { id: messageId } },
        }
    });
}

export async function deleteReact(reactId) {
    // Suppression react
    await prisma.react.delete({
        where: {id: reactId}
    });

    // Retourne info websocket(broadcast)
    return {
        id: reactId
    }
}

export async function createReactDM(userId, dmId, emoji) {
  return prisma.react.create({
    data: { 
        emoji, 
        user: { connect: { id: userId } }, 
        dm: { connect: { id: dmId } }, 
    }
  });
}

export async function deleteReactDM(reactId) {
  await prisma.react.delete({ where: { id: reactId } });
  return { id: reactId };
}