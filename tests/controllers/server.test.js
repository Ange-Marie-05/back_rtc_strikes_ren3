import { mock, describe, beforeEach, afterEach, test, expect, spyOn } from "bun:test";
import request from "supertest";
import bcrypt from "bcryptjs";

// ===============================
// Mocks auth / prisma
// ===============================

const mockUserFindFirst = mock(() => null);
const mockUserFindUnique = mock(() => null);
const mockUserUpdate = mock(() => ({}));

const mockVerify = mock(() => ({ valid: true }));
const mockQRCodeToDataURL = mock(() =>
  Promise.resolve("data:image/png;base64,MOCK_QR")
);
const mockSendWelcomeEmail = mock(() =>
  Promise.resolve({ data: {}, error: null })
);

// Socket mock
const mockIOEmit = mock(() => undefined);

mock.module("../../config/prisma.js", () => ({
  default: {
    user: {
      findFirst: mockUserFindFirst,
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
  },
}));

mock.module("otplib", () => ({
  generateSecret: () => "MOCK_SECRET",
  generateURI: () =>
    "otpauth://totp/Concorde:test@test.com?secret=MOCK_SECRET&issuer=Concorde",
  verify: mockVerify,
}));

mock.module("qrcode", () => ({
  default: {
    toDataURL: mockQRCodeToDataURL,
  },
}));

mock.module("../../services/email.service.js", () => ({
  sendWelcomeEmail: mockSendWelcomeEmail,
}));

mock.module("../../socket.js", () => ({
  getIO: () => ({
    emit: mockIOEmit,
  }),
}));

import * as serversModel from "../../models/servers.models.js";
import app from "../../app.js";

// ===============================
// Helpers
// ===============================

const VALID_PASSWORD = "BBbb##88";

async function makeHashedPassword(password = VALID_PASSWORD) {
  return bcrypt.hash(password, 10);
}

async function makeMockUser(overrides = {}) {
  return {
    id: "user-1",
    username: "Alice",
    email: "alice@test.com",
    password: await makeHashedPassword(),
    twoFactorSecret: "EXISTING_SECRET",
    ...overrides,
  };
}

function resetAllMocks() {
  mockUserFindFirst.mockReset();
  mockUserFindUnique.mockReset();
  mockUserUpdate.mockReset();

  mockVerify.mockReset();
  mockQRCodeToDataURL.mockReset();
  mockSendWelcomeEmail.mockReset();
  mockIOEmit.mockReset();

  mockUserFindFirst.mockReturnValue(null);
  mockUserFindUnique.mockReturnValue(null);
  mockUserUpdate.mockReturnValue({});

  mockVerify.mockReturnValue({ valid: true });
  mockQRCodeToDataURL.mockResolvedValue("data:image/png;base64,MOCK_QR");
  mockSendWelcomeEmail.mockResolvedValue({ data: {}, error: null });
  mockIOEmit.mockReturnValue(undefined);
}

beforeEach(() => {
  mock.restore();
  resetAllMocks();
});

afterEach(() => {
  mock.restore();
});

async function createAuthenticatedAgent(userOverrides = {}) {
  const user = await makeMockUser(userOverrides);

  mockUserFindFirst.mockReturnValue(user);
  mockUserFindUnique.mockReturnValue(user);
  mockVerify.mockReturnValue({ valid: true });

  const agent = request.agent(app);

  await agent
    .post("/auth/login")
    .send({ username_OR_email: user.username, password: VALID_PASSWORD });

  await agent
    .post("/auth/verifyTOTP")
    .send({ token: "123456" });

  return { agent, user };
}

// ===============================
// TESTS
// ===============================

describe("SERVERS ROUTES", () => {
  // -------------------------------
  // GET /servers/not_banned
  // -------------------------------
  describe("GET /servers/not_banned", () => {
    test("retourne les serveurs disponibles", async () => {
      const { agent } = await createAuthenticatedAgent();

      const findAvailableSpy = spyOn(
        serversModel,
        "findAvailableServersByUser"
      ).mockResolvedValue([
        { id: "1", name: "Serveur A", createdAt: "2026-01-01" },
        { id: "2", name: "Serveur B", createdAt: "2026-01-02" },
      ]);

      const response = await agent.get("/servers/not_banned");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.servers)).toBe(true);
      expect(response.body.servers.length).toBe(2);
      expect(findAvailableSpy).toHaveBeenCalledTimes(1);
      expect(findAvailableSpy).toHaveBeenCalledWith("user-1");
    });

    test("utilisateur non authentifié", async () => {
      const response = await request(app).get("/servers/not_banned");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Utilisateur non authentifié / User not authenticated"
      );
    });

    test("erreur de base de données", async () => {
      const { agent } = await createAuthenticatedAgent();

      spyOn(serversModel, "findAvailableServersByUser").mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const response = await agent.get("/servers/not_banned");

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        "Échec de la connexion au serveur / Failed to connect to the server"
      );
    });
  });

  // -------------------------------
  // GET /servers/:id
  // -------------------------------
  describe("GET /servers/:id", () => {
    test("retourne les infos du serveur existant", async () => {
      const serverData = {
        id: "42",
        name: "Serveur Test",
        createdAt: "2026-01-05",
        owner: { id: "123", username: "Alice" },
      };

      const findServerSpy = spyOn(serversModel, "findServerById").mockResolvedValue(
        serverData
      );

      const response = await request(app).get("/servers/42");

      expect(findServerSpy).toHaveBeenCalledTimes(1);
      expect(findServerSpy).toHaveBeenCalledWith("42");
      expect(response.status).toBe(200);
      expect(response.body).toEqual(serverData);
    });

    test("serveur inexistant", async () => {
      spyOn(serversModel, "findServerById").mockResolvedValue(null);

      const response = await request(app).get("/servers/99");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "Serveur introuvable / Server cannot be found"
      );
    });

    test("erreur de base de données", async () => {
      spyOn(serversModel, "findServerById").mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const response = await request(app).get("/servers/42");

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        "Échec de la connexion au serveur / Failed to connect to the server"
      );
    });
  });

  // -------------------------------
  // GET /servers/:id/members
  // -------------------------------
  describe("GET /servers/:id/members", () => {
    test("retourne la liste formatée des membres", async () => {
      const findMembersSpy = spyOn(
        serversModel,
        "findMembersByServerId"
      ).mockResolvedValue([
        {
          role: "Admin",
          joinedAt: "2026-01-01",
          banned: false,
          user: { id: "u1", username: "User1" },
        },
        {
          role: "Member",
          joinedAt: "2026-01-02",
          banned: true,
          user: { id: "u2", username: "User2" },
        },
      ]);

      const response = await request(app).get("/servers/123/members");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0]).toEqual({
        id: "u1",
        username: "User1",
        role: "Admin",
        joinedAt: "2026-01-01",
        banned: false,
      });

      expect(findMembersSpy).toHaveBeenCalledTimes(1);
      expect(findMembersSpy).toHaveBeenCalledWith("123");
    });

    test("serveur inexistant", async () => {
      spyOn(serversModel, "findMembersByServerId").mockResolvedValue(null);

      const response = await request(app).get("/servers/999/members");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "Serveur introuvable / Server cannot be found"
      );
    });

    test("erreur de base de données", async () => {
      spyOn(serversModel, "findMembersByServerId").mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const response = await request(app).get("/servers/123/members");

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        "Échec de la connexion au serveur / Failed to connect to the server"
      );
    });
  });

  // -------------------------------
  // GET /servers/:id/role
  // -------------------------------
  describe("GET /servers/:id/role", () => {
    test("retourne le rôle du user sur le serveur", async () => {
      const { agent } = await createAuthenticatedAgent();

      const getMyRoleSpy = spyOn(serversModel, "getMyRole").mockResolvedValue(
        "Admin"
      );

      const response = await agent.get("/servers/1/role");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ role: "Admin" });
      expect(getMyRoleSpy).toHaveBeenCalledTimes(1);
      expect(getMyRoleSpy).toHaveBeenCalledWith("1", "user-1");
    });

    test("utilisateur non authentifié", async () => {
      const response = await request(app).get("/servers/1/role");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Utilisateur non authentifié / User not authenticated"
      );
    });

    test("utilisateur non membre", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Not member");
      error.type = "USER_NOT_MEMBER";

      spyOn(serversModel, "getMyRole").mockImplementation(() => {
        throw error;
      });

      const response = await agent.get("/servers/1/role");

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Vous n'êtes pas membre de ce serveur / You are not a member of this server"
      );
    });
  });

  // -------------------------------
  // POST /servers
  // -------------------------------
  describe("POST /servers", () => {
    test("création serveur réussie", async () => {
      const { agent } = await createAuthenticatedAgent();

      const createServerSpy = spyOn(serversModel, "createServerDB").mockResolvedValue({
        id: "1",
        name: "Serveur Test",
        owner: { id: "user-1", username: "Alice" },
        members: [{ role: "Owner", user: { id: "user-1", username: "Alice" } }],
      });

      const response = await agent.post("/servers").send({ name: "Serveur Test" });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id", "1");
      expect(response.body).toHaveProperty("name", "Serveur Test");
      expect(createServerSpy).toHaveBeenCalledTimes(1);
      expect(createServerSpy).toHaveBeenCalledWith("Serveur Test", "user-1");
    });

    test("utilisateur non authentifié", async () => {
      const response = await request(app).post("/servers").send({ name: "Test" });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Utilisateur non authentifié / User not authenticated"
      );
    });

    test("nom serveur vide", async () => {
      const { agent } = await createAuthenticatedAgent();

      const response = await agent.post("/servers").send({ name: "" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Le champ du serveur ne doit pas être vide / Server name must not be empty"
      );
    });

    test("erreur de base de données", async () => {
      const { agent } = await createAuthenticatedAgent();

      spyOn(serversModel, "createServerDB").mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const response = await agent.post("/servers").send({ name: "Serveur Test" });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        "Échec de la connexion au serveur / Failed to connect to the server"
      );
    });
  });

  // -------------------------------
  // POST /servers/:id/join
  // -------------------------------
  describe("POST /servers/:id/join", () => {
    test("utilisateur rejoint serveur", async () => {
      const { agent } = await createAuthenticatedAgent();

      const joinServerSpy = spyOn(serversModel, "joinServer").mockResolvedValue({
        server: { id: "1", name: "Serveur Test" },
      });

      const response = await agent.post("/servers/1/join");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        'Vous avez rejoint le serveur "Serveur Test"'
      );
      expect(joinServerSpy).toHaveBeenCalledTimes(1);
      expect(joinServerSpy).toHaveBeenCalledWith("user-1", "1");
    });

    test("utilisateur non authentifié", async () => {
      const response = await request(app).post("/servers/1/join");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Utilisateur non authentifié / User not authenticated"
      );
    });

    test("déjà membre", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Already joined");
      error.type = "SERVER_ALREADY_JOINED";

      spyOn(serversModel, "joinServer").mockImplementation(() => {
        throw error;
      });

      const response = await agent.post("/servers/1/join");

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(
        "Vous êtes déjà membre de ce serveur / You are already a member of this server"
      );
    });
  });

  // -------------------------------
  // DELETE /servers/:id
  // -------------------------------
  describe("DELETE /servers/:id", () => {
    test("suppression serveur réussie", async () => {
      const { agent } = await createAuthenticatedAgent();

      const deleteServerSpy = spyOn(serversModel, "deleteServer").mockResolvedValue(
        true
      );

      const response = await agent.delete("/servers/1");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Le serveur a été supprimé avec succès.");
      expect(deleteServerSpy).toHaveBeenCalledWith("user-1", "1");
    });

    test("utilisateur non authentifié", async () => {
      const response = await request(app).delete("/servers/1");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Utilisateur non authentifié / User not authenticated"
      );
    });

    test("serveur inexistant", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Not found");
      error.type = "SERVER_NOT_FOUND";

      spyOn(serversModel, "deleteServer").mockRejectedValue(error);

      const response = await agent.delete("/servers/99");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "Serveur introuvable / Server cannot be found"
      );
    });

    test("utilisateur non autorisé", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Forbidden");
      error.type = "USER_NOT_AUTHORIZED";

      spyOn(serversModel, "deleteServer").mockRejectedValue(error);

      const response = await agent.delete("/servers/1");

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Vous n'êtes pas autorisé à réaliser cette action / You are not authorized to perform this action"
      );
    });
  });

  // -------------------------------
  // DELETE /servers/:id/leave
  // -------------------------------
  describe("DELETE /servers/:id/leave", () => {
    test("utilisateur non authentifié", async () => {
      const response = await request(app).delete("/servers/1/leave");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Utilisateur non authentifié / User not authenticated"
      );
    });

    test("succès : membre quitte le serveur", async () => {
      const { agent } = await createAuthenticatedAgent();

      const leaveServerSpy = spyOn(serversModel, "leaveServer").mockResolvedValue({
        server: { id: "1", name: "Serveur Test" },
        role: "Member",
      });

      const response = await agent.delete("/servers/1/leave");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        'Vous avez quitté le serveur "Serveur Test"'
      );
      expect(leaveServerSpy).toHaveBeenCalledWith("user-1", "1");
    });

    test("utilisateur non membre", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Not member");
      error.type = "USER_NOT_MEMBER";

      spyOn(serversModel, "leaveServer").mockImplementation(() => {
        throw error;
      });

      const response = await agent.delete("/servers/1/leave");

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Vous n'êtes pas membre de ce serveur / You are not a member of this server"
      );
    });

    test("owner ne peut pas quitter", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Owner cannot leave");
      error.type = "OWNER_CANNOT_LEAVE";

      spyOn(serversModel, "leaveServer").mockImplementation(() => {
        throw error;
      });

      const response = await agent.delete("/servers/1/leave");

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Vous êtes owner du serveur, cédez le rôle avant de quitter / You are the server owner, transfer ownership before leaving"
      );
    });
  });

  // -------------------------------
  // PUT /servers/:id
  // -------------------------------
  describe("PUT /servers/:id", () => {
    test("utilisateur non authentifié", async () => {
      const response = await request(app)
        .put("/servers/1")
        .send({ name: "Nouveau Nom" });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Utilisateur non authentifié / User not authenticated"
      );
    });

    test("nom serveur vide", async () => {
      const { agent } = await createAuthenticatedAgent();

      const response = await agent.put("/servers/1").send({ name: "   " });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Le champ du serveur ne doit pas être vide / Server name must not be empty"
      );
    });

    test("mise à jour réussie", async () => {
      const { agent } = await createAuthenticatedAgent();

      const updateServerSpy = spyOn(serversModel, "updateServer").mockResolvedValue({
        id: "1",
        name: "Nouveau Nom",
        createdAt: "2026-02-05",
      });

      const response = await agent.put("/servers/1").send({ name: "Nouveau Nom" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.server).toEqual({
        id: "1",
        name: "Nouveau Nom",
        createdAt: "2026-02-05",
      });

      expect(updateServerSpy).toHaveBeenCalledWith(
        "user-1",
        "1",
        "Nouveau Nom"
      );
    });

    test("serveur inexistant", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Server not found");
      error.type = "SERVER_NOT_FOUND";

      spyOn(serversModel, "updateServer").mockImplementation(() => {
        throw error;
      });

      const response = await agent.put("/servers/99").send({ name: "Nouveau Nom" });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "Serveur introuvable / Server cannot be found"
      );
    });

    test("utilisateur non propriétaire", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Not owner");
      error.type = "NOT_SERVER_OWNER";

      spyOn(serversModel, "updateServer").mockImplementation(() => {
        throw error;
      });

      const response = await agent.put("/servers/1").send({ name: "Nouveau Nom" });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Seul le propriétaire du serveur peut modifier les informations / Only the server owner can modify information"
      );
    });
  });

  // -------------------------------
  // PUT /servers/:id/members/:userId
  // -------------------------------
  describe("PUT /servers/:id/members/:userId", () => {
    test("utilisateur non authentifié", async () => {
      const response = await request(app)
        .put("/servers/1/members/u2")
        .send({ role: "Admin" });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Utilisateur non authentifié / User not authenticated"
      );
    });

    test("rôle invalide", async () => {
      const { agent } = await createAuthenticatedAgent();

      const response = await agent
        .put("/servers/1/members/u2")
        .send({ role: "SuperAdmin" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Le rôle spécifié est invalide / The specified role is invalid"
      );
    });

    test("mise à jour rôle réussie", async () => {
      const { agent } = await createAuthenticatedAgent();

      const updateMemberRoleSpy = spyOn(
        serversModel,
        "updateMemberRole"
      ).mockResolvedValue({
        id: "m1",
        userId: "u2",
        serverId: "1",
        role: "Admin",
      });

      const response = await agent
        .put("/servers/1/members/u2")
        .send({ role: "Admin" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Le rôle du membre a été mis à jour avec succès"
      );
      expect(response.body.member).toEqual({
        id: "m1",
        userId: "u2",
        serverId: "1",
        role: "Admin",
      });

      expect(updateMemberRoleSpy).toHaveBeenCalledWith(
        "user-1",
        "1",
        "u2",
        "Admin"
      );
    });

    test("serveur inexistant", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Server not found");
      error.type = "SERVER_NOT_FOUND";

      spyOn(serversModel, "updateMemberRole").mockImplementation(() => {
        throw error;
      });

      const response = await agent
        .put("/servers/99/members/u2")
        .send({ role: "Admin" });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "Serveur introuvable / Server cannot be found"
      );
    });

    test("utilisateur non propriétaire", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Not owner");
      error.type = "NOT_SERVER_OWNER";

      spyOn(serversModel, "updateMemberRole").mockImplementation(() => {
        throw error;
      });

      const response = await agent
        .put("/servers/1/members/u2")
        .send({ role: "Admin" });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Seul le propriétaire du serveur peut modifier les informations / Only the server owner can modify information"
      );
    });

    test("membre inexistant", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Member not found");
      error.type = "MEMBER_NOT_FOUND";

      spyOn(serversModel, "updateMemberRole").mockImplementation(() => {
        throw error;
      });

      const response = await agent
        .put("/servers/1/members/u999")
        .send({ role: "Admin" });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "Membre non trouvé dans ce serveur / Member not found in this server"
      );
    });

    test("transfert du rôle Owner", async () => {
      const { agent } = await createAuthenticatedAgent();

      const updateMemberRoleSpy = spyOn(
        serversModel,
        "updateMemberRole"
      ).mockResolvedValue({
        id: "m2",
        userId: "u2",
        serverId: "1",
        role: "Owner",
      });

      const response = await agent
        .put("/servers/1/members/u2")
        .send({ role: "Owner" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.member).toEqual({
        id: "m2",
        userId: "u2",
        serverId: "1",
        role: "Owner",
      });

      expect(updateMemberRoleSpy).toHaveBeenCalledTimes(1);
      expect(updateMemberRoleSpy).toHaveBeenCalledWith(
        "user-1",
        "1",
        "u2",
        "Owner"
      );
    });
  });

  // -------------------------------
  // DELETE /servers/:id/members/:userId/kick
  // -------------------------------
  describe("DELETE /servers/:id/members/:userId/kick", () => {
    test("expulsion réussie", async () => {
      const { agent } = await createAuthenticatedAgent();

      const kickMemberSpy = spyOn(serversModel, "kickMember").mockResolvedValue({
        memberId: "u2",
        serverId: "1",
      });

      const findServerSpy = spyOn(serversModel, "findServerById").mockResolvedValue({
        id: "1",
        name: "Serveur Test",
      });

      const response = await agent.delete("/servers/1/members/u2/kick");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Le membre a été expulsé avec succès");

      expect(kickMemberSpy).toHaveBeenCalledWith("user-1", "u2", "1");
      expect(findServerSpy).toHaveBeenCalledWith("1");

      expect(mockIOEmit).toHaveBeenCalledTimes(2);

      expect(mockIOEmit).toHaveBeenCalledWith("server:1:user_must_leave", {
        userId: "u2",
        action: "kick",
        messageFr: 'Vous avez été expulsé du serveur "Serveur Test"',
        messageEn: 'You have been kicked from the server "Serveur Test"',
      });

      expect(mockIOEmit).toHaveBeenCalledWith("server:1:member_removed", {
        userId: "u2",
        action: "kick",
      });
    });

    test("utilisateur non authentifié", async () => {
      const response = await request(app).delete("/servers/1/members/u2/kick");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Utilisateur non authentifié / User not authenticated"
      );
    });

    test("membre introuvable", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Member not found");
      error.type = "MEMBER_NOT_FOUND";

      spyOn(serversModel, "kickMember").mockRejectedValue(error);

      const response = await agent.delete("/servers/1/members/u2/kick");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "Membre non trouvé dans ce serveur / Member not found in this server"
      );
    });
  });

  // -------------------------------
  // POST /servers/:id/:userId/permBan
  // -------------------------------
  describe("POST /servers/:id/:userId/permBan", () => {
    test("utilisateur non authentifié", async () => {
      const response = await request(app).post("/servers/1/u2/permBan");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Utilisateur non authentifié / User not authenticated"
      );
    });

    test("ban permanent réussi", async () => {
      const { agent } = await createAuthenticatedAgent();

      const banMemberPermSpy = spyOn(
        serversModel,
        "banMemberPerm"
      ).mockResolvedValue({ username: "Bob" });

      const findServerSpy = spyOn(serversModel, "findServerById").mockResolvedValue({
        id: "1",
        name: "Serveur Test",
      });

      const response = await agent.post("/servers/1/u2/permBan");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Bob a été ban permanement");
      expect(banMemberPermSpy).toHaveBeenCalledWith("user-1", "1", "u2");
      expect(findServerSpy).toHaveBeenCalledWith("1");

      expect(mockIOEmit).toHaveBeenCalledTimes(2);

      expect(mockIOEmit).toHaveBeenCalledWith("server:1:user_must_leave", {
        userId: "u2",
        action: "permBan",
        messageFr: 'Vous avez été banni définitivement du serveur "Serveur Test"',
        messageEn: 'You have been permanently banned from the server "Serveur Test"',
      });

      expect(mockIOEmit).toHaveBeenCalledWith("server:1:member_removed", {
        userId: "u2",
        action: "permBan",
      });
    });

    test("membre cible introuvable", async () => {
      const { agent } = await createAuthenticatedAgent();
    
      const error = new Error("Member not found");
      error.type = "MEMBER_NOT_FOUND";
    
      spyOn(serversModel, "banMemberPerm").mockRejectedValue(error);
    
      const response = await agent.post("/servers/1/u2/permBan");
    
      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "Membre non trouvé dans ce serveur / Member not found in this server"
      );
    });

    test("requester non membre", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Not member");
      error.type = "USER_NOT_MEMBER";

      spyOn(serversModel, "banMemberPerm").mockRejectedValue(error);

      const response = await agent.post("/servers/1/u2/permBan");

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Vous n'êtes pas membre de ce serveur / You are not a member of this server"
      );
    });

    test("ban refusé sur owner/admin protégé", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Cannot kick");
      error.type = "MEMBER_CANNOT_BE_KICK";

      spyOn(serversModel, "banMemberPerm").mockRejectedValue(error);

      const response = await agent.post("/servers/1/u2/permBan");

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Vous n'êtes pas autorisé à expulser ce membre / You are not authorized to kick this member"
      );
    });

    test("erreur de base de données", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Database connection failed");
      error.type = "DATABASE_ERROR";

      spyOn(serversModel, "banMemberPerm").mockRejectedValue(error);

      const response = await agent.post("/servers/1/u2/permBan");

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        "Échec de la connexion au serveur / Failed to connect to the server"
      );
    });
  });

  // -------------------------------
  // POST /servers/:id/:userId/unban
  // -------------------------------
  describe("POST /servers/:id/:userId/unban", () => {
    test("utilisateur non authentifié", async () => {
      const response = await request(app).post("/servers/1/u2/unban");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Utilisateur non authentifié / User not authenticated"
      );
    });

    test("unban réussi", async () => {
      const { agent } = await createAuthenticatedAgent();

      const unbanMemberPermSpy = spyOn(
        serversModel,
        "unbanMemberPerm"
      ).mockResolvedValue({ username: "Bob" });

      const findMembersSpy = spyOn(
        serversModel,
        "findMembersByServerId"
      ).mockResolvedValue([
        {
          role: "Member",
          joinedAt: "2026-01-01",
          banned: false,
          user: { id: "u2", username: "Bob" },
        },
        {
          role: "Admin",
          joinedAt: "2026-01-02",
          banned: false,
          user: { id: "u3", username: "Jiraya" },
        },
        {
          role: "Member",
          joinedAt: "2026-01-03",
          banned: true,
          user: { id: "u4", username: "Alice" },
        },
      ]);

      const response = await agent.post("/servers/1/u2/unban");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Bob a été unban");
      expect(response.body.username).toBe("Bob");

      expect(unbanMemberPermSpy).toHaveBeenCalledWith("user-1", "1", "u2");
      expect(findMembersSpy).toHaveBeenCalledWith("1");

      expect(mockIOEmit).toHaveBeenCalledTimes(1);
      expect(mockIOEmit).toHaveBeenCalledWith("server:1:member_unbanned", {
        members: [
          {
            id: "u2",
            username: "Bob",
            role: "Member",
            joinedAt: "2026-01-01",
            banned: false,
          },
          {
            id: "u3",
            username: "Jiraya",
            role: "Admin",
            joinedAt: "2026-01-02",
            banned: false,
          },
        ],
      });
    });

    test("membre cible introuvable", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Member not found");
      error.type = "MEMBER_NOT_FOUND";

      spyOn(serversModel, "unbanMemberPerm").mockRejectedValue(error);

      const response = await agent.post("/servers/1/u2/unban");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "Membre non trouvé dans ce serveur / Member not found in this server"
      );
    });

    test("requester non membre", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Not member");
      error.type = "USER_NOT_MEMBER";

      spyOn(serversModel, "unbanMemberPerm").mockRejectedValue(error);

      const response = await agent.post("/servers/1/u2/unban");

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Vous n'êtes pas membre de ce serveur / You are not a member of this server"
      );
    });

    test("unban refusé sur owner/admin protégé", async () => {
      const { agent } = await createAuthenticatedAgent();
    
      const error = new Error("Cannot kick");
      error.type = "MEMBER_CANNOT_BE_KICK";
    
      spyOn(serversModel, "unbanMemberPerm").mockRejectedValue(error);
    
      const response = await agent.post("/servers/1/u2/unban");
    
      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Vous n'êtes pas autorisé à expulser ce membre / You are not authorized to kick this member"
      );
    });
  });

  // -------------------------------
  // POST /servers/:id/:userId/tempBan
  // -------------------------------
  describe("POST /servers/:id/:userId/tempBan", () => {
    test("ban temporaire réussi", async () => {
      const { agent } = await createAuthenticatedAgent();

      const banEndDate = new Date("2026-04-01T00:00:00.000Z");

      const banMemberTempSpy = spyOn(
        serversModel,
        "banMemberTemp"
      ).mockResolvedValue({
        memberId: "u2",
        serverId: "1",
        banEndDate,
      });

      const findServerSpy = spyOn(serversModel, "findServerById").mockResolvedValue({
        id: "1",
        name: "Serveur Test",
      });

      const response = await agent
        .post("/servers/1/u2/tempBan")
        .send({ durationDays: 7 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty("banEndDate");
      expect(banMemberTempSpy).toHaveBeenCalledWith("user-1", "u2", "1", 7);
      expect(findServerSpy).toHaveBeenCalledWith("1");

      expect(mockIOEmit).toHaveBeenCalledTimes(2);

      expect(mockIOEmit).toHaveBeenCalledWith(
        "server:1:user_must_leave",
        expect.objectContaining({
          userId: "u2",
          action: "tempBan",
          messageFr: expect.stringContaining(
            'Vous avez été banni temporairement du serveur "Serveur Test"'
          ),
          messageEn: expect.stringContaining(
            'You have been temporarily banned from the server "Serveur Test"'
          ),
        })
      );

      expect(mockIOEmit).toHaveBeenCalledWith("server:1:member_removed", {
        userId: "u2",
        action: "tempBan",
      });
    });

    test("utilisateur non authentifié", async () => {
      const response = await request(app)
        .post("/servers/1/u2/tempBan")
        .send({ durationDays: 7 });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Utilisateur non authentifié / User not authenticated"
      );
    });

    test("durée invalide", async () => {
      const { agent } = await createAuthenticatedAgent();

      const response = await agent
        .post("/servers/1/u2/tempBan")
        .send({ durationDays: 0 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "La durée du ban doit être supérieure à 0 / Ban duration must be greater than 0"
      );
    });

    test("membre cible introuvable", async () => {
      const { agent } = await createAuthenticatedAgent();

      const error = new Error("Member not found");
      error.type = "MEMBER_NOT_FOUND";

      spyOn(serversModel, "banMemberTemp").mockImplementation(() => {
        throw error;
      });

      const response = await agent
        .post("/servers/1/u2/tempBan")
        .send({ durationDays: 7 });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "Membre non trouvé dans ce serveur / Member not found in this server"
      );
    });
  });

  // -------------------------------
  // GET /servers/:id/:userId/isBanned
  // -------------------------------
  describe("GET /servers/:id/:userId/isBanned", () => {
    test("retourne true si user est banni", async () => {
      const isBannedSpy = spyOn(serversModel, "isBannedModel").mockResolvedValue(
        true
      );

      const response = await request(app).get("/servers/1/u2/isBanned");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ banned: true });
      expect(isBannedSpy).toHaveBeenCalledWith("u2", "1");
    });

    test("retourne false si user n'est pas banni", async () => {
      const isBannedSpy = spyOn(serversModel, "isBannedModel").mockResolvedValue(
        false
      );

      const response = await request(app).get("/servers/1/u2/isBanned");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ banned: false });
      expect(isBannedSpy).toHaveBeenCalledWith("u2", "1");
    });

    test("membre introuvable", async () => {
      const error = new Error("Member not found");
      error.type = "MEMBER_NOT_FOUND";

      spyOn(serversModel, "isBannedModel").mockImplementation(() => {
        throw error;
      });

      const response = await request(app).get("/servers/1/u2/isBanned");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "Membre non trouvé dans ce serveur / Member not found in this server"
      );
    });

    test("erreur de base de données", async () => {
      spyOn(serversModel, "isBannedModel").mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const response = await request(app).get("/servers/1/u2/isBanned");

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        "Échec de la connexion au serveur / Failed to connect to the server"
      );
    });
  });
});