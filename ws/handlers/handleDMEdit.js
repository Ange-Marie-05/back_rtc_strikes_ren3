import * as dmModel from "../../models/dm.models.js";

async function handleDMEdit(socket, { messageId, content }, io) {
  try {
    const userId = socket.userId;
    const result = await dmModel.editDirectMessage(userId, messageId, content);

    socket.emit("dm:edited", result);

    // Emission récepteur si connecté
    for (const [, receiverSocket] of io.sockets.sockets) {
      if (receiverSocket.userId === result.receiverId) {
        receiverSocket.emit("dm:edited", result);
        break;
      }
    }

  } catch (error) {
    console.error("Erreur handleDMEdit:", error);
    socket.emit("error", { message: "Impossible d'éditer le message" });
  }
}

export default handleDMEdit;