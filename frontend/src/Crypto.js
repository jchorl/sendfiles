export async function genKey() {
  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
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
      name: "AES-GCM",
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
      name: "AES-GCM",
      iv: encodedPassword,
    },
    key,
    ciphertext
  );

  return decrypted;
}
