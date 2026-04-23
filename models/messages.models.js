import prisma from '../config/prisma.js';
import { createError } from '../utils/errors.js';

export async function createMessage(userId, channelId, content, isGif) {
    // Validation
    if (!content || content.trim() === "") {
        throw createError('MESSAGE_CONTENT_EMPTY');
    }

    if (content.length > 2000) {
        throw createError('MESSAGE_INVALID_CONTENT');
    }

    // Vérification métier(DB)
    const channel = await prisma.channel.findUnique({
        where: {id: channelId},
        select: {id:true, serverId:true}
    });

    if (!channel) {
        throw createError('CHANNEL_NOT_FOUND');
    }

    const membership = await prisma.serverMember.findUnique({
        where: {
            userId_serverId: {
                userId,
                serverId: channel.serverId
            }
        }
    });

    if (!membership) {
        throw createError('USER_NOT_MEMBER');
    }

    return prisma.message.create({
        data: {
            content: content.trim(),
            userId,
            channelId,
            isGif
        },
        include: {
            user: {
                select: {
                    id: true,
                    username: true
                }
            },
            reacts: true
        }
    });
}

export async function getMessagesByChannel(channelId, limit = 50, requestingUserId) {
  // Vérification que le channel existe
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, serverId: true }
  });
  
  if (!channel) {
    throw createError('CHANNEL_NOT_FOUND');
  }

  // Récupérer le rôle de l'utilisateur qui fait la requête
  const membership = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: { // Prisma génère ce nom automatiquement
        userId: requestingUserId,
        serverId: channel.serverId
      }
    },
    select: { role: true }
  });

  if (!membership) {
    throw createError('USER_NOT_MEMBER');
  }

  // Récupérer les messages
  const messages = await prisma.message.findMany({
    where: { channelId },
    take: limit,
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          username: true
        }
      },
      reacts: true
    }
  });

  return {
    messages,
    userRole: membership.role, // Ajouter le rôle de l'utilisateur
    userId: requestingUserId // Ajouter l'ID de l'utilisateur pour comparaison côté client
  };
}

export async function deleteMessage(userId, messageId) {
    // Récupération message
    const message = await prisma.message.findUnique({
        where: { id: messageId },
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

    // Vérification permissions
    // User auteur du message
    const isOwner = message.userId === userId;
    // User est admin ou Owner
    const membership = await prisma.serverMember.findUnique({
        where: {
            userId_serverId: {
                userId,
                serverId: message.channel.serverId
            }
        },
        select: {role: true}
    });

    const isAdminOrOwner = membership && (membership.role === 'Admin' || membership.role === 'Owner');

    if (!isOwner && !isAdminOrOwner) {
        throw createError('MESSAGE_UNAUTHORIZED_DELETE');
    }

    // Suppression message
    await prisma.message.delete({
        where: {id: messageId}
    });

    // Retourn info websocket(broadcast)
    return {
        id: messageId,
        channelId: message.channelId
    }
}

export async function editMessage(userId, messageId, content) {
    // Validation
    if (!content || content.trim() === "") {
        throw createError('MESSAGE_CONTENT_EMPTY');
    }

    if (content.length > 2000) {
        throw createError('MESSAGE_INVALID_CONTENT');
    }

    // Récupération message
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

    // Vérification permissions
    if (message.userId !== userId) {
        throw createError('MESSAGE_UNAUTHORIZED_EDIT');
    }

    // MAJ message
    const updatedMessage = await prisma.message.update({
        where: { id: messageId },
        data: {
            content: content.trim(),
            isEdited: true
        },
        include: {
            user: {
                select: {
                    id: true,
                    username: true
                }
            },
            reacts: true
        }
    });

    // Retourne info websocket (broadcast)
    return {
        ...updatedMessage,
        channelId: message.channelId
    };
}