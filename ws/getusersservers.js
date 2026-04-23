// ws/getusersservers.js
import prisma from "../config/prisma.js";

export async function getUsersServers(userId) {
  try {
    const userWithServers = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        serverMembers: {
          include: {
            server: true
          }
        }
      }
    });

    if (!userWithServers) return [];
    return userWithServers.serverMembers.map(sm => sm.server);
  } catch (error) {
    console.error("Erreur getUsersServers:", error);
    return [];
  }
}