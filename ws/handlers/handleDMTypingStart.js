import getUsername from "../getusername.js";

async function handleDMTypingStart(socket, { receiverId }, io) {
  try {
    const username = await getUsername(socket.userId);
    if (!username) return;

    for (const [, s] of io.sockets.sockets) {
      if (s.userId === receiverId) {
        s.emit("dm:typing:user", {
          username,
          senderId: socket.userId,
        });
        break;
      }
    }
  } catch (error) {
    console.error("Erreur handleDMTypingStart:", error);
  }
}

export default handleDMTypingStart;