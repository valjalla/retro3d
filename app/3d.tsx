// todo: add uv checking for glb models

"use client";

import * as THREE from "three";
import type React from "react";
import { useRef, useState, useEffect, useCallback } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ROw, BuTTon, XEnoScript, HEXAgrid, ScrollTXsT, HEXBtn } from "./ui";
import type { ModelStats } from "./types";

// biome-ignore format: consts
const
  SCALE_CAMERA                 = false,
  PLATFORM_RADIUS              = 2,
  PLATFORM_SEGMENTS            = 64,
  LOAD_INIT_MODEL              = true,
  DEFAULT_MODEL                = "/models/millennium_falcon.glb",
  DEFAULT_MATERIAL_MODE        = "holo",
  DEFAULT_MODEL_ORIENTATION    = Math.PI / 2.5,
  ANIMATE_PLATFORM_OPACITY     = false,
  USE_COLOR_INTENSITY          = false,
  RING_DIAMETERS               = [0.9, 1.2, 1.5],
  RING_THICKNESS               = [0.004, 0.008, 0.012],
  RING_OPACITIES               = [0.35, 0.35, 0.4],
  MODEL_ROTATION_ENABLED       = true,
  MODEL_ROTATION_SPEED         = 0.05,
  MODEL_ROTATION_MIN_SPEED     = 0.09,
  MODEL_ROTATION_MAX_SPEED     = 4.2,
  MODEL_ROTATION_STEP_INTERVAL = 10,
  MODEL_ROTATION_STEP_SIZE     = 0.05,
  SPEED_GAUGE_SEGMENTS         = 15,
  SPEED_SEGMENTS = Array.from(
    { length: SPEED_GAUGE_SEGMENTS },
    (_, i) => MODEL_ROTATION_MIN_SPEED + (MODEL_ROTATION_MAX_SPEED - MODEL_ROTATION_MIN_SPEED) * (i / (SPEED_GAUGE_SEGMENTS - 1))
  ),

  COLORS_NEON_GEN_BLUE = {
    base: 0x00ffff,
    darkBase: 0x00ccff,
    emissive: 0x00ffce,
    specular: 0x00ffce,
  },
  COLORS_ORANGE        = {
    base: 0xff8c00,
    darkBase: 0xff4800,
    emissive: 0x800000,
    specular: 0xff9900,
  },
  COLORS_AURA          = {
    base: 0xee6d2b,
    darkBase: 0x8b4513,
    emissive: 0x8b4513,
    specular: 0x8b4513,
  },
  COLORS_VERDE         = {
    base: 0x399334,
    darkBase: 0x2e7d32,
    emissive: 0x2e7d32,
    specular: 0x2e7d32,
  },
  COLORS = COLORS_NEON_GEN_BLUE
;

type MaterialMode = "normal" | "spider" | "holo";

export default function ModelViewer() {
  // biome-ignore format: consts
  const
    mountRef                                    = useRef<HTMLDivElement>(null),
    [viewMode, setViewMode]                     = useState<"normal" | "spider" | "holo">(DEFAULT_MATERIAL_MODE),
    [modelLoaded, setModelLoaded]               = useState(false),
    [modelStats, setModelStats]                 = useState<ModelStats | null>(null),
    [rotationEnabled, setRotationEnabled]       = useState<boolean>(MODEL_ROTATION_ENABLED),
    [rotationSpeed, setRotationSpeed]           = useState<number>(MODEL_ROTATION_SPEED),
    rotationEnabledRef                          = useRef<boolean>(MODEL_ROTATION_ENABLED),
    rotationSpeedRef                            = useRef<number>(MODEL_ROTATION_SPEED),
    sceneRef                                    = useRef<THREE.Scene>(null),
    cameraRef                                   = useRef<THREE.PerspectiveCamera>(null),
    rendererRef                                 = useRef<THREE.WebGLRenderer>(null),
    controlsRef                                 = useRef<OrbitControls>(null),
    modelRef                                    = useRef<THREE.Group<THREE.Object3DEventMap>>(null),
    animationRef                                = useRef<number>(null),
    timeRef                                     = useRef<number>(0),
    rotationFrameRef                            = useRef<number>(0),
    [ticksX, setTicksX]                         = useState<number[]>([]),
    [ticksY, setTicksY]                         = useState<number[]>([]),
    axisContainerRef                            = useRef<HTMLDivElement>(null),
    speedGaugeRef                               = useRef<HTMLDivElement>(null),
    isDraggingRef                               = useRef<boolean>(false),
    panelRef                                    = useRef<HTMLDivElement>(null),
    [isPanelDragEnabled, setIsPanelDragEnabled] = useState(false),
    [isPanelDragging, setIsPanelDragging]       = useState(false),
    [panelPosition, setPanelPosition]           = useState({ x: 20, y: 20 }),
    [dragOffset, setDragOffset]                 = useState({ x: 0, y: 0 })
  ;

  useEffect(() => {
    rotationEnabledRef.current = rotationEnabled;
    rotationSpeedRef.current = rotationSpeed;
  }, [rotationEnabled, rotationSpeed]);

  useEffect(() => {
    const calculateTicks = () => {
      if (!axisContainerRef.current) return;

      const container = axisContainerRef.current;
      const { width, height } = container.getBoundingClientRect();
      const TICK_SPACING = 6;

      const numTicksX = Math.floor(width / TICK_SPACING);
      const numTicksY = Math.floor(height / TICK_SPACING);
      const xArray = Array.from({ length: numTicksX }, (_, i) => i);
      const yArray = Array.from({ length: numTicksY }, (_, i) => i);

      setTicksX(xArray);
      setTicksY(yArray);
    };

    calculateTicks();

    window.addEventListener("resize", calculateTicks);
    return () => window.removeEventListener("resize", calculateTicks);
  }, []);

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

          // apply rotation to make model face the camera
          model.rotation.y = DEFAULT_MODEL_ORIENTATION;

          sceneRef.current.add(model);
          modelRef.current = model;
          setModelLoaded(true);

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
      transparent: true
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.rotation.x = -Math.PI / 2; // lay flat
    platform.position.y = -0.01; // slightly below origin to avoid z-fighting
    scene.add(platform);

    // setup rings on scene
    const rings = createPlatformRings(RING_DIAMETERS, RING_THICKNESS, RING_OPACITIES) as THREE.Mesh[];
    rings.forEach((ring) => scene.add(ring));

    // setup cross on scene
    scene.add(createCross(RING_DIAMETERS));

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

      if (rotationEnabledRef.current && modelRef.current) {
        rotationFrameRef.current += 1;
        if (rotationFrameRef.current % MODEL_ROTATION_STEP_INTERVAL === 0) {
          modelRef.current.rotation.y += MODEL_ROTATION_STEP_SIZE * rotationSpeedRef.current;
        }
      }

      if (modelRef.current) {
        updateHolographicEffect(modelRef.current);
      }

      if (Math.random() > 0.98) {
        // animate random "scan" lines
        const lineMaterial = new THREE.LineBasicMaterial({
          color: COLORS.base,
          transparent: true,
          opacity: 0.1 + Math.random() * 0.5
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

  const setMaterialMode = (mode: MaterialMode) => {
    setViewMode(mode);
    if (modelRef.current) {
      applyMaterialMode(modelRef.current, mode);
    }
  };

  const clearModel = useCallback(() => {
    if (!sceneRef.current || !modelRef.current) return;

    sceneRef.current.remove(modelRef.current);
    modelRef.current = null;

    setModelLoaded(false);
    setModelStats(null);
  }, []);

  const handleSpeedSegmentClick = (segmentValue: number) => {
    if (!modelLoaded || !rotationEnabled) return;
    setRotationSpeed(segmentValue);
  };

  const getActiveSegmentIndex = () => {
    const segmentWidth = (MODEL_ROTATION_MAX_SPEED - MODEL_ROTATION_MIN_SPEED) / (SPEED_GAUGE_SEGMENTS - 1);
    return Math.round((rotationSpeed - MODEL_ROTATION_MIN_SPEED) / segmentWidth);
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!modelLoaded || !rotationEnabled || !speedGaugeRef.current) return;
      isDraggingRef.current = true;
      updateSpeedFromMousePosition(e);
      e.preventDefault();
    },
    [modelLoaded, rotationEnabled]
  );

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !speedGaugeRef.current) return;
    updateSpeedFromMousePosition(e);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const updateSpeedFromMousePosition = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!speedGaugeRef.current) return;

    const gaugeRect = speedGaugeRef.current.getBoundingClientRect();
    const relativeX = e.clientX - gaugeRect.left;
    const percentage = Math.max(0, Math.min(1, relativeX / gaugeRect.width));

    const newSpeed = MODEL_ROTATION_MIN_SPEED + (MODEL_ROTATION_MAX_SPEED - MODEL_ROTATION_MIN_SPEED) * percentage;

    setRotationSpeed(newSpeed);
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handlePanelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanelDragEnabled || !panelRef.current) return;
      // prevent conflict with other mouse handlers
      e.stopPropagation();

      const rect = panelRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsPanelDragging(true);
    },
    [isPanelDragEnabled]
  );

  const handlePanelMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanelDragging) return;

      setPanelPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    },
    [isPanelDragging, dragOffset]
  );

  const handlePanelMouseUp = useCallback(() => {
    setIsPanelDragging(false);
  }, []);

  const togglePanelDrag = useCallback(() => {
    setIsPanelDragEnabled(!isPanelDragEnabled);
  }, [isPanelDragEnabled]);

  useEffect(() => {
    document.addEventListener("mousemove", handlePanelMouseMove);
    document.addEventListener("mouseup", handlePanelMouseUp);

    return () => {
      document.removeEventListener("mousemove", handlePanelMouseMove);
      document.removeEventListener("mouseup", handlePanelMouseUp);
    };
  }, [handlePanelMouseMove, handlePanelMouseUp]);

  return (
    <div className="model-viewer">
      <div ref={mountRef} id="interface-plane" />
      <XEnoScript />
      <div className="grid-lines" />

      <div className="axis-container" ref={axisContainerRef}>
        <div className="axis x-axis" />
        <div className="axis y-axis" />

        {ticksX.map((i) => (
          <div
            key={`x-tick-${i}`}
            className={`tick x-tick ${i % 5 === 0 ? "major-tick" : ""}`}
            style={{
              right: `${(i / (ticksX.length - 1)) * 90}%`
            }}
          />
        ))}

        {ticksY.map((i) => (
          <div
            key={`y-tick-${i}`}
            className={`tick y-tick ${i % 5 === 0 ? "major-tick" : ""}`}
            style={{
              bottom: `${(i / (ticksY.length - 1)) * 90}%`
            }}
          />
        ))}
      </div>

      <div id="interface-name">
        <h1 id="interface-title" className="animate-warning-blink">
          古典道具 REMOD3D
        </h1>
      </div>

      <div
        id="interface-panel"
        ref={panelRef}
        onMouseDown={handlePanelMouseDown}
        style={{
          top: `${panelPosition.y}px`,
          left: `${panelPosition.x}px`,
          cursor: isPanelDragEnabled ? "move" : "auto"
        }}
        className={isPanelDragEnabled ? "draggable-panel animate-warning-blink" : ""}
      >
        <div className="content-group">
          <h3>OBJECT ANALYSIS</h3>
          <HEXAgrid />
          <div className="stats-table">
            <div className="stats-row">
              <span className="stats-label">File:</span>
              <span className="stats-value stats-value-filename animate-blink">
                {modelStats ? <ScrollTXsT text={modelStats.fileName} /> : <ScrollTXsT text="--" />}
              </span>
            </div>

            <ROw label="Meshes" value={modelStats?.meshes.toString()} />
            <ROw label="Vertices" value={modelStats?.vertices.toLocaleString()} />
            <ROw label="Materials" value={modelStats?.materials.toString()} />
            <ROw label="Triangles" value={modelStats?.triangles.toLocaleString()} />
            <ROw
              label="Size"
              value={
                modelStats
                  ? `${modelStats.dimensions.width}×${modelStats.dimensions.height}×${modelStats.dimensions.depth}`
                  : undefined
              }
            />
          </div>
        </div>

        <div className="content-group">
          <h3>CONFIGURATION</h3>
          <div className="status-bar">
            <div className="status-fill" />
          </div>
          <label htmlFor="model-upload" className="animate-warning-blink">
            情報作成 Upload GLB Model
          </label>
          <input id="model-upload" type="file" accept=".glb" onChange={(e) => handleFileUpload(e, loadModel)} />
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

        <div className="content-group">
          <h3>DYNAMICS</h3>
          <div className="rotation-controls">
            <BuTTon
              primaryText="回転"
              secondaryText={rotationEnabled ? "Freeze Model" : "Rotate Model"}
              onClick={() => setRotationEnabled(!rotationEnabled)}
              active={rotationEnabled}
              disabled={!modelLoaded}
              className="verde"
            />
            <div className="rotation-speed-control">
              <div className="speed-gauge" ref={speedGaugeRef} onMouseDown={handleMouseDown}>
                {SPEED_SEGMENTS.map((segValue, idx) => (
                  <div
                    key={`segment-${idx}`}
                    className={`speed-gauge-segment ${idx <= getActiveSegmentIndex() ? "active" : ""} ${
                      !modelLoaded || !rotationEnabled ? "disabled" : ""
                    }`}
                    title={`Set speed to ${segValue.toFixed(2)}`}
                  />
                ))}
                <span className="slider-label">速度</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div id="alt-panel">
        <HEXBtn primaryText="クリア" secondaryText="Clear Model" onClick={clearModel} disabled={!modelLoaded} />
        <HEXBtn
          primaryText="移動"
          secondaryText={isPanelDragEnabled ? "Lock/Panel" : "Unlock/Panle"}
          onClick={togglePanelDrag}
          active={isPanelDragEnabled}
          className={isPanelDragEnabled ? "verde animate-warning-blink" : ""}
        />
      </div>
    </div>
  );
}

function calculateModelStats(model: THREE.Group, fileName: string): ModelStats {
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

function applyMaterialMode(model: THREE.Group, mode: MaterialMode): void {
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

function updateHolographicEffect(model: THREE.Group): void {
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

function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>, loadModelCallback: Function): void {
  if (!event.target.files?.[0]) return;

  const file = event.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  loadModelCallback(url, file.name);
}

function createPlatformRings(diameters: number[], ringThickness: number[], opacities: number[]): THREE.Mesh[] {
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

function createCross(diameters: number[]): THREE.Group<THREE.Object3DEventMap> {
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
