import * as dmModel from "../../models/dm.models.js";

async function handleDMSend(socket, {receiverId, content,isGif}, io) {
    try {
        const senderId = socket.userId;

        const message = await dmModel.createDirectMessage(senderId, receiverId, content, isGif);
        console.log(`DM créé : `, message.id);

        // Trouver le socket du récepteur et émettre dm:send
        for (const [, receiverSocket] of io.sockets.sockets) {
            if (receiverSocket.userId === receiverId) {
                receiverSocket.emit("dm:new", message);
                break;
            }
        }

        // Confirmation d'envoi
        socket.emit("dm:created", message);
    } catch(error) {
        console.error('Erreur handleDMSend : ', error);
        socket.emit("error", { message: "Impossible d'envoyer le message"});
    }
}

export default handleDMSend;