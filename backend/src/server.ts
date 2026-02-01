import { env } from './config/env';
import app from './app';
import { logger } from './utils/logger';
import { startScheduler } from './modules/notifications/notifications.scheduler';
import { startAuditScheduler } from './modules/audit/audit.scheduler';
import { createServer } from 'http';
import { initializeSocketServer } from './realtime/socket';

const PORT = env.PORT;
const httpServer = createServer(app);
initializeSocketServer(httpServer);

httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} [${env.NODE_ENV}]`);
  startScheduler();
  startAuditScheduler();
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});
