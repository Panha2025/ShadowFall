#!/usr/bin/env python3
"""Installer for the SHADOWFALL browser runtime and local asset derivatives.

No models are replaced by procedural lookalikes if a download fails.
"""
from pathlib import Path
import argparse
import shutil
import sys
import urllib.request
import urllib.error
import struct
import time
import subprocess
from convert_captain_glb import convert as convert_captain

ROOT = Path(__file__).resolve().parent
VERSION = "0.181.0"
CDN = f"https://cdn.jsdelivr.net/npm/three@{VERSION}"
DEPS = {
  "vendor/three.module.js": CDN + "/build/three.module.js",
  "vendor/three.core.js": CDN + "/build/three.core.js",
  "vendor/loaders/GLTFLoader.js": CDN + "/examples/jsm/loaders/GLTFLoader.js",
  "vendor/loaders/FBXLoader.js": CDN + "/examples/jsm/loaders/FBXLoader.js",
  "vendor/libs/fflate.module.js": CDN + "/examples/jsm/libs/fflate.module.js",
  "vendor/curves/NURBSCurve.js": CDN + "/examples/jsm/curves/NURBSCurve.js",
  "vendor/curves/NURBSUtils.js": CDN + "/examples/jsm/curves/NURBSUtils.js",
  "vendor/utils/BufferGeometryUtils.js": CDN + "/examples/jsm/utils/BufferGeometryUtils.js",
  "vendor/utils/SkeletonUtils.js": CDN + "/examples/jsm/utils/SkeletonUtils.js",
  "vendor/LICENSE.txt": CDN + "/LICENSE",
}
PUBLISHER = "https://www.innerscene.com/api/library/"
ASSETS = {
  "assets/sam.glb": ("locomotion-collection-sam-3d-person-animated-dc23800f", "human male, skeletal animated, textured", True),
  "assets/maya.glb": ("locomotion-collection-maya-3d-person-animated-1499b2fd", "human female, skeletal animated, textured", False),
  "assets/harper.glb": ("locomotion-collection-harper-3d-person-animated-797e1e2a", "human pedestrian, skeletal animated, textured", False),
  "assets/sedan.glb": ("graphite-four-door-sedan-eed96d12", "real-scale four-door sedan", True),
  "assets/supercar.glb": ("generic-mid-engine-supercar-73f252c5", "mid-engine supercar", False),
  "assets/tower.glb": ("twenty-storey-glass-office-tower-0f2e9425", "glass office high-rise", True),
  "assets/office.glb": ("three-storey-office-building-16b33ce5", "street-level office", True),
  "assets/megatower.glb": ("glass-office-skyscraper-40-floors-4b927b20", "40-storey skyscraper", False),
  "assets/oak.glb": ("oak-street-tree-detailed-leaves-a273fef9", "detailed street tree", True),
  "assets/maple.glb": ("maple-street-tree-detailed-leaves-006cddf4", "detailed maple", False),
}

def get(relative, url, force=False):
    target = ROOT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and target.stat().st_size > 100 and not force:
        if target.suffix != '.glb' or target.read_bytes()[:4] == b'glTF':
            print(f'  [cached] {relative} ({target.stat().st_size/1048576:.1f} MB)', flush=True)
            return True
    tmp = target.with_suffix(target.suffix + '.partial')
    err = None
    for trial in (1,2):
        try:
            print(f'  [fetch]  {relative}', flush=True)
            # macOS curl uses the system Keychain trust roots. Some framework
            # Python builds ship with no configured CA bundle and fail HTTPS.
            subprocess.run(['curl','--fail','--location','--silent','--show-error','--max-time','60','--output',str(tmp),url],check=True)
            if tmp.stat().st_size < 100: raise ValueError('Downloaded file is empty')
            if target.suffix == '.glb':
                with tmp.open('rb') as f: head=f.read(12)
                if len(head)!=12 or head[:4] != b'glTF' or struct.unpack_from('<I',head,8)[0]!=tmp.stat().st_size:
                    raise ValueError('Server returned something other than a valid GLB binary')
            elif b'<html' in tmp.read_bytes()[:200].lower():
                raise ValueError('Server returned an HTML page instead of JS')
            tmp.replace(target)
            print(f'  [ok]     {relative} ({target.stat().st_size/1048576:.1f} MB)', flush=True)
            return True
        except Exception as exc:
            err = exc
            tmp.unlink(missing_ok=True)
            if trial == 1: time.sleep(1)
    print(f'  [FAILED] {relative}: {err}', flush=True)
    return False

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--essential',action='store_true',help='download only 5 core models instead of 10')
    parser.add_argument('--force',action='store_true')
    args=parser.parse_args()
    print('\nSHADOWFALL / local runtime installer\n' +
          'Installs the MIT Three.js runtime needed by the 3D app. The game loads the models already included in this project.\n', flush=True)
    dependencies=all([get(k,v,args.force) for k,v in DEPS.items()])
    print('\nIncluded 3D models and animations are loaded from their project folders; no model downloads are required.',flush=True)
    if not dependencies:
        print('Three.js runtime installation failed. Check internet access and relaunch.',flush=True)
        return 1
    try:convert_captain()
    except Exception as exc:
        print(f'Captain America local material conversion failed: {exc}',flush=True)
        return 1
    print('Runtime ready. Launch from START_STAGE1.command.',flush=True)
    return 0

if __name__=='__main__':sys.exit(main())
