import { test, expect, describe, beforeEach, afterEach, mock, spyOn } from "bun:test";
import request from "supertest";
import bcrypt from "bcryptjs";

// --------------------
// Mocks
// --------------------

const mockChannelFindMany = mock(() => []);
const mockChannelCreate = mock(() => ({}));

const mockUserFindFirst = mock(() => null);
const mockUserFindUnique = mock(() => null);
const mockUserUpdate = mock(() => ({}));

const mockVerify = mock(() => ({ valid: true }));
const mockQRCodeToDataURL = mock(() => Promise.resolve("data:image/png;base64,MOCK_QR"));
const mockSendWelcomeEmail = mock(() => Promise.resolve({ data: {}, error: null }));

mock.module("../../config/prisma.js", () => ({
  default: {
    channel: {
      findMany: mockChannelFindMany,
      create: mockChannelCreate,
    },
    user: {
      findFirst: mockUserFindFirst,
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
  },
}));

import * as channelModel from "../../models/channels.models.js";

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

import app from "../../app.js";

// --------------------
// Helpers
// --------------------

const VALID_PASSWORD = "BBbb##88";

async function makeHashedPassword(password = VALID_PASSWORD) {
  return bcrypt.hash(password, 14);
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
  mockChannelFindMany.mockReset();
  mockChannelCreate.mockReset();

  mockUserFindFirst.mockReset();
  mockUserFindUnique.mockReset();
  mockUserUpdate.mockReset();

  mockVerify.mockReset();
  mockQRCodeToDataURL.mockReset();
  mockSendWelcomeEmail.mockReset();

  mockChannelFindMany.mockReturnValue([]);
  mockChannelCreate.mockReturnValue({});

  mockUserFindFirst.mockReturnValue(null);
  mockUserFindUnique.mockReturnValue(null);
  mockUserUpdate.mockReturnValue({});

  mockVerify.mockReturnValue({ valid: true });
  mockQRCodeToDataURL.mockResolvedValue("data:image/png;base64,MOCK_QR");
  mockSendWelcomeEmail.mockResolvedValue({ data: {}, error: null });
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

// ========================================
// GET /channels
// ========================================

describe("GET /channels", () => {
  test("récupération de tous les channels réussie", async () => {
    mockChannelFindMany.mockReturnValue([
      { id: "1", name: "general", serverId: "server-1" },
      { id: "2", name: "random", serverId: "server-1" },
    ]);

    const response = await request(app).get("/channels");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2);
    expect(response.body[0]).toHaveProperty("name");
    expect(response.body[0]).toHaveProperty("serverId");
  });

  test("liste vide si aucun channel", async () => {
    mockChannelFindMany.mockReturnValue([]);

    const response = await request(app).get("/channels");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test("erreur de base de données", async () => {
    mockChannelFindMany.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await request(app).get("/channels");

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Échec de la récupération des channels / Failed to fetch channels");
  });
});

// ========================================
// GET /channels/:id
// ========================================

describe("GET /channels/:id", () => {
  test("récupération d'un channel par ID réussie", async () => {
    spyOn(channelModel, "findChannelById").mockResolvedValue({
      id: "channel-1",
      name: "general",
      createdAt: new Date(),
      messages: [],
    });

    const response = await request(app).get("/channels/channel-1");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("id");
    expect(response.body).toHaveProperty("name");
    expect(response.body.name).toBe("general");
  });

  test("channel introuvable", async () => {
    spyOn(channelModel, "findChannelById").mockResolvedValue(null);

    const response = await request(app).get("/channels/nonexistent-id");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Channel introuvable / Channel cannot be found");
  });

  test("erreur de base de données", async () => {
    spyOn(channelModel, "findChannelById").mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await request(app).get("/channels/channel-1");

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Échec de la connexion au serveur / Failed to connect to the server");
  });
});

// ========================================
// GET /servers/:id/channels
// ========================================

describe("GET /servers/:id/channels", () => {
  test("récupération des channels d'un serveur réussie", async () => {
    mockChannelFindMany.mockReturnValue([
      { id: "1", name: "general", serverId: "server-1" },
      { id: "2", name: "random", serverId: "server-1" },
    ]);

    const response = await request(app).get("/servers/server-1/channels");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2);
    expect(response.body[0].serverId).toBe("server-1");
  });

  test("liste vide si aucun channel sur ce serveur", async () => {
    mockChannelFindMany.mockReturnValue([]);

    const response = await request(app).get("/servers/server-empty/channels");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test("erreur de base de données", async () => {
    mockChannelFindMany.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await request(app).get("/servers/server-1/channels");

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Échec de la récupération des channels / Failed to fetch channels");
  });
});

// ========================================
// POST /servers/:id/channels
// ========================================

describe("POST /servers/:id/channels", () => {
  test("création de channel réussie", async () => {
    mockChannelCreate.mockReturnValue({
      id: "channel-new",
      name: "announcements",
      serverId: "server-1",
    });

    const response = await request(app)
      .post("/servers/server-1/channels")
      .send({ name: "announcements" });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Channel créé avec succès !");
    expect(response.body.data.name).toBe("announcements");
    expect(response.body.data.serverId).toBe("server-1");
  });

  test("échec si nom vide", async () => {
    const response = await request(app)
      .post("/servers/server-1/channels")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Nom de channel vide / Channel name is empty");
  });

  test("échec si nom manquant", async () => {
    const response = await request(app)
      .post("/servers/server-1/channels")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Nom de channel vide / Channel name is empty");
  });

  test("échec si nom composé uniquement d'espaces", async () => {
    const response = await request(app)
      .post("/servers/server-1/channels")
      .send({ name: "   " });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Nom de channel vide / Channel name is empty");
  });

  test("échec si nom de channel déjà existant", async () => {
    mockChannelCreate.mockImplementation(() => {
      const error = new Error("Unique constraint failed");
      error.code = "P2002";
      throw error;
    });

    const response = await request(app)
      .post("/servers/server-1/channels")
      .send({ name: "general" });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Nom de channel déjà existant / Channel name already exists");
  });

  test("erreur de base de données", async () => {
    mockChannelCreate.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await request(app)
      .post("/servers/server-1/channels")
      .send({ name: "test-channel" });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Échec de la connexion au serveur / Failed to connect to the server");
  });
});

// ========================================
// PUT /channels/:id
// ========================================

describe("PUT /channels/:id", () => {
  test("mise à jour du channel réussie", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(channelModel, "updateChannelbyIdDB").mockResolvedValue({
      id: "channel-1",
      name: "updated-channel",
      createdAt: new Date(),
    });

    const response = await agent
      .put("/channels/channel-1")
      .send({ name: "updated-channel" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Channel mis à jour avec succès");
    expect(response.body.channel.name).toBe("updated-channel");
  });

  test("échec si utilisateur non authentifié", async () => {
    const response = await request(app)
      .put("/channels/channel-1")
      .send({ name: "new-name" });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Utilisateur non authentifié / User not authenticated");
  });

  test("échec si nom vide", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent
      .put("/channels/channel-1")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Nom de channel vide / Channel name is empty");
  });

  test("échec si nom composé uniquement d'espaces", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent
      .put("/channels/channel-1")
      .send({ name: "   " });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Nom de channel vide / Channel name is empty");
  });

  test("échec si channel introuvable", async () => {
    const { agent } = await createAuthenticatedAgent();

    const error = new Error("Channel not found");
    error.type = "CHANNEL_NOT_FOUND";
    spyOn(channelModel, "updateChannelbyIdDB").mockImplementation(() => {
      throw error;
    });

    const response = await agent
      .put("/channels/nonexistent")
      .send({ name: "new-name" });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Channel introuvable / Channel cannot be found");
  });

  test("échec si utilisateur n'est pas membre du serveur", async () => {
    const { agent } = await createAuthenticatedAgent();

    const error = new Error("Not member");
    error.type = "USER_NOT_MEMBER";
    spyOn(channelModel, "updateChannelbyIdDB").mockImplementation(() => {
      throw error;
    });

    const response = await agent
      .put("/channels/channel-1")
      .send({ name: "new-name" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Vous n'êtes pas membre de ce serveur / You are not a member of this server");
  });

  test("échec si utilisateur n'est pas Owner ou Admin", async () => {
    const { agent } = await createAuthenticatedAgent();

    const error = new Error("Forbidden");
    error.type = "USER_NOT_AUTHORIZED";
    spyOn(channelModel, "updateChannelbyIdDB").mockImplementation(() => {
      throw error;
    });

    const response = await agent
      .put("/channels/channel-1")
      .send({ name: "new-name" });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Vous n'êtes pas autorisé à réaliser cette action / You are not authorized to perform this action");
  });

  test("succès si utilisateur est Admin", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(channelModel, "updateChannelbyIdDB").mockResolvedValue({
      id: "channel-1",
      name: "updated-by-admin",
      createdAt: new Date(),
    });

    const response = await agent
      .put("/channels/channel-1")
      .send({ name: "updated-by-admin" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.channel.name).toBe("updated-by-admin");
  });

  test("erreur de base de données", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(channelModel, "updateChannelbyIdDB").mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await agent
      .put("/channels/channel-1")
      .send({ name: "updated-channel" });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Échec de la connexion au serveur / Failed to connect to the server");
  });
});

// ========================================
// DELETE /channels/:id
// ========================================

describe("DELETE /channels/:id", () => {
  test("suppression du channel réussie", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(channelModel, "deleteChannelByIdDB").mockResolvedValue(undefined);

    const response = await agent.delete("/channels/channel-1");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Le channel a été supprimé avec succès.");
  });

  test("échec si utilisateur non authentifié", async () => {
    const response = await request(app).delete("/channels/channel-1");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Utilisateur non authentifié / User not authenticated");
  });

  test("échec si channel introuvable", async () => {
    const { agent } = await createAuthenticatedAgent();

    const error = new Error("Channel not found");
    error.type = "CHANNEL_NOT_FOUND";
    spyOn(channelModel, "deleteChannelByIdDB").mockImplementation(() => {
      throw error;
    });

    const response = await agent.delete("/channels/nonexistent");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Channel introuvable / Channel cannot be found");
  });

  test("échec si utilisateur n'est pas membre du serveur", async () => {
    const { agent } = await createAuthenticatedAgent();

    const error = new Error("Not member");
    error.type = "USER_NOT_MEMBER";
    spyOn(channelModel, "deleteChannelByIdDB").mockImplementation(() => {
      throw error;
    });

    const response = await agent.delete("/channels/channel-1");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Vous n'êtes pas membre de ce serveur / You are not a member of this server");
  });

  test("échec si utilisateur n'est pas Owner ou Admin", async () => {
    const { agent } = await createAuthenticatedAgent();

    const error = new Error("Forbidden");
    error.type = "USER_NOT_AUTHORIZED";
    spyOn(channelModel, "deleteChannelByIdDB").mockImplementation(() => {
      throw error;
    });

    const response = await agent.delete("/channels/channel-1");

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Vous n'êtes pas autorisé à réaliser cette action / You are not authorized to perform this action");
  });

  test("succès si utilisateur est Admin", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(channelModel, "deleteChannelByIdDB").mockResolvedValue(undefined);

    const response = await agent.delete("/channels/channel-1");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Le channel a été supprimé avec succès.");
  });

  test("erreur de base de données", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(channelModel, "deleteChannelByIdDB").mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await agent.delete("/channels/channel-1");

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Échec de la connexion au serveur / Failed to connect to the server");
  });
});