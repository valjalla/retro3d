import * as THREE from "three";
import type { MaterialMode, ModelStats } from "./types";
import { COLORS, USE_COLOR_INTENSITY, COLORS_ORANGE } from "./3d";

export function calculateModelStats(model: THREE.Group, fileName: string): ModelStats {
  let vertices = 0;
  let triangles = 0;
  let meshCount = 0;
  const materials = new Set();

  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshCount++;

      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => materials.add(mat));
        } else {
          materials.add(child.material);
        }
      }

      if ((child as THREE.Mesh).geometry) {
        const geometry = (child as THREE.Mesh).geometry;
        if (geometry.index !== null) {
          triangles += geometry.index.count / 3;
        } else if (geometry.attributes.position) {
          triangles += geometry.attributes.position.count / 3;
        }

        if (geometry.attributes.position) {
          vertices += geometry.attributes.position.count;
        }
      }
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());

  return {
    fileName,
    vertices,
    triangles: Math.floor(triangles),
    meshes: meshCount,
    materials: materials.size,
    dimensions: {
      width: Number.parseFloat(size.x.toFixed(2)),
      height: Number.parseFloat(size.y.toFixed(2)),
      depth: Number.parseFloat(size.z.toFixed(2))
    }
  };
}

export function applyMaterialMode(model: THREE.Group, mode: MaterialMode): void {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      if (mode !== "normal" && !child.userData.originalMaterial) {
        child.userData.originalMaterial = child.material.clone();
      }

      if (mode === "spider") {
        const spiderMaterial = new THREE.MeshPhongMaterial({
          color: COLORS.base,
          emissive: COLORS.emissive,
          specular: COLORS.specular,
          shininess: 30,
          wireframe: true,
          transparent: true,
          opacity: 0.7,
          flatShading: true
        });
        child.material = spiderMaterial;
      } else if (mode === "holo") {
        const originalColor = (child.material as THREE.MeshStandardMaterial)?.color || new THREE.Color(0xffffff);
        const colorIntensity = (originalColor.r + originalColor.g + originalColor.b) / 3;
        let baseOpacity = 0.5;
        if (USE_COLOR_INTENSITY) {
          // use color intensity to determine opacity
          baseOpacity = Math.max(0.3, Math.min(0.8, colorIntensity));
        }

        const holoMaterial = new THREE.MeshStandardMaterial({
          color: COLORS.base,
          emissive: COLORS.emissive,
          roughness: 0.2,
          metalness: 0.8,
          transparent: true,
          opacity: baseOpacity
        });

        // use size and position to mark important parts for animation
        const bbox = new THREE.Box3().setFromObject(child);
        const size = bbox.getSize(new THREE.Vector3());
        const volume = size.x * size.y * size.z;
        const VOLUME_THRESHOLD = 0.2;
        const isSignificantPart = volume > VOLUME_THRESHOLD;
        child.userData.animateOpacity = isSignificantPart;

        child.material = holoMaterial;
      } else if (mode === "normal" && child.userData.originalMaterial) {
        child.material = child.userData.originalMaterial;
      }
    }
  });
}

export function updateHolographicEffect(model: THREE.Group): void {
  model.traverse((child) => {
    // only animate opacity for parts marked for animation
    if (
      child instanceof THREE.Mesh &&
      child.material instanceof THREE.MeshStandardMaterial &&
      child.userData.animateOpacity
    ) {
      const material = child.material;
      const baseOpacity = 0.6;

      if (Math.random() > 0.97) {
        const opacityVariation = 0.1;
        const randomFactor = Math.random() * opacityVariation - opacityVariation / 2;
        material.opacity = baseOpacity + randomFactor;
      }
    }
  });
}

export function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>, loadModelCallback: Function): void {
  if (!event.target.files?.[0]) return;

  const file = event.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  loadModelCallback(url, file.name);
}

export function createPlatformRings(diameters: number[], ringThickness: number[], opacities: number[]): THREE.Mesh[] {
  const rings: THREE.Mesh[] = [];

  diameters.forEach((diameter, idx) => {
    const ringGeometry = new THREE.RingGeometry(
      diameter - ringThickness[idx] / 2, // inner radius
      diameter + ringThickness[idx] / 2, // outer radius (inner + thickness)
      128 // theta segments (roundness of the ring)
    );

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: COLORS_ORANGE.darkBase,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: opacities[idx]
    });

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0; // position right at platform level
    rings.push(ring);
  });

  return rings;
}

export function createCross(diameters: number[]): THREE.Group<THREE.Object3DEventMap> {
  const outerRingSize = diameters[diameters.length - 1];
  const crossSize = outerRingSize * 1;
  const CROSS_OPACITY = 0.6;
  const lineThickness = 0.01;

  const horizontalGeometry = new THREE.BoxGeometry(crossSize * 2, 0, lineThickness);
  const horizontalLine = new THREE.Mesh(
    horizontalGeometry,
    new THREE.MeshBasicMaterial({
      color: COLORS_ORANGE.darkBase,
      transparent: true,
      opacity: CROSS_OPACITY
    })
  );

  const verticalGeometry = new THREE.BoxGeometry(lineThickness, 0, crossSize * 2);
  const verticalLine = new THREE.Mesh(
    verticalGeometry,
    new THREE.MeshBasicMaterial({
      color: COLORS_ORANGE.darkBase,
      transparent: true,
      opacity: CROSS_OPACITY
    })
  );

  const crossGroup = new THREE.Group();
  crossGroup.add(horizontalLine);
  crossGroup.add(verticalLine);

  // position at platform level (a bit on top of rings to avoid z-fighting)
  crossGroup.position.y = 0.0001;

  return crossGroup;
}
