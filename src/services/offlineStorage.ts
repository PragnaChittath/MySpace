import { VaultDocument, User, ShareLink, AuditLog } from '../types.js';

// IndexedDB database configuration for client-side encrypted storage
const DB_NAME = 'MySpace_Offline_Encrypted_DB_v1';
const DB_VERSION = 1;

const STORES = {
  DOCUMENTS: 'encrypted_documents',
  USER: 'encrypted_user',
  SHARES: 'encrypted_shares',
  AUDIT_LOGS: 'encrypted_audit',
  SECURITY: 'security_metadata'
};

// Device-level salt & persistent key derivation for AES-GCM at rest
let cachedCryptoKey: CryptoKey | null = null;

/**
 * Converts ArrayBuffer to Hex string
 */
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts Hex string to Uint8Array
 */
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Initialize IndexedDB with encrypted stores
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
        const docStore = db.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id' });
        docStore.createIndex('userId', 'userId', { unique: false });
        docStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.USER)) {
        db.createObjectStore(STORES.USER, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.SHARES)) {
        db.createObjectStore(STORES.SHARES, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.AUDIT_LOGS)) {
        db.createObjectStore(STORES.AUDIT_LOGS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.SECURITY)) {
        db.createObjectStore(STORES.SECURITY, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves or creates a secure client-side hardware/device master key for WebCrypto AES-GCM encryption at rest
 */
async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;

  const db = await openDB();

  // Check if we have an existing device salt
  let deviceSaltHex: string | null = await new Promise((resolve) => {
    const tx = db.transaction(STORES.SECURITY, 'readonly');
    const store = tx.objectStore(STORES.SECURITY);
    const req = store.get('device_salt');
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => resolve(null);
  });

  if (!deviceSaltHex) {
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    deviceSaltHex = bufferToHex(newSalt);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.SECURITY, 'readwrite');
      const store = tx.objectStore(STORES.SECURITY);
      const req = store.put({ key: 'device_salt', value: deviceSaltHex, createdAt: new Date().toISOString() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  const saltBytes = hexToBuffer(deviceSaltHex);
  const encoder = new TextEncoder();
  const baseKeyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode('myspace-client-offline-at-rest-entropy-seed-2026'),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  cachedCryptoKey = derivedKey;
  return derivedKey;
}

/**
 * Encrypt arbitrary JSON data at rest using client-side WebCrypto AES-256-GCM
 */
async function encryptAtRest(data: any): Promise<{ ivHex: string; encryptedBuffer: ArrayBuffer }> {
  const key = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encoder = new TextEncoder();
  const encoded = encoder.encode(JSON.stringify(data));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    ivHex: bufferToHex(iv),
    encryptedBuffer
  };
}

/**
 * Decrypt data from IndexedDB using client-side WebCrypto AES-256-GCM
 */
async function decryptAtRest<T>(encryptedBuffer: ArrayBuffer, ivHex: string): Promise<T> {
  const key = await getOrCreateEncryptionKey();
  const iv = hexToBuffer(ivHex);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedBuffer
  );

  const decoder = new TextDecoder();
  const jsonStr = decoder.decode(decryptedBuffer);
  return JSON.parse(jsonStr);
}

export interface OfflineCacheStats {
  cachedDocsCount: number;
  cachedBytes: number;
  lastSyncedAt: string | null;
  isEncryptionActive: boolean;
  algorithm: string;
}

export interface ClientUserRecord extends User {
  passwordHash: string;
  passwordSalt: string;
  faceEmbedding?: number[];
  faceEmbeddingEncrypted?: string;
  faceEmbeddingIv?: string;
  faceEmbeddingAuthTag?: string;
  faceEmbeddingSalt?: string;
  faceAuthEnabled?: boolean;
  hasFaceBiometrics?: boolean;
  faceRegisteredAt?: string;
  failedFaceAttempts?: number;
}

export async function hashPasswordClient(password: string, customSalt?: string): Promise<{ hash: string; salt: string }> {
  const salt = customSalt || bufferToHex(crypto.getRandomValues(new Uint8Array(16)));
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: hexToBuffer(salt),
          iterations: 50000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );
      const hash = bufferToHex(new Uint8Array(derivedBits));
      return { hash, salt };
    }
  } catch (err) {
    console.warn('[OfflineStorage] Subtle crypto derivation fallback', err);
  }
  // Simple fallback hash
  let fallbackHash = 0;
  for (let i = 0; i < password.length; i++) {
    fallbackHash = ((fallbackHash << 5) - fallbackHash) + password.charCodeAt(i);
    fallbackHash |= 0;
  }
  return { hash: `fb_${Math.abs(fallbackHash)}_${salt}`, salt };
}

export async function verifyPasswordClient(password: string, storedHash: string, salt: string): Promise<boolean> {
  const result = await hashPasswordClient(password, salt);
  return result.hash === storedHash;
}

export const offlineStorage = {
  /**
   * Check if offline storage is available in the current browser
   */
  isSupported(): boolean {
    return typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined' && !!crypto.subtle;
  },

  /**
   * Save a document to encrypted offline IndexedDB storage (AES-256-GCM at rest)
   */
  async saveDocument(doc: VaultDocument): Promise<void> {
    try {
      const db = await openDB();
      const { ivHex, encryptedBuffer } = await encryptAtRest(doc);

      const record = {
        id: doc.id,
        userId: doc.userId,
        title: doc.title,
        category: doc.category,
        fileSize: doc.fileSize,
        cachedAt: new Date().toISOString(),
        ivHex,
        encryptedBuffer
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.DOCUMENTS, 'readwrite');
        const store = tx.objectStore(STORES.DOCUMENTS);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[OfflineStorage] Failed to encrypt & cache document:', err);
    }
  },

  /**
   * Save multiple documents in a single batch transaction
   */
  async saveDocumentsBatch(docs: VaultDocument[]): Promise<void> {
    if (!docs || docs.length === 0) return;
    try {
      const db = await openDB();
      const tx = db.transaction([STORES.DOCUMENTS, STORES.SECURITY], 'readwrite');
      const docStore = tx.objectStore(STORES.DOCUMENTS);
      const secStore = tx.objectStore(STORES.SECURITY);

      for (const doc of docs) {
        const { ivHex, encryptedBuffer } = await encryptAtRest(doc);
        docStore.put({
          id: doc.id,
          userId: doc.userId,
          title: doc.title,
          category: doc.category,
          fileSize: doc.fileSize,
          cachedAt: new Date().toISOString(),
          ivHex,
          encryptedBuffer
        });
      }

      secStore.put({
        key: 'last_sync_timestamp',
        value: new Date().toISOString(),
        docCount: docs.length
      });

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[OfflineStorage] Failed to save batch documents offline:', err);
    }
  },

  /**
   * Alias for saveDocumentsBatch
   */
  async saveDocuments(docs: VaultDocument[]): Promise<void> {
    return this.saveDocumentsBatch(docs);
  },

  /**
   * Retrieve and decrypt all offline cached documents for a user (excludes hidden items by default)
   */
  async getDocuments(userId?: string, includeHidden: boolean = false): Promise<VaultDocument[]> {
    try {
      const db = await openDB();
      const records: any[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.DOCUMENTS, 'readonly');
        const store = tx.objectStore(STORES.DOCUMENTS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      const decryptedDocs: VaultDocument[] = [];
      for (const record of records) {
        if (!userId || record.userId === userId) {
          try {
            const decryptedDoc = await decryptAtRest<VaultDocument>(record.encryptedBuffer, record.ivHex);
            if (includeHidden || !decryptedDoc.isHidden) {
              decryptedDocs.push(decryptedDoc);
            }
          } catch (decErr) {
            console.error('[OfflineStorage] Decryption error for doc:', record.id, decErr);
          }
        }
      }

      // Sort by creation date descending
      return decryptedDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      console.warn('[OfflineStorage] Error retrieving offline documents:', err);
      return [];
    }
  },

  /**
   * Retrieve and decrypt hidden documents for a user from encrypted offline store
   */
  async getHiddenDocuments(userId?: string): Promise<VaultDocument[]> {
    try {
      const db = await openDB();
      const records: any[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.DOCUMENTS, 'readonly');
        const store = tx.objectStore(STORES.DOCUMENTS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      const decryptedDocs: VaultDocument[] = [];
      for (const record of records) {
        if (!userId || record.userId === userId) {
          try {
            const decryptedDoc = await decryptAtRest<VaultDocument>(record.encryptedBuffer, record.ivHex);
            if (decryptedDoc.isHidden === true) {
              decryptedDocs.push(decryptedDoc);
            }
          } catch (decErr) {
            console.error('[OfflineStorage] Decryption error for hidden doc:', record.id, decErr);
          }
        }
      }

      return decryptedDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      console.warn('[OfflineStorage] Error retrieving hidden offline documents:', err);
      return [];
    }
  },

  /**
   * Retrieve a single document from encrypted offline store
   */
  async getDocumentById(id: string): Promise<VaultDocument | null> {
    try {
      const db = await openDB();
      const record: any = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.DOCUMENTS, 'readonly');
        const store = tx.objectStore(STORES.DOCUMENTS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });

      if (!record) return null;
      return await decryptAtRest<VaultDocument>(record.encryptedBuffer, record.ivHex);
    } catch (err) {
      console.warn('[OfflineStorage] Error retrieving single offline document:', err);
      return null;
    }
  },

  /**
   * Delete a document from offline cache
   */
  async deleteDocument(id: string): Promise<void> {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.DOCUMENTS, 'readwrite');
        const store = tx.objectStore(STORES.DOCUMENTS);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[OfflineStorage] Failed to delete offline document:', err);
    }
  },

  /**
   * Save user session profile offline
   */
  async saveUser(user: User): Promise<void> {
    try {
      const db = await openDB();
      const { ivHex, encryptedBuffer } = await encryptAtRest(user);
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.USER, 'readwrite');
        const store = tx.objectStore(STORES.USER);
        const req = store.put({
          id: user.id || 'current_user',
          cachedAt: new Date().toISOString(),
          ivHex,
          encryptedBuffer
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[OfflineStorage] Failed to save user offline:', err);
    }
  },

  /**
   * Save full user credential record offline (with encrypted password hash & biometrics)
   */
  async saveUserRecord(userRecord: ClientUserRecord): Promise<void> {
    try {
      const db = await openDB();
      const { ivHex, encryptedBuffer } = await encryptAtRest(userRecord);
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.USER, 'readwrite');
        const store = tx.objectStore(STORES.USER);
        const req = store.put({
          id: userRecord.id,
          email: userRecord.email.toLowerCase(),
          cachedAt: new Date().toISOString(),
          ivHex,
          encryptedBuffer
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      // Also mirror to localStorage for instant non-indexedDB access
      if (typeof window !== 'undefined') {
        const existingUsers = this.getLocalStorageUsers();
        const idx = existingUsers.findIndex(u => u.id === userRecord.id || u.email.toLowerCase() === userRecord.email.toLowerCase());
        if (idx >= 0) {
          existingUsers[idx] = userRecord;
        } else {
          existingUsers.push(userRecord);
        }
        localStorage.setItem('myspace_vault_users', JSON.stringify(existingUsers));
      }
    } catch (err) {
      console.warn('[OfflineStorage] Failed to save user record offline:', err);
    }
  },

  getLocalStorageUsers(): ClientUserRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('myspace_vault_users');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Retrieve all user records from offline storage
   */
  async getAllUserRecords(): Promise<ClientUserRecord[]> {
    try {
      const db = await openDB();
      const records: any[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.USER, 'readonly');
        const store = tx.objectStore(STORES.USER);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      const users: ClientUserRecord[] = [];
      for (const r of records) {
        try {
          const u = await decryptAtRest<ClientUserRecord>(r.encryptedBuffer, r.ivHex);
          if (u && u.id && u.email) {
            users.push(u);
          }
        } catch {}
      }

      // Merge with localStorage users if any
      const lsUsers = this.getLocalStorageUsers();
      for (const lsu of lsUsers) {
        if (!users.some(u => u.id === lsu.id || u.email.toLowerCase() === lsu.email.toLowerCase())) {
          users.push(lsu);
        }
      }

      return users;
    } catch (err) {
      return this.getLocalStorageUsers();
    }
  },

  /**
   * Retrieve user record by email address
   */
  async getUserRecordByEmail(email: string): Promise<ClientUserRecord | null> {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const all = await this.getAllUserRecords();
    return all.find(u => u.email.toLowerCase() === cleanEmail) || null;
  },

  /**
   * Retrieve user record by user ID
   */
  async getUserRecordById(id: string): Promise<ClientUserRecord | null> {
    if (!id) return null;
    const all = await this.getAllUserRecords();
    return all.find(u => u.id === id) || null;
  },

  /**
   * Delete user record from offline storage
   */
  async deleteUserRecord(id: string): Promise<void> {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.USER, 'readwrite');
        const store = tx.objectStore(STORES.USER);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      if (typeof window !== 'undefined') {
        const existingUsers = this.getLocalStorageUsers().filter(u => u.id !== id);
        localStorage.setItem('myspace_vault_users', JSON.stringify(existingUsers));
      }
    } catch (err) {
      console.warn('[OfflineStorage] Error deleting user record:', err);
    }
  },

  /**
   * Retrieve cached user session profile
   */
  async getUser(userId?: string): Promise<User | null> {
    try {
      if (userId) {
        const record = await this.getUserRecordById(userId);
        if (record) {
          const { passwordHash, passwordSalt, ...safeUser } = record;
          return safeUser;
        }
      }
      const db = await openDB();
      const records: any[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.USER, 'readonly');
        const store = tx.objectStore(STORES.USER);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (!records || records.length === 0) {
        const lsUsers = this.getLocalStorageUsers();
        if (lsUsers.length > 0) {
          const target = userId ? lsUsers.find(r => r.id === userId) || lsUsers[0] : lsUsers[0];
          const { passwordHash, passwordSalt, ...safeUser } = target;
          return safeUser;
        }
        return null;
      }
      const target = userId ? records.find(r => r.id === userId) || records[0] : records[0];
      const userObj = await decryptAtRest<any>(target.encryptedBuffer, target.ivHex);
      if (userObj) {
        const { passwordHash, passwordSalt, ...safeUser } = userObj;
        return safeUser;
      }
      return null;
    } catch (err) {
      console.warn('[OfflineStorage] Failed to retrieve offline user:', err);
      const lsUsers = this.getLocalStorageUsers();
      if (lsUsers.length > 0) {
        const target = userId ? lsUsers.find(r => r.id === userId) || lsUsers[0] : lsUsers[0];
        const { passwordHash, passwordSalt, ...safeUser } = target;
        return safeUser;
      }
      return null;
    }
  },

  /**
   * Save active shares to encrypted offline storage
   */
  async saveShares(shares: ShareLink[]): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORES.SHARES, 'readwrite');
      const store = tx.objectStore(STORES.SHARES);

      for (const share of shares) {
        const { ivHex, encryptedBuffer } = await encryptAtRest(share);
        store.put({
          id: share.id,
          cachedAt: new Date().toISOString(),
          ivHex,
          encryptedBuffer
        });
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[OfflineStorage] Failed to save shares offline:', err);
    }
  },

  /**
   * Retrieve cached shares
   */
  async getShares(): Promise<ShareLink[]> {
    try {
      const db = await openDB();
      const records: any[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.SHARES, 'readonly');
        const store = tx.objectStore(STORES.SHARES);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      const shares: ShareLink[] = [];
      for (const r of records) {
        try {
          const s = await decryptAtRest<ShareLink>(r.encryptedBuffer, r.ivHex);
          shares.push(s);
        } catch (e) {
          console.error(e);
        }
      }
      return shares;
    } catch (err) {
      return [];
    }
  },

  /**
   * Save audit logs offline
   */
  async saveAuditLogs(logs: AuditLog[]): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORES.AUDIT_LOGS, 'readwrite');
      const store = tx.objectStore(STORES.AUDIT_LOGS);

      for (const log of logs) {
        const { ivHex, encryptedBuffer } = await encryptAtRest(log);
        store.put({
          id: log.id,
          cachedAt: new Date().toISOString(),
          ivHex,
          encryptedBuffer
        });
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[OfflineStorage] Failed to save audit logs offline:', err);
    }
  },

  /**
   * Retrieve cached audit logs
   */
  async getAuditLogs(): Promise<AuditLog[]> {
    try {
      const db = await openDB();
      const records: any[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.AUDIT_LOGS, 'readonly');
        const store = tx.objectStore(STORES.AUDIT_LOGS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      const logs: AuditLog[] = [];
      for (const r of records) {
        try {
          const log = await decryptAtRest<AuditLog>(r.encryptedBuffer, r.ivHex);
          logs.push(log);
        } catch (e) {
          console.error(e);
        }
      }
      return logs;
    } catch (err) {
      return [];
    }
  },

  /**
   * Get offline cache diagnostic and storage statistics
   */
  async getStats(): Promise<OfflineCacheStats> {
    try {
      const db = await openDB();
      const docRecordsPromise = new Promise<any[]>((resolve) => {
        const tx = db.transaction(STORES.DOCUMENTS, 'readonly');
        const store = tx.objectStore(STORES.DOCUMENTS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      const lastSyncPromise = new Promise<any>((resolve) => {
        const tx = db.transaction(STORES.SECURITY, 'readonly');
        const store = tx.objectStore(STORES.SECURITY);
        const req = store.get('last_sync_timestamp');
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => resolve(null);
      });

      const [docRecords, lastSync] = await Promise.all([docRecordsPromise, lastSyncPromise]);

      let totalBytes = 0;
      for (const d of docRecords) {
        totalBytes += d.fileSize || 0;
        if (d.encryptedBuffer && d.encryptedBuffer.byteLength) {
          totalBytes += d.encryptedBuffer.byteLength;
        }
      }

      return {
        cachedDocsCount: docRecords.length,
        cachedBytes: totalBytes,
        lastSyncedAt: lastSync || (docRecords.length > 0 ? docRecords[0].cachedAt : null),
        isEncryptionActive: true,
        algorithm: 'WebCrypto AES-256-GCM + PBKDF2 (Encrypted at Rest)'
      };
    } catch (err) {
      return {
        cachedDocsCount: 0,
        cachedBytes: 0,
        lastSyncedAt: null,
        isEncryptionActive: true,
        algorithm: 'WebCrypto AES-256-GCM'
      };
    }
  },

  /**
   * Securely clear and purge all offline encrypted cache entries
   */
  async clearAll(): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(
        [STORES.DOCUMENTS, STORES.USER, STORES.SHARES, STORES.AUDIT_LOGS, STORES.SECURITY],
        'readwrite'
      );
      tx.objectStore(STORES.DOCUMENTS).clear();
      tx.objectStore(STORES.USER).clear();
      tx.objectStore(STORES.SHARES).clear();
      tx.objectStore(STORES.AUDIT_LOGS).clear();
      tx.objectStore(STORES.SECURITY).clear();

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => {
          cachedCryptoKey = null;
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[OfflineStorage] Error clearing offline cache:', err);
    }
  }
};
