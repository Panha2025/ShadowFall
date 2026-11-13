# SHADOWFALL — Asset attribution and release notes

## Local user-supplied assets used by the playable working copy

Model binaries are intentionally excluded from the public Git repository. The files listed here remain in the local working folder. Their presence locally does not establish redistribution rights.

| Use | Local source | Attribution / license status |
|---|---|---|
| Player | `Main Character/Remy.fbx` | User supplied. No license or source manifest was included in the project. |
| Superhero form | `Main Character/captain_america_-_marvel_cinematic_universe.glb` → local derivative `assets/captain_america_compatible.glb` | User supplied fan-project depiction of Marvel's Captain America. The local converter maps five embedded diffuse textures to current PBR base-color slots; source model remains unchanged. Marvel character, costume, and related marks are protected IP; clear rights before public or commercial release. |
| Animations | `Action/*.fbx` | User supplied Mixamo-formatted clips. Keep the original source/license terms from the download account; no per-file attribution data was included. |
| City and home assets | `House/*.glb` | User supplied. Per-file creator, license, source URLs, measurements, and integration choices are recorded in [ENVIRONMENT_ASSET_INVENTORY.md](ENVIRONMENT_ASSET_INVENTORY.md). GLB metadata identifies the integrated village and most reviewed House models. |
| Vehicles | `car/*.glb` | User supplied. Vehicle marks/designs may have separate rights; verify before public or commercial release. |
| Enemies | `Monster_Model/*.glb` | User supplied. Several filenames depict Marvel or other third-party characters; do not assume redistribution rights. |

The ten unique creature models are now assigned to danger zones; see [MONSTER_ASSET_INVENTORY.md](MONSTER_ASSET_INVENTORY.md) for per-file metadata, runtime sizing, animation limits, embedded texture counts, and creator/license data. The House environment inventory includes creator/license strings and source URLs read from GLB metadata; those records are attribution clues, not legal verification. One already-used apartment model is marked CC-BY-NC-4.0, so confirm intended use or replace it before commercial distribution. The converter also updates legacy specular/glossiness material fields in the zombie and skyline files while retaining geometry, animation, and embedded texture data. Captain America has five materials and embedded textures, but no skin/skeleton and no animations. Preserve the source pages, creator names, and license records when available; obtain permission or replace restricted assets before public distribution.

## Runtime

Three.js 0.181.0 is fetched by `setup_assets.py` from jsDelivr and is distributed under the MIT License: https://github.com/mrdoob/three.js/blob/r181/LICENSE

Rapier 3D JavaScript compatibility runtime (`@dimforge/rapier3d-compat` 0.21.x) is installed locally from npm for the car rigid-body simulation; it is distributed under Apache-2.0. Playwright Core is used as a development-only browser test dependency.

## Geometry policy

Player characters, enemies, vehicles, houses, and building scenes are loaded from the user supplied model files. Simple Three.js geometry is used for roads, sidewalks, the village berm, street bins, traffic utilities, and one short breakable fence; it does not replace the imported buildings or characters.


## Public repository distribution

The public repository keeps these attribution records but excludes the downloaded model and animation binaries. The local game continues to use its existing files. The bundle includes CC-BY-NC items, a Sketchfab Standard asset, user-supplied files without license manifests, and fan models of protected characters; obtain permission or replace an asset before publishing it. See the project README for how a clone can be supplied with separately licensed local assets.
