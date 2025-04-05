// todo: add uv checking for glb models

"use client";

import * as THREE from "three";
import type React from "react";
import { useRef, useState, useEffect, useCallback } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ROw, BuTTon, XEnoScript, HEXAgrid, ScrollTXsT, HEXBtn } from "./ui";
import type { MaterialMode, ModelStats } from "./types";
import { SketchfabBrowser } from "./sketchfab-browser";
import {
  calculateModelStats,
  applyMaterialMode,
  createPlatformRings,
  updateHolographicEffect,
  handleFileUpload,
  createCross
} from "./helpers";

// biome-ignore format: colors
export const 
  COLORS_NEON_GEN_BLUE = {
    base: 0x00ffff,
    darkBase: 0x00ccff,
    emissive: 0x00ffce,
    specular: 0x00ffce
  },
  COLORS_ORANGE        = {
    base: 0xff8c00,
    darkBase: 0xff4800,
    emissive: 0x800000,
    specular: 0xff9900
  },
  COLORS_AURA          = {
    base: 0xee6d2b,
    darkBase: 0x8b4513,
    emissive: 0x8b4513,
    specular: 0x8b4513
  },
  COLORS_VERDE         = {
    base: 0x399334,
    darkBase: 0x2e7d32,
    emissive: 0x2e7d32,
    specular: 0x2e7d32
  },
  COLORS_VIOLET        = {
    base: 0x6a5acd,
    darkBase: 0x483d8b,
    emissive: 0x483d8b,
    specular: 0x483d8b
  },
  COLORS_RED           = {
    base: 0xff0000,
    darkBase: 0xcc0000,
    emissive: 0xcc0000,
    specular: 0xcc0000
  },
  COLORS_YELLOW        = {
    base: 0xffff00,
    darkBase: 0xcccc00,
    emissive: 0xcccc00,
    specular: 0xcccc00
  },
  COLORS = COLORS_NEON_GEN_BLUE
;

// biome-ignore format: consts
export const
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
  MINIMAP_ROTATION_SPEED       = 0.001,
  SPEED_SEGMENTS = Array.from(
    { length: SPEED_GAUGE_SEGMENTS },
    (_, i) =>
      MODEL_ROTATION_MIN_SPEED +
      (MODEL_ROTATION_MAX_SPEED - MODEL_ROTATION_MIN_SPEED) * (i / (SPEED_GAUGE_SEGMENTS - 1))
  ),

  MINIMAP_RADIUS      = 90,
  MINIMAP_SEGMENTS    = 16,
  MINIMAP_POSITION    = { x: 100, y: 100 },
  MINIMAP_SCALE       = 0.1,
  CAMERA_MARKER_COLOR = COLORS_AURA.base,
  MODEL_MARKER_COLOR  = COLORS_RED.base
;

export default function retro3d() {
  // biome-ignore format: consts
  const
    mainSceneMount                                      = useRef<HTMLDivElement>(null),
    [viewMode, setViewMode]                             = useState<"normal" | "spider" | "holo">(DEFAULT_MATERIAL_MODE),
    [modelLoaded, setModelLoaded]                       = useState(false),
    [modelStats, setModelStats]                         = useState<nully<ModelStats>>(null),
    [rotationEnabled, setRotationEnabled]               = useState<boolean>(MODEL_ROTATION_ENABLED),
    [rotationSpeed, setRotationSpeed]                   = useState<number>(MODEL_ROTATION_SPEED),
    rotationEnabledRef                                  = useRef<boolean>(MODEL_ROTATION_ENABLED),
    rotationSpeedRef                                    = useRef<number>(MODEL_ROTATION_SPEED),
    sceneRef                                            = useRef<THREE.Scene>(null),
    cameraRef                                           = useRef<THREE.PerspectiveCamera>(null),
    rendererRef                                         = useRef<THREE.WebGLRenderer>(null),
    controlsRef                                         = useRef<OrbitControls>(null),
    modelRef                                            = useRef<THREE.Group<THREE.Object3DEventMap>>(null),
    animationRef                                        = useRef<number>(null),
    timeRef                                             = useRef<number>(0),
    rotationFrameRef                                    = useRef<number>(0),
    [ticksX, setTicksX]                                 = useState<number[]>([]),
    [ticksY, setTicksY]                                 = useState<number[]>([]),
    axisContainerRef                                    = useRef<HTMLDivElement>(null),
    speedGaugeRef                                       = useRef<HTMLDivElement>(null),
    isDraggingRef                                       = useRef<boolean>(false),
    panelRef                                            = useRef<HTMLDivElement>(null),
    sketchfabPanelRef                                   = useRef<nully<HTMLDivElement>>(null),
    [isPanelDragEnabled, setIsPanelDragEnabled]         = useState(false),
    [isPanelDragging, setIsPanelDragging]               = useState(false),
    [mainPanelPosition, setMainPanelPosition]           = useState({ x: 20, y: 20 }),
    [sketchfabPanelPosition, setSketchfabPanelPosition] = useState({ x: 465, y: 20 }),
    [dragOffset, setDragOffset]                         = useState({ x: 0, y: 0 }),
    [dragTargetRef, setDragTargetRef]                   = useState<React.RefObject<nully<HTMLDivElement>> | null>(null),
    [isSketchfabPanelOpen, setIsSketchfabPanelOpen]     = useState(true),
    [isFreecam, setIsFreecam]                           = useState(false),
    [isPointerLocked, setIsPointerLocked]               = useState(false),
    isFreecamRef                                        = useRef(false),
    pressedKeys                                         = useRef(new Set<string>()),
    cameraDirectionRef                                  = useRef(new THREE.Vector3(0, 0, -1)),
    cameraPitchRef                                      = useRef(0),
    cameraYawRef                                        = useRef(0),
    minimapContainerRef                                 = useRef<HTMLDivElement>(null),
    minimapSphereRef                                    = useRef<THREE.Mesh>(null),
    minimapCameraMarkerRef                              = useRef<THREE.Mesh>(null),
    minimapModelMarkerRef                               = useRef<THREE.Mesh>(null),
    minimapSceneRef                                     = useRef<THREE.Scene>(null),
    minimapRendererRef                                  = useRef<THREE.WebGLRenderer>(null),
    minimapRotationRef                                  = useRef<number>(0)
  ;

  const setMaterialMode = useCallback((mode: MaterialMode) => {
    setViewMode(mode);
    if (modelRef.current) {
      applyMaterialMode(modelRef.current, mode);
    }
  }, []);

  const calculateAxisTicks = useCallback(() => {
    if (!axisContainerRef.current) return;

    const container = axisContainerRef.current;
    const { width, height } = container.getBoundingClientRect();
    const TICK_SPACING = 6;

    const numTicksX = Math.floor(width / TICK_SPACING);
    const numTicksY = Math.floor(height / TICK_SPACING);

    setTicksX(Array.from({ length: numTicksX }, (_, i) => i));
    setTicksY(Array.from({ length: numTicksY }, (_, i) => i));
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
          positionAndScaleModel(model);
          sceneRef.current.add(model);
          modelRef.current = model;
          setModelLoaded(true);
          setModelStats(calculateModelStats(model, fileName));
          applyMaterialMode(model, viewMode);

          if (SCALE_CAMERA) {
            const platformDiameter = 3.5;
            cameraRef.current.position.z = platformDiameter * 0.8;
            controlsRef.current.update();
          }

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

  const createMinimap = useCallback(() => {
    if (!minimapContainerRef.current || !cameraRef.current) return;

    const minimapScene = new THREE.Scene();
    minimapSceneRef.current = minimapScene;
    const minimapRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    minimapRenderer.setSize(MINIMAP_RADIUS * 2, MINIMAP_RADIUS * 2);
    minimapRenderer.setClearColor(0x000000, 0);
    minimapRendererRef.current = minimapRenderer;
    minimapContainerRef.current.appendChild(minimapRenderer.domElement);

    // create minimap sphere
    const sphereGeometry = new THREE.SphereGeometry(1, MINIMAP_SEGMENTS, MINIMAP_SEGMENTS);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.base,
      wireframe: true,
      transparent: true,
      opacity: 0.2
    });
    const minimapSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    minimapSphereRef.current = minimapSphere;
    minimapScene.add(minimapSphere);
    minimapRotationRef.current = 0;

    // model/platform marker at center
    const modelMarkerGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const modelMarkerMaterial = new THREE.MeshBasicMaterial({ color: MODEL_MARKER_COLOR });
    const modelMarker = new THREE.Mesh(modelMarkerGeometry, modelMarkerMaterial);
    minimapModelMarkerRef.current = modelMarker;
    minimapScene.add(modelMarker);

    // camera marker
    const cameraMarkerGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const cameraMarkerMaterial = new THREE.MeshBasicMaterial({ color: CAMERA_MARKER_COLOR });
    const cameraMarker = new THREE.Mesh(cameraMarkerGeometry, cameraMarkerMaterial);
    minimapCameraMarkerRef.current = cameraMarker;
    minimapScene.add(cameraMarker);

    // minimap camera
    const minimapCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 10);
    minimapCamera.position.set(0, 0, 2);
    minimapCamera.lookAt(0, 0, 0);

    minimapRenderer.render(minimapScene, minimapCamera);
  }, []);

  const updateMinimap = useCallback(() => {
    if (
      !minimapSphereRef.current ||
      !minimapCameraMarkerRef.current ||
      !minimapRendererRef.current ||
      !minimapSceneRef.current ||
      !cameraRef.current
    )
      return;

    minimapRotationRef.current += MINIMAP_ROTATION_SPEED;
    minimapSphereRef.current.rotation.y = minimapRotationRef.current;

    // calculate the normalized direction vector from camera to origin
    const cameraPosition = cameraRef.current.position.clone();
    const cameraDirection = new THREE.Vector3(0, 0, 0).sub(cameraPosition).normalize();

    // position the camera marker based on the normalized camera position vector
    const normalizedCameraPos = cameraPosition.clone().normalize().multiplyScalar(0.8);
    minimapCameraMarkerRef.current.position.copy(normalizedCameraPos);

    // create a temporary minimap camera for rendering
    const minimapCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 10);
    minimapCamera.position.set(0, 0, 2);
    minimapCamera.lookAt(0, 0, 0);

    minimapRendererRef.current.render(minimapSceneRef.current, minimapCamera);
  }, []);

  const clearModel = useCallback(() => {
    if (!sceneRef.current || !modelRef.current) return;

    sceneRef.current.remove(modelRef.current);
    modelRef.current = null;

    setModelLoaded(false);
    setModelStats(null);
  }, []);

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

  const handlePanelMouseDown = useCallback(
    (e: React.MouseEvent, targetRef: React.RefObject<nully<HTMLDivElement>>) => {
      if (!isPanelDragEnabled) return;
      e.stopPropagation();

      const rect = targetRef.current?.getBoundingClientRect();
      if (!rect) return;

      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setDragTargetRef(targetRef);
      setIsPanelDragging(true);
    },
    [isPanelDragEnabled]
  );

  const handlePanelMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanelDragging || !dragTargetRef) return;

      if (dragTargetRef === panelRef) {
        setMainPanelPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      } else if (dragTargetRef === sketchfabPanelRef) {
        setSketchfabPanelPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    },
    [isPanelDragging, dragOffset, dragTargetRef]
  );

  const handlePanelMouseUp = useCallback(() => {
    setIsPanelDragging(false);
    setDragTargetRef(null);
  }, []);

  const togglePanelDrag = useCallback(() => {
    setIsPanelDragEnabled(!isPanelDragEnabled);
  }, [isPanelDragEnabled]);

  // freecam control functions
  const enterFreecam = () => {
    if (rendererRef.current) {
      rendererRef.current.domElement.requestPointerLock();
      setIsFreecam(true);
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }

      // initialize camera rotation values based on current camera orientation
      if (cameraRef.current) {
        const euler = new THREE.Euler().setFromQuaternion(cameraRef.current.quaternion, "YXZ");
        cameraPitchRef.current = euler.x;
        cameraYawRef.current = euler.y;
      }
    }
  };

  const exitFreecam = () => {
    if (document.pointerLockElement === rendererRef.current?.domElement) {
      document.exitPointerLock();
    }
    setIsFreecam(false);
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }
  };

  // MARK: main scene & effects
  useEffect(() => {
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 3);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (!mainSceneMount.current) return;
    mainSceneMount.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    addLights(scene);
    addSceneDecorations(scene);
    createMinimap();

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      // only update OrbitControls when not in freecam mode
      if (!isFreecamRef.current) {
        controls.update();
      }
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
        addRandomScanLine(scene);
      }

      // freecam movement logic
      if (isFreecamRef.current) {
        const speed = 0.1; // Movement speed, adjustable
        const direction = new THREE.Vector3();

        // forward is always the direction the camera is facing (negative z in camera space)
        if (pressedKeys.current.has("w")) direction.z -= 1; // forward
        if (pressedKeys.current.has("s")) direction.z += 1; // backward
        if (pressedKeys.current.has("a")) direction.x -= 1; // left (strafe)
        if (pressedKeys.current.has("d")) direction.x += 1; // right (strafe)
        if (pressedKeys.current.has(" ")) direction.y += 1; // up (space)
        if (pressedKeys.current.has("shift")) direction.y -= 1; // down (shift)

        if (direction.length() > 0) {
          direction.normalize();

          // create a quaternion from the current yaw and pitch
          const quaternion = new THREE.Quaternion();
          quaternion.setFromEuler(
            new THREE.Euler(
              cameraPitchRef.current,
              cameraYawRef.current,
              0,
              // the order matters for proper FPS controls
              "YXZ"
            )
          );

          // apply the quaternion to the direction vector
          direction.applyQuaternion(quaternion).multiplyScalar(speed);
          camera.position.add(direction);
        }
      }

      updateMinimap();

      renderer.render(scene, camera);
    };

    animate();

    if (LOAD_INIT_MODEL) {
      loadModel(DEFAULT_MODEL, DEFAULT_MODEL.split("/").pop() || "Unknown Model");
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (mainSceneMount.current && renderer.domElement) {
        mainSceneMount.current.removeChild(renderer.domElement);
      }
      if (modelRef.current) {
        scene.remove(modelRef.current);
        modelRef.current = null;
      }
      if (minimapContainerRef.current && minimapRendererRef.current?.domElement) {
        minimapContainerRef.current.removeChild(minimapRendererRef.current.domElement);
      }
    };
  }, [createMinimap, updateMinimap]);

  useEffect(() => {
    rotationEnabledRef.current = rotationEnabled;
    rotationSpeedRef.current = rotationSpeed;
    isFreecamRef.current = isFreecam;
  }, [rotationEnabled, rotationSpeed, isFreecam]);

  useEffect(() => {
    window.addEventListener("resize", calculateAxisTicks);
    return () => window.removeEventListener("resize", calculateAxisTicks);
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    document.addEventListener("mousemove", handlePanelMouseMove);
    document.addEventListener("mouseup", handlePanelMouseUp);

    return () => {
      document.removeEventListener("mousemove", handlePanelMouseMove);
      document.removeEventListener("mouseup", handlePanelMouseUp);
    };
  }, [handlePanelMouseMove, handlePanelMouseUp]);

  const toggleSketchfabPanel = useCallback(() => {
    setIsSketchfabPanelOpen(!isSketchfabPanelOpen);
  }, [isSketchfabPanelOpen]);

  const handleSelectSketchfabModel = (modelUrl: string, fileName: string) => {
    loadModel(modelUrl, fileName);
  };

  // keyboard event listeners for freecam movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFreecam) {
        pressedKeys.current.add(e.key.toLowerCase());

        if (e.key === "Escape") {
          exitFreecam();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isFreecam) {
        pressedKeys.current.delete(e.key.toLowerCase());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isFreecam]);

  // pointer lock event listener for entering/exiting freecam
  useEffect(() => {
    const handlePointerLockChange = () => {
      if (document.pointerLockElement === rendererRef.current?.domElement) {
        setIsPointerLocked(true);
      } else {
        setIsPointerLocked(false);
        if (isFreecam) {
          setIsFreecam(false);
          if (controlsRef.current) {
            controlsRef.current.enabled = true;
          }
        }
      }
    };
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    return () => {
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, [isFreecam]);

  // mouse movement listener for camera rotation
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isFreecam && isPointerLocked && cameraRef.current) {
        const movementX = e.movementX || 0;
        const movementY = e.movementY || 0;
        const sensitivity = 0.002;

        // update yaw (left/right) and pitch (up/down) based on mouse movement
        cameraYawRef.current -= movementX * sensitivity;
        cameraPitchRef.current -= movementY * sensitivity;

        // clamp pitch to prevent flipping
        cameraPitchRef.current = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, cameraPitchRef.current));

        // apply rotation using quaternion to avoid gimbal lock
        const quaternion = new THREE.Quaternion();
        quaternion.setFromEuler(
          new THREE.Euler(
            cameraPitchRef.current,
            cameraYawRef.current,
            0,
            // order matters for first-person camera
            "YXZ"
          )
        );

        cameraRef.current.quaternion.copy(quaternion);
        // update the camera direction vector for movement calculations
        cameraDirectionRef.current.set(0, 0, -1).applyQuaternion(quaternion);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isFreecam, isPointerLocked]);

  return (
    <div className="model-viewer">
      {isFreecam && <div className="freecam-indicator">FREECAM MODE - Press ESC to exit</div>}
      <div ref={mainSceneMount} id="interface-plane" />
      <div ref={minimapContainerRef} className="minimap-container" />
      <div className="grid-lines" />
      <XEnoScript />

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
        onMouseDown={(e) => handlePanelMouseDown(e, panelRef)}
        style={{
          top: `${mainPanelPosition.y}px`,
          left: `${mainPanelPosition.x}px`
        }}
        className={isPanelDragEnabled ? "draggable-panel animate-warning-blink moving" : ""}
      >
        <div className="content-group">
          <h3>OBJECT ANALYSIS</h3>
          <HEXAgrid />
          <div className="stats-table">
            <div className="stats-row">
              <span className="stats-label">File:</span>
              <span className="stats-value animate-blink">
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

      {isSketchfabPanelOpen && (
        <div
          id="sketchfab-panel"
          ref={sketchfabPanelRef}
          onMouseDown={(e) => handlePanelMouseDown(e, sketchfabPanelRef)}
          style={{
            top: `${sketchfabPanelPosition.y}px`,
            left: `${sketchfabPanelPosition.x}px`
          }}
          className={isPanelDragEnabled ? "draggable-panel animate-warning-blink moving" : ""}
        >
          <SketchfabBrowser
            isOpen={isSketchfabPanelOpen}
            onClose={toggleSketchfabPanel}
            onSelectModel={handleSelectSketchfabModel}
          />
        </div>
      )}

      <div id="alt-panel">
        <HEXBtn primaryText="クリア" secondaryText="Clear Model" onClick={clearModel} disabled={!modelLoaded} />
        <HEXBtn
          primaryText="移動"
          secondaryText={isPanelDragEnabled ? "Lock Panel" : "Unlock Panels"}
          onClick={togglePanelDrag}
          active={isPanelDragEnabled}
          className={isPanelDragEnabled ? "verde animate-warning-blink" : ""}
        />
        <HEXBtn
          primaryText="検索"
          secondaryText="Browse Models"
          onClick={toggleSketchfabPanel}
          active={isSketchfabPanelOpen}
          className={isSketchfabPanelOpen ? "azul animate-warning-blink" : ""}
        />
        <HEXBtn
          primaryText="フリーラム"
          secondaryText="Enter Freecam"
          onClick={enterFreecam}
          disabled={isFreecam || !modelLoaded}
        />
      </div>
    </div>
  );
}

function positionAndScaleModel(model: THREE.Group): THREE.Group {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  const platformDiameter = 3.5;
  const maxDimension = Math.max(size.x, size.y, size.z);
  const scaleFactor = (platformDiameter / maxDimension) * 0.8;
  model.scale.multiplyScalar(scaleFactor);

  model.position.sub(center.multiplyScalar(scaleFactor));
  const newBox = new THREE.Box3().setFromObject(model);
  const minY = newBox.min.y;
  model.position.y -= minY;

  model.rotation.y = DEFAULT_MODEL_ORIENTATION;

  return model;
}

function addLights(scene: THREE.Scene) {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);
}

function addSceneDecorations(scene: THREE.Scene) {
  const platformGeometry = new THREE.CircleGeometry(PLATFORM_RADIUS, PLATFORM_SEGMENTS);
  const platformMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.base,
    side: THREE.DoubleSide,
    opacity: 0.15,
    transparent: true
  });
  const platform = new THREE.Mesh(platformGeometry, platformMaterial);
  platform.rotation.x = -Math.PI / 2;
  platform.position.y = -0.01;
  scene.add(platform);

  const rings = createPlatformRings(RING_DIAMETERS, RING_THICKNESS, RING_OPACITIES) as THREE.Mesh[];
  rings.forEach((ring) => scene.add(ring));

  scene.add(createCross(RING_DIAMETERS));
}

function addRandomScanLine(scene: THREE.Scene) {
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
}
