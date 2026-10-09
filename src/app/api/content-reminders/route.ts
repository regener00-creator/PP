export async function GET() { return Response.json({ ok: false, retired: true }, { status: 410 }); }
