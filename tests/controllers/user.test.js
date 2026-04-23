import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import request from "supertest";
import bcrypt from "bcryptjs";

// --------------------
// Mocks Prisma
// --------------------

const mockUserFindFirst = mock(() => null);
const mockUserFindUnique = mock(() => null);
const mockUserUpdate = mock(() => ({}));
const mockServerMemberFindMany = mock(() => []);

// --------------------
// Mocks auth-related deps
// --------------------

const mockVerify = mock(() => ({ valid: true }));
const mockQRCodeToDataURL = mock(() =>
  Promise.resolve("data:image/png;base64,MOCK_QR")
);
const mockSendWelcomeEmail = mock(() =>
  Promise.resolve({ data: {}, error: null })
);

mock.module("../../config/prisma.js", () => ({
  default: {
    user: {
      findFirst: mockUserFindFirst,
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
    serverMember: {
      findMany: mockServerMemberFindMany,
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
  mockUserFindFirst.mockReset();
  mockUserFindUnique.mockReset();
  mockUserUpdate.mockReset();
  mockServerMemberFindMany.mockReset();

  mockVerify.mockReset();
  mockQRCodeToDataURL.mockReset();
  mockSendWelcomeEmail.mockReset();

  mockUserFindFirst.mockReturnValue(null);
  mockUserFindUnique.mockReturnValue(null);
  mockUserUpdate.mockReturnValue({});
  mockServerMemberFindMany.mockReturnValue([]);

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
// GET /me
// ========================================

describe("GET /me", () => {
  test("récupération du profil réussie avec session valide", async () => {
    const { agent } = await createAuthenticatedAgent();

    mockUserFindUnique.mockReturnValue({
      id: "user-1",
      username: "Alice",
    });

    const response = await agent.get("/me");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user).toHaveProperty("id");
    expect(response.body.user).toHaveProperty("username");
    expect(response.body.user.username).toBe("Alice");
    expect(response.body.user).not.toHaveProperty("password");
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      select: {
        id: true,
        username: true,
      },
    });
  });

  test("échec si utilisateur non authentifié", async () => {
    const response = await request(app).get("/me");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Utilisateur non authentifié / User not authenticated"
    );
  });

  test("échec si utilisateur en session n'existe plus en DB", async () => {
    const { agent } = await createAuthenticatedAgent();

    mockUserFindUnique.mockReturnValue(null);

    const response = await agent.get("/me");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Utilisateur introuvable / User cannot be found"
    );
  });

  test("erreur de base de données", async () => {
    const { agent } = await createAuthenticatedAgent();

    mockUserFindUnique.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await agent.get("/me");

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Échec de la connexion au serveur / Failed to connect to the server"
    );
  });
});

// ========================================
// PUT /me
// ========================================

describe("PUT /me", () => {
  test("mise à jour du username réussie", async () => {
    const { agent } = await createAuthenticatedAgent();

    mockUserUpdate.mockReturnValue({
      id: "user-1",
      username: "AliceUpdated",
    });

    const response = await agent
      .put("/me")
      .send({ username: "AliceUpdated" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Username mis à jour avec succès");
    expect(response.body.data.username).toBe("AliceUpdated");
    expect(response.body.data).not.toHaveProperty("password");

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      data: {
        username: "AliceUpdated",
      },
      select: {
        id: true,
        username: true,
      },
    });
  });

  test("échec si utilisateur non authentifié", async () => {
    const response = await request(app)
      .put("/me")
      .send({ username: "NewName" });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Utilisateur non authentifié / User not authenticated"
    );
  });

  test("échec si champ username vide", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.put("/me").send({ username: "" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Champ(s) vide(s) / Empty field(s)");
  });

  test("échec si username absent", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.put("/me").send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Champ(s) vide(s) / Empty field(s)");
  });

  test("échec si username n'est pas une string", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.put("/me").send({ username: 123 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Champ(s) vide(s) / Empty field(s)");
  });

  test("échec si username trop court", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.put("/me").send({ username: "AB" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Nom d'utilisateur: au moins 3 caractères / Username: at least 3 characters"
    );
  });

  test("aucun changement si username identique", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.put("/me").send({ username: "Alice" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Aucun changement détecté");
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  test("aucun changement si username identique avec espaces autour", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.put("/me").send({ username: "   Alice   " });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Aucun changement détecté");
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  test("échec si username déjà utilisé par un autre user", async () => {
    const { agent } = await createAuthenticatedAgent();

    mockUserUpdate.mockImplementation(() => {
      const error = new Error("Unique constraint failed");
      error.code = "P2002";
      throw error;
    });

    const response = await agent
      .put("/me")
      .send({ username: "ExistingUser" });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Ce nom d'utilisateur est déjà utilisé / This username is already taken"
    );
  });

  test("trim des espaces dans le username", async () => {
    const { agent } = await createAuthenticatedAgent();

    mockUserUpdate.mockReturnValue({
      id: "user-1",
      username: "AliceTrimmed",
    });

    const response = await agent
      .put("/me")
      .send({ username: "  AliceTrimmed  " });

    expect(response.status).toBe(200);
    expect(response.body.data.username).toBe("AliceTrimmed");
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          username: "AliceTrimmed",
        },
      })
    );
  });

  test("erreur de base de données", async () => {
    const { agent } = await createAuthenticatedAgent();

    mockUserUpdate.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await agent.put("/me").send({ username: "NewAlice" });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Échec de la connexion au serveur / Failed to connect to the server"
    );
  });
});

// ========================================
// GET /contacts
// ========================================

describe("GET /contacts", () => {
  test("récupération des contacts réussie", async () => {
    const { agent } = await createAuthenticatedAgent();

    mockServerMemberFindMany
      .mockReturnValueOnce([
        { serverId: "server-1" },
        { serverId: "server-2" },
      ])
      .mockReturnValueOnce([
        {
          user: { id: "user-2", username: "Bob" },
        },
        {
          user: { id: "user-3", username: "Charlie" },
        },
      ]);

    const response = await agent.get("/contacts");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.contacts)).toBe(true);
    expect(response.body.contacts).toEqual([
      { id: "user-2", username: "Bob" },
      { id: "user-3", username: "Charlie" },
    ]);
  });

  test("retourne des contacts uniques même si doublons", async () => {
    const { agent } = await createAuthenticatedAgent();

    mockServerMemberFindMany
      .mockReturnValueOnce([
        { serverId: "server-1" },
        { serverId: "server-2" },
      ])
      .mockReturnValueOnce([
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

    const response = await agent.get("/contacts");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.contacts).toEqual([
      { id: "user-2", username: "Bob" },
      { id: "user-3", username: "Charlie" },
    ]);
  });

  test("échec si utilisateur non authentifié", async () => {
    const response = await request(app).get("/contacts");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Utilisateur non authentifié / User not authenticated"
    );
  });

  test("retourne liste vide si aucun serveur", async () => {
    const { agent } = await createAuthenticatedAgent();

    mockServerMemberFindMany
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);

    const response = await agent.get("/contacts");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.contacts).toEqual([]);
  });

  test("erreur de base de données", async () => {
    const { agent } = await createAuthenticatedAgent();

    mockServerMemberFindMany.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await agent.get("/contacts");

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Échec de la connexion au serveur / Failed to connect to the server"
    );
  });
});