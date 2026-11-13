#!/usr/bin/env python3
"""Inspect included GLB headers and report renderable scene data at a basic level."""
from pathlib import Path
import json, struct

ROOT=Path(__file__).resolve().parent
FILES={
 'Captain America':'Main Character/captain_america_-_marvel_cinematic_universe.glb',
 'City set':'House/ccity_building_set_1.glb','House':'House/autumn_house.glb',
 'Abandoned street':'House/abandoned_city_street_for_games.glb',
 'Camaro':'car/chevrolet_camaro_zl1 (1).glb','Zombie':'Monster_Model/zombie_walk_test.glb',
 'Spider monster':'Monster_Model/monster_spider.glb'
}
for name,relative in FILES.items():
 p=ROOT/relative
 if not p.is_file(): print('MISSING',name,relative);continue
 try:
  with p.open('rb') as f:
   magic,version,length=struct.unpack('<4sII',f.read(12));chunk_len,chunk_type=struct.unpack('<I4s',f.read(8));data=json.loads(f.read(chunk_len))
  assert magic==b'glTF' and version==2 and length==p.stat().st_size and chunk_type==b'JSON'
  skin=sum(1 for _ in data.get('skins',[]));animations=len(data.get('animations',[]))
  print(f'OK {name}: {p.stat().st_size/1048576:.1f} MB, {len(data.get("meshes",[]))} mesh definitions, {len(data.get("materials",[]))} materials, {skin} skins, {animations} animation clips')
 except Exception as e: print('INVALID',name,e)
