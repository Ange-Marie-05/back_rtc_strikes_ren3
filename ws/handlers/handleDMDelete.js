import * as dmModel from "../../models/dm.models.js";

async function handleDMDelete(socket, { messageId }, io) {
  try {
    const userId = socket.userId;
    const result = await dmModel.deleteDirectMessage(userId, messageId);

    socket.emit("dm:deleted", { messageId });

    for (const [, receiverSocket] of io.sockets.sockets) {
      if (receiverSocket.userId === result.receiverId) {
        receiverSocket.emit("dm:deleted", { messageId });
        break;
      }
    }

  } catch (error) {
    console.error("Erreur handleDMDelete:", error);
    socket.emit("error", { message: "Impossible de supprimer le message" });
  }
}

export default handleDMDelete;