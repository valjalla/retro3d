// todo: add uv checking for glb models

"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const SCALE_CAMERA = false,
  PLATFORM_RADIUS = 2,
  PLATFORM_SEGMENTS = 64,
  LOAD_INIT_MODEL = true,
  DEFAULT_MODEL = "/models/millennium_falcon.glb",
  DEFAULT_MATERIAL_MODE = "holo",
  ANIMATE_PLATFORM_OPACITY = false,
  USE_COLOR_INTENSITY = false;

const COLORS_NEON_GEN_BLUE = {
  base: 0x00ffff,
  darkBase: 0x00ccff,
  emissive: 0x00ffce,
  specular: 0x00ffce,
};

const COLORS_ORANGE = {
  base: 0xff8c00,
  darkBase: 0xff4800,
  emissive: 0x800000,
  specular: 0xff9900,
};

const COLORS = COLORS_NEON_GEN_BLUE;

declare module "three" {
  interface Object3D {
    isMesh?: boolean;
    material?: THREE.Material;
  }
}

interface ModelStats {
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

export default function ModelViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"normal" | "spider" | "holo">(DEFAULT_MATERIAL_MODE);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const sceneRef = useRef<THREE.Scene>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const rendererRef = useRef<THREE.WebGLRenderer>(null);
  const controlsRef = useRef<OrbitControls>(null);
  const modelRef = useRef<THREE.Group<THREE.Object3DEventMap>>(null);
  const animationRef = useRef<number>(null);
  const timeRef = useRef<number>(0);

  const calculateModelStats = (model: THREE.Group, fileName: string): ModelStats => {
    let vertices = 0;
    let triangles = 0;
    let meshCount = 0;
    const materials = new Set();

    model.traverse((child) => {
      if (child.isMesh) {
        meshCount++;

        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => materials.add(mat));
          } else {
            materials.add(child.material);
          }
        }

        if (child.geometry) {
          const geometry = child.geometry;
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
      vertices,
      triangles: Math.floor(triangles),
      meshes: meshCount,
      materials: materials.size,
      dimensions: {
        width: parseFloat(size.x.toFixed(2)),
        height: parseFloat(size.y.toFixed(2)),
        depth: parseFloat(size.z.toFixed(2)),
      },
      fileName: fileName || "Unknown Model",
    };
  };

  const loadModel = useCallback(
    (url: string, fileName: string) => {
      if (!sceneRef.current || !cameraRef.current || !controlsRef.current) {
        console.error("Required refs are null");
        return;
      }

      const loader = new GLTFLoader();

      if (modelRef.current && sceneRef.current) {
        sceneRef.current.remove(modelRef.current);
        modelRef.current = null;
      }

      loader.load(
        url,
        (gltf) => {
          if (!sceneRef.current || !cameraRef.current || !controlsRef.current) {
            console.error("Required refs are null");
            return;
          }

          const model = gltf.scene;

          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());

          // scale model to fit platform diameter (2 units)
          const platformDiameter = 3.5;
          const maxDimension = Math.max(size.x, size.y, size.z);
          // reduce scaling by 20%
          const scaleFactor = (platformDiameter / maxDimension) * 0.8;
          model.scale.multiplyScalar(scaleFactor);

          // center model and align base with platform
          model.position.sub(center.multiplyScalar(scaleFactor));
          const newBox = new THREE.Box3().setFromObject(model);
          const minY = newBox.min.y;
          // align base with platform (y = 0)
          model.position.y -= minY;

          sceneRef.current.add(model);
          modelRef.current = model;
          setModelLoaded(true);

          // const fileName = url.startsWith("blob:") ? "Uploaded Model" : url.split("/").pop() || "Unknown Model";
          const stats = calculateModelStats(model, fileName);
          setModelStats(stats);

          applyMaterialMode(model, viewMode);

          if (SCALE_CAMERA) {
            // adjust camera pos based on scaled model
            const maxNewDim = platformDiameter;
            cameraRef.current.position.z = maxNewDim * 0.8;
            controlsRef.current.update();
          }

          // only revoke URL if it's a blob URL (from file upload)
          if (url.startsWith("blob:")) {
            URL.revokeObjectURL(url);
          }
        },
        (xhr) => {
          console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
        },
        (error) => {
          console.error("Error loading model:", error);
        }
      );
    },
    [viewMode]
  );

  useEffect(() => {
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 3);
    cameraRef.current = camera;

    // alpha transparency for css background usage
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (!mountRef.current) return;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // center on platform
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    const platformGeometry = new THREE.CircleGeometry(PLATFORM_RADIUS, PLATFORM_SEGMENTS); // diameter = 4 units
    const platformMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.base,
      side: THREE.DoubleSide,
      opacity: 0.15,
      transparent: true,
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.rotation.x = -Math.PI / 2; // lay flat
    platform.position.y = -0.01; // slightly below origin to avoid z-fighting
    scene.add(platform);

    const diameters = [0.9, 1.2, 1.5];
    const ringThickness = [0.004, 0.008, 0.012];
    const opacities = [0.35, 0.35, 0.4];

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
        opacity: opacities[idx],
      });

      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0; // position right at platform level
      scene.add(ring);
    });

    // crosshair cross
    const createCross = () => {
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
          opacity: CROSS_OPACITY,
        })
      );

      const verticalGeometry = new THREE.BoxGeometry(lineThickness, 0, crossSize * 2);
      const verticalLine = new THREE.Mesh(
        verticalGeometry,
        new THREE.MeshBasicMaterial({
          color: COLORS_ORANGE.darkBase,
          transparent: true,
          opacity: CROSS_OPACITY,
        })
      );

      const crossGroup = new THREE.Group();
      crossGroup.add(horizontalLine);
      crossGroup.add(verticalLine);

      // position at platform level (a bit on top of rings to avoid z-fighting)
      crossGroup.position.y = 0.0001;

      return crossGroup;
    };

    const cross = createCross();
    scene.add(cross);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      controls.update();
      timeRef.current += 0.01;
      if (modelRef.current) {
        updateHolographicEffect(modelRef.current, timeRef.current);
      }

      if (Math.random() > 0.98) {
        // animate random "scan" lines
        const lineMaterial = new THREE.LineBasicMaterial({
          color: COLORS.base,
          transparent: true,
          opacity: 0.1 + Math.random() * 0.5,
        });
        const lineGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(2 * 3);
        positions[0] = Math.random() * 2 - 1;
        positions[1] = Math.random() * 2 - 1;
        positions[2] = Math.random() * 2 - 1;
        positions[3] = Math.random() * 2 - 1;
        positions[4] = Math.random() * 2 - 1;
        positions[5] = Math.random() * 2 - 1;
        lineGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const line = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(line);
        setTimeout(() => {
          scene.remove(line);
        }, 1000);

        if (ANIMATE_PLATFORM_OPACITY) {
          platform.material.opacity = 0.1 + Math.random() * 0.1;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // load default model when component mounts
    if (LOAD_INIT_MODEL) {
      loadModel(DEFAULT_MODEL, DEFAULT_MODEL.split("/").pop() || "Unknown Model");
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      if (modelRef.current) {
        scene.remove(modelRef.current);
        modelRef.current = null;
      }
    };
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0]) return;
    
    const file = event.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    loadModel(url, file.name);
  };

  const setMaterialMode = (mode: "normal" | "spider" | "holo") => {
    setViewMode(mode);
    if (modelRef.current) {
      applyMaterialMode(modelRef.current, mode);
    }
  };

  const applyMaterialMode = (model: THREE.Group, mode: "normal" | "spider" | "holo") => {
    model.traverse((child) => {
      if (child.isMesh && child.material) {
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
            flatShading: true,
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
            opacity: baseOpacity,
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
  };

  const updateHolographicEffect = (model: THREE.Group, time: number) => {
    model.traverse((child) => {
      // only animate opacity for parts marked for animation
      if (child.isMesh && child.material instanceof THREE.MeshStandardMaterial && child.userData.animateOpacity) {
        const material = child.material;
        const baseOpacity = 0.6;

        if (Math.random() > 0.97) {
          const opacityVariation = 0.1;
          const randomFactor = Math.random() * opacityVariation - opacityVariation / 2;
          material.opacity = baseOpacity + randomFactor;
        }
      }
    });
  };

  return (
    <div className="model-viewer">
      <div
        ref={mountRef}
        id="interface-plane"
      />
      <XEnoScript />
      <div className="grid-lines" />
      <div id="interface-panel">
        <div className="content-group">
          <h1 id="interface-title">古典 RETRO3D MODEL</h1>
          <p>Upload a GLB model to view it in 3D. You can also switch between NOrmal, SPider, and HOlographic modes.</p>
        </div>

        {modelStats && (
          <div className="content-group">
            <h3>OBJECT ANALYSIS</h3>
            <HEXAgrid />
            <div className="stats-table">
              <div className="stats-row">
                <span className="stats-label">File:</span>
                <span className="stats-value animate-blink">{modelStats.fileName}</span>
              </div>
              <div className="stats-row">
                <span className="stats-label">Meshes:</span>
                <span className="stats-value">{modelStats.meshes.toString()}</span>
              </div>
              <div className="stats-row">
                <span className="stats-label">Vertices:</span>
                <span className="stats-value">{modelStats.vertices.toLocaleString()}</span>
              </div>
              <div className="stats-row">
                <span className="stats-label">Materials:</span>
                <span className="stats-value">{modelStats.materials.toString()}</span>
              </div>
              <div className="stats-row">
                <span className="stats-label">Triangles:</span>
                <span className="stats-value">{modelStats.triangles.toLocaleString()}</span>
              </div>
              <div className="stats-row">
                <span className="stats-label">Size:</span>
                <span className="stats-value">
                  {`${modelStats.dimensions.width}×${modelStats.dimensions.height}×${modelStats.dimensions.depth}`}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="content-group">
          <h3>CONFIGURATION</h3>
          <div className="status-bar">
            <div className="status-fill"></div>
          </div>
          <label
            htmlFor="model-upload"
            className="animate-warning-blink"
          >
            情報作成 Upload GLB Model
          </label>
          <input
            id="model-upload"
            type="file"
            accept=".glb"
            onChange={handleFileUpload}
          />
          <div id="interface-mode-buttons">
            <BuTTon
              primaryText="ノーマル"
              secondaryText="Normal View"
              onClick={() => setMaterialMode("normal")}
              active={viewMode === "normal"}
              disabled={!modelLoaded}
            />
            <BuTTon
              primaryText="ホログラム"
              secondaryText="Holo View"
              onClick={() => setMaterialMode("holo")}
              active={viewMode === "holo"}
              disabled={!modelLoaded}
            />
            <BuTTon
              primaryText="スパイダー"
              secondaryText="Spider View"
              onClick={() => setMaterialMode("spider")}
              active={viewMode === "spider"}
              disabled={!modelLoaded}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function BuTTon({
  primaryText,
  secondaryText,
  onClick,
  disabled = false,
  active = false,
  className = "",
}: {
  primaryText: string;
  secondaryText: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`model-viewer-button ${active ? 'active' : ''} ${className}`}
    >
      <div className="button-content">
        <span className="button-primary-text">{primaryText}</span>
        <span className="button-secondary-text">{secondaryText}</span>
      </div>
    </button>
  );
}

function XEnoScript() {
  const hebrewChars = "אבגדהוזחטיכלמנסעפצקרשת";
  const greekChars = "αβδεζηθλμξπρφχψω";
  const cyrillicChars = "бгджзлфцэюя";
  const alienChars = hebrewChars + greekChars + cyrillicChars;
  const [chars, setChars] = useState<any[]>([]);

  useEffect(() => {
    const generatedChars = Array.from({ length: 20 }).map((_, i) => ({
      char: alienChars[Math.floor(Math.random() * alienChars.length)],
      left: Math.random() * 90 + 5,
      top: Math.random() * 90 + 5,
      opacity: 0.5 + Math.random() * 0.5,
      id: i,
    }));
    setChars(generatedChars);
  }, []);

  return (
    <div className="alien-chars">
      {chars.map(({ char, left, top, opacity, id }) => (
        <div
          key={id}
          className="alien-char"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            opacity,
          }}
        >
          {char}
        </div>
      ))}
    </div>
  );
}

export function HEXAgrid() {
  const [activeHexagons, setActiveHexagons] = useState([true, false, true, false, true]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveHexagons((prev) => {
        const newActiveHexagons = [...prev];
        const randomIndex = Math.floor(Math.random() * newActiveHexagons.length);
        newActiveHexagons[randomIndex] = !newActiveHexagons[randomIndex];
        return newActiveHexagons;
      });
    }, 2000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="hexagrid">
      {activeHexagons.map((isActive, index) => (
        <div
          key={index}
          className={`hexagon ${isActive ? "active" : ""}`}
        ></div>
      ))}
    </div>
  );
}
