import * as reactsModel from "../../models/reacts.models.js";

async function handleDMReactAdd(socket, { dmId, emoji, receiverId }, io) {
  try {
    const react = await reactsModel.createReactDM(socket.userId, dmId, emoji);
    
    // Émettre aux deux participants
    socket.emit("react:added", { react, messageId: dmId });
    for (const [, s] of io.sockets.sockets) {
      if (s.userId === receiverId) {
        s.emit("react:added", { react, messageId: dmId });
        break;
      }
    }
  } catch (error) {
    console.error("Erreur handleDMReactAdd:", error);
    socket.emit("error", { message: "Impossible d'ajouter la réaction" });
  }
}

export default handleDMReactAdd;