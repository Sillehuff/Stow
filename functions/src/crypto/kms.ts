import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { KeyManagementServiceClient } from "@google-cloud/kms";

const DEFAULT_LOCAL_SECRET_ENCRYPTION_KEY = "stow-local-dev-only-change-me";

let kmsClient: KeyManagementServiceClient | null | undefined;

function getKmsKeyName() {
  return process.env.KMS_KEY_NAME?.trim() || null;
}

function isLocalRuntime() {
  return (
    process.env.FUNCTIONS_EMULATOR === "true" ||
    Boolean(process.env.FIREBASE_EMULATOR_HUB) ||
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test" ||
    !process.env.K_SERVICE
  );
}

function getLocalKeySeed() {
  return process.env.LOCAL_SECRET_ENCRYPTION_KEY ?? DEFAULT_LOCAL_SECRET_ENCRYPTION_KEY;
}

function assertLocalFallbackAllowed() {
  if (getKmsKeyName()) return;
  if (isLocalRuntime()) return;
  if (getLocalKeySeed() !== DEFAULT_LOCAL_SECRET_ENCRYPTION_KEY) return;
  throw new Error(
    "Secret encryption is misconfigured: set KMS_KEY_NAME or provide a non-placeholder LOCAL_SECRET_ENCRYPTION_KEY outside local development/emulators."
  );
}

function getLocalKey() {
  assertLocalFallbackAllowed();
  return createHash("sha256").update(getLocalKeySeed()).digest();
}

function getKmsClient() {
  const kmsKeyName = getKmsKeyName();
  if (!kmsKeyName) return { kmsKeyName: null, kmsClient: null };
  if (kmsClient === undefined) {
    kmsClient = new KeyManagementServiceClient();
  }
  return { kmsKeyName, kmsClient };
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const { kmsKeyName, kmsClient } = getKmsClient();
  if (kmsClient && kmsKeyName) {
    const [result] = await kmsClient.encrypt({
      name: kmsKeyName,
      plaintext: Buffer.from(plaintext, "utf8")
    });
    if (!result.ciphertext) throw new Error("KMS encryption returned no ciphertext");
    return `kms:${Buffer.from(result.ciphertext).toString("base64")}`;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getLocalKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `local:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export async function decryptSecret(ciphertextEnvelope: string): Promise<string> {
  const { kmsKeyName, kmsClient } = getKmsClient();
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
  const [, ivB64, tagB64, dataB64] = ciphertextEnvelope.split(":");
  const decipher = createDecipheriv("aes-256-gcm", getLocalKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final()
  ]);
  return plaintext.toString("utf8");
}
