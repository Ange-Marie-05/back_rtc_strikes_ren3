async function handleGetGlobalOnline(socket, io) {
  const onlineUserIds = [];
  for (const [, s] of io.sockets.sockets) {
    if (s.userId && !onlineUserIds.includes(s.userId)) {
      onlineUserIds.push(s.userId);
    }
  }
  socket.emit('presence:global_online_list', { userIds: onlineUserIds });
}

export default handleGetGlobalOnline;