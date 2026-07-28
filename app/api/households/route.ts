import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type HouseholdRequest = {
  action?: unknown;
  inviteCode?: unknown;
};

const responseOptions = {
  headers: { "Cache-Control": "private, no-store" },
};

export async function POST(request: Request) {
  let body: HouseholdRequest;

  try {
    body = (await request.json()) as HouseholdRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid household request." },
      { status: 400, ...responseOptions },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Your session expired. Please sign in again." },
      { status: 401, ...responseOptions },
    );
  }

  const action = body.action;
  const result = action === "create"
    ? await supabase.rpc("create_household")
    : action === "join" && typeof body.inviteCode === "string"
      ? await supabase.rpc("join_household", { input_code: body.inviteCode })
      : null;

  if (!result) {
    return NextResponse.json(
      { error: "Choose whether to create or join a household." },
      { status: 400, ...responseOptions },
    );
  }

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 400, ...responseOptions },
    );
  }

  return NextResponse.json(
    { household: result.data },
    responseOptions,
  );
}
