import express from 'express';
import cors from 'cors';
import session from 'express-session';
import errorHandler from './middleware/errorHandler.js';
import userRouter from './routes/user.routes.js';
import authRouter from './routes/auth.routes.js';
import serversRouter from './routes/servers.routes.js';
import channelRouter from './routes/channel.routes.js';
import messageRouter from './routes/messages.routes.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const allowedOrigin = process.env.FRONTEND_URL || `http://localhost:${process.env.FRONTEND_PORT}`;

// Middlewares
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  allowedHeaders: ['Content-type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
  // 24 = h; 60 = min; 60 = sec; 1000 = msec
}));

// Routes
app.use(userRouter);
app.use('/auth', authRouter);
app.use('/servers', serversRouter);
app.use('/channels', channelRouter);
app.use('/messages', messageRouter);

// Test route
app.get('/', (req, res) => res.send('API is running'));

// Error handler
app.use(errorHandler);

export default app;
