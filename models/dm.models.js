import prisma from "../config/prisma.js";
import { createError } from "../utils/errors.js";

export async function getContacts(userId) {
    // Liste serveurs utilisateur
    const servers = await prisma.serverMember.findMany({
        where: { userId },
        select: {serverId: true }
    })

    const serverIds = servers.map(s => s.serverId);

    // Liste membres serveurs
    const members = await prisma.serverMember.findMany({
        where: {
            serverId: { in: serverIds },
            userId : { not: userId }
        },
        include: {
            user: {
                select: { id: true, username: true }
            }
        }
    });

    const uniqueContacts = [...new Map(
        members.map(m => [m.user.id, m.user])
    ).values()];

    return uniqueContacts;
}

export async function createDirectMessage(senderId, receiverId, content, isGif) {
    // Validation
    if (!content || content.trim() === "") {
        throw createError('MESSAGE_CONTENT_EMPTY');
    }

    if (content.length > 2000) {
        throw createError('MESSAGE_INVALID_CONTENT');
    }

    // Recherche récepteur
    const receiver = await prisma.user.findUnique({
        where: {id: receiverId}
    });

    if (!receiver) {
        throw createError('USER_NOT_FOUND')
    }

    const directMessage = await prisma.directMessage.create({
        data: {
            content: content.trim(),
            senderId,
            receiverId,
            isGif
        },
        include: {
            sender: {
                select: {
                    id: true,
                    username: true
                }
            },
            reacts: true
        }
    });

    return directMessage;
}

export async function getDirectMessages(userId, contactId) {
    const messages = await prisma.directMessage.findMany({
        where: {
            OR: [
                { senderId: userId, receiverId: contactId },
                { senderId: contactId, receiverId: userId }
            ]
        },
        orderBy: { createdAt: 'asc' },
        include: {
            sender: {
                select: { id: true, username: true }
            },
            reacts: true
        }
    });

    return messages;
}

export async function deleteDirectMessage(userId, messageId) {
    const message = await prisma.directMessage.findUnique({
        where: { id: messageId }
    });

    if (!message) {
        throw createError('MESSAGE_NOT_FOUND');
    }

    if (message.senderId !== userId) {
        throw createError('MESSAGE_UNAUTHORIZED_DELETE');
    }

    await prisma.directMessage.delete({
        where: { id: messageId }
    });

    return { messageId, receiverId: message.receiverId };
}

export async function editDirectMessage(userId, messageId, content) {
    if (!content || content.trim() === "") {
        throw createError('MESSAGE_CONTENT_EMPTY');
    }

    if (content.length > 2000) {
        throw createError('MESSAGE_INVALID_CONTENT');
    }

    const message = await prisma.directMessage.findUnique({
        where: { id: messageId }
    });

    if (!message) {
        throw createError('MESSAGE_NOT_FOUND');
    }

    if (message.senderId !== userId) {
        throw createError('MESSAGE_UNAUTHORIZED_EDIT');
    }

    const updatedMessage = await prisma.directMessage.update({
        where: { id: messageId },
        data: { content: content.trim() },
        include: {
            sender: {
                select: { id: true, username: true }
            },
            reacts: true
        }
    });

    return { ...updatedMessage, receiverId: message.receiverId };
}