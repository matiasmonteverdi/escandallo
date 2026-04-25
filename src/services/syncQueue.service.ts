export type SyncAction = {
  id: string;
  type: 'CREATE_DISH' | 'UPDATE_DISH' | 'DELETE_DISH' | 'ADD_INVENTORY' | 'ADD_PRODUCTION';
  payload: any;
  timestamp: number;
  retryCount: number;
  processed?: boolean;
};

class SyncQueueService {
  private dbName = 'escandallo-sync-db';
  private storeName = 'sync-queue';
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async enqueue(action: Omit<SyncAction, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const db = await this.getDB();
    const fullAction: SyncAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(fullAction);

      request.onsuccess = () => resolve(fullAction.id);
      request.onerror = () => reject(request.error);
    });
  }

  async getQueue(): Promise<SyncAction[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by timestamp to ensure FIFO
        const actions = request.result as SyncAction[];
        resolve(actions.sort((a, b) => a.timestamp - b.timestamp));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async dequeue(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async incrementRetry(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const action = getRequest.result as SyncAction;
        if (action) {
          action.retryCount += 1;
          const updateRequest = store.put(action);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async markProcessed(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const action = getRequest.result as SyncAction;
        if (action) {
          action.processed = true;
          const updateRequest = store.put(action);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }
}

export const syncQueueService = new SyncQueueService();
