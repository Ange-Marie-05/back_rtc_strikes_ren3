import * as reactsModel from "../../models/reacts.models.js";

async function handleReactAdd(socket, { messageId, emoji, channelId }, io) {
  try {
    const userId = socket.userId;
    const react = await reactsModel.createReact(userId, messageId, emoji);
    io.to(`channel:${channelId}`).emit("react:added", { react, messageId });
  } catch (error) {
    console.error("Erreur handleReactAdd:", error);
    socket.emit("error", { message: "Impossible d'ajouter la réaction" });
  }
}

export default handleReactAdd;