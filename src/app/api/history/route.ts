import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const PER_PAGE = 12;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const total = await prisma.qrCode.count({ where: { userId: session.user.id } });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = Math.min(page, totalPages);

  const items = await prisma.qrCode.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * PER_PAGE,
    take: PER_PAGE,
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      dataText: item.dataText,
      size: item.size,
      errorCorrection: item.errorCorrection,
      foregroundColor: item.foregroundColor,
      backgroundColor: item.backgroundColor,
      hasLogo: item.hasLogo,
      createdAt: item.createdAt.toISOString(),
      pngDataUri: `data:image/png;base64,${Buffer.from(item.pngData).toString("base64")}`,
    })),
    total,
    page: currentPage,
    totalPages,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const dataText = typeof body?.dataText === "string" ? body.dataText : "";
  const size = Number(body?.size);
  const errorCorrection = typeof body?.errorCorrection === "string" ? body.errorCorrection : "";
  const foregroundColor = typeof body?.foregroundColor === "string" ? body.foregroundColor : "";
  const backgroundColor = typeof body?.backgroundColor === "string" ? body.backgroundColor : "";
  const hasLogo = Boolean(body?.hasLogo);
  const pngDataUri = typeof body?.pngDataUri === "string" ? body.pngDataUri : "";

  const base64Match = pngDataUri.match(/^data:image\/png;base64,(.+)$/);
  if (
    dataText === "" ||
    !Number.isFinite(size) ||
    errorCorrection === "" ||
    !/^#[0-9a-fA-F]{6}$/.test(foregroundColor) ||
    !/^#[0-9a-fA-F]{6}$/.test(backgroundColor) ||
    !base64Match
  ) {
    return NextResponse.json({ error: "Invalid save request." }, { status: 400 });
  }

  const pngData = Buffer.from(base64Match[1], "base64");
  if (pngData.length === 0 || pngData.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Invalid PNG data." }, { status: 400 });
  }

  const created = await prisma.qrCode.create({
    data: {
      userId: session.user.id,
      dataText,
      size: Math.round(size),
      errorCorrection,
      foregroundColor,
      backgroundColor,
      hasLogo,
      pngData,
    },
  });

  return NextResponse.json({ id: created.id });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  await prisma.qrCode.deleteMany({ where: { id, userId: session.user.id } });

  return NextResponse.json({ ok: true });
}
