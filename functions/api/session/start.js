import {
  isAllowedGame,
  isValidAnonymousUserId,
  isValidSessionId,
  json,
  signRunToken,
} from "../_shared.js";

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const gameId = typeof body?.gameId === "string" ? body.gameId : "";
    const anonymousUserId = typeof body?.anonymousUserId === "string" ? body.anonymousUserId : "";
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";

    if (!isAllowedGame(gameId) || !isValidAnonymousUserId(anonymousUserId) || !isValidSessionId(sessionId)) {
      return json(
        {
          ok: false,
          error: "invalid_payload",
        },
        { status: 400 }
      );
    }

    const issuedAt = Date.now();
    const expiresAt = issuedAt + 15 * 60 * 1000;
    const token = await signRunToken(
      {
        gameId,
        anonymousUserId,
        sessionId,
        issuedAt,
        expiresAt,
      },
      context.env?.SESSION_SECRET || ""
    );

    return json({
      ok: true,
      token,
      issuedAt,
      expiresAt,
      source: context.env?.SESSION_SECRET ? "signed" : "stub",
    });
  } catch {
    return json(
      {
        ok: false,
        error: "invalid_json",
      },
      { status: 400 }
    );
  }
}
