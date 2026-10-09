import { Router } from 'express';
import authRoutes from './auth.routes.js';
import conversationRoutes from './conversation.routes.js';
import messageRoutes from './message.routes.js';
import userRoutes from './user.routes.js';
import uploadRoutes from './upload.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/conversations', conversationRoutes);
apiRouter.use('/messages', messageRoutes);
apiRouter.use('/uploads', uploadRoutes);
