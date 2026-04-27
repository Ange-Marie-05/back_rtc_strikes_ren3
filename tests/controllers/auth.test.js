import { mock, describe, beforeEach, afterEach, test, expect } from "bun:test";
import request from "supertest";
import bcrypt from "bcryptjs";

// --------------------
// Mocks
// --------------------

const mockFindUnique = mock(() => null);
const mockFindFirst = mock(() => null);
const mockCreate = mock(() => ({}));
const mockUpdate = mock(() => ({}));
const mockVerify = mock(() => Promise.resolve({ valid: true }));
const mockQRCodeToDataURL = mock(() => Promise.resolve("data:image/png;base64,MOCK_QR"));
const mockSendWelcomeEmail = mock(() => Promise.resolve({ data: {}, error: null }));
const mockSendResetPasswordEmail = mock(() => Promise.resolve({ data: {}, error: null }));

mock.module("../../config/prisma.js", () => ({
  default: {
    user: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
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
  sendResetPasswordEmail: mockSendResetPasswordEmail,
}));

import app from "../../app.js";

// --------------------
// Helpers
// --------------------

const VALID_PASSWORD = "BBbb##88";

async function makeHashedPassword(password = VALID_PASSWORD) {
  return bcrypt.hash(password, 10);
}

async function makeMockUser(overrides = {}) {
  return {
    id: "user-1",
    username: "Hugo Boss",
    email: "hugo@test.com",
    password: await makeHashedPassword(),
    twoFactorSecret: "EXISTING_SECRET",
    ...overrides,
  };
}

function resetAllMocks() {
  mockFindUnique.mockReset();
  mockFindFirst.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockVerify.mockReset();
  mockQRCodeToDataURL.mockReset();
  mockSendWelcomeEmail.mockReset();
  mockSendResetPasswordEmail.mockReset();

  mockFindUnique.mockReturnValue(null);
  mockFindFirst.mockReturnValue(null);
  mockCreate.mockReturnValue({});
  mockUpdate.mockReturnValue({});
  mockVerify.mockResolvedValue({ valid: true });
  mockQRCodeToDataURL.mockResolvedValue("data:image/png;base64,MOCK_QR");
  mockSendWelcomeEmail.mockResolvedValue({ data: {}, error: null });
  mockSendResetPasswordEmail.mockResolvedValue({ data: {}, error: null });
}

beforeEach(() => {
  mock.restore();
  resetAllMocks();
});

afterEach(() => {
  mock.restore();
});

// --------------------
// POST /auth/login
// --------------------

describe("POST /auth/login", () => {
  test("login réussi => retourne un QR code, pas les données user", async () => {
    const user = await makeMockUser();
    mockFindFirst.mockReturnValue(user);

    const response = await request(app)
      .post("/auth/login")
      .send({ username_OR_email: "Hugo Boss", password: VALID_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.codeQR).toBeDefined();
    expect(response.body.data).toBeUndefined();
    expect(response.body.message).toBe("Connexion presque réussie, validez votre TOTP");
  });

  test("login réussi par email", async () => {
    const user = await makeMockUser();
    mockFindFirst.mockReturnValue(user);

    const response = await request(app)
      .post("/auth/login")
      .send({ username_OR_email: "hugo@test.com", password: VALID_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.codeQR).toBeDefined();
  });

  test("génère un secret TOTP si le user n'en a pas encore", async () => {
    const user = await makeMockUser({ twoFactorSecret: null });

    mockFindFirst.mockReturnValue(user);
    mockUpdate.mockReturnValue({
      ...user,
      twoFactorSecret: "MOCK_SECRET",
    });

    const response = await request(app)
      .post("/auth/login")
      .send({ username_OR_email: "Hugo Boss", password: VALID_PASSWORD });

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  test("champs vides", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ username_OR_email: "", password: "" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Champ(s) vide(s) / Empty field(s)");
  });

  test("utilisateur inexistant", async () => {
    mockFindFirst.mockReturnValue(null);

    const response = await request(app)
      .post("/auth/login")
      .send({ username_OR_email: "Inconnu", password: VALID_PASSWORD });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Utilisateur introuvable / User cannot be found");
  });

  test("mot de passe incorrect", async () => {
    const user = await makeMockUser();
    mockFindFirst.mockReturnValue(user);

    const response = await request(app)
      .post("/auth/login")
      .send({ username_OR_email: "Hugo Boss", password: "WrongPass11##AA" });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Données invalides / Invalid data");
  });

  test("trim username_OR_email avant recherche", async () => {
    const user = await makeMockUser();
    mockFindFirst.mockReturnValue(user);

    const response = await request(app)
      .post("/auth/login")
      .send({ username_OR_email: "   Hugo Boss   ", password: VALID_PASSWORD });

    expect(response.status).toBe(200);
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });

  test("erreur de base de données", async () => {
    mockFindFirst.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await request(app)
      .post("/auth/login")
      .send({ username_OR_email: "Alice", password: VALID_PASSWORD });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Échec de la connexion au serveur / Failed to connect to the server");
  });
});

// --------------------
// POST /auth/verifyTOTP
// --------------------

describe("POST /auth/verifyTOTP", () => {
  async function loginAndGetAgent(userOverrides = {}) {
    const user = await makeMockUser(userOverrides);

    mockFindFirst.mockReturnValue(user);
    mockFindUnique.mockReturnValue(user);

    const agent = request.agent(app);

    await agent
      .post("/auth/login")
      .send({ username_OR_email: user.username, password: VALID_PASSWORD });

    return { agent, user };
  }

  test("code TOTP valide => connexion réussie", async () => {
    mockVerify.mockResolvedValue({ valid: true });

    const { agent } = await loginAndGetAgent();

    const response = await agent
      .post("/auth/verifyTOTP")
      .send({ token: "123456" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Connexion réussie");
    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data).toHaveProperty("username");
    expect(response.body.data).toHaveProperty("email");
    expect(response.body.data).not.toHaveProperty("password");
  });

  test("code TOTP invalide", async () => {
    mockVerify.mockResolvedValue({ valid: false });

    const { agent } = await loginAndGetAgent();

    const response = await agent
      .post("/auth/verifyTOTP")
      .send({ token: "000000" });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Code incorrect / Incorrect code");
  });

  test("échec si token absent", async () => {
    const { agent } = await loginAndGetAgent();

    const response = await agent
      .post("/auth/verifyTOTP")
      .send({ token: "" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Champ(s) vide(s) / Empty field(s)");
  });

  test("échec si aucune session pendingUserId", async () => {
    const response = await request(app)
      .post("/auth/verifyTOTP")
      .send({ token: "123456" });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Utilisateur non authentifié / User not authenticated");
  });

  test("échec si user introuvable pendant verifyTOTP", async () => {
    const { agent } = await loginAndGetAgent();
    mockFindUnique.mockReturnValue(null);

    const response = await agent
      .post("/auth/verifyTOTP")
      .send({ token: "123456" });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Utilisateur introuvable / User cannot be found");
  });

  test("remember me actif => connexion réussie", async () => {
    const user = await makeMockUser();
    mockFindFirst.mockReturnValue(user);
    mockFindUnique.mockReturnValue(user);
    mockVerify.mockResolvedValue({ valid: true });

    const agent = request.agent(app);

    await agent
      .post("/auth/login")
      .send({
        username_OR_email: "Hugo Boss",
        password: VALID_PASSWORD,
        rememberMe: true,
      });

    const response = await agent
      .post("/auth/verifyTOTP")
      .send({ token: "123456" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test("erreur de base de données lors de la vérification TOTP", async () => {
    const { agent } = await loginAndGetAgent();

    mockFindUnique.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await agent
      .post("/auth/verifyTOTP")
      .send({ token: "123456" });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Échec de la connexion au serveur / Failed to connect to the server");
  });
});

// --------------------
// POST /auth/signup
// --------------------

describe("POST /auth/signup", () => {
  test("création réussie", async () => {
    mockCreate.mockReturnValue({
      id: "new-user-123",
      username: "Charles",
      email: "charles@test.com",
      twoFactorSecret: "MOCK_SECRET",
    });

    const response = await request(app)
      .post("/auth/signup")
      .send({
        username: "Charles",
        email: "charles@test.com",
        password: VALID_PASSWORD,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Utilisateur créé avec succès");
    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data).toHaveProperty("username");
    expect(response.body.data).toHaveProperty("email");
    expect(response.body.data).not.toHaveProperty("password");
    expect(mockSendWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  test("trim username et email avant création", async () => {
    mockCreate.mockReturnValue({
      id: "new-user-123",
      username: "Charles",
      email: "charles@test.com",
      twoFactorSecret: "MOCK_SECRET",
    });

    const response = await request(app)
      .post("/auth/signup")
      .send({
        username: "   Charles   ",
        email: "   charles@test.com   ",
        password: VALID_PASSWORD,
      });

    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  test("champ username vide", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .send({ username: "", email: "test@test.com", password: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Champ(s) vide(s) / Empty field(s)");
  });

  test("champ email vide", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .send({ username: "Charles", email: "", password: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Champ(s) vide(s) / Empty field(s)");
  });

  test("champ password vide", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .send({ username: "Charles", email: "charles@test.com", password: "" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Champ(s) vide(s) / Empty field(s)");
  });

  test("username trop court (moins de 3 caractères)", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .send({ username: "ab", email: "test@test.com", password: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Nom d'utilisateur: au moins 3 caractères / Username: at least 3 characters"
    );
  });

  test("format email invalide", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .send({ username: "Charles", email: "pas-un-email", password: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Email: format xxxx@gmail.com / Email: format xxxx@gmail.com");
  });

  test("password trop court (moins de 8 caractères)", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .send({ username: "Charles", email: "charles@test.com", password: "Aa1#Bb2" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Mot de passe: au moins 8 caractères (2 chiffres, 2 Majuscules, 2 minuscules, 2 spéciaux) / Password: at least 8 characters (2 digits, 2 uppercase, 2 lowercase, 2 special characters)"
    );
  });

  test("password sans assez de majuscules", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .send({ username: "Charles", email: "charles@test.com", password: "Bbbb##88" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Mot de passe");
  });

  test("password sans assez de caractères spéciaux", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .send({ username: "Charles", email: "charles@test.com", password: "BBbbab88" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Mot de passe");
  });

  test("password avec espace", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .send({ username: "Charles", email: "charles@test.com", password: "BBbb ##88" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Mot de passe");
  });

  test("username ou email déjà existant (erreur Prisma P2002)", async () => {
    mockCreate.mockImplementation(() => {
      const error = new Error("Unique constraint failed on the fields: (`username`)");
      error.code = "P2002";
      throw error;
    });

    const response = await request(app)
      .post("/auth/signup")
      .send({ username: "ExistingUser", email: "new@test.com", password: VALID_PASSWORD });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Ce nom utilisateur existe déjà / This username already exists");
  });

  test("erreur de base de données", async () => {
    mockCreate.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await request(app)
      .post("/auth/signup")
      .send({ username: "Alice", email: "alice@test.com", password: VALID_PASSWORD });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Échec de la connexion au serveur / Failed to connect to the server");
  });

  test("création réussie même si l'envoi du mail échoue", async () => {
    mockCreate.mockReturnValue({
      id: "new-user-123",
      username: "Charles",
      email: "charles@test.com",
      twoFactorSecret: "MOCK_SECRET",
    });

    mockSendWelcomeEmail.mockResolvedValue({
      data: null,
      error: { message: "Mail failed" },
    });

    const response = await request(app)
      .post("/auth/signup")
      .send({
        username: "Charles",
        email: "charles@test.com",
        password: VALID_PASSWORD,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});

// --------------------
// POST /auth/forgot-password
// --------------------

describe("POST /auth/forgot-password", () => {
  test("succès => email de reset envoyé", async () => {
    const user = await makeMockUser();
    mockFindUnique.mockReturnValue(user);
    mockUpdate.mockReturnValue({ ...user, PasswordResetToken: "mock-token" });

    const response = await request(app)
      .post("/auth/forgot-password")
      .send({ email: "hugo@test.com" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockSendResetPasswordEmail).toHaveBeenCalledTimes(1);
  });

  test("email vide", async () => {
    const response = await request(app)
      .post("/auth/forgot-password")
      .send({ email: "" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Champ(s) vide(s) / Empty field(s)");
  });

  test("format email invalide", async () => {
    const response = await request(app)
      .post("/auth/forgot-password")
      .send({ email: "pas-un-email" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Email: format xxxx@gmail.com / Email: format xxxx@gmail.com");
  });

  test("utilisateur non trouvé", async () => {
    mockFindUnique.mockReturnValue(null);

    const response = await request(app)
      .post("/auth/forgot-password")
      .send({ email: "inconnu@test.com" });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Utilisateur introuvable / User cannot be found");
  });

  test("erreur de base de données", async () => {
    mockFindUnique.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await request(app)
      .post("/auth/forgot-password")
      .send({ email: "hugo@test.com" });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Échec de la connexion au serveur / Failed to connect to the server");
  });
});

// --------------------
// POST /auth/reset-password
// --------------------

describe("POST /auth/reset-password", () => {
  test("succès => mot de passe mis à jour, token supprimé", async () => {
    const user = await makeMockUser({
      PasswordResetToken: "valid-token",
      PasswordResetTokenExp: new Date(Date.now() + 60 * 60 * 1000), // dans 1h
    });

    mockFindFirst.mockReturnValue(user);
    mockUpdate.mockReturnValue({ ...user, PasswordResetToken: null, PasswordResetTokenExp: null });

    const response = await request(app)
      .post("/auth/reset-password")
      .send({ token: "valid-token", newPassword: VALID_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    // vérifier que le token est bien supprimé
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          PasswordResetToken: null,
          PasswordResetTokenExp: null,
        }),
      })
    );
  });

  test("champs vides", async () => {
    const response = await request(app)
      .post("/auth/reset-password")
      .send({ token: "", newPassword: "" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Champ(s) vide(s) / Empty field(s)");
  });

  test("token invalide ou déjà utilisé", async () => {
    mockFindFirst.mockReturnValue(null);

    const response = await request(app)
      .post("/auth/reset-password")
      .send({ token: "invalid-token", newPassword: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Lien de modification du mot de passe invalide ou déjà utilisé / Invalid or already used password change link");
  });

  test("token expiré", async () => {
    const user = await makeMockUser({
      PasswordResetToken: "expired-token",
      PasswordResetTokenExp: new Date(Date.now() - 1000), // expiré il y a 1 seconde
    });

    mockFindFirst.mockReturnValue(user);

    const response = await request(app)
      .post("/auth/reset-password")
      .send({ token: "expired-token", newPassword: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Lien de modification du mot de passe expiré / Expired password change link");
  });

  test("nouveau mot de passe invalide", async () => {
    const user = await makeMockUser({
      PasswordResetToken: "valid-token",
      PasswordResetTokenExp: new Date(Date.now() + 60 * 60 * 1000),
    });

    mockFindFirst.mockReturnValue(user);

    const response = await request(app)
      .post("/auth/reset-password")
      .send({ token: "valid-token", newPassword: "trop-court" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Mot de passe");
  });

  test("erreur de base de données", async () => {
    mockFindFirst.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await request(app)
      .post("/auth/reset-password")
      .send({ token: "valid-token", newPassword: VALID_PASSWORD });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Échec de la connexion au serveur / Failed to connect to the server");
  });
});

// --------------------
// POST /auth/logout
// --------------------

describe("POST /auth/logout", () => {
  test("déconnexion réussie (après login + verifyTOTP)", async () => {
    const user = await makeMockUser({
      username: "Alice",
      email: "alice@test.com",
    });

    mockFindFirst.mockReturnValue(user);
    mockFindUnique.mockReturnValue(user);
    mockVerify.mockResolvedValue({ valid: true });

    const agent = request.agent(app);

    await agent
      .post("/auth/login")
      .send({ username_OR_email: "Alice", password: VALID_PASSWORD });

    await agent
      .post("/auth/verifyTOTP")
      .send({ token: "123456" });

    const response = await agent.post("/auth/logout");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Déconnexion réussie");
  });

  test("échec si utilisateur non authentifié", async () => {
    const response = await request(app).post("/auth/logout");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Utilisateur non authentifié / User not authenticated");
  });
});