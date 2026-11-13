# SHADOWFALL

SHADOWFALL is a third-person, open-world superhero action-adventure prototype set across Riverton County. Explore the city and surrounding districts on foot or by car, switch between Remy and Captain America, and fight creatures across marked territories.

> **Development status:** playable local prototype. It is not a finished or licensed commercial release. This public repository contains the game source and tools; downloaded character, environment, animation, and vehicle models are kept out of Git until their redistribution rights are clear.

## Features

- Camera-relative walking, running, jumping, turning, and Remy animation.
- In-place transformation between Remy and a static Captain America mesh.
- A 1,040 × 1,040 m map with connected roads, residential neighborhoods, Old Mill Village, and marked monster territories.
- 33 marked residential entrances connected to a reusable furnished interior. Walk to a door, press **E**, explore with collision, and return through the interior exit.
- Vehicle driving with steering, reverse, handbrake, collisions, durability, and garage repair.
- Ten creature types with pursuit, attacks, damage, melee and area attacks, health, death, and respawn systems.
- Missions, map and minimap, and browser save data.

## Characters and current limits

Remy's supplied Mixamo clips drive his movement. The supplied Captain America model has textures but no skeleton or animation clips, so transformation works but the model remains static. Several monster models also have no usable animation clips and slide while moving. The supplied house exterior has no interior; supported doors transition to a separate shared furnished layout.

## Controls

| Action | Control |
|---|---|
| Move | W / S |
| Move left / right | A / D, relative to the camera |
| Run | Shift or on-screen Run |
| Jump / crouch | Space / Ctrl |
| Look / zoom | Mouse / scroll wheel |
| Interact with a nearby door or mission | E |
| Enter or exit a vehicle | F |
| Transform | T |
| Attack / block | Left click / right click |
| Captain's shield / area attack | Q / R |
| County map / pause | M / Esc |

While driving, W accelerates, S brakes and reverses, A/D steer, Space handbrakes, and F exits.

## Run locally on macOS

The existing local `ShadowFall` folder retains the downloaded files needed by this working copy.

1. Open Terminal in the project folder.
2. Run `./START_STAGE1.command`.
3. Open the local URL printed by the launcher (normally `http://127.0.0.1:8787/`).

The launcher requires Python 3 and Node/npm. It installs the Rapier physics package if needed and runs `setup_assets.py`, which retrieves the Three.js 0.181.0 runtime and creates compatibility derivatives from the local Captain America, zombie, and skyline source files. The game uses Three.js and Rapier locally; it does not use a hosted game service.

### Running a public clone

The public repository intentionally omits downloaded art files. To run a clone, obtain assets you are licensed to use and place them in the paths listed by `src/assets.js` and `convert_captain_glb.py`. Then run `npm install` and `python3 setup_assets.py`, followed by `./START_STAGE1.command`. The game currently requires the referenced models and animation clips to launch; a source-only clone will report missing assets until they are supplied.

## Asset credits and redistribution

See [ASSET_CREDITS.md](ASSET_CREDITS.md), [ENVIRONMENT_ASSET_INVENTORY.md](ENVIRONMENT_ASSET_INVENTORY.md), and [MONSTER_ASSET_INVENTORY.md](MONSTER_ASSET_INVENTORY.md) for creator names, source links, license metadata, and runtime use.

Downloaded binaries are ignored by Git because the local bundle mixes assets with no accompanying license, CC-BY-NC assets, assets licensed for use but not raw-file redistribution, and models depicting third-party characters. This keeps the user's local playable copy intact without placing uncleared files in the public repository. No downloaded art or model file is required to be deleted locally. The 161 MB `House/after_the_rain..._-_vr__sound.glb` also exceeds GitHub's 100 MB per-file limit and is not used by the game; it remains local. No Git LFS is needed for the source-only release.

The installed Three.js runtime is MIT licensed; Rapier is Apache-2.0. Their notices and package metadata are retained. This repository does not grant rights to third-party character names, designs, marks, or user-supplied assets. No separate license has been selected for the SHADOWFALL project source.

## Tests

With the local asset bundle installed, run:

```sh
python3 tests/test_structure.py
node --check src/main.js
node --check src/world.js
NEON_COUNTY_URL=http://127.0.0.1:8787/ node tests/playwright_gameplay.mjs
```

The Playwright Core browser test covers movement at different camera angles, transformation, Remy animation, map, driving, vehicle impacts, creature pursuit and combat, missions, and save persistence. It launches the installed Google Chrome app and writes local gameplay screenshots under `tests/`. Run it only after the local server is active.
