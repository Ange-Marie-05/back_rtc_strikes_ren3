import * as messagesModel from "../../models/messages.models.js";

async function handleMessageDelete(socket, { messageId }, io) {
  try {
    const userId = socket.userId;
    const result = await messagesModel.deleteMessage(userId, messageId);
    console.log(`Message ${messageId} supprimé du channel ${result.channelId}`);
    
    // Émettre à TOUT le channel (y compris l'émetteur)
    io.to(`channel:${result.channelId}`).emit("message:deleted", { messageId });
    
  } catch (error) {
    console.error("Erreur handleMessageDelete:", error);
    socket.emit("error", { message: "Impossible de supprimer le message" });
  }
}

export default handleMessageDelete;