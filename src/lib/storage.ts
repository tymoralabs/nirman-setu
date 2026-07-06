import { createHmac } from "node:crypto";
import { env } from "@/env";

/**
 * Backend-agnostic file storage (§2, §7.2). Drivers:
 *  - local: dev only — files under .data/storage, "presigned" URLs are
 *    HMAC-signed links to /api/storage/local (the one place files transit
 *    the app server; acceptable local-dev deviation from §7.2).
 *  - r2 / s3: presigned PUT/GET via @aws-sdk/client-s3. Content-Length is
 *    signed into upload URLs (closes the "presign small, PUT huge" hole).
 * Storage keys are immutable — objects are never overwritten.
 */

export interface PresignedUpload {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface StorageDriver {
  presignUpload(
    key: string,
    contentLength: number,
    mimeType: string
  ): Promise<PresignedUpload>;
  presignDownload(key: string, fileName: string): Promise<string>;
  deleteObject(key: string): Promise<void>;
  headObject(key: string): Promise<{ sizeBytes: number } | null>;
}

// ---------- local driver ----------

const LOCAL_URL_TTL_MS = 10 * 60 * 1000;

export function signLocalUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams(params);
  qs.sort();
  return createHmac("sha256", env.AUTH_SECRET + ":storage")
    .update(qs.toString())
    .digest("base64url");
}

export function verifyLocalUrl(
  params: Record<string, string>,
  sig: string
): boolean {
  if (signLocalUrl(params) !== sig) return false;
  const exp = Number(params.exp);
  return Number.isFinite(exp) && exp > Date.now();
}

function localStoragePath(): string {
  return "./.data/storage";
}

export async function localObjectPath(key: string): Promise<string> {
  const { join, normalize } = await import("node:path");
  const path = normalize(join(localStoragePath(), key));
  const root = normalize(localStoragePath());
  if (!path.startsWith(root)) throw new Error("Path traversal blocked");
  return path;
}

const localDriver: StorageDriver = {
  async presignUpload(key, contentLength, mimeType) {
    const params = {
      key,
      size: String(contentLength),
      mime: mimeType,
      exp: String(Date.now() + LOCAL_URL_TTL_MS),
      op: "put",
    };
    const sig = signLocalUrl(params);
    const qs = new URLSearchParams({ ...params, sig });
    return {
      url: `${env.NEXT_PUBLIC_APP_URL}/api/storage/local?${qs}`,
      method: "PUT",
      headers: { "Content-Type": mimeType },
    };
  },

  async presignDownload(key, fileName) {
    const params = {
      key,
      name: fileName,
      exp: String(Date.now() + 5 * 60 * 1000),
      op: "get",
    };
    const sig = signLocalUrl(params);
    const qs = new URLSearchParams({ ...params, sig });
    return `${env.NEXT_PUBLIC_APP_URL}/api/storage/local?${qs}`;
  },

  async deleteObject(key) {
    const { unlink } = await import("node:fs/promises");
    const path = await localObjectPath(key);
    await unlink(path).catch(() => {});
  },

  async headObject(key) {
    const { stat } = await import("node:fs/promises");
    try {
      const path = await localObjectPath(key);
      const s = await stat(path);
      return { sizeBytes: s.size };
    } catch {
      return null;
    }
  },
};

// ---------- r2/s3 driver ----------

function createS3Driver(): StorageDriver {
  // Lazy import so local dev never loads the SDK
  const getClient = async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  };

  return {
    async presignUpload(key, contentLength, mimeType) {
      const [{ PutObjectCommand }, { getSignedUrl }] = await Promise.all([
        import("@aws-sdk/client-s3"),
        import("@aws-sdk/s3-request-presigner"),
      ]);
      const client = await getClient();
      const cmd = new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        ContentLength: contentLength, // signed — mismatched size fails at storage layer
        ContentType: mimeType,
      });
      const url = await getSignedUrl(client, cmd, { expiresIn: 600 });
      return {
        url,
        method: "PUT",
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(contentLength),
        },
      };
    },

    async presignDownload(key, fileName) {
      const [{ GetObjectCommand }, { getSignedUrl }] = await Promise.all([
        import("@aws-sdk/client-s3"),
        import("@aws-sdk/s3-request-presigner"),
      ]);
      const client = await getClient();
      const cmd = new GetObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
      });
      return getSignedUrl(client, cmd, { expiresIn: 300 });
    },

    async deleteObject(key) {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const client = await getClient();
      await client.send(
        new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key })
      );
    },

    async headObject(key) {
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      const client = await getClient();
      try {
        const res = await client.send(
          new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key })
        );
        return { sizeBytes: res.ContentLength ?? 0 };
      } catch {
        return null;
      }
    },
  };
}

export function getStorage(): StorageDriver {
  if (env.STORAGE_BACKEND === "local") return localDriver;
  return createS3Driver();
}
