import * as reactsModel from "../../models/reacts.models.js";

async function handleReactRemove(socket, { reactId, messageId, channelId }, io) {
  try {
    await reactsModel.deleteReact(reactId);
    io.to(`channel:${channelId}`).emit("react:removed", { reactId, messageId });
  } catch (error) {
    console.error("Erreur handleReactRemove:", error);
    socket.emit("error", { message: "Impossible de supprimer la réaction" });
  }
}

export default handleReactRemove;