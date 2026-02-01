let cryptoKey = null;

/* DEBUG helper */
function debug(msg) {
  console.log("[CRYPTO]", msg);
}

export async function initCrypto(password) {
  debug("Initializing crypto");

  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  cryptoKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("VAjournal-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  debug("Crypto key ready");
}

export async function encryptText(text) {
  if (!cryptoKey) {
    throw new Error("Crypto not initialized");
  }

  debug("Encrypting text");

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    enc.encode(text)
  );

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  };
}

export async function decryptText(encrypted) {
  if (!cryptoKey) {
    throw new Error("Crypto not initialized");
  }

  debug("Decrypting text");

  const iv = new Uint8Array(encrypted.iv);
  const data = new Uint8Array(encrypted.data);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    data
  );

  const dec = new TextDecoder();
  return dec.decode(decrypted);
}
