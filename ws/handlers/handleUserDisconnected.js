async function handleUserDisconnected(socket, io) {
  io.emit('presence:user_disconnected', { userId: socket.userId });
}

export default handleUserDisconnected;