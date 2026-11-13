#!/usr/bin/env python3
"""Convert Captain America's legacy KHR spec/gloss fields to equivalent GLB PBR fields.

Only the local derivative changes. Meshes, UVs, embedded texture images, and the
original user-supplied GLB remain untouched. No skeleton is created.
"""
from pathlib import Path
import json
import struct
import sys

ROOT=Path(__file__).resolve().parent
PAIRS=[
    (ROOT/'Main Character/captain_america_-_marvel_cinematic_universe.glb',ROOT/'assets/captain_america_compatible.glb'),
    (ROOT/'Monster_Model/zombie_walk_test.glb',ROOT/'assets/zombie_compatible.glb'),
    (ROOT/'House/new_york_buildings.glb',ROOT/'assets/downtown_compatible.glb'),
]
JSON_CHUNK=0x4E4F534A

def convert_pair(source,output):
    raw=source.read_bytes()
    magic,version,total=struct.unpack_from('<4sII',raw,0)
    if magic!=b'glTF' or version!=2 or total!=len(raw):raise ValueError('Expected a valid GLB 2.0 source')
    chunks=[];offset=12;changed=0;texture_refs=0
    while offset<len(raw):
        length,kind=struct.unpack_from('<I4s',raw,offset);offset+=8
        payload=raw[offset:offset+length];offset+=length
        if kind==struct.pack('<I',JSON_CHUNK):
            doc=json.loads(payload.rstrip(b' \t\r\n\0'))
            for material in doc.get('materials',[]):
                extensions=material.get('extensions',{});legacy=extensions.pop('KHR_materials_pbrSpecularGlossiness',None)
                if legacy is None:continue
                pbr=material.setdefault('pbrMetallicRoughness',{})
                if 'diffuseFactor' in legacy:pbr['baseColorFactor']=legacy['diffuseFactor']
                if 'diffuseTexture' in legacy:pbr['baseColorTexture']=legacy['diffuseTexture'];texture_refs+=1
                pbr['metallicFactor']=0.0
                pbr['roughnessFactor']=max(0.0,min(1.0,1-float(legacy.get('glossinessFactor',1))))
                if not extensions:material.pop('extensions',None)
                changed+=1
            if 'KHR_materials_pbrSpecularGlossiness' in doc.get('extensionsUsed',[]):doc['extensionsUsed'].remove('KHR_materials_pbrSpecularGlossiness')
            if 'KHR_materials_pbrSpecularGlossiness' in doc.get('extensionsRequired',[]):doc['extensionsRequired'].remove('KHR_materials_pbrSpecularGlossiness')
            payload=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode('utf-8')
            payload+=b' '*((-len(payload))%4)
        chunks.append((kind,payload))
    if not changed:raise ValueError('No legacy spec/gloss materials were found to convert')
    body=b''.join(struct.pack('<I4s',len(data),kind)+data for kind,data in chunks)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_bytes(struct.pack('<4sII',b'glTF',2,12+len(body))+body)
    print(f'Converted {changed} materials and retained {texture_refs} embedded diffuse textures: {output.relative_to(ROOT)}')

def convert():
    for source,output in PAIRS:convert_pair(source,output)

if __name__=='__main__':
    try:convert()
    except Exception as exc:print(f'Captain America material conversion failed: {exc}',file=sys.stderr);sys.exit(1)
