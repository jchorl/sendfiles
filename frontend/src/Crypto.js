const algo = "AES-GCM";

export async function genKey() {
  return await window.crypto.subtle.generateKey(
    {
      name: algo,
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(message, key, password) {
  const enc = new TextEncoder();
  const encodedPassword = enc.encode(password);

  return window.crypto.subtle.encrypt(
    {
      name: algo,
      iv: encodedPassword,
    },
    key,
    message
  );
}

export async function decryptMessage(ciphertext, key, password) {
  const enc = new TextEncoder();
  const encodedPassword = enc.encode(password);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: algo,
      iv: encodedPassword,
    },
    key,
    ciphertext
  );

  return decrypted;
}

export async function exportKeyAsBase64(key) {
  const exportedKey = await crypto.subtle.exportKey("raw", key);
  const chars = String.fromCharCode(...new Uint8Array(exportedKey));
  return btoa(chars);
}

export async function importKeyFromBase64(encoded) {
  const b64DecodedKey = atob(encoded);
  const charCodes = b64DecodedKey
    .split("")
    .map((c, idx) => b64DecodedKey.charCodeAt(idx));
  const decodedKey = new Uint8Array(charCodes);
  const privateKey = await crypto.subtle.importKey(
    "raw",
    decodedKey,
    algo,
    false,
    ["decrypt"]
  );
  return privateKey;
}
