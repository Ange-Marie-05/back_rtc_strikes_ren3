import { getUsersServers } from "../getusersservers.js";

export async function handleJoinUsersServers(socket, io) {
  const userId = socket.userId;
  const servers = await getUsersServers(userId);
  for (const server of servers) {
    socket.join(`server:${server.id}`);
    console.log(`User ${userId} rejoint server:${server.id}`);
  }
}