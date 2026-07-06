import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { exportClientData } from "@/services/dpdp.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authorize staff user
    await requireStaff();

    const { id } = await params;

    // 2. Export client data zip
    const buffer = await exportClientData(id);

    // 3. Return ZIP attachment
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="client-${id}-export.zip"`,
      },
    });
  } catch (err) {
    console.error("DPDP client export failed:", err);
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
