async function handleDisconnect(socket, io) {
  const userId = socket.userId;
  if (!userId) return;

  const activeRooms = [...socket.rooms].filter((r) =>
    r.startsWith("active_server:")
  );

  activeRooms.forEach((room) => {
    const serverId = room.replace("active_server:", "");

    const socketsInRoom = io.sockets.adapter.rooms.get(room);
    const onlineUserIds = [];

    if (socketsInRoom) {
      for (const socketId of socketsInRoom) {
        if (socketId === socket.id) continue;

        const s = io.sockets.sockets.get(socketId);
        if (s?.userId && !onlineUserIds.includes(s.userId)) {
          onlineUserIds.push(s.userId);
        }
      }
    }

    io.to(room).emit("presence:online_list", {
      serverId,
      userIds: onlineUserIds,
    });
  });

  console.log(`User ${userId} déconnecté`);
}

export default handleDisconnect;