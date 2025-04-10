## _retro3d_
inspect and tinker with 3d models in style!

performance update scheduled for february 31st!

<div align="center">
  <img src="assets/retro3d.png" alt="REMOD3D" width="800"/>
</div>

## physics and 3d modeling in retro3d

retro3d implements several key physics and 3d rendering concepts to create an interactive model viewer with a retro-futuristic aesthetic. here's a breakdown of the core physics and 3d concepts used:

### 3d transformation and coordinate systems

- **model positioning**: models are positioned using a right-handed coordinate system where:
  - x-axis runs horizontally (left to right)
  - y-axis represents vertical height (bottom to top)
  - z-axis represents depth (near to far)

- **scaling and normalization**: imported models are automatically scaled to fit within a standard platform diameter (3.5 units) using a uniform scaling factor derived from the model's bounding box dimensions

- **rotation transformations**: models rotate around the y-axis with configurable speeds from 0.09 to 4.2 radians per step interval, implementing quaternion-based rotation to avoid gimbal lock issues

### material rendering physics

retro3d offers three distinct material viewing modes, each implementing different physics-based rendering approaches:

1. **normal mode**: preserves original material properties including textures, reflectance models (pbr), and light interactions as defined in the imported model.

2. **spider mode**: applies a wireframe visualization using the phong illumination model:
   - ambient reflection: constant base color reflection (0xffffff)
   - diffuse reflection: directional light interacts with surface normals (color 0x00ffff)
   - specular reflection: shininess parameter of 30 creates focused highlights
   - transparency: 0.7 opacity creates see-through effect

3. **holo mode**: implements a holographic material using the physically-based rendering (pbr) approach:
   - roughness: 0.2 (low value creates smoother specular reflections)
   - metalness: 0.8 (high value creates metallic-like specular reflection)
   - opacity: variable based on color intensity and animated over time
   - emissive properties: glowing effect independent of scene lighting

### camera physics

- **orbit controls**: implements a damped spring system for camera movement with:
  - dampingfactor: 0.05 (controls deceleration rate)
  - target focusing: camera always orbits around the central point (0,0,0)

- **perspective projection**: uses a perspective camera with:
  - field of view (fov): 75 degrees
  - aspect ratio: dynamically matched to viewport dimensions
  - near clipping plane: 0.1 units
  - far clipping plane: 1000 units

- **freecam physics**: implements first-person camera physics with:
  - 6 degrees of freedom movement (wasd + space/shift)
  - euler angle rotation using yxz rotation order to prevent gimbal lock
  - velocity-based movement with normalized direction vectors

### platform and environmental physics

- **platform visualization**: circular platform with rings positioned on the xz plane, implementing:
  - double-sided light interaction (both top and bottom surfaces visible)
  - opacity gradient toward edges

- **lighting physics**: dual lighting system with:
  - ambient lighting: uniform 0.5 intensity white light for base visibility
  - directional lighting: simulates distant light source (like sun) with parallel light rays
  
- **holographic effects**: dynamically animated opacity based on model part significance with:
  - volume-threshold detection to identify significant model parts
  - random opacity fluctuations at intervals to create holographic instability effects

### minimap physics and representations

- **spherical projection**: minimap represents the 3d space as a wireframe sphere with:
  - constant rotation around y-axis at speed of 0.001 radians per frame
  - normalized position vectors to map 3d positions onto sphere surface
  - camera position projected onto spherical surface using normalization
  
- **markers**: position indicators using vector normalization and dot products

## technical implementation

built with three.js for 3d rendering and physics calculations alongside next.js for the application framework. the project uses webgl for hardware-accelerated rendering and implements custom vertex and fragment shaders for specialized visual effects

## more specifics

### damped spring system

in the orbit controls, a damped spring system simulates realistic camera movement:

```javascript
// pseudo-code example of damped spring implementation
const damping_factor = 0.05; // determines how quickly oscillations decay
const spring_constant = 1.0; // determines spring stiffness

function update_camera_position() {
    // calculate spring force based on distance from target
    const displacement = current_position.sub(target_position);
    const spring_force = displacement.multiplyScalar(spring_constant);
    
    // apply damping to reduce oscillation
    const damping_force = velocity.multiplyScalar(damping_factor);
    
    // calculate acceleration (f = ma, assuming unit mass)
    const acceleration = spring_force.sub(damping_force);
    
    // update velocity and position using basic physics integration
    velocity.add(acceleration);
    current_position.add(velocity);
}
```

this creates camera movement that:
- smoothly decelerates as it approaches the target
- prevents overshooting and endless oscillation
- feels physical and intuitive to users

#### damping as a continuous force

damping doesn't just affect the system when user input stops—it's a continuous force acting like movement through a viscous fluid:

```javascript
// damping acts at all times during motion
function update_physics_step(delta_time) {
    // external forces (user input, etc)
    const external_forces = calculate_user_input_forces();
    
    // spring force pulls toward target
    const spring_force = calculate_spring_force();
    
    // damping force always opposes motion proportional to velocity
    const damping_force = current_velocity.clone().multiplyScalar(-damping_factor);
    
    // combine all forces
    const total_force = external_forces.add(spring_force).add(damping_force);
    
    // update physics state
    current_velocity.add(total_force.multiplyScalar(delta_time));
    current_position.add(current_velocity.clone().multiplyScalar(delta_time));
}
```

this continuous damping creates several important physical effects:
- prevents excessive acceleration and speed during rapid inputs
- creates a feeling of weight and physicality to the camera
- prevents jerky or too-responsive motion that would feel unrealistic
- adds a sense of inertia, making movement feel substantial
- smooths out user inputs for more cinematic camera behavior
- stabilizes numerical integration in the physics simulation

### gimbal lock explained

gimbal lock occurs when two rotation axes align, causing a loss of one degree of freedom. in 3d rotation:

1. when using euler angles (representing rotations around x, y, z axes in sequence)
2. if the second rotation is 90°, the first and third rotation axes become parallel
3. this causes a loss of one rotational degree of freedom

example in retro3d's freecam implementation:

```javascript
// this code prevents gimbal lock by using yxz rotation order
const quaternion = new THREE.Quaternion();
quaternion.setFromEuler(
    new THREE.Euler(
        camera_pitch_ref.current, // x-axis rotation (pitch)
        camera_yaw_ref.current,   // y-axis rotation (yaw)
        0,                        // z-axis rotation (roll, unused)
        "YXZ"                     // applying yaw first, then pitch prevents gimbal lock
    )
);
```

### direction vector normalization

vector normalization preserves direction while standardizing length to 1 unit:

```javascript
// example from movement direction calculation
const direction = new THREE.Vector3();
if (keys.w) direction.z -= 1; // forward
if (keys.s) direction.z += 1; // backward
if (keys.a) direction.x -= 1; // left
if (keys.d) direction.x += 1; // right

// normalization ensures consistent movement speed regardless of direction
if (direction.length() > 0) {
    direction.normalize();
    // apply speed factor after normalization
    direction.multiplyScalar(speed);
}
```

without normalization, moving diagonally would be faster (by a factor of $`\sqrt{2}`$) than moving along a single axis

### dot products in the codebase

dot products calculate cosine similarity between vectors. in the minimap code:

```javascript
// calculate camera angle relative to model
const camera_position = camera_ref.current.position.clone();
const camera_to_model = new THREE.Vector3().sub(camera_position).normalize();
const forward_vector = new THREE.Vector3(0, 0, -1).applyQuaternion(camera_ref.current.quaternion);

// dot product determines if camera is facing model
const facing_factor = forward_vector.dot(camera_to_model);
// result ranges from 1 (directly facing) to -1 (facing away)
```

### quaternions vs euler angles

euler angles represent rotations as three sequential rotations around x, y, z axes:
- intuitive to understand (pitch, yaw, roll)
- susceptible to gimbal lock
- order-dependent (xyz vs. zyx gives different results)

quaternions represent rotations using four components (x, y, z, w):
- avoids gimbal lock completely
- enables smooth interpolation between orientations
- computationally efficient for composing multiple rotations

```javascript
// euler angles example (susceptible to gimbal lock)
const euler = new THREE.Euler(pitch, yaw, roll, "YXZ");
object.rotation.copy(euler);

// equivalent quaternion (avoids gimbal lock)
const quaternion = new THREE.Quaternion();
quaternion.setFromEuler(euler);
object.quaternion.copy(quaternion);
```

retro3d uses quaternions for critical rotations while offering euler angles for intuitive parameter adjustments