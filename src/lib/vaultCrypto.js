/**
 * Web Crypto API Vault Engine
 * AES-GCM 256-bit encryption with PBKDF2 100,000 iterations key derivation.
 * 100% native browser security, zero external crypto libraries.
 */

// Helper to convert ArrayBuffer to Base64
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
function base64ToBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives an AES-GCM CryptoKey from a user-supplied plaintext passphrase
 */
async function deriveKey(passphrase, salt) {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt arbitrary JSON object with user passphrase
 * @param {object} payload
 * @param {string} passphrase
 * @returns {Promise<string>} Base64-encoded encrypted vault package
 */
export async function encryptVault(payload, passphrase) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));

  // Generate 16 bytes random salt and 12 bytes IV
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(passphrase, salt);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    data
  );

  const vaultPackage = {
    version: 1,
    algorithm: 'AES-GCM-256-PBKDF2',
    timestamp: new Date().toISOString(),
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertext),
  };

  return JSON.stringify(vaultPackage, null, 2);
}

/**
 * Decrypt encrypted vault package with user passphrase
 * @param {string} vaultPackageJson
 * @param {string} passphrase
 * @returns {Promise<object>} Parsed decrypted JSON payload
 */
export async function decryptVault(vaultPackageJson, passphrase) {
  const pkg = JSON.parse(vaultPackageJson);
  if (!pkg.salt || !pkg.iv || !pkg.ciphertext) {
    throw new Error('Invalid vault package format.');
  }

  const salt = base64ToBuffer(pkg.salt);
  const iv = base64ToBuffer(pkg.iv);
  const ciphertext = base64ToBuffer(pkg.ciphertext);

  const key = await deriveKey(passphrase, salt);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      ciphertext
    );
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedBuffer));
  } catch {
    throw new Error('Decryption failed: Incorrect passphrase or corrupted vault file.');
  }
}

/**
 * Convert an array of objects to CSV formatted string
 * @param {Array<object>} rows
 * @returns {string}
 */
export function convertToCSV(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    });
    csvLines.push(values.join(','));
  }

  return csvLines.join('\n');
}

/**
 * Trigger client-side file download
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
