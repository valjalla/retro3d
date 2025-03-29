import { cookies } from "next/headers";

export async function GET() {
  const cookieStore  = await cookies();
  const token        = cookieStore.get("sketchfab_token");
  const tokenExpiry  = cookieStore.get("sketchfab_token_expiry");
  const refreshToken = cookieStore.get("sketchfab_refresh_token");

  if (!token || !tokenExpiry) {
    return Response.json({ authenticated: false });
  }

  const expiryTime = Number.parseInt(tokenExpiry.value, 10);
  const isExpired = Date.now() > expiryTime;
  if (isExpired) {
    if (refreshToken) {
      try {
        const clientId = process.env.SKETCHFAB_CLIENT_ID;
        const clientSecret = process.env.SKETCHFAB_CLIENT_SECRET;
        const tokenUrl = process.env.SKETCHFAB_TOKEN_URL;
        
        if (!clientId || !clientSecret || !tokenUrl) {
          console.error("Missing required environment variables for token refresh");
          return Response.json({ authenticated: false, error: "Unable to refresh token" });
        }

        const refresh_token_response = await fetch(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken.value,
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
        });

        if (!refresh_token_response.ok) {
          console.error("Token refresh failed:", await refresh_token_response.text());
          return Response.json({ authenticated: false });
        }

        const tokenData = await refresh_token_response.json();
        const expiresIn = tokenData.expires_in || 3600; // default to 1 hour
        const newExpiryTime = Date.now() + expiresIn * 1000;
        
        // update cookies
        cookieStore.set("sketchfab_token", tokenData.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: expiresIn,
          path: "/",
        });
        
        cookieStore.set("sketchfab_token_expiry", newExpiryTime.toString(), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: expiresIn,
          path: "/",
        });
        
        if (tokenData.refresh_token) {
          cookieStore.set("sketchfab_refresh_token", tokenData.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 30 * 24 * 60 * 60, // 30 days
            path: "/",
          });
        }
        
        // return authenticated with the new expiry time
        return Response.json({
          authenticated: true,
          expiresAt: newExpiryTime,
          refreshed: true,
        });
      } catch (error) {
        console.error("Token refresh error:", error);
        return Response.json({ authenticated: false, error: "Refresh token failed" });
      }
    }

    return Response.json({ authenticated: false, error: "Token expired and no refresh token available" });
  }

  return Response.json({
    authenticated: true,
    expiresAt: expiryTime,
  });
}
