import { migrateData, type AppData } from '../types';
const DB_NAME = 'mindpilot-local-v1';
let connection: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('app');
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); connection = undefined; };
      resolve(request.result);
    };
    request.onerror = () => { connection = undefined; reject(request.error); };
    request.onblocked = () => { connection = undefined; reject(new Error('Close other MindPilot tabs, then reload.')); };
  });
  return connection;
}
export async function readData(): Promise<AppData> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('app', 'readonly');
    const request = tx.objectStore('app').get('data');
    tx.oncomplete = () => { try { resolve(migrateData(request.result)); } catch (error) { reject(error); } };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Reading local data was interrupted.'));
  });
}
// Read and write in one transaction: concurrent tabs cannot overwrite each other's changes.
export async function mutateData(change: (draft: AppData) => void): Promise<AppData> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('app', 'readwrite');
    const store = tx.objectStore('app');
    const request = store.get('data');
    let result: AppData;
    let failure: unknown;
    request.onsuccess = () => {
      try {
        result = migrateData(request.result);
        change(result);
        store.put(result, 'data');
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(failure ?? tx.error);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Local storage could not save your change.'));
  });
}
export async function closeDatabase() { if (connection) (await connection).close(); connection = undefined; }
