import { mock, describe, beforeEach, afterEach, test, expect, spyOn } from "bun:test";

const mockUserFindUnique = mock(() => null);
const mockGetUsername = mock(() => null);
const mockGetUsersServers = mock(() => []);

mock.module("../../config/prisma.js", () => ({
  default: {
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

mock.module("../../ws/getusername.js", () => ({
  default: mockGetUsername,
}));

mock.module("../../ws/getusersservers.js", () => ({
  getUsersServers: mockGetUsersServers,
}));

import * as messagesModel from "../../models/messages.models.js";
import * as dmModel from "../../models/dm.models.js";
import * as reactsModel from "../../models/reacts.models.js";

import { handleJoinUsersServers } from "../../ws/handlers/handlejoinusersservers.js";
import handleDisconnect from "../../ws/handlers/handleDisconnect.js";
import handleMessageSend from "../../ws/handlers/handleMessageSend.js";
import handleMessageDelete from "../../ws/handlers/handleMessageDelete.js";
import handleMessageEdit from "../../ws/handlers/handleMessageEdit.js";
import handleTypingStart from "../../ws/handlers/handletypingstart.js";
import handleTypingStop from "../../ws/handlers/handletypingstop.js";
import handleChannelJoin from "../../ws/handlers/handlechanneljoin.js";
import handleChannelLeave from "../../ws/handlers/handlechannelleave.js";
import handleUserConnected from "../../ws/handlers/handleUserConnected.js";
import handleUserDisconnected from "../../ws/handlers/handleUserDisconnected.js";
import handleGetGlobalOnline from "../../ws/handlers/handleGetGlobalOnline.js";
import handleDMSend from "../../ws/handlers/handleDMSend.js";
import handleDMDelete from "../../ws/handlers/handleDMDelete.js";
import handleDMEdit from "../../ws/handlers/handleDMEdit.js";
import handleDMReactAdd from "../../ws/handlers/handleDMReactAdd.js";
import handleDMReactRemove from "../../ws/handlers/handleDMReactRemove.js";
import handleDMTypingStart from "../../ws/handlers/handleDMTypingStart.js";
import handleDMTypingStop from "../../ws/handlers/handleDMTypingStop.js";
import handleReactAdd from "../../ws/handlers/handleReactAdd.js";
import handleReactRemove from "../../ws/handlers/handleReactRemove.js";

function resetAllMocks() {
  mockUserFindUnique.mockReset();
  mockGetUsername.mockReset();
  mockGetUsersServers.mockReset();

  mockUserFindUnique.mockReturnValue(null);
  mockGetUsername.mockReturnValue(null);
  mockGetUsersServers.mockReturnValue([]);
}

beforeEach(() => {
  mock.restore();
  resetAllMocks();
});

afterEach(() => {
  mock.restore();
});

// ========================================
// handleJoinUsersServers
// ========================================

describe("handleJoinUsersServers", () => {
  test("rejoint tous les serveurs de l'utilisateur", async () => {
    const mockJoin = mock(() => {});
    const mockSocket = {
      userId: "user123",
      join: mockJoin,
    };

    mockGetUsersServers.mockResolvedValue([
      { id: "server1", name: "Server 1" },
      { id: "server2", name: "Server 2" },
    ]);

    await handleJoinUsersServers(mockSocket, {});

    expect(mockGetUsersServers).toHaveBeenCalledWith("user123");
    expect(mockJoin).toHaveBeenCalledWith("server:server1");
    expect(mockJoin).toHaveBeenCalledWith("server:server2");
  });

  test("ne fait rien si l'utilisateur n'a aucun serveur", async () => {
    const mockJoin = mock(() => {});
    const mockSocket = {
      userId: "user123",
      join: mockJoin,
    };

    mockGetUsersServers.mockResolvedValue([]);

    await handleJoinUsersServers(mockSocket, {});

    expect(mockJoin).not.toHaveBeenCalled();
  });
});

// ========================================
// handleDisconnect
// ========================================

describe("handleDisconnect", () => {
  test("émet presence:online_list uniquement vers les rooms active_server", async () => {
    const mockEmit = mock(() => {});
    const mockTo = mock(() => ({ emit: mockEmit }));

    const socketId = "socket-id";
    const socketsMap = new Map([
      ["socket-id", { id: "socket-id", userId: "user123" }],
      ["other-socket", { id: "other-socket", userId: "user456" }],
    ]);

    const roomsMap = new Map([
      ["active_server:server1", new Set(["socket-id", "other-socket"])],
      ["active_server:server2", new Set(["socket-id"])],
    ]);

    const mockIo = {
      to: mockTo,
      sockets: {
        adapter: {
          rooms: roomsMap,
        },
        sockets: socketsMap,
      },
    };

    const mockSocket = {
      id: socketId,
      userId: "user123",
      rooms: new Set([
        "socket-id",
        "active_server:server1",
        "active_server:server2",
        "server:server1",
        "channel:channel1",
      ]),
    };

    await handleDisconnect(mockSocket, mockIo);

    expect(mockTo).toHaveBeenCalledWith("active_server:server1");
    expect(mockTo).toHaveBeenCalledWith("active_server:server2");
    expect(mockEmit).toHaveBeenCalledWith("presence:online_list", {
      serverId: "server1",
      userIds: ["user456"],
    });
    expect(mockEmit).toHaveBeenCalledWith("presence:online_list", {
      serverId: "server2",
      userIds: [],
    });
  });

  test("n'émet rien si userId est absent", async () => {
    const mockEmit = mock(() => {});
    const mockTo = mock(() => ({ emit: mockEmit }));
    const mockSocket = {
      userId: null,
      rooms: new Set(["active_server:server1"]),
    };

    await handleDisconnect(mockSocket, { to: mockTo });

    expect(mockTo).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ========================================
// handleMessageSend
// ========================================

describe("handleMessageSend", () => {
  test("émet message:new aux autres et message:created à l'émetteur", async () => {
    const mockEmitToOthers = mock(() => {});
    const mockEmitToSelf = mock(() => {});
    const mockSocketTo = mock(() => ({ emit: mockEmitToOthers }));
    const mockSocket = {
      to: mockSocketTo,
      emit: mockEmitToSelf,
      userId: "user1",
    };

    const createMessageSpy = spyOn(messagesModel, "createMessage").mockResolvedValue({
      id: "msg123",
      content: "Hello",
      isGif: false,
      userId: "user1",
      channelId: "room1",
      createdAt: new Date(),
      user: { id: "user1", username: "John" },
    });

    await handleMessageSend(
      mockSocket,
      { content: "Hello", channelId: "room1", isGif: false },
      {}
    );

    expect(createMessageSpy).toHaveBeenCalledWith("user1", "room1", "Hello", false);
    expect(mockSocketTo).toHaveBeenCalledWith("channel:room1");
    expect(mockEmitToOthers).toHaveBeenCalledWith(
      "message:new",
      expect.objectContaining({ id: "msg123" })
    );
    expect(mockEmitToSelf).toHaveBeenCalledWith(
      "message:created",
      expect.objectContaining({ id: "msg123" })
    );
  });

  test("gère aussi un message gif", async () => {
    const mockEmitToOthers = mock(() => {});
    const mockEmitToSelf = mock(() => {});
    const mockSocketTo = mock(() => ({ emit: mockEmitToOthers }));
    const mockSocket = {
      to: mockSocketTo,
      emit: mockEmitToSelf,
      userId: "user1",
    };

    const createMessageSpy = spyOn(messagesModel, "createMessage").mockResolvedValue({
      id: "msgGif",
      content: "gif",
      isGif: true,
      userId: "user1",
      channelId: "room1",
    });

    await handleMessageSend(
      mockSocket,
      { content: "gif", channelId: "room1", isGif: true },
      {}
    );

    expect(createMessageSpy).toHaveBeenCalledWith("user1", "room1", "gif", true);
    expect(mockEmitToSelf).toHaveBeenCalledWith(
      "message:created",
      expect.objectContaining({ isGif: true })
    );
  });

  test("émet une erreur si createMessage échoue", async () => {
    spyOn(messagesModel, "createMessage").mockImplementation(() => {
      throw new Error("Database error");
    });

    const mockEmit = mock(() => {});
    const mockSocket = {
      to: mock(() => ({ emit: mock(() => {}) })),
      emit: mockEmit,
      userId: "user1",
    };

    await handleMessageSend(
      mockSocket,
      { content: "Hello", channelId: "room1", isGif: false },
      {}
    );

    expect(mockEmit).toHaveBeenCalledWith("error", {
      message: "Impossible d'envoyer le message",
    });
  });
});

// ========================================
// handleMessageDelete
// ========================================

describe("handleMessageDelete", () => {
  test("émet message:deleted à tout le channel", async () => {
    const mockEmit = mock(() => {});
    const mockTo = mock(() => ({ emit: mockEmit }));
    const mockIo = { to: mockTo };
    const mockSocket = {
      userId: "user1",
      emit: mock(() => {}),
    };

    const deleteMessageSpy = spyOn(messagesModel, "deleteMessage").mockResolvedValue({
      id: "msg123",
      channelId: "room1",
    });

    await handleMessageDelete(mockSocket, { messageId: "msg123" }, mockIo);

    expect(deleteMessageSpy).toHaveBeenCalledWith("user1", "msg123");
    expect(mockTo).toHaveBeenCalledWith("channel:room1");
    expect(mockEmit).toHaveBeenCalledWith("message:deleted", {
      messageId: "msg123",
    });
  });

  test("émet une erreur si deleteMessage échoue", async () => {
    spyOn(messagesModel, "deleteMessage").mockImplementation(() => {
      throw new Error("Unauthorized");
    });

    const mockEmit = mock(() => {});
    const mockSocket = {
      userId: "user1",
      emit: mockEmit,
    };

    await handleMessageDelete(
      mockSocket,
      { messageId: "msg123" },
      { to: mock(() => ({ emit: mock(() => {}) })) }
    );

    expect(mockEmit).toHaveBeenCalledWith("error", {
      message: "Impossible de supprimer le message",
    });
  });
});

// ========================================
// handleMessageEdit
// ========================================

describe("handleMessageEdit", () => {
  test("émet message:edited à tout le channel", async () => {
    const mockEmit = mock(() => {});
    const mockTo = mock(() => ({ emit: mockEmit }));
    const mockIo = { to: mockTo };
    const mockSocket = {
      userId: "user1",
      emit: mock(() => {}),
    };

    const editMessageSpy = spyOn(messagesModel, "editMessage").mockResolvedValue({
      id: "msg123",
      content: "edited",
      channelId: "room1",
    });

    await handleMessageEdit(
      mockSocket,
      { messageId: "msg123", content: "edited" },
      mockIo
    );

    expect(editMessageSpy).toHaveBeenCalledWith("user1", "msg123", "edited");
    expect(mockTo).toHaveBeenCalledWith("channel:room1");
    expect(mockEmit).toHaveBeenCalledWith("message:edited", {
      id: "msg123",
      content: "edited",
      channelId: "room1",
    });
  });

  test("émet une erreur si editMessage échoue", async () => {
    spyOn(messagesModel, "editMessage").mockImplementation(() => {
      throw new Error("DB error");
    });

    const mockEmit = mock(() => {});
    const mockSocket = {
      userId: "user1",
      emit: mockEmit,
    };

    await handleMessageEdit(
      mockSocket,
      { messageId: "msg123", content: "edited" },
      { to: mock(() => ({ emit: mock(() => {}) })) }
    );

    expect(mockEmit).toHaveBeenCalledWith("error", {
      message: "Impossible d'éditer le message",
    });
  });
});

// ========================================
// handleTypingStart / Stop
// ========================================

describe("handleTypingStart", () => {
  test("émet typing:user aux autres dans le channel", async () => {
    const mockEmit = mock(() => {});
    const mockSocketTo = mock(() => ({ emit: mockEmit }));
    const mockSocket = {
      to: mockSocketTo,
      userId: "user1",
    };

    mockGetUsername.mockResolvedValue("John");

    await handleTypingStart(mockSocket, { channelId: "room1" }, {});

    expect(mockGetUsername).toHaveBeenCalledWith("user1");
    expect(mockSocketTo).toHaveBeenCalledWith("channel:room1");
    expect(mockEmit).toHaveBeenCalledWith("typing:user", {
      username: "John",
      channelId: "room1",
    });
  });

  test("n'émet rien si username est null", async () => {
    const mockEmit = mock(() => {});
    const mockSocketTo = mock(() => ({ emit: mockEmit }));
    const mockSocket = {
      to: mockSocketTo,
      userId: "user1",
    };

    mockGetUsername.mockResolvedValue(null);

    await handleTypingStart(mockSocket, { channelId: "room1" }, {});

    expect(mockSocketTo).not.toHaveBeenCalled();
  });
});

describe("handleTypingStop", () => {
  test("émet typing:stop aux autres dans le channel", async () => {
    const mockEmit = mock(() => {});
    const mockSocketTo = mock(() => ({ emit: mockEmit }));
    const mockSocket = {
      to: mockSocketTo,
    };

    await handleTypingStop(mockSocket, { channelId: "room1" }, {});

    expect(mockSocketTo).toHaveBeenCalledWith("channel:room1");
    expect(mockEmit).toHaveBeenCalledWith("typing:stop", {
      channelId: "room1",
    });
  });
});

// ========================================
// handleChannelJoin / Leave
// ========================================

describe("handleChannelJoin", () => {
  test("rejoint le channel et émet channel:joined", async () => {
    const mockJoin = mock(() => {});
    const mockEmit = mock(() => {});
    const mockSocket = {
      join: mockJoin,
      emit: mockEmit,
      id: "socket-1",
    };

    await handleChannelJoin(mockSocket, { channelId: "room1" }, {});

    expect(mockJoin).toHaveBeenCalledWith("channel:room1");
    expect(mockEmit).toHaveBeenCalledWith("channel:joined", {
      channelId: "room1",
    });
  });
});

describe("handleChannelLeave", () => {
  test("quitte le channel et émet channel:left", async () => {
    const mockLeave = mock(() => {});
    const mockEmit = mock(() => {});
    const mockSocket = {
      leave: mockLeave,
      emit: mockEmit,
      id: "socket-1",
    };

    await handleChannelLeave(mockSocket, { channelId: "room1" });

    expect(mockLeave).toHaveBeenCalledWith("channel:room1");
    expect(mockEmit).toHaveBeenCalledWith("channel:left", {
      channelId: "room1",
    });
  });
});

// ========================================
// Presence / connected
// ========================================

describe("handleUserConnected", () => {
  test("émet presence:user_connected avec l'userId du socket", async () => {
    const mockEmit = mock(() => {});
    const mockIo = { emit: mockEmit };
    const mockSocket = { userId: "user1" };

    await handleUserConnected(mockSocket, mockIo);

    expect(mockEmit).toHaveBeenCalledWith("presence:user_connected", {
      userId: "user1",
    });
  });

  test("n'émet rien si userId est absent", async () => {
    const mockEmit = mock(() => {});
    const mockIo = { emit: mockEmit };
    const mockSocket = { userId: null };

    await handleUserConnected(mockSocket, mockIo);

    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe("handleUserDisconnected", () => {
  test("émet presence:user_disconnected", async () => {
    const mockEmit = mock(() => {});
    const mockIo = { emit: mockEmit };
    const mockSocket = { userId: "user1" };

    await handleUserDisconnected(mockSocket, mockIo);

    expect(mockEmit).toHaveBeenCalledWith("presence:user_disconnected", {
      userId: "user1",
    });
  });
});

describe("handleGetGlobalOnline", () => {
  test("émet la liste globale des users connectés sans doublons", async () => {
    const mockEmit = mock(() => {});
    const mockSocket = { emit: mockEmit };
    const mockIo = {
      sockets: {
        sockets: new Map([
          ["s1", { userId: "u1" }],
          ["s2", { userId: "u2" }],
          ["s3", { userId: "u1" }],
          ["s4", {}],
        ]),
      },
    };

    await handleGetGlobalOnline(mockSocket, mockIo);

    expect(mockEmit).toHaveBeenCalledWith("presence:global_online_list", {
      userIds: ["u1", "u2"],
    });
  });
});

// ========================================
// DM handlers
// ========================================

describe("handleDMSend", () => {
  test("envoie dm:new au récepteur et dm:created à l'émetteur", async () => {
    const receiverEmit = mock(() => {});
    const senderEmit = mock(() => {});
    const mockSocket = {
      userId: "sender1",
      emit: senderEmit,
    };
    const mockIo = {
      sockets: {
        sockets: new Map([
          ["s1", { userId: "receiver1", emit: receiverEmit }],
        ]),
      },
    };

    const createDirectMessageSpy = spyOn(dmModel, "createDirectMessage").mockResolvedValue({
      id: "dm1",
      senderId: "sender1",
      receiverId: "receiver1",
      content: "hello",
      isGif: false,
    });

    await handleDMSend(
      mockSocket,
      { receiverId: "receiver1", content: "hello", isGif: false },
      mockIo
    );

    expect(createDirectMessageSpy).toHaveBeenCalledWith(
      "sender1",
      "receiver1",
      "hello",
      false
    );
    expect(receiverEmit).toHaveBeenCalledWith(
      "dm:new",
      expect.objectContaining({ id: "dm1" })
    );
    expect(senderEmit).toHaveBeenCalledWith(
      "dm:created",
      expect.objectContaining({ id: "dm1" })
    );
  });

  test("émet une erreur si createDirectMessage échoue", async () => {
    spyOn(dmModel, "createDirectMessage").mockImplementation(() => {
      throw new Error("DB error");
    });

    const senderEmit = mock(() => {});
    const mockSocket = {
      userId: "sender1",
      emit: senderEmit,
    };

    await handleDMSend(
      mockSocket,
      { receiverId: "receiver1", content: "hello", isGif: false },
      { sockets: { sockets: new Map() } }
    );

    expect(senderEmit).toHaveBeenCalledWith("error", {
      message: "Impossible d'envoyer le message",
    });
  });
});

describe("handleDMDelete", () => {
  test("émet dm:deleted au sender et au receiver", async () => {
    const senderEmit = mock(() => {});
    const receiverEmit = mock(() => {});
    const mockSocket = {
      userId: "sender1",
      emit: senderEmit,
    };
    const mockIo = {
      sockets: {
        sockets: new Map([
          ["s1", { userId: "receiver1", emit: receiverEmit }],
        ]),
      },
    };

    const deleteDirectMessageSpy = spyOn(dmModel, "deleteDirectMessage").mockResolvedValue({
      messageId: "dm1",
      receiverId: "receiver1",
    });

    await handleDMDelete(mockSocket, { messageId: "dm1" }, mockIo);

    expect(deleteDirectMessageSpy).toHaveBeenCalledWith("sender1", "dm1");
    expect(senderEmit).toHaveBeenCalledWith("dm:deleted", { messageId: "dm1" });
    expect(receiverEmit).toHaveBeenCalledWith("dm:deleted", { messageId: "dm1" });
  });

  test("émet une erreur si deleteDirectMessage échoue", async () => {
    spyOn(dmModel, "deleteDirectMessage").mockImplementation(() => {
      throw new Error("DB error");
    });

    const senderEmit = mock(() => {});
    const mockSocket = {
      userId: "sender1",
      emit: senderEmit,
    };

    await handleDMDelete(mockSocket, { messageId: "dm1" }, {
      sockets: { sockets: new Map() },
    });

    expect(senderEmit).toHaveBeenCalledWith("error", {
      message: "Impossible de supprimer le message",
    });
  });
});

describe("handleDMEdit", () => {
  test("émet dm:edited au sender et au receiver", async () => {
    const senderEmit = mock(() => {});
    const receiverEmit = mock(() => {});
    const mockSocket = {
      userId: "sender1",
      emit: senderEmit,
    };
    const mockIo = {
      sockets: {
        sockets: new Map([
          ["s1", { userId: "receiver1", emit: receiverEmit }],
        ]),
      },
    };

    const editDirectMessageSpy = spyOn(dmModel, "editDirectMessage").mockResolvedValue({
      id: "dm1",
      receiverId: "receiver1",
      content: "edited",
    });

    await handleDMEdit(
      mockSocket,
      { messageId: "dm1", content: "edited" },
      mockIo
    );

    expect(editDirectMessageSpy).toHaveBeenCalledWith(
      "sender1",
      "dm1",
      "edited"
    );
    expect(senderEmit).toHaveBeenCalledWith(
      "dm:edited",
      expect.objectContaining({ id: "dm1" })
    );
    expect(receiverEmit).toHaveBeenCalledWith(
      "dm:edited",
      expect.objectContaining({ id: "dm1" })
    );
  });

  test("émet une erreur si editDirectMessage échoue", async () => {
    spyOn(dmModel, "editDirectMessage").mockImplementation(() => {
      throw new Error("DB error");
    });

    const senderEmit = mock(() => {});
    const mockSocket = {
      userId: "sender1",
      emit: senderEmit,
    };

    await handleDMEdit(
      mockSocket,
      { messageId: "dm1", content: "edited" },
      { sockets: { sockets: new Map() } }
    );

    expect(senderEmit).toHaveBeenCalledWith("error", {
      message: "Impossible d'éditer le message",
    });
  });
});

// ========================================
// DM reactions
// ========================================

describe("handleDMReactAdd", () => {
  test("émet react:added au sender et au receiver", async () => {
    const senderEmit = mock(() => {});
    const receiverEmit = mock(() => {});
    const mockSocket = {
      userId: "user1",
      emit: senderEmit,
    };
    const mockIo = {
      sockets: {
        sockets: new Map([
          ["s1", { userId: "user2", emit: receiverEmit }],
        ]),
      },
    };

    const createReactDMSpy = spyOn(reactsModel, "createReactDM").mockResolvedValue({
      id: "react1",
      emoji: "🔥",
      userId: "user1",
      dmId: "dm1",
    });

    await handleDMReactAdd(
      mockSocket,
      { dmId: "dm1", emoji: "🔥", receiverId: "user2" },
      mockIo
    );

    expect(createReactDMSpy).toHaveBeenCalledWith("user1", "dm1", "🔥");
    expect(senderEmit).toHaveBeenCalledWith("react:added", {
      react: expect.objectContaining({ id: "react1" }),
      messageId: "dm1",
    });
    expect(receiverEmit).toHaveBeenCalledWith("react:added", {
      react: expect.objectContaining({ id: "react1" }),
      messageId: "dm1",
    });
  });

  test("émet une erreur si createReactDM échoue", async () => {
    spyOn(reactsModel, "createReactDM").mockImplementation(() => {
      throw new Error("DB error");
    });

    const senderEmit = mock(() => {});
    const mockSocket = {
      userId: "user1",
      emit: senderEmit,
    };

    await handleDMReactAdd(
      mockSocket,
      { dmId: "dm1", emoji: "🔥", receiverId: "user2" },
      { sockets: { sockets: new Map() } }
    );

    expect(senderEmit).toHaveBeenCalledWith("error", {
      message: "Impossible d'ajouter la réaction",
    });
  });
});

describe("handleDMReactRemove", () => {
  test("émet react:removed au sender et au receiver", async () => {
    const senderEmit = mock(() => {});
    const receiverEmit = mock(() => {});
    const mockSocket = {
      userId: "user1",
      emit: senderEmit,
    };
    const mockIo = {
      sockets: {
        sockets: new Map([
          ["s1", { userId: "user2", emit: receiverEmit }],
        ]),
      },
    };

    const deleteReactDMSpy = spyOn(reactsModel, "deleteReactDM").mockResolvedValue({ id: "react1" });

    await handleDMReactRemove(
      mockSocket,
      { reactId: "react1", dmId: "dm1", receiverId: "user2" },
      mockIo
    );

    expect(deleteReactDMSpy).toHaveBeenCalledWith("react1");
    expect(senderEmit).toHaveBeenCalledWith("react:removed", {
      reactId: "react1",
      messageId: "dm1",
    });
    expect(receiverEmit).toHaveBeenCalledWith("react:removed", {
      reactId: "react1",
      messageId: "dm1",
    });
  });

  test("émet une erreur si deleteReactDM échoue", async () => {
    spyOn(reactsModel, "deleteReactDM").mockImplementation(() => {
      throw new Error("DB error");
    });

    const senderEmit = mock(() => {});
    const mockSocket = {
      userId: "user1",
      emit: senderEmit,
    };

    await handleDMReactRemove(
      mockSocket,
      { reactId: "react1", dmId: "dm1", receiverId: "user2" },
      { sockets: { sockets: new Map() } }
    );

    expect(senderEmit).toHaveBeenCalledWith("error", {
      message: "Impossible de supprimer la réaction",
    });
  });
});

// ========================================
// DM typing
// ========================================

describe("handleDMTypingStart", () => {
  test("émet dm:typing:user au receiver avec username et senderId", async () => {
    const receiverEmit = mock(() => {});
    const mockSocket = {
      userId: "user1",
    };
    const mockIo = {
      sockets: {
        sockets: new Map([
          ["s1", { userId: "user2", emit: receiverEmit }],
        ]),
      },
    };

    mockGetUsername.mockResolvedValue("John");

    await handleDMTypingStart(mockSocket, { receiverId: "user2" }, mockIo);

    expect(mockGetUsername).toHaveBeenCalledWith("user1");
    expect(receiverEmit).toHaveBeenCalledWith("dm:typing:user", {
      username: "John",
      senderId: "user1",
    });
  });

  test("gère une erreur si getUsername échoue", async () => {
    mockGetUsername.mockImplementation(() => {
      throw new Error("DB error");
    });

    const mockEmit = mock(() => {});
    const receiverSocket = {
      userId: "user-2",
      emit: mockEmit,
    };

    const mockIo = {
      sockets: {
        sockets: new Map([["socket-2", receiverSocket]]),
      },
    };

    const mockSocket = {
      userId: "user-1",
    };

    const mockConsoleError = mock(() => {});
    const originalConsoleError = console.error;
    console.error = mockConsoleError;

    await handleDMTypingStart(mockSocket, { receiverId: "user-2" }, mockIo);

    expect(mockConsoleError).toHaveBeenCalled();

    console.error = originalConsoleError;
  });

  test("n'émet rien si username est null", async () => {
    const receiverEmit = mock(() => {});
    const mockSocket = {
      userId: "user1",
    };
    const mockIo = {
      sockets: {
        sockets: new Map([
          ["s1", { userId: "user2", emit: receiverEmit }],
        ]),
      },
    };

    mockGetUsername.mockResolvedValue(null);

    await handleDMTypingStart(mockSocket, { receiverId: "user2" }, mockIo);

    expect(receiverEmit).not.toHaveBeenCalled();
  });
});

describe("handleDMTypingStop", () => {
  test("émet dm:typing:stop au receiver avec senderId", async () => {
    const receiverEmit = mock(() => {});
    const mockSocket = {
      userId: "user1",
    };
    const mockIo = {
      sockets: {
        sockets: new Map([
          ["s1", { userId: "user2", emit: receiverEmit }],
        ]),
      },
    };

    await handleDMTypingStop(mockSocket, { receiverId: "user2" }, mockIo);

    expect(receiverEmit).toHaveBeenCalledWith("dm:typing:stop", {
      senderId: "user1",
    });
  });

  test("n'émet rien si le receiver n'est pas connecté", async () => {
    const mockEmit = mock(() => {});

    const otherSocket = {
      userId: "user-3",
      emit: mockEmit,
    };

    const mockIo = {
      sockets: {
        sockets: new Map([["socket-3", otherSocket]]),
      },
    };

    const mockSocket = {
      userId: "user-1",
    };

    await handleDMTypingStop(mockSocket, { receiverId: "user-2" }, mockIo);

    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ========================================
// Channel reactions
// ========================================

describe("handleReactAdd", () => {
  test("émet react:added au channel", async () => {
    const mockEmit = mock(() => {});
    const mockTo = mock(() => ({ emit: mockEmit }));
    const mockIo = { to: mockTo };
    const mockSocket = { userId: "user1", emit: mock(() => {}) };

    const createReactSpy = spyOn(reactsModel, "createReact").mockResolvedValue({
      id: "react1",
      emoji: "🔥",
      userId: "user1",
      messageId: "msg1",
    });

    await handleReactAdd(
      mockSocket,
      { messageId: "msg1", emoji: "🔥", channelId: "room1" },
      mockIo
    );

    expect(createReactSpy).toHaveBeenCalledWith("user1", "msg1", "🔥");
    expect(mockTo).toHaveBeenCalledWith("channel:room1");
    expect(mockEmit).toHaveBeenCalledWith("react:added", {
      react: expect.objectContaining({ id: "react1" }),
      messageId: "msg1",
    });
  });

  test("émet une erreur si createReact échoue", async () => {
    spyOn(reactsModel, "createReact").mockImplementation(() => {
      throw new Error("DB error");
    });

    const senderEmit = mock(() => {});
    const mockSocket = { userId: "user1", emit: senderEmit };

    await handleReactAdd(
      mockSocket,
      { messageId: "msg1", emoji: "🔥", channelId: "room1" },
      { to: mock(() => ({ emit: mock(() => {}) })) }
    );

    expect(senderEmit).toHaveBeenCalledWith("error", {
      message: "Impossible d'ajouter la réaction",
    });
  });
});

describe("handleReactRemove", () => {
  test("émet react:removed au channel", async () => {
    const mockEmit = mock(() => {});
    const mockTo = mock(() => ({ emit: mockEmit }));
    const mockIo = { to: mockTo };
    const mockSocket = { emit: mock(() => {}) };

    const deleteReactSpy = spyOn(reactsModel, "deleteReact").mockResolvedValue({ id: "react1" });

    await handleReactRemove(
      mockSocket,
      { reactId: "react1", messageId: "msg1", channelId: "room1" },
      mockIo
    );

    expect(deleteReactSpy).toHaveBeenCalledWith("react1");
    expect(mockTo).toHaveBeenCalledWith("channel:room1");
    expect(mockEmit).toHaveBeenCalledWith("react:removed", {
      reactId: "react1",
      messageId: "msg1",
    });
  });

  test("émet une erreur si deleteReact échoue", async () => {
    spyOn(reactsModel, "deleteReact").mockImplementation(() => {
      throw new Error("DB error");
    });

    const senderEmit = mock(() => {});
    const mockSocket = { emit: senderEmit };

    await handleReactRemove(
      mockSocket,
      { reactId: "react1", messageId: "msg1", channelId: "room1" },
      { to: mock(() => ({ emit: mock(() => {}) })) }
    );

    expect(senderEmit).toHaveBeenCalledWith("error", {
      message: "Impossible de supprimer la réaction",
    });
  });
});