import prisma from "../config/prisma.js";
import { createError } from "../utils/errors.js";

export async function deleteChannelByIdDB(userId, channelId) {
  // retrouver le channel et son serverId pour connaitre les memebres
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      serverId: true,
    },
  });

  if (!channel) throw createError("CHANNEL_NOT_FOUND");

  const serverId = channel.serverId;

  // Vérifier que l'utilisateur est membre Admin ou Owner
  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { role: true },
  });

  if (!member) throw createError("USER_NOT_MEMBER");
  if (!["Owner", "Admin"].includes(member.role)) throw createError("USER_NOT_AUTHORIZED");

  // Supprimer le channel
  await prisma.channel.delete({
    where: { id: channelId },
  });
}

export async function findChannelById(channelId) {
  return prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      messages: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'  // Plus récent en premier
        }
      }
    },
  });
}

export async function updateChannelbyIdDB(userId, channelId, name) {

  // retrouver le channel et son serverId pour connaitre les memebres
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      serverId: true,
    },
  });

  if (!channel) throw createError("CHANNEL_NOT_FOUND");

  const serverId = channel.serverId;

  // Vérifier que l'utilisateur est membre Admin ou Owner
  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { role: true },
  });

  if (!member) throw createError("USER_NOT_MEMBER");
  if (!["Owner", "Admin"].includes(member.role)) throw createError("USER_NOT_AUTHORIZED");

  return prisma.channel.update({
    where: { id: channelId },
    data: { name },
    select: { id: true, name: true, createdAt: true },
  });
}