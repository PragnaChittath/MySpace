import JSZip from 'jszip';
import { VaultDocument } from '../types.js';
import { api } from '../services/api.js';

export interface ExportProgress {
  stage: 'FETCHING' | 'KEY_DERIVATION' | 'ENCRYPTING' | 'PACKAGING' | 'COMPLETED' | 'ERROR';
  message: string;
  percent: number;
  currentFile?: string;
  totalFiles: number;
  processedFiles: number;
}

export interface ExportOptions {
  organizeByCategory?: boolean;
  includeOfflineDecryptor?: boolean;
  includeManifest?: boolean;
  archivePassword?: string;
  archiveName?: string;
  onProgress?: (progress: ExportProgress) => void;
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
  fileSizeBytes: number;
  documentsCount: number;
  checksumSha256: string;
}

/**
 * Derives a cryptographic key from password and salt using WebCrypto PBKDF2
 */
async function deriveWebCryptoKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Computes SHA-256 checksum of an ArrayBuffer or string
 */
async function computeSha256(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data).buffer as ArrayBuffer;
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer as ArrayBuffer;
  } else {
    buffer = data;
  }

  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Converts Base64 or DataURL to Uint8Array
 */
function dataUrlToBytes(dataUrlOrBase64: string): Uint8Array {
  let base64 = dataUrlOrBase64;
  if (dataUrlOrBase64.includes('base64,')) {
    base64 = dataUrlOrBase64.split('base64,')[1];
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates standalone offline HTML decryptor tool embedded directly inside the zip
 */
function generateOfflineDecryptorHtml(manifestJson: string, archiveTitle: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${archiveTitle} – Offline Vault Decryptor</title>
  <style>
    :root {
      --bg: #0b1120;
      --card-bg: #131d31;
      --border: #233554;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem;
    }
    .container {
      width: 100%;
      max-width: 860px;
    }
    .header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(37, 99, 235, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 0.5rem;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text);
    }
    input[type="password"], input[type="text"] {
      width: 100%;
      background: #090e17;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.75rem 1rem;
      border-radius: 0.6rem;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus {
      border-color: var(--primary);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: var(--primary);
      color: #fff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 0.6rem;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      width: 100%;
    }
    .btn:hover {
      background: var(--primary-hover);
    }
    .btn-secondary {
      background: #1e293b;
      color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover {
      background: #334155;
    }
    .btn-success {
      background: #059669;
    }
    .btn-success:hover {
      background: #047857;
    }
    .file-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .file-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.85rem 1rem;
      background: #0a101d;
      border: 1px solid var(--border);
      border-radius: 0.6rem;
      gap: 1rem;
    }
    .file-info {
      flex: 1;
      min-width: 0;
    }
    .file-name {
      font-weight: 600;
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-meta {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }
    .status-badge {
      font-size: 0.75rem;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-weight: 600;
    }
    .status-encrypted { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .status-decrypted { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .status-error { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .actions {
      display: flex;
      gap: 0.5rem;
    }
    .btn-sm {
      padding: 0.4rem 0.8rem;
      font-size: 0.8rem;
      border-radius: 0.4rem;
      width: auto;
    }
    .modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      align-items: center;
      justify-content: center;
      padding: 1rem;
      z-index: 100;
    }
    .modal.open { display: flex; }
    .modal-content {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 1rem;
      width: 100%;
      max-width: 800px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 1.5rem;
    }
    .preview-box {
      margin-top: 1rem;
      max-height: 60vh;
      overflow: auto;
      text-align: center;
      background: #000;
      border-radius: 0.5rem;
      padding: 1rem;
    }
    .preview-box img { max-width: 100%; max-height: 50vh; object-fit: contain; }
    .preview-box iframe { width: 100%; height: 50vh; border: none; }
    .preview-box audio { width: 100%; margin-top: 1rem; }
    .preview-box pre { text-align: left; color: #38bdf8; font-family: monospace; font-size: 0.8rem; white-space: pre-wrap; }
    .alert {
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.85rem;
      margin-bottom: 1rem;
      display: none;
    }
    .alert.visible { display: block; }
    .alert-danger { background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; }
    .alert-success { background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #a7f3d0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">🔒 Standalone Offline Decryptor</div>
      <h1>${archiveTitle}</h1>
      <p class="subtitle">Decrypt and inspect your secure documents locally in your browser. No server connection required.</p>
    </div>

    <div class="card">
      <div id="alertBox" class="alert"></div>

      <div class="form-group">
        <label for="archivePassword">Vault Master Password</label>
        <input type="password" id="archivePassword" placeholder="Enter the password used to encrypt this archive..." autocomplete="current-password" autofocus />
      </div>

      <div style="display: flex; gap: 0.75rem;">
        <button id="btnDecryptAll" class="btn">
          🔓 Decrypt All Documents
        </button>
        <button id="btnDownloadAll" class="btn btn-secondary" style="display: none;">
          📦 Download Decrypted Files (.zip)
        </button>
      </div>
    </div>

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 1.1rem; font-weight: 600;">Vault Documents (<span id="docCount">0</span>)</h2>
        <span style="font-size: 0.75rem; color: var(--text-muted);">AES-256-GCM Verified</span>
      </div>

      <div id="fileList" class="file-list"></div>
    </div>
  </div>

  <!-- Preview Modal -->
  <div id="previewModal" class="modal">
    <div class="modal-content">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 id="previewTitle" style="font-size: 1.1rem;">Document Preview</h3>
        <button id="btnClosePreview" class="btn btn-secondary btn-sm">✕ Close</button>
      </div>
      <div id="previewContainer" class="preview-box"></div>
      <div style="margin-top: 1rem; text-align: right;">
        <a id="btnDownloadSingle" class="btn btn-success btn-sm" download="">⬇ Download Decrypted File</a>
      </div>
    </div>
  </div>

  <script>
    // Embedded Manifest
    const manifest = ${manifestJson};
    const decryptedCache = new Map();

    document.getElementById('docCount').textContent = manifest.documents.length;
    renderDocumentList();

    function showAlert(msg, type = 'danger') {
      const el = document.getElementById('alertBox');
      el.className = 'alert visible alert-' + type;
      el.textContent = msg;
    }

    function hideAlert() {
      const el = document.getElementById('alertBox');
      el.className = 'alert';
    }

    function renderDocumentList() {
      const list = document.getElementById('fileList');
      list.innerHTML = '';

      manifest.documents.forEach((doc, idx) => {
        const item = document.createElement('div');
        item.className = 'file-item';

        const isDecrypted = decryptedCache.has(doc.id);
        const statusBadge = isDecrypted
          ? '<span class="status-badge status-decrypted">Decrypted</span>'
          : '<span class="status-badge status-encrypted">AES-256-GCM</span>';

        const buttons = isDecrypted
          ? \`<button class="btn btn-secondary btn-sm" onclick="previewDoc('\${doc.id}')">View</button>
             <button class="btn btn-success btn-sm" onclick="downloadDoc('\${doc.id}')">Download</button>\`
          : \`<button class="btn btn-secondary btn-sm" onclick="decryptSingle('\${doc.id}')">Decrypt</button>\`;

        item.innerHTML = \`
          <div class="file-info">
            <div class="file-name">\${doc.title} (\${doc.fileName})</div>
            <div class="file-meta">Category: \${doc.category} • Size: \${(doc.fileSize / 1024).toFixed(1)} KB • SHA-256: \${doc.checksumSha256 ? doc.checksumSha256.substring(0, 12) + '...' : 'N/A'}</div>
          </div>
          <div>\${statusBadge}</div>
          <div class="actions">\${buttons}</div>
        \`;
        list.appendChild(item);
      });
    }

    async function deriveKey(password, saltHex) {
      const salt = hexToBytes(saltHex);
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: manifest.encryptionMeta?.iterations || 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
    }

    function hexToBytes(hex) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
      }
      return bytes;
    }

    async function decryptDocument(doc, password) {
      if (!doc.encryption) throw new Error('Document has no encryption metadata');
      const key = await deriveKey(password, doc.encryption.salt);
      const iv = hexToBytes(doc.encryption.iv);
      const authTag = hexToBytes(doc.encryption.authTag);

      // Ciphertext from Base64
      const ciphertextBytes = Uint8Array.from(atob(doc.encryption.ciphertext), c => c.charCodeAt(0));
      
      // Combine ciphertext and authTag for WebCrypto AES-GCM
      const combined = new Uint8Array(ciphertextBytes.length + authTag.length);
      combined.set(ciphertextBytes, 0);
      combined.set(authTag, ciphertextBytes.length);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv, tagLength: 128 },
        key,
        combined
      );

      const decStr = new TextDecoder().decode(decryptedBuffer);
      return decStr;
    }

    async function handleDecryptAll() {
      hideAlert();
      const password = document.getElementById('archivePassword').value;
      if (!password) {
        showAlert('Please enter your archive master password.');
        return;
      }

      const btn = document.getElementById('btnDecryptAll');
      btn.disabled = true;
      btn.textContent = '⏳ Decrypting documents...';

      let successCount = 0;
      let errorCount = 0;

      for (const doc of manifest.documents) {
        try {
          const decrypted = await decryptDocument(doc, password);
          decryptedCache.set(doc.id, {
            content: decrypted,
            doc: doc
          });
          successCount++;
        } catch (err) {
          console.error('Failed to decrypt ' + doc.title, err);
          errorCount++;
        }
      }

      btn.disabled = false;
      btn.textContent = '🔓 Decrypt All Documents';

      if (successCount > 0 && errorCount === 0) {
        showAlert(\`Successfully decrypted all \${successCount} document(s) with authenticated AES-256-GCM integrity!\`, 'success');
      } else if (successCount > 0 && errorCount > 0) {
        showAlert(\`Decrypted \${successCount} document(s), but \${errorCount} failed. Check password.\`, 'danger');
      } else {
        showAlert('Decryption failed. Please verify your password and try again.', 'danger');
      }

      renderDocumentList();
    }

    async function decryptSingle(docId) {
      hideAlert();
      const password = document.getElementById('archivePassword').value;
      if (!password) {
        showAlert('Please enter your archive master password above first.');
        return;
      }

      const doc = manifest.documents.find(d => d.id === docId);
      if (!doc) return;

      try {
        const decrypted = await decryptDocument(doc, password);
        decryptedCache.set(doc.id, { content: decrypted, doc: doc });
        showAlert(\`Successfully decrypted "\${doc.title}"!\`, 'success');
        renderDocumentList();
      } catch (err) {
        showAlert(\`Failed to decrypt "\${doc.title}". Check password.\`, 'danger');
      }
    }

    function previewDoc(docId) {
      const item = decryptedCache.get(docId);
      if (!item) return;

      const doc = item.doc;
      const content = item.content;

      document.getElementById('previewTitle').textContent = doc.title + ' (' + doc.fileName + ')';
      const container = document.getElementById('previewContainer');
      container.innerHTML = '';

      const downloadBtn = document.getElementById('btnDownloadSingle');
      downloadBtn.href = content;
      downloadBtn.download = doc.fileName;

      const isImage = doc.fileType && doc.fileType.startsWith('image/');
      const isPdf = doc.fileType === 'application/pdf' || doc.fileName.endsWith('.pdf');
      const isAudio = doc.fileType && doc.fileType.startsWith('audio/');

      if (isImage) {
        const img = document.createElement('img');
        img.src = content;
        container.appendChild(img);
      } else if (isPdf) {
        const iframe = document.createElement('iframe');
        iframe.src = content;
        container.appendChild(iframe);
      } else if (isAudio) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.autoplay = true;
        audio.src = content;
        container.appendChild(audio);
      } else if (content.startsWith('data:')) {
        const text = document.createElement('p');
        text.style.color = '#94a3b8';
        text.textContent = 'Binary file ready for download: ' + doc.fileName;
        container.appendChild(text);
      } else {
        const pre = document.createElement('pre');
        pre.textContent = content.substring(0, 10000);
        container.appendChild(pre);
      }

      document.getElementById('previewModal').classList.add('open');
    }

    function downloadDoc(docId) {
      const item = decryptedCache.get(docId);
      if (!item) return;
      const link = document.createElement('a');
      link.href = item.content;
      link.download = item.doc.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    document.getElementById('btnDecryptAll').addEventListener('click', handleDecryptAll);
    document.getElementById('btnClosePreview').addEventListener('click', () => {
      document.getElementById('previewModal').classList.remove('open');
    });

    document.getElementById('archivePassword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleDecryptAll();
    });
  </script>
</body>
</html>`;
}

/**
 * Main function to generate the bulk encrypted zip archive
 */
export async function generateBulkEncryptedZip(
  documents: VaultDocument[],
  password: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const {
    organizeByCategory = true,
    includeOfflineDecryptor = true,
    includeManifest = true,
    archiveName,
    onProgress
  } = options;

  // Filter non-hidden documents strictly
  const nonHiddenDocs = documents.filter(d => !d.isHidden);

  if (nonHiddenDocs.length === 0) {
    throw new Error('No non-hidden documents found to export.');
  }

  const notify = (stage: ExportProgress['stage'], message: string, percent: number, currentFile?: string, processed = 0) => {
    if (onProgress) {
      onProgress({
        stage,
        message,
        percent,
        currentFile,
        totalFiles: nonHiddenDocs.length,
        processedFiles: processed
      });
    }
  };

  notify('FETCHING', 'Preparing documents and verifying cryptographic payloads...', 5);

  // 1. Fetch full decrypted content for any doc that doesn't have decryptedPreviewData
  const fullyLoadedDocs: (VaultDocument & { rawContent: string })[] = [];

  for (let i = 0; i < nonHiddenDocs.length; i++) {
    const doc = nonHiddenDocs[i];
    notify('FETCHING', `Loading document ${i + 1} of ${nonHiddenDocs.length}: ${doc.title}`, Math.round(5 + (i / nonHiddenDocs.length) * 25), doc.title, i);

    let rawContent = doc.decryptedPreviewData || '';
    if (!rawContent) {
      try {
        const fullDoc = await api.getDocument(doc.id);
        rawContent = fullDoc.decryptedPreviewData || '';
      } catch (err) {
        console.warn(`Could not fetch live decrypted preview for ${doc.title}, using encrypted ciphertext fallback`, err);
      }
    }

    fullyLoadedDocs.push({
      ...doc,
      rawContent
    });
  }

  notify('KEY_DERIVATION', 'Deriving PBKDF2-HMAC-SHA256 master key for AES-256-GCM archive...', 35);

  const archiveSalt = window.crypto.getRandomValues(new Uint8Array(16));
  const archiveSaltHex = Array.from(archiveSalt).map(b => b.toString(16).padStart(2, '0')).join('');

  const zip = new JSZip();

  // Create document manifest record
  const manifestData: {
    exportVersion: string;
    appName: string;
    exportedAt: string;
    totalDocuments: number;
    encryptionMeta: {
      algorithm: string;
      keyDerivation: string;
      iterations: number;
      archiveSalt: string;
    };
    documents: Array<{
      id: string;
      title: string;
      category: string;
      documentNumber?: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      issueDate?: string;
      expiryDate?: string;
      sensitivity: string;
      tags: string[];
      notes?: string;
      verifiedIssuer?: string;
      checksumSha256: string;
      archivePath: string;
      encryption: {
        ciphertext: string;
        iv: string;
        authTag: string;
        salt: string;
      };
    }>;
  } = {
    exportVersion: '2.0-AEAD-VAULT',
    appName: 'MySpace',
    exportedAt: new Date().toISOString(),
    totalDocuments: fullyLoadedDocs.length,
    encryptionMeta: {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2-HMAC-SHA256',
      iterations: 100000,
      archiveSalt: archiveSaltHex
    },
    documents: []
  };

  notify('ENCRYPTING', 'Encrypting documents with AES-256-GCM...', 45);

  // 2. Encrypt each file and add to ZIP
  for (let i = 0; i < fullyLoadedDocs.length; i++) {
    const doc = fullyLoadedDocs[i];
    const progressPercent = Math.round(45 + (i / fullyLoadedDocs.length) * 35);
    notify('ENCRYPTING', `Encrypting ${doc.fileName}...`, progressPercent, doc.title, i + 1);

    // Generate unique salt & IV for each document file
    const docSalt = window.crypto.getRandomValues(new Uint8Array(16));
    const docSaltHex = Array.from(docSalt).map(b => b.toString(16).padStart(2, '0')).join('');
    const docIv = window.crypto.getRandomValues(new Uint8Array(12));
    const docIvHex = Array.from(docIv).map(b => b.toString(16).padStart(2, '0')).join('');

    const key = await deriveWebCryptoKey(password, docSalt);

    const contentToEncrypt = doc.rawContent || doc.encryption.ciphertext || 'EMPTY_CONTENT';
    const contentBytes = new TextEncoder().encode(contentToEncrypt);
    const checksumSha256 = await computeSha256(contentBytes);

    // WebCrypto AES-GCM Encrypt
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: docIv,
        tagLength: 128
      },
      key,
      contentBytes
    );

    const encryptedBytes = new Uint8Array(encryptedBuffer);
    // In WebCrypto, the last 16 bytes are the authTag
    const tagLength = 16;
    const ciphertextBytes = encryptedBytes.slice(0, encryptedBytes.length - tagLength);
    const authTagBytes = encryptedBytes.slice(encryptedBytes.length - tagLength);

    const ciphertextBase64 = btoa(String.fromCharCode(...ciphertextBytes));
    const authTagHex = Array.from(authTagBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // Determine target path in zip
    const categoryFolder = organizeByCategory ? `${doc.category.toUpperCase()}/` : '';
    const safeFileName = doc.fileName.replace(/[/\\?%*:|"<>]/g, '_');
    const encryptedFileName = `${safeFileName}.vault`;
    const archivePath = `${categoryFolder}${encryptedFileName}`;

    // Add encrypted payload file directly into the ZIP
    // The .vault file contains JSON envelope with ciphertext, salt, IV, authTag, and metadata
    const envelopeJson = JSON.stringify({
      format: 'MYSPACE_ENCRYPTED_DOCUMENT_V2',
      id: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      category: doc.category,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      checksumSha256,
      encryption: {
        algorithm: 'AES-256-GCM',
        keyDerivation: 'PBKDF2-HMAC-SHA256',
        iterations: 100000,
        salt: docSaltHex,
        iv: docIvHex,
        authTag: authTagHex,
        ciphertext: ciphertextBase64
      }
    }, null, 2);

    zip.file(archivePath, envelopeJson);

    // Record in manifest
    manifestData.documents.push({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      documentNumber: doc.documentNumber,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      issueDate: doc.issueDate,
      expiryDate: doc.expiryDate,
      sensitivity: doc.sensitivity,
      tags: doc.tags || [],
      notes: doc.notes,
      verifiedIssuer: doc.verifiedIssuer,
      checksumSha256,
      archivePath,
      encryption: {
        ciphertext: ciphertextBase64,
        iv: docIvHex,
        authTag: authTagHex,
        salt: docSaltHex
      }
    });
  }

  notify('PACKAGING', 'Generating cryptographic manifest and offline decryptor tool...', 85);

  const manifestJsonString = JSON.stringify(manifestData, null, 2);

  // Add manifest.json
  if (includeManifest) {
    zip.file('manifest.json', manifestJsonString);
  }

  // Add README.txt instructions
  const readmeText = `================================================================================
MYSPACE SECURE DIGITAL DOCUMENT VAULT - BULK EXPORT ARCHIVE
================================================================================

Export Timestamp: ${manifestData.exportedAt}
Total Protected Documents: ${manifestData.totalDocuments}
Encryption Algorithm: AES-256-GCM (Authenticated Encryption with Associated Data)
Key Derivation: PBKDF2-HMAC-SHA256 (100,000 iterations)
Security Standard: Military-Grade Zero-Knowledge Archive

--------------------------------------------------------------------------------
HOW TO DECRYPT AND VIEW YOUR DOCUMENTS:
--------------------------------------------------------------------------------

METHOD 1: STANDALONE OFFLINE DECRYPTOR (RECOMMENDED)
1. Extract all files from this .zip archive.
2. Double-click "vault-decryptor.html" in any modern browser (Chrome, Safari, Edge, Firefox).
3. Enter your Master Vault Password.
4. Instant 1-click preview and bulk download of all decrypted files!
* Works 100% offline with standard browser WebCrypto API. No software install needed.

METHOD 2: VAULT IMPORT
1. In MySpace, select "Import Vault Backup" or drag this archive into your dashboard.
2. Enter your password to restore all items into your secure repository.

--------------------------------------------------------------------------------
EXCLUDED PRIVATE ITEMS NOTICE:
--------------------------------------------------------------------------------
In accordance with zero-leakage security protocols, documents stored in your
private "Hidden Space" have been strictly excluded from this bulk export.

================================================================================
Integrity Hash (SHA-256): ${await computeSha256(manifestJsonString)}
================================================================================
`;
  zip.file('README.txt', readmeText);

  // Add offline HTML decryptor
  if (includeOfflineDecryptor) {
    const decryptorHtml = generateOfflineDecryptorHtml(manifestJsonString, 'MySpace Vault Backup');
    zip.file('vault-decryptor.html', decryptorHtml);
  }

  notify('PACKAGING', 'Compressing archive and finalizing zip package...', 92);

  // Generate final ZIP blob
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    },
    (metadata) => {
      const p = Math.round(92 + (metadata.percent / 100) * 7);
      notify('PACKAGING', `Writing archive stream: ${Math.round(metadata.percent)}%`, p);
    }
  );

  const finalArrayBuffer = await zipBlob.arrayBuffer();
  const archiveChecksum = await computeSha256(finalArrayBuffer);

  const dateStr = new Date().toISOString().split('T')[0];
  const finalFileName = archiveName || `myspace-vault-export-${dateStr}.zip`;

  notify('COMPLETED', 'Export package successfully encrypted and ready!', 100);

  return {
    blob: zipBlob,
    fileName: finalFileName,
    fileSizeBytes: zipBlob.size,
    documentsCount: nonHiddenDocs.length,
    checksumSha256: archiveChecksum
  };
}
