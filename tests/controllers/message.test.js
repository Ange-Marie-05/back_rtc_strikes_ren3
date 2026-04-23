import { test, expect, describe, beforeEach, afterEach, mock, spyOn } from "bun:test";
import request from "supertest";
import bcrypt from "bcryptjs";

// --------------------
// Mocks auth-related deps
// --------------------

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

import * as messagesModel from "../../models/messages.models.js";
import app from "../../app.js";
import { createError } from "../../utils/errors.js";

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

  mockVerify.mockReset();
  mockQRCodeToDataURL.mockReset();
  mockSendWelcomeEmail.mockReset();

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
// GET /channels/:id/messages
// ========================================

describe("GET /channels/:id/messages", () => {
  test("récupération des messages réussie avec limite par défaut et rôle utilisateur", async () => {
    const { agent } = await createAuthenticatedAgent();

    const getMessagesSpy = spyOn(messagesModel, "getMessagesByChannel").mockReturnValue({
      messages: [
        {
          id: "msg-1",
          content: "Hello world",
          userId: "user-1",
          channelId: "channel-1",
          createdAt: new Date(),
          user: {
            id: "user-1",
            username: "Alice",
          },
        },
        {
          id: "msg-2",
          content: "How are you?",
          userId: "user-1",
          channelId: "channel-1",
          createdAt: new Date(),
          user: {
            id: "user-1",
            username: "Alice",
          },
        },
      ],
      userRole: "Member",
      userId: "user-1",
    });

    const response = await agent.get("/channels/channel-1/messages");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("messages");
    expect(response.body).toHaveProperty("userRole");
    expect(response.body).toHaveProperty("userId");
    expect(Array.isArray(response.body.messages)).toBe(true);
    expect(response.body.messages.length).toBe(2);
    expect(response.body.userRole).toBe("Member");
    expect(response.body.userId).toBe("user-1");
    expect(getMessagesSpy).toHaveBeenCalledWith("channel-1", 50, "user-1");
  });

  test("récupération avec limite personnalisée", async () => {
    const { agent } = await createAuthenticatedAgent();

    const getMessagesSpy = spyOn(messagesModel, "getMessagesByChannel").mockReturnValue({
      messages: [],
      userRole: "Admin",
      userId: "user-1",
    });

    const response = await agent.get("/channels/channel-1/messages?limit=10");

    expect(response.status).toBe(200);
    expect(getMessagesSpy).toHaveBeenCalledWith("channel-1", 10, "user-1");
  });

  test("utilisateur Owner peut voir les messages", async () => {
    const { agent } = await createAuthenticatedAgent({
      id: "user-owner",
      username: "Owner",
      email: "owner@test.com",
    });

    spyOn(messagesModel, "getMessagesByChannel").mockReturnValue({
      messages: [
        {
          id: "msg-1",
          content: "Message from owner",
          userId: "user-owner",
          channelId: "channel-1",
          createdAt: new Date(),
          user: {
            id: "user-owner",
            username: "Owner",
          },
        },
      ],
      userRole: "Owner",
      userId: "user-owner",
    });

    const response = await agent.get("/channels/channel-1/messages");

    expect(response.status).toBe(200);
    expect(response.body.userRole).toBe("Owner");
  });

  test("échec si utilisateur non authentifié", async () => {
    const response = await request(app).get("/channels/channel-1/messages");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Utilisateur non authentifié / User not authenticated"
    );
  });

  test("échec si channel introuvable", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(messagesModel, "getMessagesByChannel").mockImplementation(() => {
      throw createError("CHANNEL_NOT_FOUND");
    });

    const response = await agent.get("/channels/channel-999/messages");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Channel introuvable / Channel cannot be found"
    );
  });

  test("échec si utilisateur non membre du serveur", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(messagesModel, "getMessagesByChannel").mockImplementation(() => {
      throw createError("USER_NOT_MEMBER");
    });

    const response = await agent.get("/channels/channel-1/messages");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Vous n'êtes pas membre de ce serveur / You are not a member of this server"
    );
  });

  test("erreur de base de données", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(messagesModel, "getMessagesByChannel").mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await agent.get("/channels/channel-1/messages");

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Échec de la connexion au serveur / Failed to connect to the server"
    );
  });
});

// ========================================
// POST /channels/:id/messages
// ========================================

describe("POST /channels/:id/messages", () => {
  test("création de message réussie", async () => {
    const { agent } = await createAuthenticatedAgent();

    const createMessageSpy = spyOn(messagesModel, "createMessage").mockReturnValue({
      id: "msg-123",
      content: "Hello world",
      isGif: false,
      userId: "user-1",
      channelId: "channel-1",
      createdAt: new Date(),
      user: {
        id: "user-1",
        username: "Alice",
      },
    });

    const response = await agent
      .post("/channels/channel-1/messages")
      .send({ content: "Hello world" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("id");
    expect(response.body).toHaveProperty("content");
    expect(response.body.content).toBe("Hello world");
    expect(response.body).toHaveProperty("user");
    expect(createMessageSpy).toHaveBeenCalledWith(
      "user-1",
      "channel-1",
      "Hello world",
      false
    );
  });

  test("création message gif", async () => {
    const { agent } = await createAuthenticatedAgent();

    const createMessageSpy = spyOn(messagesModel, "createMessage").mockReturnValue({
      id: "msg-123",
      content: "gif",
      isGif: true,
    });

    const response = await agent
      .post("/channels/channel-1/messages")
      .send({ content: "gif", isGif: true });

    expect(response.status).toBe(201);
    expect(createMessageSpy).toHaveBeenCalledWith(
      "user-1",
      "channel-1",
      "gif",
      true
    );
  });

  test("échec si utilisateur non authentifié", async () => {
    const response = await request(app)
      .post("/channels/channel-1/messages")
      .send({ content: "Hello" });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Utilisateur non authentifié / User not authenticated"
    );
  });

  test("échec si contenu vide", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent
      .post("/channels/channel-1/messages")
      .send({ content: "" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Contenu du message vide / Message content is empty"
    );
  });

  test("échec si contenu avec uniquement des espaces", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent
      .post("/channels/channel-1/messages")
      .send({ content: "   " });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Contenu du message vide / Message content is empty"
    );
  });

  test("échec si contenu absent", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent
      .post("/channels/channel-1/messages")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Contenu du message vide / Message content is empty"
    );
  });

  test("échec si contenu trop long", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(messagesModel, "createMessage").mockImplementation(() => {
      throw createError("MESSAGE_INVALID_CONTENT");
    });

    const longContent = "a".repeat(2001);

    const response = await agent
      .post("/channels/channel-1/messages")
      .send({ content: longContent });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Contenu du message trop long / Message content is too long"
    );
  });

  test("échec si channel introuvable", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(messagesModel, "createMessage").mockImplementation(() => {
      throw createError("CHANNEL_NOT_FOUND");
    });

    const response = await agent
      .post("/channels/channel-999/messages")
      .send({ content: "Hello" });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Channel introuvable / Channel cannot be found"
    );
  });

  test("échec si utilisateur non membre du serveur", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(messagesModel, "createMessage").mockImplementation(() => {
      throw createError("USER_NOT_MEMBER");
    });

    const response = await agent
      .post("/channels/channel-1/messages")
      .send({ content: "Hello" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Vous n'êtes pas membre de ce serveur / You are not a member of this server"
    );
  });

  test("erreur de base de données", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(messagesModel, "createMessage").mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await agent
      .post("/channels/channel-1/messages")
      .send({ content: "Hello" });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Échec de la connexion au serveur / Failed to connect to the server"
    );
  });
});

// ========================================
// DELETE /messages/:messageId
// ========================================

describe("DELETE /messages/:messageId", () => {
  test("suppression de message réussie", async () => {
    const { agent } = await createAuthenticatedAgent();

    const deleteMessageSpy = spyOn(messagesModel, "deleteMessage").mockReturnValue({
      id: "msg-123",
      channelId: "channel-1",
    });

    const response = await agent.delete("/messages/msg-123");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Message supprimé avec succès");
    expect(deleteMessageSpy).toHaveBeenCalledWith("user-1", "msg-123");
  });

  test("échec si utilisateur non authentifié", async () => {
    const response = await request(app).delete("/messages/msg-123");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Utilisateur non authentifié / User not authenticated"
    );
  });

  test("échec si message introuvable", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(messagesModel, "deleteMessage").mockImplementation(() => {
      throw createError("MESSAGE_NOT_FOUND");
    });

    const response = await agent.delete("/messages/msg-999");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Message introuvable / Message cannot be found"
    );
  });

  test("échec si utilisateur non autorisé à supprimer", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(messagesModel, "deleteMessage").mockImplementation(() => {
      throw createError("MESSAGE_UNAUTHORIZED_DELETE");
    });

    const response = await agent.delete("/messages/msg-123");

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Vous n'êtes pas autorisé à supprimer ce message / You are not authorized to delete this message"
    );
  });

  test("erreur de base de données", async () => {
    const { agent } = await createAuthenticatedAgent();

    spyOn(messagesModel, "deleteMessage").mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const response = await agent.delete("/messages/msg-123");

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Échec de la connexion au serveur / Failed to connect to the server"
    );
  });
});