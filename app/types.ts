import type * as THREE from "three";

// MARK: ThreeJS
export type MaterialMode = "normal" | "spider" | "holo";

declare module "three" {
  interface Object3D {
    isMesh?: boolean;
    material?: THREE.Material;
  }
}

export interface ModelStats {
  vertices: number;
  triangles: number;
  meshes: number;
  materials: number;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  fileName: string;
}

// MARK: Sketchfab
export enum SketchfabModelFormat {
  glb = "glb",
  gltf = "gltf",
  usdz = "usdz",
  source = "source",
}

export type SketchfabDownloadResponse = {
  [formatName in SketchfabModelFormat]?: {
    url: string;
    size: number;
    expires: string;
  };
};

export type SketchfabDownloadResult = {
  downloadUrl: string;
  formats: SketchfabDownloadResponse;
};

export interface SketchfabAuth {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

export interface SketchfabModelThumbnail {
  url: string;
  width: number;
  height: number;
  size?: number;
  uid?: string;
}

export interface SketchfabModel {
  uid: string;
  name: string;
  description: string;
  thumbnails: {
    images: SketchfabModelThumbnail[];
  };
  user: {
    username: string;
    displayName?: string;
    uid: string;
  };
  vertexCount?: number;
  faceCount?: number;
  viewerUrl: string;
  downloadUrl?: string;
  isDownloadable: boolean;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
}

export interface SketchfabSearchResult {
  results: SketchfabModel[];
  next?: string;
  previous?: string;
  totalCount?: number;
}
