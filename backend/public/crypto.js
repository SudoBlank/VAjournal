let key;

export async function initCrypto(password) {
  const enc = new TextEncoder();
  key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password.padEnd(32)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(text);
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc
  );
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(data)) };
}

export async function decryptText(enc) {
  const iv = new Uint8Array(enc.iv);
  const data = new Uint8Array(enc.data);
  const dec = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return new TextDecoder().decode(dec);
}
