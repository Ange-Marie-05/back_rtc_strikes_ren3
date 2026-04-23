import * as messagesModel from "../../models/messages.models.js";

async function handleMessageEdit(socket, { messageId, content }, io) {
  try {
    const userId = socket.userId;
    const result = await messagesModel.editMessage(userId, messageId, content);
    
    // Émettre à TOUT le channel (y compris l'émetteur)
    io.to(`channel:${result.channelId}`).emit("message:edited", result);
    
  } catch (error) {
    console.error("Erreur handleMessageEdit:", error);
    socket.emit("error", { message: "Impossible d'éditer le message" });
  }
}

export default handleMessageEdit;