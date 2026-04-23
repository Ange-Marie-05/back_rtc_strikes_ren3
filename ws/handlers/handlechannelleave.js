async function handleChannelLeave(socket, { channelId }) {
  socket.leave(`channel:${channelId}`);
  socket.emit("channel:left", { channelId });
  console.log(`Socket ${socket.id} quitte channel:${channelId}`);
}

export default handleChannelLeave;