// handleUserConnected.js
async function handleUserConnected(socket, io) {
  if (!socket.userId) return;
  io.emit('presence:user_connected', { userId: socket.userId });
}
export default handleUserConnected;