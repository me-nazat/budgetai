import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'wealth-ai-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pendingTransactions';

interface PendingTransaction {
    id: string;
    payload: {
        actionType?: 'add' | 'edit' | 'delete';
        id?: number;
        type?: string;
        amount?: number;
        category?: string;
        description?: string;
        date?: string;
    };
    createdAt: number;
    retryCount: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
}

export async function queueTransaction(payload: PendingTransaction['payload']): Promise<string> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const record: PendingTransaction = {
        id,
        payload,
        createdAt: Date.now(),
        retryCount: 0,
    };
    await db.put(STORE_NAME, record);
    return id;
}

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
    const db = await getDb();
    const all = await db.getAll(STORE_NAME) as PendingTransaction[];
    return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteSyncedTransaction(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(STORE_NAME, id);
}

export async function incrementRetryCount(id: string): Promise<void> {
    const db = await getDb();
    const record = await db.get(STORE_NAME, id) as PendingTransaction | undefined;
    if (record) {
        record.retryCount += 1;
        await db.put(STORE_NAME, record);
    }
}
