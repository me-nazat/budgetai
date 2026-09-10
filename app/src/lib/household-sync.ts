/**
 * @fileoverview Household real-time synchronization manager using Server-Sent Events (SSE).
 *
 * Provides real-time balance and expense broadcasting to connected household members,
 * matching the established SSE pub/sub architecture.
 *
 * @module lib/household-sync
 */

import { ReadableStreamDefaultController } from 'stream/web';

type SyncClient = {
  controller: ReadableStreamDefaultController;
  userId: number;
};

const globalClients = globalThis as unknown as {
  householdSyncClients?: Map<number, Set<SyncClient>>;
};

if (!globalClients.householdSyncClients) {
  globalClients.householdSyncClients = new Map();
}

export const householdSyncClients = globalClients.householdSyncClients;

/**
 * Register an active SSE client stream for a household.
 */
export function addHouseholdSyncClient(householdId: number, userId: number, controller: any): () => void {
  let clients = householdSyncClients.get(householdId);
  if (!clients) {
    clients = new Set();
    householdSyncClients.set(householdId, clients);
  }
  const client: SyncClient = { controller, userId };
  clients.add(client);

  return () => {
    clients?.delete(client);
    if (clients && clients.size === 0) {
      householdSyncClients.delete(householdId);
    }
  };
}

/**
 * Broadcast an event payload to all connected members of a household.
 */
export function broadcastHouseholdUpdate(householdId: number, payload: { type: string; data?: any }): void {
  const clients = householdSyncClients.get(householdId);
  if (!clients || clients.size === 0) return;

  const encoder = new TextEncoder();
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  const encoded = encoder.encode(message);

  clients.forEach((client) => {
    try {
      client.controller.enqueue(encoded);
    } catch {
      // Stream may have disconnected; ignore
    }
  });
}
