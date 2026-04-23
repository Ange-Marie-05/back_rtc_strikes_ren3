async function handleDMTypingStop(socket, { receiverId }, io) {
  for (const [, s] of io.sockets.sockets) {
    if (s.userId === receiverId) {
      s.emit("dm:typing:stop", {
        senderId: socket.userId,
      });
      break;
    }
  }
}

export default handleDMTypingStop;