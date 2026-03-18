function textToBytes(text) {
  return new TextEncoder().encode(String(text));
}

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function bytesToBase64(bytes) {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(String(b64 || ""));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function importRsaPublicKey(jwk) {
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["wrapKey"]
  );
}

async function importRsaPrivateKey(jwk) {
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["unwrapKey"]
  );
}

export async function importUserKeyPairFromJwk({ publicKeyJwk, privateKeyJwk }) {
  if (!publicKeyJwk || !privateKeyJwk) throw new Error("Missing key material.");
  const [publicKey, privateKey] = await Promise.all([
    importRsaPublicKey(publicKeyJwk),
    importRsaPrivateKey(privateKeyJwk),
  ]);
  return { publicKey, privateKey };
}

async function deriveWrappingKeyFromPassword(password, saltBytes, iterations) {
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    textToBytes(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function generateAndWrapUserKeyPair({ password, iterations = 150000 } = {}) {
  if (!password) throw new Error("Password is required for encryption setup.");

  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["wrapKey", "unwrapKey"]
  );

  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    window.crypto.subtle.exportKey("jwk", keyPair.publicKey),
    window.crypto.subtle.exportKey("jwk", keyPair.privateKey),
  ]);

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const wrappingKey = await deriveWrappingKeyFromPassword(password, salt, iterations);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const privateKeyJson = JSON.stringify(privateKeyJwk);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    textToBytes(privateKeyJson)
  );

  return {
    publicKeyJwk,
    privateKeyJwk,
    encryptedPrivateKey: bytesToBase64(new Uint8Array(encrypted)),
    kdfSalt: bytesToBase64(salt),
    kdfIterations: iterations,
    privateKeyIv: bytesToBase64(iv),
    version: "E2EE-v1",
    // usable keys for current session
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

export async function unlockUserPrivateKey({ password, encryptedPrivateKey, kdfSalt, kdfIterations, privateKeyIv, publicKeyJwk }) {
  if (!password) throw new Error("Password is required to unlock encryption keys.");

  const saltBytes = base64ToBytes(kdfSalt);
  const ivBytes = base64ToBytes(privateKeyIv);
  const wrappingKey = await deriveWrappingKeyFromPassword(password, saltBytes, Number(kdfIterations) || 150000);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    wrappingKey,
    base64ToBytes(encryptedPrivateKey)
  );

  const privateKeyJwk = JSON.parse(new TextDecoder().decode(new Uint8Array(decrypted)));
  const [publicKey, privateKey] = await Promise.all([
    importRsaPublicKey(publicKeyJwk),
    importRsaPrivateKey(privateKeyJwk),
  ]);

  return { publicKey, privateKey, publicKeyJwk, privateKeyJwk };
}

export async function encryptFileE2ee({ file, ownerPublicKey }) {
  if (!file) throw new Error("Missing file.");
  if (!ownerPublicKey) throw new Error("Missing owner public key.");

  const fileKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = await file.arrayBuffer();
  const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, fileKey, plaintext);

  const wrappedKey = await window.crypto.subtle.wrapKey("raw", fileKey, ownerPublicKey, { name: "RSA-OAEP" });

  return {
    encryptedBlob: new Blob([new Uint8Array(ciphertext)], { type: "application/octet-stream" }),
    encryptionIv: bytesToBase64(iv),
    wrappedKey: bytesToBase64(new Uint8Array(wrappedKey)),
  };
}

export async function wrapRecordKeyForDoctor({ wrappedKeyForOwnerB64, ownerPrivateKey, doctorPublicKeyJwk }) {
  if (!wrappedKeyForOwnerB64) throw new Error("Missing wrapped key.");
  if (!ownerPrivateKey) throw new Error("Encryption key not unlocked. Please log in again.");
  if (!doctorPublicKeyJwk) throw new Error("Doctor has no encryption key configured.");

  const doctorPublicKey = await importRsaPublicKey(doctorPublicKeyJwk);
  const wrappedKeyBytes = base64ToBytes(wrappedKeyForOwnerB64);

  const fileKey = await window.crypto.subtle.unwrapKey(
    "raw",
    wrappedKeyBytes,
    ownerPrivateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const wrappedForDoctor = await window.crypto.subtle.wrapKey("raw", fileKey, doctorPublicKey, { name: "RSA-OAEP" });
  return bytesToBase64(new Uint8Array(wrappedForDoctor));
}

export async function decryptToObjectUrl({ fileUrl, encryptionIvB64, wrappedKeyB64, privateKey, mimeType }) {
  if (!fileUrl) throw new Error("Missing file URL.");
  if (!privateKey) throw new Error("Encryption key not unlocked. Please log in again.");
  if (!encryptionIvB64 || !wrappedKeyB64) throw new Error("Missing encryption metadata.");

  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error("Failed to download file.");
  const ciphertext = await resp.arrayBuffer();

  return decryptArrayBufferToObjectUrl({ ciphertext, encryptionIvB64, wrappedKeyB64, privateKey, mimeType });
}

export async function decryptArrayBufferToObjectUrl({ ciphertext, encryptionIvB64, wrappedKeyB64, privateKey, mimeType }) {
  if (!ciphertext) throw new Error("Missing ciphertext.");
  if (!privateKey) throw new Error("Encryption key not unlocked. Please log in again.");
  if (!encryptionIvB64 || !wrappedKeyB64) throw new Error("Missing encryption metadata.");

  const fileKey = await window.crypto.subtle.unwrapKey(
    "raw",
    base64ToBytes(wrappedKeyB64),
    privateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const iv = base64ToBytes(encryptionIvB64);
  const plaintext = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, fileKey, ciphertext);

  const blob = new Blob([new Uint8Array(plaintext)], { type: mimeType || "application/octet-stream" });
  return URL.createObjectURL(blob);
}
