async function handleUserConnected(socket, io) {
  io.emit('presence:user_connected', { userId: socket.userId });
}

export default handleUserConnected;