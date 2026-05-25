import crypto from "crypto";
import bcrypt from "bcrypt";

const SCRYPT_KEYLEN = 64;
const BCRYPT_SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new Error("Password cannot be empty");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) {
    return false;
  }

  if (storedHash.startsWith("$2")) {
    try {
      return await bcrypt.compare(password, storedHash);
    } catch {
      return false;
    }
  }

  return verifyLegacyScryptPassword(password, storedHash);
}

function verifyLegacyScryptPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, expectedHash] = storedHash.split(":");
    if (!salt || !expectedHash) {
      return false;
    }

    const actualHash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
    const actualBuffer = Buffer.from(actualHash, "hex");
    const expectedBuffer = Buffer.from(expectedHash, "hex");

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
