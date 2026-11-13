import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';

// These are the user's downloaded assets. FBX animation clips stay separate so
// Mixamo can bind their tracks to Remy's matching skeleton at runtime.
export const CATALOG={
 remy:'Main Character/Remy.fbx',captain:'assets/captain_america_compatible.glb',
 zombie:'assets/zombie_compatible.glb',monsterSpider:'Monster_Model/monster_spider.glb',monsterBoss:'Monster_Model/surtur_rigged.glb',
 monsterDragon:'Monster_Model/dragon_character_3d_by_oscar_creativo.glb',monsterWyrm:'Monster_Model/dragon_nemesis__the_infernal_wyrm.glb',
 monsterGodzilla:'Monster_Model/evolved_godzilla.glb',monsterGalactus:'Monster_Model/galactus_marvel_vs._capcom_3.glb',
 monsterGhostRider:'Monster_Model/ghost_rider_-_robbie_reyes.glb',monsterPennywise:'Monster_Model/pennywise.glb',monsterUltron:'Monster_Model/ultron_-_marvel_rivals.glb',
 house:'House/autumn_house.glb',apartment:'House/japanese_apartment.glb',shop:'House/the_old_curiosity_shop_2024.glb',downtown:'assets/downtown_compatible.glb',abandoned:'House/abandoned_city_street_for_games.glb',village:'House/village_personal_assets.glb',
 sedan:'car/chevrolet_camaro_zl1%20(1).glb',bus:'car/school_bus.glb',
 idle:'Action/Standing Idle.fbx',walk:'Action/Walking.fbx',run:'Action/Running.fbx',backward:'Action/Walking Backwards.fbx',runBackward:'Action/Running Backward (1).fbx',
 punch:'Action/Punching.fbx',fight:'Action/Fighting Idle.fbx',sit:'Action/Sitting.fbx',sitIdle:'Action/Sitting Idle.fbx',turn:'Action/Walking Turn 180.fbx',jump:'Action/Jumping Up.fbx',land:'Action/Jumping Down.fbx'
};
export const REQUIRED=['remy','captain','zombie','monsterSpider','monsterBoss','monsterDragon','monsterWyrm','monsterGodzilla','monsterGalactus','monsterGhostRider','monsterPennywise','monsterUltron','house','apartment','shop','downtown','abandoned','village','sedan','bus','idle','walk','run','backward','runBackward','jump','land','fight','sit','sitIdle','turn'];

export class AssetBank{
 constructor(progress){this.progress=progress;this.sources=new Map();this.failed=[];this.gltf=new GLTFLoader();this.fbx=new FBXLoader()}
 async load(){let done=0;const names=Object.keys(CATALOG);await Promise.all(names.map(async name=>{
   try{
     let asset;
     if(CATALOG[name].endsWith('.fbx')){const object=await this.fbx.loadAsync('./'+CATALOG[name]);asset={scene:object,animations:object.animations||[]};}
     else {const gltf=await this.gltf.loadAsync('./'+CATALOG[name]);asset={scene:gltf.scene,animations:gltf.animations||[]};}
     asset.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){if(m.map){m.map.colorSpace=THREE.SRGBColorSpace;m.map.anisotropy=4}}}});
     this.sources.set(name,asset);
   }catch(e){this.failed.push(`${name}: ${e.message||e}`)}finally{this.progress(++done,names.length,name)}
 }));const missing=REQUIRED.filter(k=>!this.sources.has(k));if(missing.length)throw new Error(`Downloaded project assets could not load: ${missing.join(', ')}. ${this.failed.filter(x=>missing.some(m=>x.startsWith(m+':'))).join('; ')}`);return this}
 get(name){return this.sources.get(name)||null}
 clone(name){const asset=this.get(name);if(!asset)return null;const content=asset.scene.isSkinnedMesh||asset.scene.getObjectByProperty('isSkinnedMesh',true)?cloneSkinned(asset.scene):asset.scene.clone(true);
  // autumn_house.glb includes a 50 m circular presentation base and a second
  // coplanar display disc. They float as islands when the actual house is reused
  // as a residential lot, so strip those two staging meshes from each clone.
  if(name==='house'){const remove=[];content.traverse(o=>{if(o.isMesh&&/^polySurface63[78]_/.test(o.name))remove.push(o)});for(const o of remove)o.parent?.remove(o)}
  // The supplied Captain GLB has no armature, but its separate circular shield
  // mesh is visibly left near the ground. Lift that static prop to hand height;
  // this is only a mesh-placement correction, not a skeletal animation.
  if(name==='captain'){const remove=[];content.traverse(o=>{if(o.isMesh&&o.name.startsWith('24_+hero-thor01-s06-wp02'))remove.push(o)});for(const o of remove)o.parent?.remove(o);content.updateMatrixWorld(true);let shield=null;content.traverse(o=>{if(o.isMesh&&o.name.startsWith('24_+Captain_america-Civil_War-WP001'))shield=o});if(shield?.parent){const node=shield.parent,worldPos=new THREE.Vector3().setFromMatrixPosition(node.matrixWorld);worldPos.y+=.44;node.parent?.worldToLocal(worldPos);node.position.copy(worldPos)}}
  return content}
 instance(name,dimensions={}){const content=this.clone(name);if(!content)return null;const bounds=new THREE.Box3().setFromObject(content),size=bounds.getSize(new THREE.Vector3());let scale=1;if(dimensions.height)scale=dimensions.height/Math.max(.01,size.y);if(dimensions.width)scale=dimensions.width/Math.max(.01,Math.max(size.x,size.z));if(dimensions.length)scale=dimensions.length/Math.max(.01,Math.max(size.x,size.z));const root=new THREE.Group();root.add(content);content.scale.setScalar(scale);content.position.set(-(bounds.min.x+bounds.max.x)*.5*scale,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)*.5*scale);return{root,pivot:content,content,scale,dimensions:size}}
}
export function createAnimator(bank,name='remy',height=1.8){
 const a=bank.instance(name,{height});if(!a)return null;const mixer=new THREE.AnimationMixer(a.content),actions={};
 const aliases=name==='remy'?['idle','walk','run','backward','runBackward','punch','fight','sit','sitIdle','turn','jump','land']:[];
 for(const key of aliases){const source=bank.get(key);if(source?.animations?.length)actions[key]=mixer.clipAction(source.animations[0],a.content)}
 if(name!=='remy'){const clips=bank.get(name)?.animations||[];for(const clip of clips){const n=clip.name.toLowerCase();const key=/idle|stand/.test(n)?'idle':'walk';if(!actions[key])actions[key]=mixer.clipAction(clip,a.content)}}
 if(!actions.idle)actions.idle=mixer.clipAction(new THREE.AnimationClip('idle',1,[]));
 if(!actions.walk)actions.walk=actions.idle;if(!actions.run)actions.run=actions.walk;actions.idle.play();let current='idle';
 return{...a,mixer,actions,step(dt,state){let next=actions[state]?state:state==='idle'?'idle':'walk';if(!actions[next])next=actions.idle?'idle':'walk';if(next!==current){const from=actions[current],to=actions[next];if(from!==to){to.reset().play();from?.crossFadeTo(to,.2,true)}current=next}mixer.update(dt)}};
}
