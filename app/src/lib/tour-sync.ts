import { ReadableStreamDefaultController } from 'stream/web';

type SyncClient = {
  controller: ReadableStreamDefaultController;
  userId: number;
};

const globalClients = globalThis as unknown as {
  tourSyncClients?: Map<number, Set<SyncClient>>;
};

if (!globalClients.tourSyncClients) {
  globalClients.tourSyncClients = new Map();
}

export const tourSyncClients = globalClients.tourSyncClients;

export function addSyncClient(tourId: number, userId: number, controller: any) {
  let clients = tourSyncClients.get(tourId);
  if (!clients) {
    clients = new Set();
    tourSyncClients.set(tourId, clients);
  }
  const client = { controller, userId };
  clients.add(client);
  
  return () => {
    clients.delete(client);
    if (clients.size === 0) {
      tourSyncClients.delete(tourId);
    }
  };
}

export function broadcastTourUpdate(tourId: number, payload: { type: string; data?: any }) {
  const clients = tourSyncClients.get(tourId);
  if (!clients) return;

  const encoder = new TextEncoder();
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  const encoded = encoder.encode(message);

  clients.forEach((client) => {
    try {
      client.controller.enqueue(encoded);
    } catch (err) {
      // Stream might have closed already, ignore
    }
  });
}
