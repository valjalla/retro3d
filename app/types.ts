import * as THREE from "three";

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
