import getUsername from "../getusername.js";

async function handleTypingStart(socket, { channelId }, io) {
  try {
    const username = await getUsername(socket.userId);
    if (username) {
      // Envoyer seulement aux autres
      socket.to(`channel:${channelId}`).emit("typing:user", { username, channelId });
    }
  } catch (error) {
    console.error("Erreur handleTypingStart:", error);
  }
}

export default handleTypingStart;