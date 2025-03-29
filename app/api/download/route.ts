import type { SketchfabDownloadResponse } from "#/app/types";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const modelId = url.searchParams.get("modelId");
  if (!modelId) {
    return new Response("Model ID is required", { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("sketchfab_token");
  if (!token) {
    return new Response("Authentication required", { status: 401 });
  }

  try {
    // authenticated request for download url
    const response = await fetch(`https://api.sketchfab.com/v3/models/${modelId}/download`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.value}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Download error from Sketchfab:", errorText);
      return new Response(`Failed to download model: ${response.statusText}`, { status: response.status });
    }

    const downloadData = (await response.json()) as SketchfabDownloadResponse;

    // return approved download urls
    // todo: glb should always return a single file, however, gltf can return a zip, handle that
    return Response.json({
      downloadUrl: downloadData.glb?.url || downloadData.gltf?.url,
      formats: downloadData,
    });
  } catch (error) {
    console.error("Error downloading model:", error);
    return new Response("Error processing download request", { status: 500 });
  }
}
