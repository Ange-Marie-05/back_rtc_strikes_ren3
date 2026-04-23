import { test, expect, describe, beforeEach, mock } from "bun:test";

// --------------------
// Prisma mocks
// --------------------

const mockChannelFindUnique = mock(() => null);
const mockServerMemberFindUnique = mock(() => null);
const mockMessageCreate = mock(() => ({}));
const mockMessageFindMany = mock(() => []);
const mockMessageFindUnique = mock(() => null);
const mockMessageDelete = mock(() => ({}));
const mockMessageUpdate = mock(() => ({}));

mock.module("../../config/prisma.js", () => ({
  default: {
    channel: {
      findUnique: mockChannelFindUnique,
    },
    serverMember: {
      findUnique: mockServerMemberFindUnique,
    },
    message: {
      create: mockMessageCreate,
      findMany: mockMessageFindMany,
      findUnique: mockMessageFindUnique,
      delete: mockMessageDelete,
      update: mockMessageUpdate,
    },
  },
}));

import {
  createMessage,
  getMessagesByChannel,
  deleteMessage,
  editMessage,
} from "../../models/messages.models.js";

// --------------------
// Helpers
// --------------------

function resetAllMocks() {
  mockChannelFindUnique.mockReset();
  mockServerMemberFindUnique.mockReset();
  mockMessageCreate.mockReset();
  mockMessageFindMany.mockReset();
  mockMessageFindUnique.mockReset();
  mockMessageDelete.mockReset();
  mockMessageUpdate.mockReset();

  mockChannelFindUnique.mockResolvedValue(null);
  mockServerMemberFindUnique.mockResolvedValue(null);
  mockMessageCreate.mockResolvedValue({});
  mockMessageFindMany.mockResolvedValue([]);
  mockMessageFindUnique.mockResolvedValue(null);
  mockMessageDelete.mockResolvedValue({});
  mockMessageUpdate.mockResolvedValue({});
}

beforeEach(() => {
  resetAllMocks();
});

// ========================================
// createMessage
// ========================================

describe("createMessage", () => {
  test("refuse un contenu vide", async () => {
    await expect(createMessage("user-1", "channel-1", "", false)).rejects.toMatchObject({
      type: "MESSAGE_CONTENT_EMPTY",
    });
  });

  test("refuse un contenu avec seulement des espaces", async () => {
    await expect(createMessage("user-1", "channel-1", "   ", false)).rejects.toMatchObject({
      type: "MESSAGE_CONTENT_EMPTY",
    });
  });

  test("refuse un contenu trop long", async () => {
    await expect(
      createMessage("user-1", "channel-1", "a".repeat(2001), false)
    ).rejects.toMatchObject({
      type: "MESSAGE_INVALID_CONTENT",
    });
  });

  test("refuse si le channel n'existe pas", async () => {
    mockChannelFindUnique.mockResolvedValue(null);

    await expect(createMessage("user-1", "channel-1", "Hello", false)).rejects.toMatchObject({
      type: "CHANNEL_NOT_FOUND",
    });

    expect(mockChannelFindUnique).toHaveBeenCalledWith({
      where: { id: "channel-1" },
      select: { id: true, serverId: true },
    });
  });

  test("refuse si l'utilisateur n'est pas membre du serveur", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue(null);

    await expect(createMessage("user-1", "channel-1", "Hello", false)).rejects.toMatchObject({
      type: "USER_NOT_MEMBER",
    });

    expect(mockServerMemberFindUnique).toHaveBeenCalledWith({
      where: {
        userId_serverId: {
          userId: "user-1",
          serverId: "server-1",
        },
      },
    });
  });

  test("crée un message si tout est valide", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue({
      userId: "user-1",
      serverId: "server-1",
      role: "Member",
    });
    mockMessageCreate.mockResolvedValue({
      id: "msg-1",
      content: "Hello world",
      isGif: false,
      userId: "user-1",
      channelId: "channel-1",
      user: {
        id: "user-1",
        username: "Alice",
      },
      reacts: [],
    });

    const result = await createMessage("user-1", "channel-1", "Hello world", false);

    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: {
        content: "Hello world",
        userId: "user-1",
        channelId: "channel-1",
        isGif: false,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        reacts: true,
      },
    });

    expect(result).toEqual({
      id: "msg-1",
      content: "Hello world",
      isGif: false,
      userId: "user-1",
      channelId: "channel-1",
      user: {
        id: "user-1",
        username: "Alice",
      },
      reacts: [],
    });
  });

  test("trim le contenu avant création", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue({
      userId: "user-1",
      serverId: "server-1",
      role: "Member",
    });
    mockMessageCreate.mockResolvedValue({
      id: "msg-1",
      content: "Hello trimmed",
    });

    await createMessage("user-1", "channel-1", "   Hello trimmed   ", false);

    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "Hello trimmed",
        }),
      })
    );
  });

  test("transmet isGif=true correctement", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue({
      userId: "user-1",
      serverId: "server-1",
      role: "Member",
    });
    mockMessageCreate.mockResolvedValue({
      id: "msg-gif",
      content: "gif",
      isGif: true,
    });

    await createMessage("user-1", "channel-1", "gif", true);

    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isGif: true,
        }),
      })
    );
  });
});

// ========================================
// getMessagesByChannel
// ========================================

describe("getMessagesByChannel", () => {
  test("refuse si le channel n'existe pas", async () => {
    mockChannelFindUnique.mockResolvedValue(null);

    await expect(getMessagesByChannel("channel-1", 50, "user-1")).rejects.toMatchObject({
      type: "CHANNEL_NOT_FOUND",
    });
  });

  test("refuse si l'utilisateur n'est pas membre du serveur", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue(null);

    await expect(getMessagesByChannel("channel-1", 50, "user-1")).rejects.toMatchObject({
      type: "USER_NOT_MEMBER",
    });
  });

  test("retourne les messages avec rôle et userId", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Admin",
    });
    mockMessageFindMany.mockResolvedValue([
      {
        id: "msg-1",
        content: "Hello",
        user: { id: "user-1", username: "Alice" },
        reacts: [],
      },
    ]);

    const result = await getMessagesByChannel("channel-1", 10, "user-1");

    expect(mockMessageFindMany).toHaveBeenCalledWith({
      where: { channelId: "channel-1" },
      take: 10,
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        reacts: true,
      },
    });

    expect(result).toEqual({
      messages: [
        {
          id: "msg-1",
          content: "Hello",
          user: { id: "user-1", username: "Alice" },
          reacts: [],
        },
      ],
      userRole: "Admin",
      userId: "user-1",
    });
  });

  test("utilise bien la limite par défaut", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Member",
    });
    mockMessageFindMany.mockResolvedValue([]);

    await getMessagesByChannel("channel-1", undefined, "user-1");

    expect(mockMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    );
  });
});

// ========================================
// deleteMessage
// ========================================

describe("deleteMessage", () => {
  test("refuse si le message n'existe pas", async () => {
    mockMessageFindUnique.mockResolvedValue(null);

    await expect(deleteMessage("user-1", "msg-1")).rejects.toMatchObject({
      type: "MESSAGE_NOT_FOUND",
    });
  });

  test("autorise l'auteur à supprimer son message", async () => {
    mockMessageFindUnique.mockResolvedValue({
      id: "msg-1",
      userId: "user-1",
      channelId: "channel-1",
      channel: {
        id: "channel-1",
        serverId: "server-1",
      },
    });
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Member",
    });
    mockMessageDelete.mockResolvedValue({});

    const result = await deleteMessage("user-1", "msg-1");

    expect(mockMessageDelete).toHaveBeenCalledWith({
      where: { id: "msg-1" },
    });

    expect(result).toEqual({
      id: "msg-1",
      channelId: "channel-1",
    });
  });

  test("autorise un Admin à supprimer un message", async () => {
    mockMessageFindUnique.mockResolvedValue({
      id: "msg-1",
      userId: "other-user",
      channelId: "channel-1",
      channel: {
        id: "channel-1",
        serverId: "server-1",
      },
    });
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Admin",
    });
    mockMessageDelete.mockResolvedValue({});

    const result = await deleteMessage("user-1", "msg-1");

    expect(result).toEqual({
      id: "msg-1",
      channelId: "channel-1",
    });
  });

  test("autorise un Owner à supprimer un message", async () => {
    mockMessageFindUnique.mockResolvedValue({
      id: "msg-1",
      userId: "other-user",
      channelId: "channel-1",
      channel: {
        id: "channel-1",
        serverId: "server-1",
      },
    });
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Owner",
    });
    mockMessageDelete.mockResolvedValue({});

    const result = await deleteMessage("user-1", "msg-1");

    expect(result).toEqual({
      id: "msg-1",
      channelId: "channel-1",
    });
  });

  test("refuse un membre simple non auteur", async () => {
    mockMessageFindUnique.mockResolvedValue({
      id: "msg-1",
      userId: "other-user",
      channelId: "channel-1",
      channel: {
        id: "channel-1",
        serverId: "server-1",
      },
    });
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Member",
    });

    await expect(deleteMessage("user-1", "msg-1")).rejects.toMatchObject({
      type: "MESSAGE_UNAUTHORIZED_DELETE",
    });
  });
});

// ========================================
// editMessage
// ========================================

describe("editMessage", () => {
  test("refuse un contenu vide", async () => {
    await expect(editMessage("user-1", "msg-1", "")).rejects.toMatchObject({
      type: "MESSAGE_CONTENT_EMPTY",
    });
  });

  test("refuse un contenu avec seulement des espaces", async () => {
    await expect(editMessage("user-1", "msg-1", "   ")).rejects.toMatchObject({
      type: "MESSAGE_CONTENT_EMPTY",
    });
  });

  test("refuse un contenu trop long", async () => {
    await expect(
      editMessage("user-1", "msg-1", "a".repeat(2001))
    ).rejects.toMatchObject({
      type: "MESSAGE_INVALID_CONTENT",
    });
  });

  test("refuse si le message n'existe pas", async () => {
    mockMessageFindUnique.mockResolvedValue(null);

    await expect(editMessage("user-1", "msg-1", "edited")).rejects.toMatchObject({
      type: "MESSAGE_NOT_FOUND",
    });
  });

  test("refuse si l'utilisateur n'est pas l'auteur", async () => {
    mockMessageFindUnique.mockResolvedValue({
      id: "msg-1",
      userId: "other-user",
      channelId: "channel-1",
      channel: {
        id: "channel-1",
        serverId: "server-1",
      },
    });

    await expect(editMessage("user-1", "msg-1", "edited")).rejects.toMatchObject({
      type: "MESSAGE_UNAUTHORIZED_EDIT",
    });
  });

  test("met à jour le message avec isEdited=true", async () => {
    mockMessageFindUnique.mockResolvedValue({
      id: "msg-1",
      userId: "user-1",
      channelId: "channel-1",
      channel: {
        id: "channel-1",
        serverId: "server-1",
      },
    });

    mockMessageUpdate.mockResolvedValue({
      id: "msg-1",
      content: "edited",
      isEdited: true,
      user: {
        id: "user-1",
        username: "Alice",
      },
      reacts: [],
    });

    const result = await editMessage("user-1", "msg-1", "edited");

    expect(mockMessageUpdate).toHaveBeenCalledWith({
      where: { id: "msg-1" },
      data: {
        content: "edited",
        isEdited: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        reacts: true,
      },
    });

    expect(result).toEqual({
      id: "msg-1",
      content: "edited",
      isEdited: true,
      user: {
        id: "user-1",
        username: "Alice",
      },
      reacts: [],
      channelId: "channel-1",
    });
  });

  test("trim le contenu avant update", async () => {
    mockMessageFindUnique.mockResolvedValue({
      id: "msg-1",
      userId: "user-1",
      channelId: "channel-1",
      channel: {
        id: "channel-1",
        serverId: "server-1",
      },
    });

    mockMessageUpdate.mockResolvedValue({
      id: "msg-1",
      content: "edited clean",
      isEdited: true,
      user: {
        id: "user-1",
        username: "Alice",
      },
      reacts: [],
    });

    await editMessage("user-1", "msg-1", "   edited clean   ");

    expect(mockMessageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "edited clean",
        }),
      })
    );
  });
});