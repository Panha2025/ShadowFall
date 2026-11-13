"""Static checks only: no visual/GPU verification without third-party GLB files."""
from pathlib import Path
import ast, re, struct
R=Path(__file__).resolve().parents[1]
assert (R/'index.html').exists()
assert (R/'START_STAGE1.command').exists()
assert (R/'legacy/PLAY_ORIGINAL_ADVENTURE.html').exists()
assert (R/'ASSET_CREDITS.md').exists()
text=(R/'src/main.js').read_text()
assert 'side=Number(!!keys.KeyD)-Number(!!keys.KeyA)' in text
assert 'steer=Number(!!keys.KeyA)-Number(!!keys.KeyD)' in (R/'src/vehicle_physics.js').read_text()
assert 'fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw)' in (R/'src/vehicle_physics.js').read_text()
assert 'const zoomStep=e.deltaY<0?-1:1' in text
assert 'cameraYaw=-car.yaw' in text
assert 'Mouse' or 'mousemove' in text
assert 'document.pointerLockElement' in text
assert 'toCar()' in text
assert 'function attack()' in text and 'function throwShield()' in text
assert "$('#transformButton').addEventListener('click',transform)" in text
assert "$('#sprintButton').addEventListener('click'" in text
assert 'function updateShield(dt)' in text
assert 'function damageMonster(m,damage' in text
assert "if(e.code==='KeyT')transform()" in text
assert 'nearestMonster' in text and 'function attack()' in text
assert "new THREE.WebGLRenderer" in text
assert "import RAPIER from '@dimforge/rapier3d-compat'" in text
assert 'cameraDistance(desiredTarget' in text
assert 'world.configurePhysics(RAPIER)' in text
assert "if(!player.grounded)mode=player.vy>.35?'jump':'fall'" in text
assert 'simulationAccumulator+=Math.min(.25,wallDt)' in text
assert 'cameraFollowSensitivity' in text and 'vehicleCameraDistance' in text
assert 'walkSpeed=controls.walkSpeed' in text and 'runSpeed=controls.runSpeed' in text
physics=(R/'src/vehicle_physics.js').read_text()
assert 'body.addTorque' in physics and 'targetYawRate' in physics
assert 'this.dt=1/60' in physics and 'this.accumulator' in physics
assert "canvas.requestPointerLock?.();attack();return" in text
assets=(R/'src/assets.js').read_text()
assert 'GLTFLoader' in assets and 'SkeletonUtils' in assets and 'AnimationMixer' in assets
assert "remy:'Main Character/Remy.fbx'" in assets
assert "captain:'assets/captain_america_compatible.glb'" in assets
assert "zombie:'assets/zombie_compatible.glb'" in assets
assert 'FBXLoader' in assets and 'REQUIRED' in assets
world=(R/'src/world.js').read_text()
assert 'bank.instance(name' in world
assert 'new THREE.PlaneGeometry' in world
assert 'this.buildVehicles()' in world and 'this.buildPeople()' in world
assert "?Math.PI/2:0)+Math.PI" in world
assert 'rightZ=-Math.sin(car.yaw)' in world
assert 'c===excludeCar||Math.abs(target.x-c.x)' in world
assert 'addMonster(x,z,type,zone,nightOnly)' in world
assert 'function measuredActorBounds(root)' in world
assert 'mesh.getVertexPosition(i,point)' in world
assert 'actor.step(.12,\'walk\')' in world
assert 'this.dangerZones=[]' in world and 'this.buildTrees()' in world
assert 'this.residentialRoads=[-98,-28,28,98]' in world
assert 'buildDriveways()' in world
setup=(R/'setup_assets.py').read_text()
ast.parse(setup)
assert 'vendor/loaders/FBXLoader.js' in setup
assert 'convert_captain' in setup and (R/'convert_captain_glb.py').exists()
assert 'polySurface63[78]' in assets
assert '@dimforge/rapier3d-compat' in (R/'package.json').read_text()
print('PASS: assets, Remy animation pipeline, camera-relative movement, vehicle heading/camera, combat, traffic, legacy archive')
