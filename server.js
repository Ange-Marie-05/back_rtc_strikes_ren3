import express from 'express';
import cors from 'cors';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import pg from 'pg';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import errorHandler from './middleware/errorHandler.js';
import userRouter from './routes/user.routes.js';
import authRouter from './routes/auth.routes.js';
import serversRouter from './routes/servers.routes.js';
import channelRouter from './routes/channel.routes.js';
import messageRouter from './routes/messages.routes.js';
import dmRouter from './routes/dm.routes.js';
import { setIO } from './socket.js';
import { isProduction } from './config/env.js';

// WebSocket handlers
import { handleJoinUsersServers } from './ws/handlers/handlejoinusersservers.js';
import handleChannelJoin from './ws/handlers/handlechanneljoin.js';
import handleChannelLeave from './ws/handlers/handlechannelleave.js';
import handleMessageSend from './ws/handlers/handleMessageSend.js';
import handleMessageDelete from './ws/handlers/handleMessageDelete.js';
import handleMessageEdit from './ws/handlers/handleMessageEdit.js'
import handleTypingStart from './ws/handlers/handletypingstart.js';
import handleTypingStop from './ws/handlers/handletypingstop.js';
import handleDisconnect from './ws/handlers/handleDisconnect.js';
import handleDMSend from './ws/handlers/handleDMSend.js';
import handleDMDelete from './ws/handlers/handleDMDelete.js';
import handleDMEdit from './ws/handlers/handleDMEdit.js';
import handleReactAdd from './ws/handlers/handleReactAdd.js';
import handleReactRemove from './ws/handlers/handleReactRemove.js';
import handleDMReactAdd from './ws/handlers/handleDMReactAdd.js';
import handleDMReactRemove from './ws/handlers/handleDMReactRemove.js';
import handleUserConnected from './ws/handlers/handleUserConnected.js';
import handleUserDisconnected from './ws/handlers/handleUserDisconnected.js';
import handleGetGlobalOnline from './ws/handlers/handleGetGlobalOnline.js';
import handleDMTypingStart from './ws/handlers/handleDMTypingStart.js';
import handleDMTypingStop from './ws/handlers/handleDMTypingStop.js';

dotenv.config();

//connect-pg-simple est un adaptateur qui dit à express-session "au lieu de stocker les sessions en mémoire, stocke-les dans Postgres".
const PgStore = pgSession(session); //on lui passe express-session pour qu'il s'y connecte
//pg est le driver postgresql pour nodejs. il permet de se connecter à la db sans passer par prisma
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
}) //pool = ensemble de connexions ouvertes vers ta DB Postgres

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigin = process.env.FRONTEND_URL;
//En prod, Railway est un proxy
//Express peut refuser de poser correctement le cookie si trust proxy n’est pas activé
app.set("trust proxy", 1);

// Créer le serveur HTTP avant de configurer les middlewares
const serveurHttp = http.createServer(app);

// Configuration de la session AVANT tout
const sessionMiddleware = session({
  store: new PgStore({
    pool,                          //connexion à Postgres
    tableName: 'sessions',         //nom de la table créé automatiquement pour stocker la session
    createTableIfMissing: true     //créé la table si elle n'existe pas
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    httpOnly: true, 
    secure: isProduction, 
    sameSite: isProduction ? 'none' : 'lax', 
    maxAge: 24 * 60 * 60 * 1000 
  }
});

// Middlewares
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  allowedHeaders: ['Content-type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware); // Utiliser la session partagée

// Routes
app.use(userRouter);
app.use('/auth', authRouter);
app.use('/servers', serversRouter);
app.use('/channels', channelRouter);
app.use('/messages', messageRouter);
app.use('/dm', dmRouter);

// Test route
app.get('/', (req, res) => res.send('API is running'));

// Error handler
app.use(errorHandler);


// CONFIGURATION SOCKET.IO
const io = new Server(serveurHttp, {
  cors: {
    origin: allowedOrigin,
    credentials: true,
    methods: ["GET", "POST"]
  },
  path: '/socket.io'
});

setIO(io);

// Partager la session entre Express et Socket.io
io.engine.use(sessionMiddleware);


// WEBSOCKET - GESTION DES CONNEXIONS
io.on('connection', async (socket) => {
  console.log('Nouvelle connexion WebSocket:', socket.id);

  // Authentification via session
  const session = socket.request.session;
  const userId = session?.user?.id;

  if (!userId) {
    console.log('Connexion refusée: pas de session utilisateur');
    socket.disconnect();
    return;
  }

  console.log(`Utilisateur ${userId} authentifié via session`);
  socket.userId = userId;

  // Rejoindre automatiquement les serveurs de l'utilisateur
  try {
    await handleJoinUsersServers(socket, io);
    await handleUserConnected(socket, io);
    console.log(`Utilisateur ${userId} a rejoint ses serveurs`);
  } catch (error) {
    console.error('Erreur lors du join des serveurs:', error);
  }

  // Répondre à la demande de liste des connectés sur un serveur
  socket.on("presence:join_server", async ({ serverId }) => {
  const roomName = `active_server:${serverId}`;

  await socket.join(roomName);

  const room = io.sockets.adapter.rooms.get(roomName);
  const onlineUserIds = [];

  console.log("JOIN SERVER", {
    userId: socket.userId,
    socketId: socket.id,
    serverId,
    roomExists: !!room,
    roomSockets: room ? [...room] : [],
  });

  if (room) {
    for (const socketId of room) {
      const s = io.sockets.sockets.get(socketId);
      if (s?.userId && !onlineUserIds.includes(s.userId)) {
        onlineUserIds.push(s.userId);
      }
    }
  }

  console.log("ONLINE LIST AFTER JOIN", { serverId, onlineUserIds });

  io.to(roomName).emit("presence:online_list", {
    serverId,
    userIds: onlineUserIds,
  });
  });

  socket.on("presence:leave_server", ({ serverId }) => {
    const roomName = `active_server:${serverId}`;
    socket.leave(roomName);

    const room = io.sockets.adapter.rooms.get(roomName);
    const onlineUserIds = [];

    if (room) {
      for (const socketId of room) {
        const s = io.sockets.sockets.get(socketId);
        if (s?.userId && !onlineUserIds.includes(s.userId)) {
          onlineUserIds.push(s.userId);
        }
      }
    }

    io.to(roomName).emit("presence:online_list", {
      serverId,
      userIds: onlineUserIds,
    });
  });

  //PRÉSENCE GLOBAL
  socket.on('presence:get_global_online', () => handleGetGlobalOnline(socket, io));

  // ÉVÉNEMENTS DE CHANNELS
  socket.on('channel:join', (data) => {
    console.log(`User ${socket.userId} rejoint channel ${data.channelId}`);
    handleChannelJoin(socket, data);
  });

  socket.on('channel:leave', (data) => {
    console.log(`User ${socket.userId} quitte channel ${data.channelId}`);
    handleChannelLeave(socket, data);
  });


  // ÉVÉNEMENTS DE MESSAGES
  socket.on('message:send', (data) => {
    console.log(`Message de ${socket.userId} dans channel ${data.channelId}: "${data.content}"`);
    handleMessageSend(socket, data, io);
  });

  socket.on('message:delete', (data) => {
    console.log(`User ${socket.userId} supprime message ${data.messageId}`);
    handleMessageDelete(socket, data, io);
  });

  socket.on('message:edit', (data) => {
    console.log(`User ${socket.userId} à édité message ${data.messageId}`);
    handleMessageEdit(socket,data,io);
  })

  // ÉVENEMENT DM
  socket.on('dm:send', (data) => {
    console.log(`DM de ${socket.userId} à ${data.receiverId}`);
    handleDMSend(socket, data, io);
  })

  socket.on('dm:delete', (data) => {
    console.log(`User ${socket.userId} supprime DM ${data.messageId}`);
    handleDMDelete(socket, data, io);
  });

  socket.on('dm:edit', (data) => {
    console.log(`User ${socket.userId} édite DM ${data.messageId}`);
    handleDMEdit(socket, data, io);
  });
  

  // GESTION DES REACTS
  socket.on('react:add', (data) => {
    handleReactAdd(socket, data, io)
  })

  socket.on('react:remove', (data) => {
    handleReactRemove(socket, data, io);
  })

  // GESTION DES REACTS DANS DM
  socket.on('dm:react:add', (data) => handleDMReactAdd(socket, data, io));

  socket.on('dm:react:remove', (data) => handleDMReactRemove(socket, data, io));

 
  // ÉVÉNEMENTS DE TYPING
  socket.on('typing:start', (data) => {
    handleTypingStart(socket, data, io);
  });

  socket.on('typing:stop', (data) => {
    handleTypingStop(socket, data, io);
  });


  // ÉVÈNEMENTS DE TYPING DANS LES DM
  socket.on('dm:typing:start', (data) => handleDMTypingStart(socket, data, io));

  socket.on('dm:typing:stop', (data) => handleDMTypingStop(socket, data, io));


  // DÉCONNEXION
  // Sauvegarder les rooms avant déconnexion
  socket.on('disconnecting', () => {
    socket.serverRooms = [...socket.rooms].filter(r => r.startsWith('server:'));
  });

  socket.on('disconnect', () => {
    console.log('Utilisateur déconnecté:', socket.id, 'User ID:', socket.userId);
    handleUserDisconnected(socket, io);
    handleDisconnect(socket, io);
  });


  // GESTION DES ERREURS
  socket.on('error', (error) => {
    console.error('Erreur WebSocket:', error);
  });
});

// Démarrage du serveur
serveurHttp.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket ready on ws://localhost:${PORT}`);
  console.log(`Frontend expected on ${allowedOrigin}`);
});

export {app,io};