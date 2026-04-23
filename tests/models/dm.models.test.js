import { test, expect, describe, beforeEach, mock } from "bun:test";

// --------------------
// Prisma mocks
// --------------------

const mockServerMemberFindMany = mock(() => []);
const mockUserFindUnique = mock(() => null);
const mockDirectMessageCreate = mock(() => ({}));
const mockDirectMessageFindMany = mock(() => []);
const mockDirectMessageFindUnique = mock(() => null);
const mockDirectMessageDelete = mock(() => ({}));
const mockDirectMessageUpdate = mock(() => ({}));

mock.module("../../config/prisma.js", () => ({
  default: {
    serverMember: {
      findMany: mockServerMemberFindMany,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
    directMessage: {
      create: mockDirectMessageCreate,
      findMany: mockDirectMessageFindMany,
      findUnique: mockDirectMessageFindUnique,
      delete: mockDirectMessageDelete,
      update: mockDirectMessageUpdate,
    },
  },
}));

import {
  getContacts,
  createDirectMessage,
  getDirectMessages,
  deleteDirectMessage,
  editDirectMessage,
} from "../../models/dm.models.js";

// --------------------
// Helpers
// --------------------

function resetAllMocks() {
  mockServerMemberFindMany.mockReset();
  mockUserFindUnique.mockReset();
  mockDirectMessageCreate.mockReset();
  mockDirectMessageFindMany.mockReset();
  mockDirectMessageFindUnique.mockReset();
  mockDirectMessageDelete.mockReset();
  mockDirectMessageUpdate.mockReset();

  mockServerMemberFindMany.mockResolvedValue([]);
  mockUserFindUnique.mockResolvedValue(null);
  mockDirectMessageCreate.mockResolvedValue({});
  mockDirectMessageFindMany.mockResolvedValue([]);
  mockDirectMessageFindUnique.mockResolvedValue(null);
  mockDirectMessageDelete.mockResolvedValue({});
  mockDirectMessageUpdate.mockResolvedValue({});
}

beforeEach(() => {
  resetAllMocks();
});

// ========================================
// getContacts
// ========================================

describe("getContacts", () => {
  test("retourne une liste vide si l'utilisateur n'a aucun serveur", async () => {
    mockServerMemberFindMany.mockResolvedValueOnce([]);

    const result = await getContacts("user-1");

    expect(result).toEqual([]);
    expect(mockServerMemberFindMany).toHaveBeenCalledTimes(2);
  });

  test("retourne les contacts uniques des serveurs communs", async () => {
    mockServerMemberFindMany
      .mockResolvedValueOnce([
        { serverId: "server-1" },
        { serverId: "server-2" },
      ])
      .mockResolvedValueOnce([
        {
          user: { id: "user-2", username: "Bob" },
        },
        {
          user: { id: "user-3", username: "Charlie" },
        },
      ]);

    const result = await getContacts("user-1");

    expect(result).toEqual([
      { id: "user-2", username: "Bob" },
      { id: "user-3", username: "Charlie" },
    ]);

    expect(mockServerMemberFindMany).toHaveBeenNthCalledWith(1, {
      where: { userId: "user-1" },
      select: { serverId: true },
    });

    expect(mockServerMemberFindMany).toHaveBeenNthCalledWith(2, {
      where: {
        serverId: { in: ["server-1", "server-2"] },
        userId: { not: "user-1" },
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });
  });

  test("supprime les doublons dans les contacts", async () => {
    mockServerMemberFindMany
      .mockResolvedValueOnce([
        { serverId: "server-1" },
        { serverId: "server-2" },
      ])
      .mockResolvedValueOnce([
        {
          user: { id: "user-2", username: "Bob" },
        },
        {
          user: { id: "user-2", username: "Bob" },
        },
        {
          user: { id: "user-3", username: "Charlie" },
        },
      ]);

    const result = await getContacts("user-1");

    expect(result).toEqual([
      { id: "user-2", username: "Bob" },
      { id: "user-3", username: "Charlie" },
    ]);
  });
});

// ========================================
// createDirectMessage
// ========================================

describe("createDirectMessage", () => {
  test("refuse un contenu vide", async () => {
    await expect(
      createDirectMessage("user-1", "user-2", "", false)
    ).rejects.toMatchObject({
      type: "MESSAGE_CONTENT_EMPTY",
    });
  });

  test("refuse un contenu avec seulement des espaces", async () => {
    await expect(
      createDirectMessage("user-1", "user-2", "   ", false)
    ).rejects.toMatchObject({
      type: "MESSAGE_CONTENT_EMPTY",
    });
  });

  test("refuse un contenu trop long", async () => {
    await expect(
      createDirectMessage("user-1", "user-2", "a".repeat(2001), false)
    ).rejects.toMatchObject({
      type: "MESSAGE_INVALID_CONTENT",
    });
  });

  test("refuse si le receiver n'existe pas", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      createDirectMessage("user-1", "user-2", "Hello", false)
    ).rejects.toMatchObject({
      type: "USER_NOT_FOUND",
    });

    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: "user-2" },
    });
  });

  test("crée un DM si tout est valide", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-2",
      username: "Bob",
    });

    mockDirectMessageCreate.mockResolvedValue({
      id: "dm-1",
      content: "Hello Bob",
      senderId: "user-1",
      receiverId: "user-2",
      isGif: false,
      sender: {
        id: "user-1",
        username: "Alice",
      },
      reacts: [],
    });

    const result = await createDirectMessage(
      "user-1",
      "user-2",
      "Hello Bob",
      false
    );

    expect(mockDirectMessageCreate).toHaveBeenCalledWith({
      data: {
        content: "Hello Bob",
        senderId: "user-1",
        receiverId: "user-2",
        isGif: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
          },
        },
        reacts: true,
      },
    });

    expect(result).toEqual({
      id: "dm-1",
      content: "Hello Bob",
      senderId: "user-1",
      receiverId: "user-2",
      isGif: false,
      sender: {
        id: "user-1",
        username: "Alice",
      },
      reacts: [],
    });
  });

  test("trim le contenu avant création", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-2",
      username: "Bob",
    });

    mockDirectMessageCreate.mockResolvedValue({
      id: "dm-1",
      content: "Hello trimmed",
    });

    await createDirectMessage("user-1", "user-2", "   Hello trimmed   ", false);

    expect(mockDirectMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "Hello trimmed",
        }),
      })
    );
  });

  test("transmet isGif=true correctement", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-2",
      username: "Bob",
    });

    mockDirectMessageCreate.mockResolvedValue({
      id: "dm-gif",
      content: "gif",
      isGif: true,
    });

    await createDirectMessage("user-1", "user-2", "gif", true);

    expect(mockDirectMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isGif: true,
        }),
      })
    );
  });
});

// ========================================
// getDirectMessages
// ========================================

describe("getDirectMessages", () => {
  test("retourne les messages entre deux contacts", async () => {
    mockDirectMessageFindMany.mockResolvedValue([
      {
        id: "dm-1",
        content: "Hello",
        sender: {
          id: "user-1",
          username: "Alice",
        },
        reacts: [],
      },
      {
        id: "dm-2",
        content: "Hi",
        sender: {
          id: "user-2",
          username: "Bob",
        },
        reacts: [],
      },
    ]);

    const result = await getDirectMessages("user-1", "user-2");

    expect(mockDirectMessageFindMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { senderId: "user-1", receiverId: "user-2" },
          { senderId: "user-2", receiverId: "user-1" },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: {
        sender: {
          select: { id: true, username: true },
        },
        reacts: true,
      },
    });

    expect(result).toEqual([
      {
        id: "dm-1",
        content: "Hello",
        sender: {
          id: "user-1",
          username: "Alice",
        },
        reacts: [],
      },
      {
        id: "dm-2",
        content: "Hi",
        sender: {
          id: "user-2",
          username: "Bob",
        },
        reacts: [],
      },
    ]);
  });

  test("retourne une liste vide si aucun message", async () => {
    mockDirectMessageFindMany.mockResolvedValue([]);

    const result = await getDirectMessages("user-1", "user-2");

    expect(result).toEqual([]);
  });
});

// ========================================
// deleteDirectMessage
// ========================================

describe("deleteDirectMessage", () => {
  test("refuse si le message n'existe pas", async () => {
    mockDirectMessageFindUnique.mockResolvedValue(null);

    await expect(
      deleteDirectMessage("user-1", "dm-1")
    ).rejects.toMatchObject({
      type: "MESSAGE_NOT_FOUND",
    });
  });

  test("refuse si l'utilisateur n'est pas l'auteur", async () => {
    mockDirectMessageFindUnique.mockResolvedValue({
      id: "dm-1",
      senderId: "other-user",
      receiverId: "user-2",
    });

    await expect(
      deleteDirectMessage("user-1", "dm-1")
    ).rejects.toMatchObject({
      type: "MESSAGE_UNAUTHORIZED_DELETE",
    });
  });

  test("supprime le DM si l'utilisateur est l'auteur", async () => {
    mockDirectMessageFindUnique.mockResolvedValue({
      id: "dm-1",
      senderId: "user-1",
      receiverId: "user-2",
    });

    mockDirectMessageDelete.mockResolvedValue({});

    const result = await deleteDirectMessage("user-1", "dm-1");

    expect(mockDirectMessageDelete).toHaveBeenCalledWith({
      where: { id: "dm-1" },
    });

    expect(result).toEqual({
      messageId: "dm-1",
      receiverId: "user-2",
    });
  });
});

// ========================================
// editDirectMessage
// ========================================

describe("editDirectMessage", () => {
  test("refuse un contenu vide", async () => {
    await expect(
      editDirectMessage("user-1", "dm-1", "")
    ).rejects.toMatchObject({
      type: "MESSAGE_CONTENT_EMPTY",
    });
  });

  test("refuse un contenu avec seulement des espaces", async () => {
    await expect(
      editDirectMessage("user-1", "dm-1", "   ")
    ).rejects.toMatchObject({
      type: "MESSAGE_CONTENT_EMPTY",
    });
  });

  test("refuse un contenu trop long", async () => {
    await expect(
      editDirectMessage("user-1", "dm-1", "a".repeat(2001))
    ).rejects.toMatchObject({
      type: "MESSAGE_INVALID_CONTENT",
    });
  });

  test("refuse si le message n'existe pas", async () => {
    mockDirectMessageFindUnique.mockResolvedValue(null);

    await expect(
      editDirectMessage("user-1", "dm-1", "edited")
    ).rejects.toMatchObject({
      type: "MESSAGE_NOT_FOUND",
    });
  });

  test("refuse si l'utilisateur n'est pas l'auteur", async () => {
    mockDirectMessageFindUnique.mockResolvedValue({
      id: "dm-1",
      senderId: "other-user",
      receiverId: "user-2",
    });

    await expect(
      editDirectMessage("user-1", "dm-1", "edited")
    ).rejects.toMatchObject({
      type: "MESSAGE_UNAUTHORIZED_EDIT",
    });
  });

  test("met à jour le DM si l'utilisateur est l'auteur", async () => {
    mockDirectMessageFindUnique.mockResolvedValue({
      id: "dm-1",
      senderId: "user-1",
      receiverId: "user-2",
    });

    mockDirectMessageUpdate.mockResolvedValue({
      id: "dm-1",
      content: "edited",
      sender: {
        id: "user-1",
        username: "Alice",
      },
      reacts: [],
    });

    const result = await editDirectMessage("user-1", "dm-1", "edited");

    expect(mockDirectMessageUpdate).toHaveBeenCalledWith({
      where: { id: "dm-1" },
      data: { content: "edited" },
      include: {
        sender: {
          select: { id: true, username: true },
        },
        reacts: true,
      },
    });

    expect(result).toEqual({
      id: "dm-1",
      content: "edited",
      sender: {
        id: "user-1",
        username: "Alice",
      },
      reacts: [],
      receiverId: "user-2",
    });
  });

  test("trim le contenu avant update", async () => {
    mockDirectMessageFindUnique.mockResolvedValue({
      id: "dm-1",
      senderId: "user-1",
      receiverId: "user-2",
    });

    mockDirectMessageUpdate.mockResolvedValue({
      id: "dm-1",
      content: "edited clean",
      sender: {
        id: "user-1",
        username: "Alice",
      },
      reacts: [],
    });

    await editDirectMessage("user-1", "dm-1", "   edited clean   ");

    expect(mockDirectMessageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "edited clean",
        }),
      })
    );
  });
});