# Monster model inventory

Inspected the project’s `Monster_Model/` and `assets/` folders for GLB/glTF/FBX/OBJ/archive creature assets. The ten unique creature models below are the complete `Monster_Model/` set. Every file is GLB 2.0, and each image is embedded in the GLB (no external texture URI was found). Geometry triangle totals are approximate sums from mesh index accessors. Rig and clip counts come from the GLB scene metadata.

Model heights are the game’s normalized gameplay targets, in meters, rather than source-file measurements. Several source files use transformed or skeletal mesh spaces where the raw accessor bounds do not match the rendered body, so treating those raw bounds as real-world dimensions would give misleading results.

| Source file | Creature | Runtime target | Geometry | Rig / animation | Textures | Creator / license metadata | Game use and limits |
|---|---|---:|---:|---|---|---|---|
| `dragon_character_3d_by_oscar_creativo.glb` | Dragon | 3.6 m | ~167k triangles; 15 meshes | 1 skin; 1 clip (`MOTION`) | 48 embedded images; 15 materials | Oscar Creativo; CC-BY-NC-4.0 | Used in Outskirts. Clip is loaded as its movement action; source clip quality still needs visual review in-game. Non-commercial license. |
| `dragon_nemesis__the_infernal_wyrm.glb` | Dragon Nemesis / wyrm | 2.7 m | ~10k; 1 mesh | No skin or clips | 4 embedded; 1 material | 6 / Atahan3D; CC-BY-4.0 | Used in Abandoned zone. Moves by root translation/rotation; no skeletal locomotion. |
| `evolved_godzilla.glb` | Evolved Godzilla | 4.0 m | ~59k; 4 meshes | 1 skin; no clips | 7 embedded; 2 materials | savounited; CC-BY-4.0 | Used in Industrial zone. Rig exists, but there are no animation clips, so it currently slides while moving. |
| `galactus_marvel_vs._capcom_3.glb` | Galactus | 5.2 m | ~31k; 37 meshes | 1 skin; no clips | 3 embedded; 37 materials | Lightning McQueen productions / raffiarai0101; CC-BY-4.0 | Used in Industrial zone as a boss. Static pose while moving. Marvel character; commercial/public use also requires appropriate IP rights. |
| `ghost_rider_-_robbie_reyes.glb` | Ghost Rider | 1.95 m | ~5.7k; 6 meshes | No skin or clips | 9 embedded; 6 materials | Luciano Soares; CC-BY-NC-4.0 | Used in Woods. Root-motion only, no skeletal locomotion. Non-commercial license; character is also third-party IP. |
| `monster_spider.glb` | Spider | 1.32 m | ~60.8k; 4 meshes | 1 skin; 3 clips | 2 embedded; 3 materials | aziz / AZlZ; CC-BY-4.0 | Used in Abandoned, Woods, and a night reserve. Clips load; current generic monster animator selects a movement clip, but per-clip suitability needs visual review. |
| `pennywise.glb` | Pennywise | 1.82 m | ~6.2k; 6 meshes | No skin or clips | 15 embedded; 5 materials | Kernee; CC-BY-NC-4.0 | Used in Downtown. Root-motion only, no skeletal locomotion. Non-commercial license and third-party IP. |
| `surtur_rigged.glb` | Surtur | 3.8 m | ~5k; 1 mesh | 1 skin; no clips | 1 embedded; 1 material | CAPTAAINR; CC-BY-4.0 | Used as the Industrial boss. Has a skeleton but no animation clip; currently slides while moving. |
| `ultron_-_marvel_rivals.glb` | Ultron | 2.15 m | ~130k; 6 meshes | 1 skin; no clips | 12 embedded; 6 materials | WW3 / Mr.Iguana; CC-BY-4.0 | Used in Outskirts. Rig present without clips; currently slides while moving. Marvel character; commercial/public use also requires appropriate IP rights. |
| `zombie_walk_test.glb` | Zombie (source) | 2.05 m | ~32.9k; 4 meshes | 1 skin; 1 clip (`ANIMATION ZOMBIE`) | 3 embedded; 1 material | Oscar Creativo; CC-BY-4.0 | Game uses the project’s repaired derivative `assets/zombie_compatible.glb`; the source remains accounted for here. Zombie action is selected as movement, but final motion quality needs visual review. |

The loaded gameplay roster contains 17 actors (15 daytime and 2 night-only), across five danger zones. All ten source creature types are used in at least one zone. Nearby/distant visibility is bounded by existing world logic. The static models above have working health, damage, attack, pursuit, death, and respawn logic, but their lack of animation clips is a visible quality limitation.

`assets/zombie_compatible.glb` is a compatibility derivative of the zombie source, not an eleventh unique creature. Captain America and other character GLBs are not in this creature inventory.
