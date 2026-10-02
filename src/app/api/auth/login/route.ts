import { NextResponse } from "next/server";
import { signIn } from "@/server/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ user: await signIn(String(body.email ?? ""), String(body.password ?? "")) });
  } catch (error) {
    console.error("Falha no login:", error);
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }
}
