async function handleTypingStop(socket, { channelId }, io) {
  socket.to(`channel:${channelId}`).emit("typing:stop", { channelId });
}

export default handleTypingStop;