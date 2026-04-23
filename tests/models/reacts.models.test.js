import { test, expect, describe, beforeEach, mock } from "bun:test";

// --------------------
// Prisma mocks
// --------------------

const mockMessageFindUnique = mock(() => null);
const mockServerMemberFindUnique = mock(() => null);
const mockReactCreate = mock(() => ({}));
const mockReactDelete = mock(() => ({}));

mock.module("../../config/prisma.js", () => ({
  default: {
    message: {
      findUnique: mockMessageFindUnique,
    },
    serverMember: {
      findUnique: mockServerMemberFindUnique,
    },
    react: {
      create: mockReactCreate,
      delete: mockReactDelete,
    },
  },
}));

import {
  createReact,
  deleteReact,
  createReactDM,
  deleteReactDM,
} from "../../models/reacts.models.js";

// --------------------
// Helpers
// --------------------

function resetAllMocks() {
  mockMessageFindUnique.mockReset();
  mockServerMemberFindUnique.mockReset();
  mockReactCreate.mockReset();
  mockReactDelete.mockReset();

  mockMessageFindUnique.mockResolvedValue(null);
  mockServerMemberFindUnique.mockResolvedValue(null);
  mockReactCreate.mockResolvedValue({});
  mockReactDelete.mockResolvedValue({});
}

beforeEach(() => {
  resetAllMocks();
});

// ========================================
// createReact
// ========================================

describe("createReact", () => {
  test("refuse si le message n'existe pas", async () => {
    mockMessageFindUnique.mockResolvedValue(null);

    await expect(createReact("user-1", "msg-1", "🔥")).rejects.toMatchObject({
      type: "MESSAGE_NOT_FOUND",
    });

    expect(mockMessageFindUnique).toHaveBeenCalledWith({
      where: { id: "msg-1" },
      include: {
        channel: {
          select: {
            id: true,
            serverId: true,
          },
        },
      },
    });
  });

  test("refuse si l'utilisateur n'est pas membre du serveur", async () => {
    mockMessageFindUnique.mockResolvedValue({
      id: "msg-1",
      channel: {
        id: "channel-1",
        serverId: "server-1",
      },
    });

    mockServerMemberFindUnique.mockResolvedValue(null);

    await expect(createReact("user-1", "msg-1", "🔥")).rejects.toMatchObject({
      type: "USER_NOT_MEMBER",
    });

    expect(mockServerMemberFindUnique).toHaveBeenCalledWith({
      where: {
        userId_serverId: {
          userId: "user-1",
          serverId: "server-1",
        },
      },
      select: { role: true },
    });
  });

  test("crée une réaction si le message existe et que l'utilisateur est membre", async () => {
    mockMessageFindUnique.mockResolvedValue({
      id: "msg-1",
      channel: {
        id: "channel-1",
        serverId: "server-1",
      },
    });

    mockServerMemberFindUnique.mockResolvedValue({
      role: "Member",
    });

    mockReactCreate.mockResolvedValue({
      id: "react-1",
      emoji: "🔥",
      userId: "user-1",
      messageId: "msg-1",
    });

    const result = await createReact("user-1", "msg-1", "🔥");

    expect(mockReactCreate).toHaveBeenCalledWith({
      data: {
        emoji: "🔥",
        user: { connect: { id: "user-1" } },
        message: { connect: { id: "msg-1" } },
      },
    });

    expect(result).toEqual({
      id: "react-1",
      emoji: "🔥",
      userId: "user-1",
      messageId: "msg-1",
    });
  });

  test("autorise aussi Admin/Owner car seul le membership est vérifié", async () => {
    mockMessageFindUnique.mockResolvedValue({
      id: "msg-1",
      channel: {
        id: "channel-1",
        serverId: "server-1",
      },
    });

    mockServerMemberFindUnique.mockResolvedValue({
      role: "Admin",
    });

    mockReactCreate.mockResolvedValue({
      id: "react-2",
      emoji: "✅",
    });

    const result = await createReact("user-1", "msg-1", "✅");

    expect(result).toEqual({
      id: "react-2",
      emoji: "✅",
    });
  });
});

// ========================================
// deleteReact
// ========================================

describe("deleteReact", () => {
  test("supprime la réaction et retourne son id", async () => {
    mockReactDelete.mockResolvedValue({});

    const result = await deleteReact("react-1");

    expect(mockReactDelete).toHaveBeenCalledWith({
      where: { id: "react-1" },
    });

    expect(result).toEqual({
      id: "react-1",
    });
  });
});

// ========================================
// createReactDM
// ========================================

describe("createReactDM", () => {
  test("crée une réaction sur un DM", async () => {
    mockReactCreate.mockResolvedValue({
      id: "react-dm-1",
      emoji: "😂",
      userId: "user-1",
      dmId: "dm-1",
    });

    const result = await createReactDM("user-1", "dm-1", "😂");

    expect(mockReactCreate).toHaveBeenCalledWith({
      data: {
        emoji: "😂",
        user: { connect: { id: "user-1" } },
        dm: { connect: { id: "dm-1" } },
      },
    });

    expect(result).toEqual({
      id: "react-dm-1",
      emoji: "😂",
      userId: "user-1",
      dmId: "dm-1",
    });
  });
});

// ========================================
// deleteReactDM
// ========================================

describe("deleteReactDM", () => {
  test("supprime la réaction DM et retourne son id", async () => {
    mockReactDelete.mockResolvedValue({});

    const result = await deleteReactDM("react-dm-1");

    expect(mockReactDelete).toHaveBeenCalledWith({
      where: { id: "react-dm-1" },
    });

    expect(result).toEqual({
      id: "react-dm-1",
    });
  });
});