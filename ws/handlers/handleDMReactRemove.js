import * as reactsModel from "../../models/reacts.models.js";

async function handleDMReactRemove(socket, { reactId, dmId, receiverId }, io) {
  try {
    await reactsModel.deleteReactDM(reactId);

    socket.emit("react:removed", { reactId, messageId: dmId });
    for (const [, s] of io.sockets.sockets) {
      if (s.userId === receiverId) {
        s.emit("react:removed", { reactId, messageId: dmId });
        break;
      }
    }
  } catch (error) {
    console.error("Erreur handleDMReactRemove:", error);
    socket.emit("error", { message: "Impossible de supprimer la réaction" });
  }
}

export default handleDMReactRemove;