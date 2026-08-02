import { applyMutation } from "@/server/game/dailyService";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let payload: { songId?: string };
  try { payload = await request.json() as { songId?: string }; }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  return applyMutation(request, id, "guess", payload.songId);
}
