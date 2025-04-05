import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("No authorization code provided", { status: 400 });
  }

  try {
    const clientId     = process.env.SKETCHFAB_CLIENT_ID;
    const clientSecret = process.env.SKETCHFAB_CLIENT_SECRET;
    const redirectUri  = process.env.SKETCHFAB_REDIRECT_URI;
    const tokenUrl     = process.env.SKETCHFAB_TOKEN_URL;
    console.log("! ~ GET ~ tokenUrl:", tokenUrl);

    if (!clientId || !clientSecret || !redirectUri || !tokenUrl) {
      console.error("Missing required environment variables");
      return new Response("Server configuration error", { status: 500 });
    }

    // exchange code for token
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
    });
    console.log("! ~ GET ~ tokenResponse:", tokenResponse);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange error:", errorText);
      return new Response("Failed to exchange code for token", { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    const cookieStore = await cookies();
    const expiresIn = tokenData.expires_in || 3600; // default to 1 hour if not specified

    cookieStore.set("sketchfab_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: expiresIn,
      path: "/",
    });

    if (tokenData.refresh_token) {
      cookieStore.set("sketchfab_refresh_token", tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        // refresh token usually lives longer
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      });
    }

    const expiryTime = Date.now() + expiresIn * 1000;
    cookieStore.set("sketchfab_token_expiry", expiryTime.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: expiresIn,
      path: "/",
    });

    // redirect back to the application after successful auth
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
      },
    });
  } catch (error) {
    console.error("Authentication error:", error);
    return new Response("Authentication error", { status: 500 });
  }
}
