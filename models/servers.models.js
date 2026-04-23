import prisma from "../config/prisma.js";
import { createError } from "../utils/errors";

export async function findServerById(serverId) {
  return prisma.server.findUnique({
    where: { id: serverId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      owner: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });
}

export async function findMembersByServerId(serverId) {
  return prisma.serverMember.findMany({
    where: { serverId },
    select: {
      role: true,
      joinedAt: true,
      banned: true,
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });
}

export async function getMyRole(serverId, userId) {
  const membership = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: {
        userId,
        serverId,
      },
    },
    select: {
      role: true,
    },
  });

  if (!membership) {
    throw createError("USER_NOT_MEMBER");
  }

  return membership.role;
}

export async function createServerDB(name, ownerId) {
  return prisma.server.create({
    data: {
      name,
      ownerId,
      members: {
        create: {
          userId: ownerId,
          role: "Owner",
        },
      },
    },
    include: {
      members: {
        select: {
          role: true,
          user: {
            select: { id: true, username: true },
          },
        },
      },
      owner: {
        select: { id: true, username: true },
      },
    },
  });
}

export async function joinServer(userId, serverId) {
  // Vérifie si déjà membre
  const existingMembership = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: {
        userId,
        serverId,
      },
    },
  });

  if (existingMembership) {
    if (existingMembership.banned) {
      throw createError("SERVER_GOT_BANNED");
    }

    throw createError("SERVER_ALREADY_JOINED");
  }

  // Créer le membre sinon
  return prisma.serverMember.create({
    data: {
      userId,
      serverId,
      role: "Member",
    },
    include: {
      server: {
        select: {
          id: true,
          name: true,
        },
      },
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });
}

export async function deleteServer(userId, serverId) {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: { ownerId: true },
  });

  if (!server) {
    throw createError("SERVER_NOT_FOUND");
  }

  if (server.ownerId !== userId) {
    throw createError("USER_NOT_AUTHORIZED");
  }

  await prisma.server.delete({
    where: { id: serverId },
  });

  return true;
}

export async function leaveServer(userId, serverId) {
  // Cherche si le membre existe bien et s'il est pas le owner
  const membership = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: {
        userId,
        serverId,
      },
    },
    include: {
      server: true,
    },
  });

  if (!membership) {
    throw createError("USER_NOT_MEMBER");
  }

  if (membership.role === "Owner") {
    throw createError("OWNER_CANNOT_LEAVE");
  }

  // Supprime le membre
  await prisma.serverMember.delete({
    where: {
      userId_serverId: {
        userId,
        serverId,
      },
    },
  });

  return membership;
}

export async function updateServer(userId, serverId, name) {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: { id: true, name: true, ownerId: true },
  });

  if (!server) throw createError("SERVER_NOT_FOUND");

  if (server.ownerId !== userId) throw createError("NOT_SERVER_OWNER");

  return prisma.server.update({
    where: { id: serverId },
    data: { name },
    select: { id: true, name: true, createdAt: true },
  });
}

export async function updateMemberRole(ownerId, serverId, memberId, role) {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: { id: true, ownerId: true },
  });
  if (!server) throw createError("SERVER_NOT_FOUND");

  if (server.ownerId !== ownerId) throw createError("NOT_SERVER_OWNER");

  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId: memberId, serverId } },
    select: { id: true, role: true, userId: true, serverId: true },
  });
  if (!member) throw createError("MEMBER_NOT_FOUND");

  if (role === "Owner") {
    // Retrait du rôle Owner de l'ancien owner car unique
    const previousOwnerMember = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId: ownerId, serverId } },
    });
    if (previousOwnerMember) {
      await prisma.serverMember.update({
        where: { id: previousOwnerMember.id },
        data: { role: "Member" },
      });
    }

    // Mettre à jour le serveur pour définir le nouveau owner
    await prisma.server.update({
      where: { id: serverId },
      data: { ownerId: memberId },
    });

    //Attribuer le rôle Owner au membre choisi
    const newOwner = await prisma.serverMember.update({
      where: { id: member.id },
      data: { role: "Owner" },
      select: { id: true, role: true, userId: true, serverId: true },
    });

    return newOwner;
  }

  // Mise à jour classique si juste member ou admin
  return prisma.serverMember.update({
    where: { id: member.id },
    data: { role },
    select: { id: true, role: true, userId: true, serverId: true },
  });
}

export async function kickMember(requesterId, memberId, serverId) {
  const requesterMembership = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: {
        userId: requesterId,
        serverId,
      },
    },
    select: { role: true },
  });

  if (!requesterMembership) {
    throw createError("MEMBER_NOT_FOUND");
  }

  const membership = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: {
        userId: memberId,
        serverId,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    throw createError("MEMBER_NOT_FOUND");
  }

  // Validation des permissions
  if (membership.role === "Owner") {
    throw createError("MEMBER_CANNOT_BE_KICK");
  }

  if (requesterMembership.role === "Admin" && membership.role === "Admin") {
    throw createError("MEMBER_CANNOT_BE_KICK");
  }

  // Expulsion membre
  await prisma.serverMember.delete({
    where: {
      userId_serverId: {
        userId: memberId,
        serverId,
      },
    },
  });

  // Retourner info pour le controller
  return { memberId, serverId };
}

export async function banMemberPerm(requesterId, serverId, userId) {
  const requesterMembership = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: {
        userId: requesterId,
        serverId,
      },
    },
    select: { role: true },
  });

  if (!requesterMembership) {
    throw createError("USER_NOT_MEMBER");
  }

  const membership = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: {
        userId,
        serverId,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    throw createError("MEMBER_NOT_FOUND");
  }

  if (membership.role === "Owner") {
    throw createError("MEMBER_CANNOT_BE_KICK");
  }

  if (requesterMembership.role === "Admin" && membership.role === "Admin") {
    throw createError("MEMBER_CANNOT_BE_KICK");
  }

  await prisma.serverMember.update({
    where: {
      userId_serverId: {
        userId,
        serverId,
      },
    },
    data: { banned: true, banEndDate: null },
  });

  return await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });
}

// Débannit un membre d’un serveur
// Remet banned à false et banEndDate à null
// Retourne les infos de l’utilisateur débanni
export async function unbanMemberPerm(requesterId, serverId, userId) {
  const requesterMembership = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: {
        userId: requesterId,
        serverId,
      },
    },
    select: { role: true },
  });

  if (!requesterMembership) {
    throw createError("USER_NOT_MEMBER");
  }

  const membership = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: {
        userId,
        serverId,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    throw createError("MEMBER_NOT_FOUND");
  }

  if (membership.role === "Owner") {
    throw createError("MEMBER_CANNOT_BE_KICK");
  }

  if (requesterMembership.role === "Admin" && membership.role === "Admin") {
    throw createError("MEMBER_CANNOT_BE_KICK");
  }

  await prisma.serverMember.update({
    where: {
      userId_serverId: {
        userId,
        serverId,
      },
    },
    data: { banned: false, banEndDate: null },
  });

  return await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });
}

// Débannit un membre sans vérification de permissions
// À utiliser uniquement pour les traitements automatiques du système
export async function unbanMemberSystem(serverId, userId) {
  await prisma.serverMember.update({
    where: {
      userId_serverId: {
        userId,
        serverId,
      },
    },
    data: { banned: false, banEndDate: null },
  });

  return await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });
}

// Vérifie si un ban temporaire a expiré
// Si oui, le membre est automatiquement débanni
export async function refreshExpiredBan(userId, serverId) {
  const membership = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: { userId, serverId },
    },
  });

  if (!membership) return null;

  if (
    membership.banned === true &&
    membership.banEndDate &&
    membership.banEndDate.getTime() < Date.now()
  ) {
    return prisma.serverMember.update({
      where: {
        userId_serverId: { userId, serverId },
      },
      data: {
        banned: false,
        banEndDate: null,
      },
    });
  }

  return membership;
}

export async function findAvailableServersByUser(userId) {
  const userWithServers = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      serverMembers: {
        include: {
          server: true,
        },
      },
    },
  });

  if (!userWithServers) return [];

  const refreshedMembers = await Promise.all(
    userWithServers.serverMembers.map(async (sm) => {
      if (
        sm.banned === true &&
        sm.banEndDate &&
        sm.banEndDate.getTime() < Date.now()
      ) {
        return prisma.serverMember.update({
          where: {
            userId_serverId: {
              userId: sm.userId,
              serverId: sm.serverId,
            },
          },
          data: {
            banned: false,
            banEndDate: null,
          },
          include: {
            server: true,
          },
        });
      }

      return sm;
    })
  );

  // Exclude permanent bans (banned=true, no banEndDate)
  // Include temp bans (banned=true, banEndDate in future) as grayed-out
  return refreshedMembers
    .filter((sm) => !(sm.banned === true && !sm.banEndDate))
    .map((sm) => ({
      id: sm.server.id,
      name: sm.server.name,
      createdAt: sm.server.createdAt,
      tempBanned: sm.banned === true && !!sm.banEndDate,
      banEndDate: sm.banned === true && sm.banEndDate ? sm.banEndDate : null,
    }));
}

export async function isBannedModel(userId, serverId) {
  try {
    const membership = await refreshExpiredBan(userId, serverId);

    if (!membership) {
      throw createError("MEMBER_NOT_FOUND");
    }

    return membership.banned;
  } catch (error) {
    console.error("Error checking ban status in model:", error);
    throw createError("DATABASE_ERROR");
  }
}

export async function banMemberTemp(requesterId, memberId, serverId, durationDays) {
  const requesterMembership = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: {
        userId: requesterId,
        serverId,
      },
    },
    select: { role: true },
  });

  if (!requesterMembership) {
    throw createError("MEMBER_NOT_FOUND");
  }

  const membership = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: {
        userId: memberId,
        serverId,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    throw createError("MEMBER_NOT_FOUND");
  }

  //Check permissions
  if (membership.role === "Owner") {
    throw createError("MEMBER_CANNOT_BE_KICK");
  }

  if (requesterMembership.role === "Admin" && membership.role === "Admin") {
    throw createError("MEMBER_CANNOT_BE_KICK");
  }

  const banEndDate = new Date();
  banEndDate.setDate(banEndDate.getDate() + durationDays);

  await prisma.serverMember.update({
    where: {
      userId_serverId: {
        userId: memberId,
        serverId,
      },
    },
    data: {
      banned: true,
      banEndDate,
    },
  });

  return { memberId, serverId, banEndDate };
}