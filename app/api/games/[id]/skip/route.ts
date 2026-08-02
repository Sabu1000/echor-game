import { applyMutation } from "@/server/game/dailyService";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return applyMutation(request, id, "skip");
}
