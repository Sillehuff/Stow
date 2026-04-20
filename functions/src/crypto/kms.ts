import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { KeyManagementServiceClient } from "@google-cloud/kms";

const kmsKeyName = process.env.KMS_KEY_NAME;
const localKeySeed = process.env.LOCAL_SECRET_ENCRYPTION_KEY;
const usingFunctionsEmulator = process.env.FUNCTIONS_EMULATOR === "true";
const localKey = createHash("sha256").update(localKeySeed ?? "stow-local-dev-only-change-me").digest();
const kmsClient = kmsKeyName ? new KeyManagementServiceClient() : null;

function requireLocalEncryptionKey() {
  if (localKeySeed) return;
  if (usingFunctionsEmulator) return;
  throw new Error("Local secret encryption is not configured. Set KMS_KEY_NAME or LOCAL_SECRET_ENCRYPTION_KEY.");
}

export async function encryptSecret(plaintext: string): Promise<string> {
  if (kmsClient && kmsKeyName) {
    const [result] = await kmsClient.encrypt({
      name: kmsKeyName,
      plaintext: Buffer.from(plaintext, "utf8")
    });
    if (!result.ciphertext) throw new Error("KMS encryption returned no ciphertext");
    return `kms:${Buffer.from(result.ciphertext).toString("base64")}`;
  }

  requireLocalEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", localKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `local:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export async function decryptSecret(ciphertextEnvelope: string): Promise<string> {
  if (ciphertextEnvelope.startsWith("kms:")) {
    if (!kmsClient || !kmsKeyName) throw new Error("KMS decryption is not configured");
    const payload = Buffer.from(ciphertextEnvelope.slice(4), "base64");
    const [result] = await kmsClient.decrypt({
      name: kmsKeyName,
      ciphertext: payload
    });
    if (!result.plaintext) throw new Error("KMS decryption returned no plaintext");
    return Buffer.from(result.plaintext).toString("utf8");
  }

  if (!ciphertextEnvelope.startsWith("local:")) throw new Error("Unknown secret envelope format");
  requireLocalEncryptionKey();
  const [, ivB64, tagB64, dataB64] = ciphertextEnvelope.split(":");
  const decipher = createDecipheriv("aes-256-gcm", localKey, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final()
  ]);
  return plaintext.toString("utf8");
}
