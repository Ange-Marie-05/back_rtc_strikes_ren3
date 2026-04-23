import { test, expect, describe, beforeEach, mock } from "bun:test";

// --------------------
// Prisma mocks
// --------------------

const mockServerFindUnique = mock(() => null);
const mockServerCreate = mock(() => ({}));
const mockServerDelete = mock(() => ({}));
const mockServerUpdate = mock(() => ({}));

const mockServerMemberFindUnique = mock(() => null);
const mockServerMemberFindMany = mock(() => []);
const mockServerMemberCreate = mock(() => ({}));
const mockServerMemberDelete = mock(() => ({}));
const mockServerMemberUpdate = mock(() => ({}));

const mockUserFindUnique = mock(() => null);

mock.module("../../config/prisma.js", () => ({
  default: {
    server: {
      findUnique: mockServerFindUnique,
      create: mockServerCreate,
      delete: mockServerDelete,
      update: mockServerUpdate,
    },
    serverMember: {
      findUnique: mockServerMemberFindUnique,
      findMany: mockServerMemberFindMany,
      create: mockServerMemberCreate,
      delete: mockServerMemberDelete,
      update: mockServerMemberUpdate,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

import {
  findServerById,
  findMembersByServerId,
  getMyRole,
  createServerDB,
  joinServer,
  deleteServer,
  leaveServer,
  updateServer,
  updateMemberRole,
  kickMember,
  banMemberPerm,
  unbanMemberPerm,
  unbanMemberSystem,
  refreshExpiredBan,
  findAvailableServersByUser,
  isBannedModel,
  banMemberTemp,
} from "../../models/servers.models.js";

// --------------------
// Helpers
// --------------------

const mockConsoleError = mock(() => {});

function resetAllMocks() {
  mockServerFindUnique.mockReset();
  mockServerCreate.mockReset();
  mockServerDelete.mockReset();
  mockServerUpdate.mockReset();

  mockServerMemberFindUnique.mockReset();
  mockServerMemberFindMany.mockReset();
  mockServerMemberCreate.mockReset();
  mockServerMemberDelete.mockReset();
  mockServerMemberUpdate.mockReset();

  mockUserFindUnique.mockReset();
  mockConsoleError.mockReset();

  mockServerFindUnique.mockResolvedValue(null);
  mockServerCreate.mockResolvedValue({});
  mockServerDelete.mockResolvedValue({});
  mockServerUpdate.mockResolvedValue({});

  mockServerMemberFindUnique.mockResolvedValue(null);
  mockServerMemberFindMany.mockResolvedValue([]);
  mockServerMemberCreate.mockResolvedValue({});
  mockServerMemberDelete.mockResolvedValue({});
  mockServerMemberUpdate.mockResolvedValue({});

  mockUserFindUnique.mockResolvedValue(null);

  console.error = mockConsoleError;
}

beforeEach(() => {
  resetAllMocks();
});

// ========================================
// findServerById
// ========================================

describe("findServerById", () => {
  test("retourne le serveur", async () => {
    const fakeServer = {
      id: "server-1",
      name: "Test Server",
      createdAt: new Date("2026-01-01"),
      owner: {
        id: "user-1",
        username: "Alice",
      },
    };

    mockServerFindUnique.mockResolvedValue(fakeServer);

    const result = await findServerById("server-1");

    expect(mockServerFindUnique).toHaveBeenCalledWith({
      where: { id: "server-1" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    expect(result).toEqual(fakeServer);
  });

  test("retourne null si serveur introuvable", async () => {
    mockServerFindUnique.mockResolvedValue(null);

    const result = await findServerById("server-404");

    expect(result).toBeNull();
  });
});

// ========================================
// findMembersByServerId
// ========================================

describe("findMembersByServerId", () => {
  test("retourne les membres du serveur", async () => {
    const fakeMembers = [
      {
        role: "Owner",
        joinedAt: new Date("2026-01-01"),
        banned: false,
        user: { id: "user-1", username: "Alice" },
      },
      {
        role: "Member",
        joinedAt: new Date("2026-01-02"),
        banned: true,
        user: { id: "user-2", username: "Bob" },
      },
    ];

    mockServerMemberFindMany.mockResolvedValue(fakeMembers);

    const result = await findMembersByServerId("server-1");

    expect(mockServerMemberFindMany).toHaveBeenCalledWith({
      where: { serverId: "server-1" },
      select: {
        role: true,
        joinedAt: true,
        banned: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    expect(result).toEqual(fakeMembers);
  });

  test("retourne une liste vide si aucun membre", async () => {
    mockServerMemberFindMany.mockResolvedValue([]);

    const result = await findMembersByServerId("server-empty");

    expect(result).toEqual([]);
  });
});

// ========================================
// getMyRole
// ========================================

describe("getMyRole", () => {
  test("retourne le rôle du membre", async () => {
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Admin",
    });

    const result = await getMyRole("server-1", "user-1");

    expect(mockServerMemberFindUnique).toHaveBeenCalledWith({
      where: {
        userId_serverId: {
          userId: "user-1",
          serverId: "server-1",
        },
      },
      select: {
        role: true,
      },
    });

    expect(result).toBe("Admin");
  });

  test("refuse si l'utilisateur n'est pas membre", async () => {
    mockServerMemberFindUnique.mockResolvedValue(null);

    await expect(getMyRole("server-1", "user-1")).rejects.toMatchObject({
      type: "USER_NOT_MEMBER",
    });
  });
});

// ========================================
// createServerDB
// ========================================

describe("createServerDB", () => {
  test("crée un serveur avec owner + member owner", async () => {
    const fakeServer = {
      id: "server-1",
      name: "My Server",
      owner: { id: "user-1", username: "Alice" },
      members: [{ role: "Owner", user: { id: "user-1", username: "Alice" } }],
    };

    mockServerCreate.mockResolvedValue(fakeServer);

    const result = await createServerDB("My Server", "user-1");

    expect(mockServerCreate).toHaveBeenCalledWith({
      data: {
        name: "My Server",
        ownerId: "user-1",
        members: {
          create: {
            userId: "user-1",
            role: "Owner",
          },
        },
      },
      include: {
        members: {
          select: {
            role: true,
            user: {
              select: { id: true, username: true },
            },
          },
        },
        owner: {
          select: { id: true, username: true },
        },
      },
    });

    expect(result).toEqual(fakeServer);
  });
});

// ========================================
// joinServer
// ========================================

describe("joinServer", () => {
  test("refuse si déjà membre", async () => {
    mockServerMemberFindUnique.mockResolvedValue({
      userId: "user-1",
      serverId: "server-1",
      banned: false,
    });

    await expect(joinServer("user-1", "server-1")).rejects.toMatchObject({
      type: "SERVER_ALREADY_JOINED",
    });
  });

  test("refuse si déjà membre banni", async () => {
    mockServerMemberFindUnique.mockResolvedValue({
      userId: "user-1",
      serverId: "server-1",
      banned: true,
    });

    await expect(joinServer("user-1", "server-1")).rejects.toMatchObject({
      type: "SERVER_GOT_BANNED",
    });
  });

  test("rejoint le serveur si pas encore membre", async () => {
    mockServerMemberFindUnique.mockResolvedValue(null);
    mockServerMemberCreate.mockResolvedValue({
      server: { id: "server-1", name: "Test Server" },
      user: { id: "user-1", username: "Alice" },
      role: "Member",
    });

    const result = await joinServer("user-1", "server-1");

    expect(mockServerMemberCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        serverId: "server-1",
        role: "Member",
      },
      include: {
        server: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    expect(result).toEqual({
      server: { id: "server-1", name: "Test Server" },
      user: { id: "user-1", username: "Alice" },
      role: "Member",
    });
  });
});

// ========================================
// deleteServer
// ========================================

describe("deleteServer", () => {
  test("refuse si serveur introuvable", async () => {
    mockServerFindUnique.mockResolvedValue(null);

    await expect(deleteServer("user-1", "server-1")).rejects.toMatchObject({
      type: "SERVER_NOT_FOUND",
    });
  });

  test("refuse si l'utilisateur n'est pas autorisé", async () => {
    mockServerFindUnique.mockResolvedValue({
      ownerId: "other-user",
    });

    await expect(deleteServer("user-1", "server-1")).rejects.toMatchObject({
      type: "USER_NOT_AUTHORIZED",
    });
  });

  test("supprime le serveur si owner", async () => {
    mockServerFindUnique.mockResolvedValue({
      ownerId: "user-1",
    });

    mockServerDelete.mockResolvedValue({});

    const result = await deleteServer("user-1", "server-1");

    expect(mockServerDelete).toHaveBeenCalledWith({
      where: { id: "server-1" },
    });

    expect(result).toBe(true);
  });
});

// ========================================
// leaveServer
// ========================================

describe("leaveServer", () => {
  test("refuse si utilisateur non membre", async () => {
    mockServerMemberFindUnique.mockResolvedValue(null);

    await expect(leaveServer("user-1", "server-1")).rejects.toMatchObject({
      type: "USER_NOT_MEMBER",
    });
  });

  test("refuse si owner", async () => {
    mockServerMemberFindUnique.mockResolvedValue({
      role: "Owner",
      server: { id: "server-1", name: "Test Server" },
    });

    await expect(leaveServer("user-1", "server-1")).rejects.toMatchObject({
      type: "OWNER_CANNOT_LEAVE",
    });
  });

  test("supprime le membre si membre normal", async () => {
    const fakeMembership = {
      role: "Member",
      server: { id: "server-1", name: "Test Server" },
    };

    mockServerMemberFindUnique.mockResolvedValue(fakeMembership);
    mockServerMemberDelete.mockResolvedValue({});

    const result = await leaveServer("user-1", "server-1");

    expect(mockServerMemberDelete).toHaveBeenCalledWith({
      where: {
        userId_serverId: {
          userId: "user-1",
          serverId: "server-1",
        },
      },
    });

    expect(result).toEqual(fakeMembership);
  });
});

// ========================================
// updateServer
// ========================================

describe("updateServer", () => {
  test("refuse si serveur introuvable", async () => {
    mockServerFindUnique.mockResolvedValue(null);

    await expect(
      updateServer("user-1", "server-1", "New Name")
    ).rejects.toMatchObject({
      type: "SERVER_NOT_FOUND",
    });
  });

  test("refuse si pas owner", async () => {
    mockServerFindUnique.mockResolvedValue({
      id: "server-1",
      name: "Old",
      ownerId: "other-user",
    });

    await expect(
      updateServer("user-1", "server-1", "New Name")
    ).rejects.toMatchObject({
      type: "NOT_SERVER_OWNER",
    });
  });

  test("met à jour le serveur si owner", async () => {
    mockServerFindUnique.mockResolvedValue({
      id: "server-1",
      name: "Old",
      ownerId: "user-1",
    });

    mockServerUpdate.mockResolvedValue({
      id: "server-1",
      name: "New Name",
      createdAt: new Date("2026-01-01"),
    });

    const result = await updateServer("user-1", "server-1", "New Name");

    expect(mockServerUpdate).toHaveBeenCalledWith({
      where: { id: "server-1" },
      data: { name: "New Name" },
      select: { id: true, name: true, createdAt: true },
    });

    expect(result).toEqual({
      id: "server-1",
      name: "New Name",
      createdAt: new Date("2026-01-01"),
    });
  });
});

// ========================================
// updateMemberRole
// ========================================

describe("updateMemberRole", () => {
  test("refuse si serveur introuvable", async () => {
    mockServerFindUnique.mockResolvedValue(null);

    await expect(
      updateMemberRole("owner-1", "server-1", "member-1", "Admin")
    ).rejects.toMatchObject({
      type: "SERVER_NOT_FOUND",
    });
  });

  test("refuse si requester n'est pas owner", async () => {
    mockServerFindUnique.mockResolvedValue({
      id: "server-1",
      ownerId: "other-user",
    });

    await expect(
      updateMemberRole("owner-1", "server-1", "member-1", "Admin")
    ).rejects.toMatchObject({
      type: "NOT_SERVER_OWNER",
    });
  });

  test("refuse si membre cible introuvable", async () => {
    mockServerFindUnique.mockResolvedValue({
      id: "server-1",
      ownerId: "owner-1",
    });

    mockServerMemberFindUnique.mockResolvedValueOnce(null);

    await expect(
      updateMemberRole("owner-1", "server-1", "member-1", "Admin")
    ).rejects.toMatchObject({
      type: "MEMBER_NOT_FOUND",
    });
  });

  test("met à jour un rôle classique", async () => {
    mockServerFindUnique.mockResolvedValue({
      id: "server-1",
      ownerId: "owner-1",
    });

    mockServerMemberFindUnique.mockResolvedValueOnce({
      id: "membership-1",
      role: "Member",
      userId: "member-1",
      serverId: "server-1",
    });

    mockServerMemberUpdate.mockResolvedValue({
      id: "membership-1",
      role: "Admin",
      userId: "member-1",
      serverId: "server-1",
    });

    const result = await updateMemberRole(
      "owner-1",
      "server-1",
      "member-1",
      "Admin"
    );

    expect(mockServerMemberUpdate).toHaveBeenCalledWith({
      where: { id: "membership-1" },
      data: { role: "Admin" },
      select: { id: true, role: true, userId: true, serverId: true },
    });

    expect(result).toEqual({
      id: "membership-1",
      role: "Admin",
      userId: "member-1",
      serverId: "server-1",
    });
  });

  test("transfère le rôle Owner", async () => {
    mockServerFindUnique.mockResolvedValue({
      id: "server-1",
      ownerId: "owner-1",
    });

    mockServerMemberFindUnique
      .mockResolvedValueOnce({
        id: "member-membership",
        role: "Admin",
        userId: "member-1",
        serverId: "server-1",
      })
      .mockResolvedValueOnce({
        id: "previous-owner-membership",
        userId: "owner-1",
        serverId: "server-1",
        role: "Owner",
      });

    mockServerMemberUpdate
      .mockResolvedValueOnce({
        id: "previous-owner-membership",
        role: "Member",
      })
      .mockResolvedValueOnce({
        id: "member-membership",
        role: "Owner",
        userId: "member-1",
        serverId: "server-1",
      });

    mockServerUpdate.mockResolvedValue({
      id: "server-1",
      ownerId: "member-1",
    });

    const result = await updateMemberRole(
      "owner-1",
      "server-1",
      "member-1",
      "Owner"
    );

    expect(mockServerUpdate).toHaveBeenCalledWith({
      where: { id: "server-1" },
      data: { ownerId: "member-1" },
    });

    expect(result).toEqual({
      id: "member-membership",
      role: "Owner",
      userId: "member-1",
      serverId: "server-1",
    });
  });
});

// ========================================
// kickMember
// ========================================

describe("kickMember", () => {
  test("refuse si requester introuvable dans le serveur", async () => {
    mockServerMemberFindUnique.mockResolvedValueOnce(null);

    await expect(
      kickMember("requester-1", "member-1", "server-1")
    ).rejects.toMatchObject({
      type: "MEMBER_NOT_FOUND",
    });
  });

  test("refuse si membre cible introuvable", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Owner" })
      .mockResolvedValueOnce(null);

    await expect(
      kickMember("requester-1", "member-1", "server-1")
    ).rejects.toMatchObject({
      type: "MEMBER_NOT_FOUND",
    });
  });

  test("refuse si la cible est Owner", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Admin" })
      .mockResolvedValueOnce({ role: "Owner" });

    await expect(
      kickMember("requester-1", "member-1", "server-1")
    ).rejects.toMatchObject({
      type: "MEMBER_CANNOT_BE_KICK",
    });
  });

  test("refuse si Admin essaie de kick un Admin", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Admin" })
      .mockResolvedValueOnce({ role: "Admin" });

    await expect(
      kickMember("requester-1", "member-1", "server-1")
    ).rejects.toMatchObject({
      type: "MEMBER_CANNOT_BE_KICK",
    });
  });

  test("supprime le membre si autorisé", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Owner" })
      .mockResolvedValueOnce({ role: "Member" });

    mockServerMemberDelete.mockResolvedValue({});

    const result = await kickMember("requester-1", "member-1", "server-1");

    expect(mockServerMemberDelete).toHaveBeenCalledWith({
      where: {
        userId_serverId: {
          userId: "member-1",
          serverId: "server-1",
        },
      },
    });

    expect(result).toEqual({
      memberId: "member-1",
      serverId: "server-1",
    });
  });
});

// ========================================
// banMemberPerm
// ========================================

describe("banMemberPerm", () => {
  test("refuse si requester n'est pas membre", async () => {
    mockServerMemberFindUnique.mockResolvedValueOnce(null);

    await expect(
      banMemberPerm("requester-1", "server-1", "member-1")
    ).rejects.toMatchObject({
      type: "USER_NOT_MEMBER",
    });
  });

  test("refuse si membre cible introuvable", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Owner" })
      .mockResolvedValueOnce(null);

    await expect(
      banMemberPerm("requester-1", "server-1", "member-1")
    ).rejects.toMatchObject({
      type: "MEMBER_NOT_FOUND",
    });
  });

  test("refuse si la cible est Owner", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Admin" })
      .mockResolvedValueOnce({ role: "Owner" });

    await expect(
      banMemberPerm("requester-1", "server-1", "member-1")
    ).rejects.toMatchObject({
      type: "MEMBER_CANNOT_BE_KICK",
    });
  });

  test("refuse si Admin essaie de ban un Admin", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Admin" })
      .mockResolvedValueOnce({ role: "Admin" });

    await expect(
      banMemberPerm("requester-1", "server-1", "member-1")
    ).rejects.toMatchObject({
      type: "MEMBER_CANNOT_BE_KICK",
    });
  });

  test("ban définitivement un membre", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Owner" })
      .mockResolvedValueOnce({ role: "Member" });

    mockServerMemberUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({
      id: "member-1",
      username: "Bob",
    });

    const result = await banMemberPerm(
      "requester-1",
      "server-1",
      "member-1"
    );

    expect(mockServerMemberUpdate).toHaveBeenCalledWith({
      where: {
        userId_serverId: {
          userId: "member-1",
          serverId: "server-1",
        },
      },
      data: { banned: true, banEndDate: null },
    });

    expect(result).toEqual({
      id: "member-1",
      username: "Bob",
    });
  });
});

// ========================================
// unbanMemberPerm
// ========================================

describe("unbanMemberPerm", () => {
  test("refuse si requester n'est pas membre", async () => {
    mockServerMemberFindUnique.mockResolvedValueOnce(null);

    await expect(
      unbanMemberPerm("requester-1", "server-1", "member-1")
    ).rejects.toMatchObject({
      type: "USER_NOT_MEMBER",
    });
  });

  test("refuse si membre cible introuvable", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Owner" })
      .mockResolvedValueOnce(null);

    await expect(
      unbanMemberPerm("requester-1", "server-1", "member-1")
    ).rejects.toMatchObject({
      type: "MEMBER_NOT_FOUND",
    });
  });

  test("refuse si la cible est Owner", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Admin" })
      .mockResolvedValueOnce({ role: "Owner" });

    await expect(
      unbanMemberPerm("requester-1", "server-1", "member-1")
    ).rejects.toMatchObject({
      type: "MEMBER_CANNOT_BE_KICK",
    });
  });

  test("refuse si Admin essaie de unban un Admin", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Admin" })
      .mockResolvedValueOnce({ role: "Admin" });

    await expect(
      unbanMemberPerm("requester-1", "server-1", "member-1")
    ).rejects.toMatchObject({
      type: "MEMBER_CANNOT_BE_KICK",
    });
  });

  test("débannit un membre", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Owner" })
      .mockResolvedValueOnce({ role: "Member" });

    mockServerMemberUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({
      id: "member-1",
      username: "Bob",
    });

    const result = await unbanMemberPerm(
      "requester-1",
      "server-1",
      "member-1"
    );

    expect(mockServerMemberUpdate).toHaveBeenCalledWith({
      where: {
        userId_serverId: {
          userId: "member-1",
          serverId: "server-1",
        },
      },
      data: { banned: false, banEndDate: null },
    });

    expect(result).toEqual({
      id: "member-1",
      username: "Bob",
    });
  });
});

// ========================================
// unbanMemberSystem
// ========================================

describe("unbanMemberSystem", () => {
  test("débannit sans vérifier les permissions", async () => {
    mockServerMemberUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({
      id: "member-1",
      username: "Bob",
    });

    const result = await unbanMemberSystem("server-1", "member-1");

    expect(mockServerMemberUpdate).toHaveBeenCalledWith({
      where: {
        userId_serverId: {
          userId: "member-1",
          serverId: "server-1",
        },
      },
      data: { banned: false, banEndDate: null },
    });

    expect(result).toEqual({
      id: "member-1",
      username: "Bob",
    });
  });
});

// ========================================
// refreshExpiredBan
// ========================================

describe("refreshExpiredBan", () => {
  test("retourne null si membership introuvable", async () => {
    mockServerMemberFindUnique.mockResolvedValue(null);

    const result = await refreshExpiredBan("user-1", "server-1");

    expect(result).toBeNull();
  });

  test("débannit si ban expiré", async () => {
    const pastDate = new Date(Date.now() - 60_000);

    mockServerMemberFindUnique.mockResolvedValue({
      userId: "user-1",
      serverId: "server-1",
      banned: true,
      banEndDate: pastDate,
    });

    mockServerMemberUpdate.mockResolvedValue({
      userId: "user-1",
      serverId: "server-1",
      banned: false,
      banEndDate: null,
    });

    const result = await refreshExpiredBan("user-1", "server-1");

    expect(mockServerMemberUpdate).toHaveBeenCalledWith({
      where: {
        userId_serverId: { userId: "user-1", serverId: "server-1" },
      },
      data: {
        banned: false,
        banEndDate: null,
      },
    });

    expect(result).toEqual({
      userId: "user-1",
      serverId: "server-1",
      banned: false,
      banEndDate: null,
    });
  });

  test("retourne le membership si pas expiré", async () => {
    const futureDate = new Date(Date.now() + 60_000);

    const fakeMembership = {
      userId: "user-1",
      serverId: "server-1",
      banned: true,
      banEndDate: futureDate,
    };

    mockServerMemberFindUnique.mockResolvedValue(fakeMembership);

    const result = await refreshExpiredBan("user-1", "server-1");

    expect(mockServerMemberUpdate).not.toHaveBeenCalled();
    expect(result).toEqual(fakeMembership);
  });

  test("retourne le membership si pas banni", async () => {
    const fakeMembership = {
      userId: "user-1",
      serverId: "server-1",
      banned: false,
      banEndDate: null,
    };

    mockServerMemberFindUnique.mockResolvedValue(fakeMembership);

    const result = await refreshExpiredBan("user-1", "server-1");

    expect(result).toEqual(fakeMembership);
  });
});

// ========================================
// findAvailableServersByUser
// ========================================

describe("findAvailableServersByUser", () => {
  test("retourne [] si user introuvable", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const result = await findAvailableServersByUser("user-1");

    expect(result).toEqual([]);
  });

  test("retourne les serveurs visibles, débannit les bans expirés et garde les bans temporaires actifs grisés", async () => {
    const pastDate = new Date(Date.now() - 60_000);
    const futureDate = new Date(Date.now() + 60_000);
  
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      serverMembers: [
        {
          userId: "user-1",
          serverId: "server-1",
          banned: false,
          banEndDate: null,
          server: {
            id: "server-1",
            name: "Open",
            createdAt: new Date("2026-01-01"),
          },
        },
        {
          userId: "user-1",
          serverId: "server-2",
          banned: true,
          banEndDate: pastDate,
          server: {
            id: "server-2",
            name: "Expired Ban",
            createdAt: new Date("2026-01-02"),
          },
        },
        {
          userId: "user-1",
          serverId: "server-3",
          banned: true,
          banEndDate: futureDate,
          server: {
            id: "server-3",
            name: "Still Banned",
            createdAt: new Date("2026-01-03"),
          },
        },
      ],
    });
  
    mockServerMemberUpdate.mockResolvedValue({
      userId: "user-1",
      serverId: "server-2",
      banned: false,
      banEndDate: null,
      server: {
        id: "server-2",
        name: "Expired Ban",
        createdAt: new Date("2026-01-02"),
      },
    });
  
    const result = await findAvailableServersByUser("user-1");
  
    expect(mockServerMemberUpdate).toHaveBeenCalledTimes(1);
  
    expect(result).toEqual([
      {
        id: "server-1",
        name: "Open",
        createdAt: new Date("2026-01-01"),
        tempBanned: false,
        banEndDate: null,
      },
      {
        id: "server-2",
        name: "Expired Ban",
        createdAt: new Date("2026-01-02"),
        tempBanned: false,
        banEndDate: null,
      },
      {
        id: "server-3",
        name: "Still Banned",
        createdAt: new Date("2026-01-03"),
        tempBanned: true,
        banEndDate: futureDate,
      },
    ]);
  });
});

// ========================================
// isBannedModel
// ========================================

describe("isBannedModel", () => {
  test("retourne l'état banned si membership trouvé", async () => {
    mockServerMemberFindUnique.mockResolvedValue({
      userId: "user-1",
      serverId: "server-1",
      banned: true,
      banEndDate: null,
    });

    const result = await isBannedModel("user-1", "server-1");

    expect(result).toBe(true);
  });

  test("retourne DATABASE_ERROR si membership introuvable", async () => {
    mockServerMemberFindUnique.mockResolvedValue(null);

    await expect(isBannedModel("user-1", "server-1")).rejects.toMatchObject({
      type: "DATABASE_ERROR",
    });

    expect(mockConsoleError).toHaveBeenCalled();
  });

  test("retourne DATABASE_ERROR si refreshExpiredBan échoue", async () => {
    mockServerMemberFindUnique.mockImplementation(() => {
      throw new Error("DB failure");
    });

    await expect(isBannedModel("user-1", "server-1")).rejects.toMatchObject({
      type: "DATABASE_ERROR",
    });

    expect(mockConsoleError).toHaveBeenCalled();
  });
});

// ========================================
// banMemberTemp
// ========================================

describe("banMemberTemp", () => {
  test("refuse si requester introuvable", async () => {
    mockServerMemberFindUnique.mockResolvedValueOnce(null);

    await expect(
      banMemberTemp("requester-1", "member-1", "server-1", 7)
    ).rejects.toMatchObject({
      type: "MEMBER_NOT_FOUND",
    });
  });

  test("refuse si membre cible introuvable", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Owner" })
      .mockResolvedValueOnce(null);

    await expect(
      banMemberTemp("requester-1", "member-1", "server-1", 7)
    ).rejects.toMatchObject({
      type: "MEMBER_NOT_FOUND",
    });
  });

  test("refuse si la cible est Owner", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Admin" })
      .mockResolvedValueOnce({ role: "Owner" });

    await expect(
      banMemberTemp("requester-1", "member-1", "server-1", 7)
    ).rejects.toMatchObject({
      type: "MEMBER_CANNOT_BE_KICK",
    });
  });

  test("refuse si Admin essaie de ban temporairement un Admin", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Admin" })
      .mockResolvedValueOnce({ role: "Admin" });

    await expect(
      banMemberTemp("requester-1", "member-1", "server-1", 7)
    ).rejects.toMatchObject({
      type: "MEMBER_CANNOT_BE_KICK",
    });
  });

  test("ban temporairement un membre", async () => {
    mockServerMemberFindUnique
      .mockResolvedValueOnce({ role: "Owner" })
      .mockResolvedValueOnce({ role: "Member" });

    mockServerMemberUpdate.mockResolvedValue({});

    const before = Date.now();
    const result = await banMemberTemp("requester-1", "member-1", "server-1", 7);
    const after = Date.now();

    expect(mockServerMemberUpdate).toHaveBeenCalledTimes(1);

    const updateArg = mockServerMemberUpdate.mock.calls[0][0];

    expect(updateArg.where).toEqual({
      userId_serverId: {
        userId: "member-1",
        serverId: "server-1",
      },
    });

    expect(updateArg.data.banned).toBe(true);
    expect(updateArg.data.banEndDate instanceof Date).toBe(true);

    expect(updateArg.data.banEndDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(updateArg.data.banEndDate.getTime()).toBeLessThanOrEqual(
      after + 7 * 24 * 60 * 60 * 1000
    );

    expect(result.memberId).toBe("member-1");
    expect(result.serverId).toBe("server-1");
    expect(result.banEndDate instanceof Date).toBe(true);
  });
});