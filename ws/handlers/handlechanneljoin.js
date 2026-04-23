async function handleChannelJoin(socket, { channelId }) {
  socket.join(`channel:${channelId}`);
  socket.emit("channel:joined", { channelId });
  console.log(`Socket ${socket.id} rejoint channel:${channelId}`);
}

export default handleChannelJoin;