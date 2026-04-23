import prisma from "../config/prisma.js";

async function getUsername(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true }
    });
    return user ? user.username : null;
  } catch (error) {
    throw error;
  }
}
export default getUsername;