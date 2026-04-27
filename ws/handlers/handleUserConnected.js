// handleUserConnected.js
async function handleUserConnected(socket, io) {
  // Notifier les rooms active_server où l'user est membre
  const rooms = [...socket.rooms].filter(r => r.startsWith('server:'));
  
  for (const room of rooms) {
    const serverId = room.replace('server:', '');
    const activeRoom = `active_server:${serverId}`;
    
    const activeRoomSockets = io.sockets.adapter.rooms.get(activeRoom);
    if (!activeRoomSockets) continue;

    const onlineUserIds = [];
    for (const socketId of activeRoomSockets) {
      const s = io.sockets.sockets.get(socketId);
      if (s?.userId && !onlineUserIds.includes(s.userId)) {
        onlineUserIds.push(s.userId);
      }
    }

    if (!onlineUserIds.includes(socket.userId)) {
      onlineUserIds.push(socket.userId);
    }

    io.to(activeRoom).emit('presence:online_list', {
      serverId,
      userIds: onlineUserIds,
    });
  }
}

export default handleUserConnected;