import { test, expect, describe, beforeEach, mock } from "bun:test";

// --------------------
// Prisma mocks
// --------------------

const mockChannelFindUnique = mock(() => null);
const mockChannelDelete = mock(() => ({}));
const mockChannelUpdate = mock(() => ({}));
const mockServerMemberFindUnique = mock(() => null);

mock.module("../../config/prisma.js", () => ({
  default: {
    channel: {
      findUnique: mockChannelFindUnique,
      delete: mockChannelDelete,
      update: mockChannelUpdate,
    },
    serverMember: {
      findUnique: mockServerMemberFindUnique,
    },
  },
}));

import {
  deleteChannelByIdDB,
  findChannelById,
  updateChannelbyIdDB,
} from "../../models/channels.models.js";

// --------------------
// Helpers
// --------------------

function resetAllMocks() {
  mockChannelFindUnique.mockReset();
  mockChannelDelete.mockReset();
  mockChannelUpdate.mockReset();
  mockServerMemberFindUnique.mockReset();

  mockChannelFindUnique.mockResolvedValue(null);
  mockChannelDelete.mockResolvedValue({});
  mockChannelUpdate.mockResolvedValue({});
  mockServerMemberFindUnique.mockResolvedValue(null);
}

beforeEach(() => {
  resetAllMocks();
});

// ========================================
// deleteChannelByIdDB
// ========================================

describe("deleteChannelByIdDB", () => {
  test("refuse si le channel n'existe pas", async () => {
    mockChannelFindUnique.mockResolvedValue(null);

    await expect(
      deleteChannelByIdDB("user-1", "channel-1")
    ).rejects.toMatchObject({
      type: "CHANNEL_NOT_FOUND",
    });

    expect(mockChannelFindUnique).toHaveBeenCalledWith({
      where: { id: "channel-1" },
      select: {
        id: true,
        serverId: true,
      },
    });
  });

  test("refuse si l'utilisateur n'est pas membre du serveur", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue(null);

    await expect(
      deleteChannelByIdDB("user-1", "channel-1")
    ).rejects.toMatchObject({
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

  test("refuse si l'utilisateur est Member", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Member",
    });

    await expect(
      deleteChannelByIdDB("user-1", "channel-1")
    ).rejects.toMatchObject({
      type: "USER_NOT_AUTHORIZED",
    });

    expect(mockChannelDelete).not.toHaveBeenCalled();
  });

  test("autorise un Admin à supprimer le channel", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Admin",
    });
    mockChannelDelete.mockResolvedValue({});

    const result = await deleteChannelByIdDB("user-1", "channel-1");

    expect(mockChannelDelete).toHaveBeenCalledWith({
      where: { id: "channel-1" },
    });
    expect(result).toBeUndefined();
  });

  test("autorise un Owner à supprimer le channel", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Owner",
    });
    mockChannelDelete.mockResolvedValue({});

    const result = await deleteChannelByIdDB("user-1", "channel-1");

    expect(mockChannelDelete).toHaveBeenCalledWith({
      where: { id: "channel-1" },
    });
    expect(result).toBeUndefined();
  });
});

// ========================================
// findChannelById
// ========================================

describe("findChannelById", () => {
  test("retourne le channel avec ses messages", async () => {
    const fakeChannel = {
      id: "channel-1",
      name: "general",
      createdAt: new Date("2026-01-01"),
      messages: [
        {
          id: "msg-1",
          content: "Hello",
          createdAt: new Date("2026-01-02"),
          user: {
            id: "user-1",
            username: "Alice",
          },
        },
      ],
    };

    mockChannelFindUnique.mockResolvedValue(fakeChannel);

    const result = await findChannelById("channel-1");

    expect(mockChannelFindUnique).toHaveBeenCalledWith({
      where: { id: "channel-1" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        messages: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    expect(result).toEqual(fakeChannel);
  });

  test("retourne null si le channel n'existe pas", async () => {
    mockChannelFindUnique.mockResolvedValue(null);

    const result = await findChannelById("channel-404");

    expect(result).toBeNull();
  });
});

// ========================================
// updateChannelbyIdDB
// ========================================

describe("updateChannelbyIdDB", () => {
  test("refuse si le channel n'existe pas", async () => {
    mockChannelFindUnique.mockResolvedValue(null);

    await expect(
      updateChannelbyIdDB("user-1", "channel-1", "new-name")
    ).rejects.toMatchObject({
      type: "CHANNEL_NOT_FOUND",
    });
  });

  test("refuse si l'utilisateur n'est pas membre du serveur", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue(null);

    await expect(
      updateChannelbyIdDB("user-1", "channel-1", "new-name")
    ).rejects.toMatchObject({
      type: "USER_NOT_MEMBER",
    });
  });

  test("refuse si l'utilisateur est Member", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Member",
    });

    await expect(
      updateChannelbyIdDB("user-1", "channel-1", "new-name")
    ).rejects.toMatchObject({
      type: "USER_NOT_AUTHORIZED",
    });

    expect(mockChannelUpdate).not.toHaveBeenCalled();
  });

  test("autorise un Admin à mettre à jour le channel", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Admin",
    });
    mockChannelUpdate.mockResolvedValue({
      id: "channel-1",
      name: "updated-channel",
      createdAt: new Date("2026-01-01"),
    });

    const result = await updateChannelbyIdDB(
      "user-1",
      "channel-1",
      "updated-channel"
    );

    expect(mockChannelUpdate).toHaveBeenCalledWith({
      where: { id: "channel-1" },
      data: { name: "updated-channel" },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    expect(result).toEqual({
      id: "channel-1",
      name: "updated-channel",
      createdAt: new Date("2026-01-01"),
    });
  });

  test("autorise un Owner à mettre à jour le channel", async () => {
    mockChannelFindUnique.mockResolvedValue({
      id: "channel-1",
      serverId: "server-1",
    });
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Owner",
    });
    mockChannelUpdate.mockResolvedValue({
      id: "channel-1",
      name: "owner-update",
      createdAt: new Date("2026-01-01"),
    });

    const result = await updateChannelbyIdDB(
      "user-1",
      "channel-1",
      "owner-update"
    );

    expect(result).toEqual({
      id: "channel-1",
      name: "owner-update",
      createdAt: new Date("2026-01-01"),
    });
  });
});