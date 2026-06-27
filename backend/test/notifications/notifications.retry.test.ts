/** Tests for sendToWebhook retry behavior */
jest.mock('axios');
jest.mock('../../src/config/database', () => ({
  __esModule: true,
  prisma: require('jest-mock-extended').mockDeep(),
}));

import axios from 'axios';
import { prismaMock } from '../config/singleton';
import { sendToWebhook } from '../../src/modules/notifications/notifications.service';

const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
  jest.clearAllMocks();
});

it('retries on failure and records sent status when succeeds', async () => {
  mockedAxios.post.mockRejectedValueOnce(new Error('net error'))
    .mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValueOnce({ status: 200, data: 'ok' } as any);

  prismaMock.notificationLog.create.mockResolvedValue({ id: 'log-1' } as any);

  const res = await sendToWebhook({ webhookUrl: 'https://hooks.test/1', payload: { hello: 'world' }, type: 'test', message: 'msg' });

  expect(mockedAxios.post).toHaveBeenCalledTimes(3);
  expect(prismaMock.notificationLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'sent' }) }));
});

it('records failed status after exhausting retries', async () => {
  mockedAxios.post.mockRejectedValue(new Error('fatal'));
  prismaMock.notificationLog.create.mockResolvedValue({ id: 'log-2' } as any);

  const res = await sendToWebhook({ webhookUrl: 'https://hooks.test/2', payload: { hello: 'x' }, type: 'test', message: 'msg' });

  expect(mockedAxios.post).toHaveBeenCalledTimes(3);
  expect(prismaMock.notificationLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }));
});
