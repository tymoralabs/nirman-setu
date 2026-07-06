import { NextRequest, NextResponse } from "next/server";
import { verifyLocalUrl, localObjectPath } from "@/lib/storage";
import { env } from "@/env";

/**
 * Local storage driver endpoint (dev only). Serves HMAC-signed PUT/GET
 * "presigned" URLs so upload/download flows behave like R2 locally.
 */

export const dynamic = "force-dynamic";

function extractParams(req: NextRequest, op: "put" | "get") {
  const sp = req.nextUrl.searchParams;
  const sig = sp.get("sig") ?? "";
  const params: Record<string, string> = {};
  sp.forEach((v, k) => {
    if (k !== "sig") params[k] = v;
  });
  if (params.op !== op) return null;
  if (!verifyLocalUrl(params, sig)) return null;
  return params;
}

export async function PUT(req: NextRequest) {
  if (env.STORAGE_BACKEND !== "local") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const params = extractParams(req, "put");
  if (!params) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  const body = Buffer.from(await req.arrayBuffer());
  // mirror R2's signed Content-Length behaviour
  if (body.byteLength !== Number(params.size)) {
    return NextResponse.json({ error: "size_mismatch" }, { status: 403 });
  }

  const { mkdir, writeFile, stat } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const path = await localObjectPath(params.key);

  // keys are immutable — never overwrite (§7.2)
  const exists = await stat(path).then(() => true).catch(() => false);
  if (exists) {
    return NextResponse.json({ error: "key_exists" }, { status: 409 });
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  if (env.STORAGE_BACKEND !== "local") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const params = extractParams(req, "get");
  if (!params) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  const { readFile } = await import("node:fs/promises");
  const path = await localObjectPath(params.key);
  try {
    const data = await readFile(path);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Disposition": `attachment; filename="${encodeURIComponent(params.name ?? "file")}"`,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(data.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
