import * as messagesModel from "../../models/messages.models.js";

async function handleMessageSend(socket, message, io) {
  const { channelId, content, isGif : isGif } = message;
  
  try {
    const newMessage = await messagesModel.createMessage(socket.userId, channelId, content,isGif);
    console.log(`Message créé:`, newMessage.id);
    
    // Émettre SEULEMENT aux autres (pas à soi-même)
    socket.to(`channel:${channelId}`).emit("message:new", newMessage);
    
    // Confirmer au créateur (évite les doublons)
    socket.emit("message:created", newMessage);
    
  } catch (error) {
    console.error("Erreur handleMessageSend:", error);
    socket.emit("error", { message: "Impossible d'envoyer le message" });
  }
}

export default handleMessageSend;