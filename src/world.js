import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createAnimator} from './assets.js';
import {VehiclePhysics} from './vehicle_physics.js';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const rand=(min,max)=>min+Math.random()*(max-min);
const WORLD_HALF_EXTENT=520;

function surfaceTexture(palette,type='asphalt'){
 const c=document.createElement('canvas');c.width=c.height=512;let ctx=c.getContext('2d');
 ctx.fillStyle=palette;ctx.fillRect(0,0,512,512);
 let seed=314159;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
 for(let i=0;i<17000;i++){
  let val=(random()-.5)*(type==='asphalt'?42:20),x=random()*512,y=random()*512,sz=.5+random()*2;
  ctx.fillStyle=`rgba(${val>0?'245,235,220':'16,24,29'},${Math.abs(val)/(type==='asphalt'?190:330)})`;
  ctx.fillRect(x,y,sz,sz);
 }
 if(type==='concrete'){
  ctx.strokeStyle='#6c6a641e';ctx.lineWidth=1;
  for(let p=0;p<=512;p+=128){ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,512);ctx.stroke();ctx.beginPath();ctx.moveTo(0,p);ctx.lineTo(512,p);ctx.stroke()}
 }
 let tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=8;return tex;
}
function groundPlane(scene,x,z,w,l,material,y=0){
 const geo=new THREE.PlaneGeometry(w,l);const mesh=new THREE.Mesh(geo,material);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
function ringPlane(scene,x,z,inner,outer,material,y=0){
 const mesh=new THREE.Mesh(new THREE.RingGeometry(inner,outer,96),material);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
function measuredActorBounds(root){
 root.updateMatrixWorld(true);const bounds=new THREE.Box3();
 root.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry?.attributes?.position)return;
  if(mesh.isSkinnedMesh){const point=new THREE.Vector3(),count=mesh.geometry.attributes.position.count;for(let i=0;i<count;i++)bounds.expandByPoint(mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld))}
  else{if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox,e=mesh.matrixWorld.elements;for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])bounds.expandByPoint(new THREE.Vector3(e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]))}
 });return bounds;
}
export class WorldScene{
 constructor(scene,bank){this.scene=scene;this.bank=bank;this.worldHalfExtent=WORLD_HALF_EXTENT;this.buildings=[];this.villageColliders=[];this.villages=[];this.dangerZones=[];this.cars=[];this.people=[];this.monsters=[];this.movableProps=[];this.destructibleProps=[];this.doorMarkers=[];this.enterableHouses=[];this.hotspots=[];this.effects=[];this.elapsed=0;this.makeWorld()}
 makeWorld(){
  const scene=this.scene;
  scene.background=new THREE.Color(0xb7c7d3);scene.fog=new THREE.FogExp2(0xb7c7d3,.0018);
  this.hemisphere=new THREE.HemisphereLight(0xe2edfc,0x6e7164,1.75);scene.add(this.hemisphere);
  this.sun=new THREE.DirectionalLight(0xffebcf,2.65);scene.add(this.sun);this.sun.position.set(-80,140,-70);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-175;this.sun.shadow.camera.right=175;this.sun.shadow.camera.top=175;this.sun.shadow.camera.bottom=-175;this.sun.shadow.camera.near=.5;this.sun.shadow.camera.far=360;this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.03;this.sun.target.position.set(0,0,0);scene.add(this.sun.target);
  const asphalt=surfaceTexture('#3c4146');asphalt.repeat.set(14,14);
  const pavement=surfaceTexture('#89877f','concrete');pavement.repeat.set(4,4);
  const grass=surfaceTexture('#5e6a53');grass.repeat.set(36,36);
  const forest=surfaceTexture('#435640');forest.repeat.set(18,22);
  const countryside=surfaceTexture('#778063');countryside.repeat.set(15,12);
  const industrialGround=surfaceTexture('#5c5a54','concrete');industrialGround.repeat.set(12,12);
  const abandonedGround=surfaceTexture('#484b49');abandonedGround.repeat.set(13,13);
  const roadMat=new THREE.MeshStandardMaterial({map:asphalt,roughness:.94,metalness:.01});
  const sideMat=new THREE.MeshStandardMaterial({map:pavement,roughness:.9});
  const grassMat=new THREE.MeshStandardMaterial({map:grass,roughness:1});
  this.suburbGrass=grassMat;
  groundPlane(scene,0,0,1100,1100,grassMat,-.035);
  // The outer districts get distinct ground treatment before their roads and
  // buildings are placed, so the larger map reads as several connected regions.
  groundPlane(scene,-280,85,205,300,new THREE.MeshStandardMaterial({map:forest,roughness:1}),-.018);
  groundPlane(scene,0,310,340,190,new THREE.MeshStandardMaterial({map:countryside,roughness:1}),-.017);
  groundPlane(scene,280,155,205,230,new THREE.MeshStandardMaterial({map:industrialGround,roughness:.96}),-.016);
  groundPlane(scene,260,-310,220,210,new THREE.MeshStandardMaterial({map:abandonedGround,roughness:.98}),-.015);
  // Utility roadway geometry is not used for humans, cars, buildings or trees.
  this.majorRoads=[-350,-280,-210,-140,-70,0,70,140,210,280,350];
  for(const pos of [-70,0,70]){
   groundPlane(scene,pos,0,15,1100,roadMat,.016);
   groundPlane(scene,0,pos,1100,15,roadMat,.018);
  }
  this.residentialRoads=[-98,-28,28,98];this.sidewalkMaterial=sideMat;
  // Connected two-lane local streets bring the houses within walking distance
  // of a road and tie the outer blocks into the main avenues.
  for(const pos of this.residentialRoads){
   groundPlane(scene,pos,0,6.5,285,roadMat,.017);
   groundPlane(scene,0,pos,285,6.5,roadMat,.019);
   for(const side of [-1,1]){
    groundPlane(scene,pos+side*4.2,0,1.8,285,sideMat,.005);
    groundPlane(scene,0,pos+side*4.2,285,1.8,sideMat,.005);
   }
  }
  this.outerRoads=[-350,-280,-210,-140,140,210,280,350];
  for(const pos of this.outerRoads){
   groundPlane(scene,pos,0,11,1100,roadMat,.017);
   groundPlane(scene,0,pos,1100,11,roadMat,.019);
   for(const side of [-1,1]){
    groundPlane(scene,pos+side*6.7,0,1.8,1100,sideMat,.006);
    groundPlane(scene,0,pos+side*6.7,1100,1.8,sideMat,.006);
   }
  }
  // Residential blocks are planted lots with continuous sidewalks at the street
  // edge. Full-block concrete pads read as empty plazas and detach the houses.
  for(const x of [-105,-35,35,105])for(const z of [-105,-35,35,105]){
   groundPlane(scene,x,z,52,52,grassMat,-.025);
   groundPlane(scene,x,z-24.35,52,3.3,sideMat,.004);
   groundPlane(scene,x,z+24.35,52,3.3,sideMat,.004);
   groundPlane(scene,x-24.35,z,3.3,52,sideMat,.004);
   groundPlane(scene,x+24.35,z,3.3,52,sideMat,.004);
  }
  const yellow=new THREE.MeshStandardMaterial({color:0xc8ae6e,roughness:.84}),white=new THREE.MeshStandardMaterial({color:0xd8d8ce,roughness:.9});
  const stripeV=new THREE.PlaneGeometry(.12,5.3),stripeH=new THREE.PlaneGeometry(5.3,.12);
  // Road center lines and crosswalks use flat textured utility geometry, not placeholder buildings.
  for(let coord of [-70,0,70])for(let k=-410;k<410;k+=10){
   if([-70,0,70].some(p=>Math.abs(k-p)<9))continue;
   const v=new THREE.Mesh(stripeV,yellow);v.rotation.x=-Math.PI/2;v.position.set(coord,.031,k);scene.add(v);
   const h=new THREE.Mesh(stripeH,yellow);h.rotation.x=-Math.PI/2;h.position.set(k,.031,coord);scene.add(h);
  }
  const whiteGeom=new THREE.PlaneGeometry(1.25,3);
  for(const x of [-70,0,70])for(const z of [-70,0,70])for(const offset of [-12,12])for(let k=-4;k<=4;k++){
    const a=new THREE.Mesh(whiteGeom,white);a.rotation.x=-Math.PI/2;a.position.set(x+k*1.85,.039,z+offset);scene.add(a);
    const b=new THREE.Mesh(whiteGeom,white);b.rotation.x=-Math.PI/2;b.rotation.z=Math.PI/2;b.position.set(x+offset,.039,z+k*1.85);scene.add(b);
  }
  // Dash markings on outer district arterials are instanced so the expanded
  // road grid adds only two draw calls, not hundreds of individual meshes.
  const dashGeo=new THREE.PlaneGeometry(.14,4.2),dashMat=new THREE.MeshBasicMaterial({color:0xc8ae6e});
  for(const axis of ['x','z']){const coords=this.outerRoads,steps=Array.from({length:57},(_,i)=>-392+i*14),count=coords.length*steps.length,mesh=new THREE.InstancedMesh(dashGeo,dashMat,count),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,axis==='x'?Math.PI/2:0,0)),scale=new THREE.Vector3(1,1,1);let index=0;for(const road of coords)for(const step of steps){matrix.compose(axis==='x'?new THREE.Vector3(step,.032,road):new THREE.Vector3(road,.032,step),rotation,scale);mesh.setMatrixAt(index++,matrix)}mesh.instanceMatrix.needsUpdate=true;mesh.name=`outer-road-dashes-${axis}`;scene.add(mesh)}
  this.roadMaterial=roadMat;this.buildArchitecture();this.buildVillageDistrict(grassMat,roadMat,sideMat);this.buildTrees();this.buildStreetFurniture();this.buildMovableProps();this.buildPeople();this.buildVehicles();this.buildHotspots();this.buildSafehouse();this.buildMonsters();
 }
 addAsset(name,x,z,options={}){
   const obj=this.bank.instance(name,{width:options.width,height:options.height});if(!obj)return null;
   obj.root.position.set(x,options.y??-.02,z);obj.root.rotation.y=options.yaw||0;
   this.scene.add(obj.root);return obj;
 }
 configurePhysics(RAPIER){this.vehiclePhysics=new VehiclePhysics(RAPIER,this);return this.vehiclePhysics}
 measureHouseEntrance(building){
  if(building.kind!=='house')return;
  building.model.root.updateMatrixWorld(true);let door=null;building.model.content.traverse(o=>{if(!door&&o.isMesh&&o.name.startsWith('House_door_'))door=o});if(!door)return;
  const bounds=new THREE.Box3().setFromObject(door),center=bounds.getCenter(new THREE.Vector3()),outward=new THREE.Vector3(-1,0,0).transformDirection(door.matrixWorld).normalize(),outside=center.clone().addScaledVector(outward,1.85);
  building.entrance={doorX:center.x,doorZ:center.z,x:outside.x,z:outside.z,normalX:outward.x,normalZ:outward.z,halfWidth:Math.max(.55,bounds.getSize(new THREE.Vector3()).x*.5),facingYaw:Math.atan2(-outward.x,outward.z)};
 }
 buildArchitecture(){
  // Reuse the actual downloaded neighborhood house and city-building set.
  const plots=[];for(const x of [-112,-84,-42,42,84,112])for(const z of [-112,-84,-42,42,84,112])plots.push([x,z]);
  // Extend the four outer neighborhood corners with another reused house each.
  // These lots sit outside the existing 112 m ring and keep clear of avenues.
  plots.push([-126,-126],[-126,126],[126,-126],[126,126]);
  plots.forEach(([x,z],i)=>{
   // Use individual building assets with measured footprints; the bundled village
   // and city-set scenes span kilometers in source units and are not single houses.
   const nearCore=Math.abs(x)===42&&Math.abs(z)===42;if(nearCore)return;
   const outerCorner=Math.abs(x)===126&&Math.abs(z)===126;
   const name=outerCorner?'house':i%3===0?'house':i%3===1?'shop':'apartment';
   const size=name==='house'?15:name==='shop'?14:16;
   const road=this.nearestStreet(x,z),yaw=road.axis==='x'?(road.sign>0?Math.PI/2:-Math.PI/2):(road.sign>0?0:Math.PI);
   const model=this.addAsset(name,x,z,{width:size,yaw});
   if(model){const building={x,z,r:name==='house'?7.5:name==='shop'?7:8,kind:name,model};this.measureHouseEntrance(building);this.buildings.push(building)}
  });
  this.suburbanBlocks=[];
  const addSuburb=(name,centersX,centersZ)=>{let index=0;for(const cx of centersX)for(const cz of centersZ){this.suburbanBlocks.push({name,x:cx,z:cz});groundPlane(this.scene,cx,cz,52,52,this.suburbGrass,-.024);for(const offset of [-25.5,25.5]){groundPlane(this.scene,cx+offset,cz,1.7,52,this.sidewalkMaterial,.006);groundPlane(this.scene,cx,cz+offset,52,1.7,this.sidewalkMaterial,.006)}let lotIndex=0;for(const dx of [-15,15])for(const dz of [-15,15]){const x=cx+dx,z=cz+dz,road=this.nearestStreet(x,z),yaw=road.axis==='x'?(road.sign>0?Math.PI/2:-Math.PI/2):(road.sign>0?0:Math.PI),model=this.addAsset('house',x,z,{width:15,yaw});if(model){const building={x,z,r:7.5,kind:'house',model,district:name,blockIndex:index,lotIndex};this.measureHouseEntrance(building);this.buildings.push(building)}lotIndex++}index++}};
  addSuburb('North Suburbs',[-105,-35,35,105,175],[175,245]);
  addSuburb('South Suburbs',[-105,-35,35,105,175],[-175,-245]);
  addSuburb('East Neighborhood',[175,245],[-105,-35,35,105]);
  // A denser east-side borough bridges the old town and the expanded village route.
  addSuburb('East Borough',[390],[65,125,185,245]);
  // One imported multi-building skyline set fills a downtown block; it stays one instance.
  const downtown=this.addAsset('downtown',35,35,{width:46,yaw:0});if(downtown)this.buildings.push({x:35,z:35,r:22,kind:'downtown',model:downtown});
  const wreck=this.addAsset('abandoned',94,0,{width:30,yaw:Math.PI/2});if(wreck)this.buildings.push({x:94,z:0,r:14,kind:'abandoned',model:wreck});
  const industrial=this.addAsset('downtown',280,155,{width:58,yaw:Math.PI/2});if(industrial)this.buildings.push({x:280,z:155,r:28,kind:'downtown',model:industrial});
  const abandonedQuarter=this.addAsset('abandoned',260,-310,{width:44,yaw:Math.PI/2});if(abandonedQuarter)this.buildings.push({x:260,z:-310,r:21,kind:'abandoned',model:abandonedQuarter});
  this.buildDriveways();this.instanceRepeatedBuildings();
 }
 buildVillageDistrict(grass,road,sidewalk){
  const x=460,z=450,model=this.addAsset('village',x,z,{width:70});if(!model)return;
  model.root.name='village-personal-assets-integrated';
  // The source contains a complete compact village on its landscaped plinth.
  // Place it as a discrete settlement and preserve its authored relative layout.
  groundPlane(this.scene,460,450,190,190,grass,-.026);
  groundPlane(this.scene,387.5,350,75,8,road,.02); // joins the existing z=350 arterial
  groundPlane(this.scene,425,400,8,100,road,.02);
  groundPlane(this.scene,414.5,450,21,8,road,.021); // joins the perimeter road at the village's west edge
  for(const side of [-1,1]){
   groundPlane(this.scene,387.5,350+side*5.1,75,1.4,sidewalk,.007);
   groundPlane(this.scene,425+side*5.1,400,1.4,100,sidewalk,.007);
   groundPlane(this.scene,414.5,450+side*5.1,21,1.4,sidewalk,.008);
  }
  // Blend the source's raised circular landscape base into the county ground.
  // The level ring road and sidewalk form a connected village access loop.
  const berm=new THREE.Mesh(new THREE.CylinderGeometry(35.5,47,3.4,96,1,false),grass);berm.position.set(460,1.68,450);berm.castShadow=true;berm.receiveShadow=true;berm.name='old-mill-village-grass-berm';this.scene.add(berm);
  ringPlane(this.scene,460,450,48,56,road,.025);ringPlane(this.scene,460,450,56.5,59,sidewalk,.009);
  this.villages.push({name:'Old Mill Village',x,z,width:model.dimensions.x*model.scale,depth:model.dimensions.z*model.scale,root:model.root,source:'House/village_personal_assets.glb'});
  model.root.updateMatrixWorld(true);
  model.root.traverse(mesh=>{
   if(!mesh.isMesh||!mesh.geometry?.attributes?.position)return;
   const box=new THREE.Box3().setFromObject(mesh),size=box.getSize(new THREE.Vector3());
   // Skip the 69 m circular display/landscape base and tiny decorative pieces.
   // Building and tower meshes get light axis-aligned character/car colliders.
   if(size.y<4||Math.max(size.x,size.z)>55||Math.min(size.x,size.z)<1.1)return;
   const hx=size.x*.48,hz=size.z*.48,h=Math.max(2,size.y*.5),center=box.getCenter(new THREE.Vector3());
   if(center.y+h<.45)return;
   this.villageColliders.push({x:center.x,z:center.z,hx,hz,h,centerY:center.y,r:Math.max(hx,hz),kind:'village-structure',meshName:mesh.name});
  });
 }
 nearestStreet(x,z){const roads=[-70,0,70,...this.residentialRoads,...this.outerRoads],rx=roads.reduce((best,v)=>Math.abs(v-x)<Math.abs(best-x)?v:best,roads[0]),rz=roads.reduce((best,v)=>Math.abs(v-z)<Math.abs(best-z)?v:best,roads[0]);return Math.abs(rx-x)<=Math.abs(rz-z)?{axis:'x',coord:rx,sign:Math.sign(rx-x)||1,distance:Math.abs(rx-x)}:{axis:'z',coord:rz,sign:Math.sign(rz-z)||1,distance:Math.abs(rz-z)}}
 buildDriveways(){const lots=this.buildings.filter(b=>['house','shop','apartment'].includes(b.kind));if(!lots.length)return;const geo=new THREE.PlaneGeometry(1,1),batch=new THREE.InstancedMesh(geo,this.sidewalkMaterial,lots.length),matrix=new THREE.Matrix4(),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));let count=0;for(const b of lots){const road=this.nearestStreet(b.x,b.z),drive=Math.max(2,road.distance-4.2-b.r),mid=(b.r+road.distance-4.2)*.5,x=road.axis==='x'?b.x+road.sign*mid:b.x,z=road.axis==='z'?b.z+road.sign*mid:b.z,sx=road.axis==='x'?drive:3.2,sz=road.axis==='z'?drive:3.2;matrix.compose(new THREE.Vector3(x,.009,z),q,new THREE.Vector3(sx,sz,1));batch.setMatrixAt(count++,matrix)}batch.count=count;batch.instanceMatrix.needsUpdate=true;batch.name='instanced-residential-driveways';this.scene.add(batch)}
 instanceRepeatedBuildings(){
  const sets=this.buildings.filter(b=>['house','shop','apartment'].includes(b.kind));
  // The supplied autumn house is made from 276 separate mesh pieces, many of
  // them tiny glass panes. Merge each asset's pieces by material once, then
  // instance those compact building meshes per district sector. This cuts the
  // repeated-house batches from thousands to a few dozen while keeping the
  // authored textures and materials intact.
  const prototypes=new Map();
  for(const building of sets){
   if(prototypes.has(building.kind))continue;
   const root=building.model.root;root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),parts=new Map(),remove=[];
   root.traverse(mesh=>{if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.morphTargetInfluences)return;remove.push(mesh);const relative=mesh.matrixWorld.clone().premultiply(inverse),materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(let materialIndex=0;materialIndex<materials.length;materialIndex++){
     const material=materials[materialIndex],source=mesh.geometry.clone();source.applyMatrix4(relative);
     let geometry=source.index?source.toNonIndexed():source;
     const signature=Object.keys(geometry.attributes).sort().map(k=>`${k}:${geometry.attributes[k].itemSize}`).join('|'),key=`${material.uuid}:${signature}`;
     if(!parts.has(key))parts.set(key,{material,geometries:[]});parts.get(key).geometries.push(geometry);
    }
   });
   const merged=[];for(const part of parts.values()){const geometry=mergeGeometries(part.geometries,false);if(geometry){geometry.computeBoundingSphere();merged.push({geometry,material:part.material})}for(const source of part.geometries)source.dispose()}
   for(const mesh of remove)mesh.parent?.remove(mesh);
   prototypes.set(building.kind,merged);
  }
  const sectors=new Map();
  for(const building of sets){const sectorX=Math.floor((building.x+this.worldHalfExtent)/500),sectorZ=Math.floor((building.z+this.worldHalfExtent)/500),key=`${building.kind}:${sectorX}:${sectorZ}`;if(!sectors.has(key))sectors.set(key,{kind:building.kind,buildings:[]});sectors.get(key).buildings.push(building)}
  for(const sector of sectors.values())for(const part of prototypes.get(sector.kind)){
   const batch=new THREE.InstancedMesh(part.geometry,part.material,sector.buildings.length);batch.name=`${sector.kind}-merged-sector-instances`;batch.castShadow=true;batch.receiveShadow=true;
   sector.buildings.forEach((building,i)=>{building.model.root.updateMatrixWorld(true);batch.setMatrixAt(i,building.model.root.matrixWorld)});
   batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();this.scene.add(batch);
  }
  for(const building of sets){const remove=[];building.model.root.traverse(mesh=>{if(mesh.isMesh)remove.push(mesh)});for(const mesh of remove)mesh.parent?.remove(mesh)}
 }
 buildTrees(){
  // District-sized instance batches keep forest and orchard geometry off-screen
  // when the player is in another part of the expanded map.
  const trunkGeo=new THREE.CylinderGeometry(.16,.23,2.3,7),crownGeo=new THREE.ConeGeometry(1.45,3.6,8);
  const trunkMat=new THREE.MeshStandardMaterial({color:0x554638,roughness:1}),crownMats=[0x334a39,0x3d5942,0x4c6044].map(color=>new THREE.MeshStandardMaterial({color,roughness:1})),groups=new Map();
  for(let x=-378;x<=378;x+=12)for(let z=-378;z<=378;z+=12){
   const forest=x<=-185&&x>=-378&&z>=-82&&z<=298,country=x>=185&&z>=190&&z<=378,local=Math.abs(x)<=132&&Math.abs(z)<=132;if(!forest&&!country&&!local)continue;
   const hash=(Math.abs(Math.imul(x+401,73856093)^Math.imul(z+407,19349663))%1000)/1000,density=forest?.66:country?.34:.18;if(hash>density)continue;
   const majorRoad=this.majorRoads.some(v=>Math.abs(x-v)<10||Math.abs(z-v)<10),localRoad=this.residentialRoads.some(v=>(Math.abs(x-v)<8&&Math.abs(z)<145)||(Math.abs(z-v)<8&&Math.abs(x)<145));
   if(majorRoad||localRoad||this.buildings.some(b=>Math.abs(x-b.x)<b.r+5&&Math.abs(z-b.z)<b.r+5))continue;
   const key=`${Math.floor((x+this.worldHalfExtent)/280)}:${Math.floor((z+this.worldHalfExtent)/280)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({x,z,hash});
  }
  this.trees=[];this.treeCount=0;
  for(const [sector,items] of groups){const trunks=new THREE.InstancedMesh(trunkGeo,trunkMat,items.length),crowns=crownMats.map(mat=>new THREE.InstancedMesh(crownGeo,mat,items.length)),matrix=new THREE.Matrix4();
   items.forEach(({x,z,hash},i)=>{const scale=.76+hash*.72;matrix.compose(new THREE.Vector3(x,1.15*scale,z),new THREE.Quaternion(),new THREE.Vector3(scale,scale,scale));trunks.setMatrixAt(i,matrix);for(let k=0;k<crowns.length;k++){matrix.compose(new THREE.Vector3(x,3.15*scale,z),new THREE.Quaternion(),new THREE.Vector3(scale*(.9+k*.08),scale,scale*(.9+k*.08)));crowns[k].setMatrixAt(i,matrix)}});
   trunks.name=`forest-trunks-sector-${sector}`;trunks.count=items.length;trunks.instanceMatrix.needsUpdate=true;trunks.castShadow=true;trunks.receiveShadow=true;this.scene.add(trunks);this.trees.push(trunks);
   crowns.forEach(c=>{c.name=`forest-canopy-sector-${sector}`;c.count=items.length;c.instanceMatrix.needsUpdate=true;c.castShadow=true;this.scene.add(c);this.trees.push(c)});this.treeCount+=items.length;
  }
 }
 buildStreetFurniture(){
  const steel=new THREE.MeshStandardMaterial({color:0x51595c,roughness:.42,metalness:.72});
  const glass=new THREE.MeshPhysicalMaterial({color:0xe2e0c6,roughness:.28,metalness:.04,emissive:0xffdfa4,emissiveIntensity:.45});
  const poleGeo=new THREE.CylinderGeometry(.07,.11,6,9),lampGeo=new THREE.BoxGeometry(1.0,.22,.48),barGeo=new THREE.BoxGeometry(1.1,.09,.09);
  for(let x of [-102,-32,32,102])for(let z of [-126,-84,-16,16,84,126]){
   const pole=new THREE.Mesh(poleGeo,steel);pole.position.set(x,3,z);pole.castShadow=true;this.scene.add(pole);
   const bar=new THREE.Mesh(barGeo,steel);bar.position.set(x+.46,5.8,z);this.scene.add(bar);
   const bulb=new THREE.Mesh(lampGeo,glass);bulb.position.set(x+1,5.75,z);this.scene.add(bulb);
  }
  const outerLampPoints=[];for(const x of [-350,-210,210,350])for(let z=-350;z<=350;z+=70)outerLampPoints.push([x+8.5,z]);for(const z of [-350,-210,210,350])for(let x=-350;x<=350;x+=70)outerLampPoints.push([x,z+8.5]);
  const poleBatch=new THREE.InstancedMesh(poleGeo,steel,outerLampPoints.length),barBatch=new THREE.InstancedMesh(barGeo,steel,outerLampPoints.length),bulbBatch=new THREE.InstancedMesh(lampGeo,glass,outerLampPoints.length),matrix=new THREE.Matrix4();outerLampPoints.forEach(([x,z],i)=>{matrix.makeTranslation(x,3,z);poleBatch.setMatrixAt(i,matrix);matrix.makeTranslation(x+.46,5.8,z);barBatch.setMatrixAt(i,matrix);matrix.makeTranslation(x+1,5.75,z);bulbBatch.setMatrixAt(i,matrix)});for(const batch of[poleBatch,barBatch,bulbBatch]){batch.castShadow=true;batch.receiveShadow=true;this.scene.add(batch)}
  // Traffic light housings indicate an actual changing traffic state.
  this.trafficBulbs=[];
  for(let x of [-70,0,70])for(let z of [-70,0,70]){
   const material=new THREE.MeshStandardMaterial({color:0x202727,roughness:.7,metalness:.45});
   const pole=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,4.7,8),steel);pole.position.set(x+9,2.35,z+9);this.scene.add(pole);
   const housing=new THREE.Mesh(new THREE.BoxGeometry(.55,1.4,.35),material);housing.position.set(x+9,4.7,z+9);this.scene.add(housing);
   const red=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),new THREE.MeshStandardMaterial({color:0x351414,emissive:0xff311e,emissiveIntensity:.1}));
   const green=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),new THREE.MeshStandardMaterial({color:0x0b2c14,emissive:0x3df45d,emissiveIntensity:1.2}));
   red.position.set(x+9,5.05,z+9.21);green.position.set(x+9,4.49,z+9.21);this.scene.add(red,green);this.trafficBulbs.push([red,green]);
  }
  for(const x of [-210,210])for(const z of [-210,210]){const material=new THREE.MeshStandardMaterial({color:0x202727,roughness:.7,metalness:.45}),pole=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,4.7,8),steel),housing=new THREE.Mesh(new THREE.BoxGeometry(.55,1.4,.35),material),red=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),new THREE.MeshStandardMaterial({color:0x351414,emissive:0xff311e,emissiveIntensity:.1})),green=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),new THREE.MeshStandardMaterial({color:0x0b2c14,emissive:0x3df45d,emissiveIntensity:1.2}));pole.position.set(x+9,2.35,z+9);housing.position.set(x+9,4.7,z+9);red.position.set(x+9,5.05,z+9.21);green.position.set(x+9,4.49,z+9.21);this.scene.add(pole,housing,red,green);this.trafficBulbs.push([red,green])}
 }
 buildMovableProps(){
  const shell=new THREE.MeshStandardMaterial({color:0x345e64,roughness:.82,metalness:.2}),lidMat=new THREE.MeshStandardMaterial({color:0x263f43,roughness:.72,metalness:.26}),label=new THREE.MeshStandardMaterial({color:0x8dba9d,roughness:.76});
  const positions=[[146,0],[0,146],[-146,0],[0,-146]];
  for(const [i,[x,z]] of positions.entries()){
   const root=new THREE.Group(),body=new THREE.Mesh(new THREE.CylinderGeometry(.34,.42,1.08,12),shell),lid=new THREE.Mesh(new THREE.CylinderGeometry(.43,.39,.1,12),lidMat),handle=new THREE.Mesh(new THREE.BoxGeometry(.24,.08,.08),label);
   body.position.y=0;lid.position.y=.57;handle.position.set(0,.42,.405);root.add(body,lid,handle);root.position.set(x,.56,z);root.rotation.y=i*Math.PI/2;root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});root.name=`movable-street-bin-${i}`;this.scene.add(root);this.movableProps.push({x,z,startX:x,startZ:z,root,kind:'street-bin',mass:34,durability:100,maxDurability:100,lastImpactAt:-10});
  }
  const wood=new THREE.MeshStandardMaterial({color:0x72573b,roughness:.95}),fenceRoot=new THREE.Group(),postGeo=new THREE.BoxGeometry(.18,1.25,.18),railGeo=new THREE.BoxGeometry(6,.16,.16);
  for(const x of [-2.85,0,2.85]){const post=new THREE.Mesh(postGeo,wood);post.position.set(x,.64,0);post.castShadow=true;fenceRoot.add(post)}
  for(const y of [.42,1.02]){const rail=new THREE.Mesh(railGeo,wood);rail.position.set(0,y,0);rail.castShadow=true;fenceRoot.add(rail)}
  fenceRoot.position.set(151,0,12);fenceRoot.name='breakable-wood-garden-fence';this.scene.add(fenceRoot);this.destructibleProps.push({x:151,z:12,root:fenceRoot,kind:'fence',halfX:3,halfY:.68,halfZ:.13,health:35,maxHealth:35,lastImpactAt:-10,destroyed:false});
 }
 buildPeople(){
  const variants=['remy'].filter(name=>this.bank.get(name));
  const pts=[[-22,17],[-12,-18],[13,25],[12,-24],[-82,18],[82,-16],[54,10],[-54,-10],[-11,72],[11,-74],[82,76],[-82,-76],[12,100],[-12,-111],[104,-11],[-104,11],[175,175],[105,245],[-35,175],[35,-245],[105,-175],[245,-35],[245,35],[245,105]];
  pts.forEach(([x,z],i)=>{
   const name=variants[i%variants.length]||'remy';const actor=createAnimator(this.bank,name,1.72+((i*5)%4)*.05);if(!actor)return;
   actor.root.position.set(x,0,z);this.scene.add(actor.root);
   this.people.push({x,z,startX:x,startZ:z,axis:i%2?'z':'x',dir:i%3===0?-1:1,pace:rand(.6,1.05),actor,index:i,rest:0,health:100,alive:true,respawn:0,hitCooldown:0,knockX:0,knockZ:0});
  });
 }
 buildVehicles(){
  const trafficLanes=[-213,-207,-73,-67,-3.3,3.3,67,73,207,213];
  for(let i=0;i<22;i++){
   const type=i===12?'bus':i%5===0&&this.bank.get('supercar')?'supercar':'sedan';
   const parked=i<3;const lane=i===2?-5.7:parked?[-73,-67][i]:trafficLanes[(i-3+trafficLanes.length)%trafficLanes.length];
   let z=parked?(i===2?12:22+i*11):-365+(((i-3)*83)%730);
   if(!parked)for(let attempt=0;attempt<18&&this.cars.some(c=>Math.abs(c.x-lane)<5&&Math.abs(c.z-z)<11);attempt++){z+=17;if(z>120)z-=240}
   let obj=this.bank.instance(type,{length:type==='bus'?8.6:4.9});
   if(!obj)continue;
   // Normalize the model's long axis and face its nose along the game's -Z driving direction.
   const glbSize=obj.dimensions;
   obj.content.rotation.y=(glbSize.x>glbSize.z*1.25?Math.PI/2:0)+Math.PI;
   obj.root.position.set(lane,0,z);obj.root.rotation.y=i%2?Math.PI:0;this.scene.add(obj.root);
   const car={x:lane,z,yaw:obj.root.rotation.y,velocity:0,driven:false,parked,trafficSpeed:parked?0:rand(7,12),carModel:obj,kind:type,id:i};
   this.cars.push(car);
  }
 }
 buildMonsters(){
  const makeZone=(name,x,z,r,color)=>{const ring=new THREE.Mesh(new THREE.RingGeometry(r-.65,r,56),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(x,.055,z);this.scene.add(ring);const zone={name,x,z,r,ring};this.dangerZones.push(zone);return zone};
  const specs=[
   ['Downtown Outbreak',9,-19,26,0xe3574d,[[4,-18,'zombie'],[15,-15,'pennywise'],[16,-25,'zombie']]],
   ['Abandoned Quarter',205,-220,45,0xd66b4e,[[185,-215,'zombie'],[214,-205,'wyrm'],[218,-232,'spider'],[193,-190,'pennywise']]],
   ['Dark Forest',-280,80,48,0x78985e,[[-292,62,'zombie'],[-258,93,'spider'],[-306,100,'ghostRider']]],
   ['Countryside',18,280,42,0x9db957,[[2,266,'dragon'],[31,294,'ultron']]],
   ['Industrial District',280,155,48,0xef9e45,[[272,151,'boss'],[251,173,'zombie'],[302,176,'ultron']]],
   ['Boss Territory',342,-342,55,0xef9e45,[[326,-332,'godzilla'],[360,-350,'galactus']]],
  ];
  for(const [name,x,z,r,color,actors] of specs){const zone=makeZone(name,x,z,r,color);for(const [mx,mz,type] of actors)this.addMonster(mx,mz,type,zone,false)}
  const reserve=[['spider',224,-174,'Abandoned Quarter'],['zombie',-252,119,'Dark Forest']];for(const [type,x,z,zoneName] of reserve)this.addMonster(x,z,type,this.dangerZones.find(q=>q.name===zoneName),true);
 }
 addMonster(x,z,type,zone,nightOnly){const defs={
  zombie:{key:'zombie',label:'Infected',height:2.05,health:100,patrol:0.82,chase:2,damage:8,interval:1.3},
  spider:{key:'monsterSpider',label:'Spider',height:1.32,health:115,patrol:1.2,chase:3.05,damage:12,interval:.95},
  boss:{key:'monsterBoss',label:'Surtur',height:3.8,health:360,patrol:.85,chase:2.25,damage:18,interval:1.7,boss:true},
  wyrm:{key:'monsterWyrm',label:'Dragon Nemesis',height:2.7,health:170,patrol:.9,chase:2.15,damage:15,interval:1.4},
  godzilla:{key:'monsterGodzilla',label:'Evolved Godzilla',height:4,health:460,patrol:.75,chase:1.65,damage:21,interval:1.8,boss:true},
  galactus:{key:'monsterGalactus',label:'Galactus',height:5.2,health:600,patrol:.65,chase:1.35,damage:25,interval:2,boss:true},
  ghostRider:{key:'monsterGhostRider',label:'Ghost Rider',height:1.95,health:150,patrol:.95,chase:2.35,damage:14,interval:1.25},
  pennywise:{key:'monsterPennywise',label:'Pennywise',height:1.82,health:125,patrol:.85,chase:2.1,damage:12,interval:1.2},
  dragon:{key:'monsterDragon',label:'Dragon',height:3.6,health:300,patrol:.8,chase:2.2,damage:19,interval:1.65,boss:true},
  ultron:{key:'monsterUltron',label:'Ultron',height:2.15,health:190,patrol:.9,chase:2,damage:15,interval:1.35}
 }[type];if(!defs)return null;const {key,height}=defs,actor=createAnimator(this.bank,key,height);if(!actor)return null;
  // Sample an authored walk pose before measuring; some GLBs have stale bounds
  // and animated scale tracks can overwrite adjustments made to their children.
  actor.root.position.set(x,0,z);actor.step(.12,'walk');actor.root.updateMatrixWorld(true);
  const sourceBounds=measuredActorBounds(actor.root),sourceSize=sourceBounds.getSize(new THREE.Vector3());
  if(sourceSize.y>.01){const heightScale=height/sourceSize.y,span=Math.max(sourceSize.x,sourceSize.z)*heightScale,horizontalScale=Math.min(1,height*3/Math.max(.01,span));
   actor.root.scale.multiplyScalar(heightScale);actor.root.scale.x*=horizontalScale;actor.root.scale.z*=horizontalScale;actor.root.position.y=-sourceBounds.min.y*heightScale;actor.scale*=heightScale;actor.visualScale=actor.scale*horizontalScale;
   actor.root.updateMatrixWorld(true)
  }
  const normalizedSize=measuredActorBounds(actor.root).getSize(new THREE.Vector3()),measuredDimensions={x:normalizedSize.x,y:normalizedSize.y,z:normalizedSize.z};
  actor.measuredDimensions=measuredDimensions;actor.visualHeight=height;this.scene.add(actor.root);const maxHealth=defs.health;const m={x,z,homeX:x,homeZ:z,type,label:defs.label,boss:!!defs.boss,zone,nightOnly,health:maxHealth,maxHealth,actor,visualHeight:height,measuredDimensions,alive:true,attack:rand(.4,1.2),attackDamage:defs.damage,attackInterval:defs.interval,patrolSpeed:defs.patrol,chaseSpeed:defs.chase,state:'patrol',targetX:x,targetZ:z,patrolTime:0,respawn:0,knockX:0,knockZ:0};this.monsters.push(m);return m}
 buildHotspots(){
  this.hotspots=[
   {type:'guide',x:-22,z:17,label:'Talk to Sam · start your adventure'},
   {type:'coffee',x:-20,z:-20,label:'Buy coffee · $12'},
   {type:'garage',x:19,z:23,label:'Repair vehicle · $50'},
   {type:'finish',x:71,z:24,label:'Meet the city contact'},
  ];
  const houses=this.buildings.filter(b=>b.kind==='house'&&b.entrance),selected=new Set();
  const closest=houses.slice().sort((a,b)=>Math.hypot(a.x+11,a.z-10)-Math.hypot(b.x+11,b.z-10))[0];if(closest)selected.add(closest);
  const blocks=new Map();for(const house of houses){if(!house.district)continue;const key=`${house.district}:${house.blockIndex}`;if(!blocks.has(key))blocks.set(key,[]);blocks.get(key).push(house)}
  for(const group of blocks.values()){group.sort((a,b)=>a.lotIndex-b.lotIndex);if(group[0])selected.add(group[0])}
  this.enterableHouses=[...selected];
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d');c.fillStyle='#0d241bdd';c.beginPath();c.arc(32,32,29,0,Math.PI*2);c.fill();c.strokeStyle='#c4e9bd';c.lineWidth=3;c.beginPath();c.moveTo(14,30);c.lineTo(32,14);c.lineTo(50,30);c.moveTo(19,28);c.lineTo(19,49);c.lineTo(45,49);c.lineTo(45,28);c.moveTo(28,49);c.lineTo(28,37);c.lineTo(36,37);c.lineTo(36,49);c.stroke();
  const iconTexture=new THREE.CanvasTexture(canvas);iconTexture.colorSpace=THREE.SRGBColorSpace;
  const iconMaterial=new THREE.SpriteMaterial({map:iconTexture,transparent:true,depthWrite:false});
  for(const [i,house] of this.enterableHouses.entries()){
   const e=house.entrance;house.enterable=true;
   const marker=new THREE.Group();marker.name=`house-entry-marker-${i}`;marker.position.set(e.x,0,e.z);
   const ring=new THREE.Mesh(new THREE.RingGeometry(.48,.62,28),new THREE.MeshBasicMaterial({color:0xaee394,transparent:true,opacity:.88,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.025;marker.add(ring);
   const icon=new THREE.Sprite(iconMaterial);icon.position.y=2.0;icon.scale.set(.9,.9,1);marker.add(icon);this.scene.add(marker);e.marker=marker;this.doorMarkers.push(marker);
   this.hotspots.push({type:'house',x:e.x,z:e.z,radius:2.8,label:'Press E to Enter House',house,entrance:e});
  }
 }
 buildSafehouse(){
  // The supplied exterior house has no room meshes, so this reusable furnished
  // interior stands in a safe off-map pocket and is linked from real doorways.
  this.safehouse={x:395,z:395,halfX:7,halfZ:6,spawnX:394.3,spawnZ:395.4,exitX:395,exitZ:400.12,obstacles:[],cameraWalls:[]};
  const root=new THREE.Group();root.name='safehouse-interior';this.safehouse.root=root;
  const wall=new THREE.MeshStandardMaterial({color:0xb8a58b,roughness:.92}),floor=new THREE.MeshStandardMaterial({color:0x55483b,roughness:.94}),trim=new THREE.MeshStandardMaterial({color:0x4b3022,roughness:.8}),fabric=new THREE.MeshStandardMaterial({color:0x62726d,roughness:.98}),wood=new THREE.MeshStandardMaterial({color:0x76553a,roughness:.86}),lightWood=new THREE.MeshStandardMaterial({color:0x9a744c,roughness:.82}),glass=new THREE.MeshStandardMaterial({color:0x78a7b5,roughness:.3,metalness:.08,emissive:0x203f4c,emissiveIntensity:.24});
  const box=(name,x,y,z,sx,sy,sz,material,blocks=false)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);if(blocks)this.safehouse.obstacles.push({x,z,hx:sx*.5,hz:sz*.5});return m};
  const wallBox=(name,x,y,z,sx,sy,sz)=>{box(name,x,y,z,sx,sy,sz,wall);this.safehouse.cameraWalls.push({x,y,z,hx:sx*.5,hy:sy*.5,hz:sz*.5})};
  box('safehouse-floor',395,.06,395,14,.12,12,floor);
  wallBox('safehouse-north-wall',395,1.65,389,14,3.3,.24);wallBox('safehouse-west-wall',388,1.65,395,.24,3.3,12);wallBox('safehouse-east-wall',402,1.65,395,.24,3.3,12);
  // South wall has a clear front door. Interior partitions leave a short hall
  // and separate the living room, bedroom, and kitchen.
  wallBox('safehouse-south-left',390.9,1.65,401,5.8,3.3,.24);wallBox('safehouse-south-right',399.1,1.65,401,5.8,3.3,.24);wallBox('safehouse-door-lintel',395,3.08,401,2.4,.44,.24);
  // Keep the center hall open all the way to the south exit. The north
  // partition separates the bedroom while its gap at the south end lets the
  // player reach the bedroom and continue down the hall to leave.
  wallBox('safehouse-room-divider-north',395,1.5,391.75,.16,3,5.25);this.safehouse.obstacles.push({x:395,z:391.75,hx:.08,hz:2.625});
  wallBox('safehouse-kitchen-divider-west',396.77,1.5,396.5,3.35,3,.16);wallBox('safehouse-kitchen-divider-east',401.22,1.5,396.5,1.36,3,.16);this.safehouse.obstacles.push({x:396.77,z:396.5,hx:1.675,hz:.08},{x:401.22,z:396.5,hx:.68,hz:.08});
  // Living room seating, rug, and coffee table.
  box('safehouse-living-rug',391.5,.13,395,5.8,.025,4.6,new THREE.MeshStandardMaterial({color:0x77715b,roughness:1}));
  box('safehouse-sofa',391.2,.62,391.6,2.8,.8,1.05,fabric,true);box('safehouse-sofa-back',391.2,1.2,391.18,2.8,.38,.24,fabric,true);
  box('safehouse-coffee-table',392,.58,396.1,1.6,.12,.9,wood,true);for(const [x,z] of [[391.35,395.78],[392.65,395.78],[391.35,396.42],[392.65,396.42]])box('safehouse-coffee-table-leg',x,.31,z,.1,.52,.1,trim);
  // Bedroom and wardrobe.
  box('safehouse-bed-frame',399.25,.34,391.65,2.1,.42,3.2,wood,true);box('safehouse-mattress',399.25,.62,391.65,1.98,.22,3.0,new THREE.MeshStandardMaterial({color:0xb7b2a3,roughness:1}));box('safehouse-pillow',399.25,.78,390.45,1.1,.16,.55,new THREE.MeshStandardMaterial({color:0xe1d8c6,roughness:1}));box('safehouse-wardrobe',401.05,1.05,393.65,1.2,2.1,.72,lightWood,true);
  // Kitchen counter, cabinets, sink, stove, and a small breakfast table.
  box('safehouse-kitchen-counter',398.1,.98,398.25,3.9,.22,.72,lightWood,true);box('safehouse-kitchen-base-cabinets',398.1,.48,398.25,3.75,.82,.65,wood,true);box('safehouse-kitchen-backsplash',398.1,1.72,398.22,3.9,1.15,.08,wall);box('safehouse-sink',397.1,1.105,398.2,.72,.05,.42,new THREE.MeshStandardMaterial({color:0x9ba6a5,metalness:.55,roughness:.3}));box('safehouse-stove',399.25,1.12,398.2,.78,.06,.58,trim);box('safehouse-fridge',401.05,1.45,396.8,.82,2.8,.78,new THREE.MeshStandardMaterial({color:0xa9b2ad,roughness:.45,metalness:.18}),true);
  box('safehouse-breakfast-table',397.65,.76,396.55,1.35,.12,.75,wood,true);box('safehouse-table-leg-a',397.1,.38,396.28,.1,.7,.1,trim);box('safehouse-table-leg-b',398.2,.38,396.28,.1,.7,.1,trim);box('safehouse-table-leg-c',397.1,.38,396.82,.1,.7,.1,trim);box('safehouse-table-leg-d',398.2,.38,396.82,.1,.7,.1,trim);
  // Framed windows give the separate interior a visible outside reference.
  for(const [x,z] of [[391,389.17],[399,389.17]]){box('safehouse-window-glass',x,2.05,z,2.1,1.2,.045,glass);box('safehouse-window-sill',x,1.42,z,2.3,.12,.14,trim);box('safehouse-window-header',x,2.68,z,2.3,.12,.14,trim);box('safehouse-window-mullion',x,2.05,z, .09,1.2,.16,trim)}
  const point=new THREE.PointLight(0xffc980,44,23,1.8);point.position.set(395,2.85,395);root.add(point);const kitchenLight=new THREE.PointLight(0xffe0b0,12,8,1.8);kitchenLight.position.set(399,2.55,398);root.add(kitchenLight);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.13,12,10),new THREE.MeshBasicMaterial({color:0xffd7a0}));lamp.position.set(395,3.05,395);root.add(lamp);
  const door=new THREE.Group();door.name='safehouse-exit-door-marker';door.position.set(this.safehouse.exitX,.045,this.safehouse.exitZ);const markerMat=new THREE.MeshBasicMaterial({color:0xa7d58a,transparent:true,opacity:.82,side:THREE.DoubleSide,depthWrite:false});const threshold=new THREE.Mesh(new THREE.RingGeometry(.62,.82,32),markerMat);threshold.rotation.x=-Math.PI/2;door.add(threshold);this.scene.add(door);this.safehouse.exitMarker=door;
  this.scene.add(root);root.visible=false;
 }
 safehouseCollision(x,z,r=.48){const h=this.safehouse;if(!h)return true;const left=h.x-h.halfX+r,right=h.x+h.halfX-r,top=h.z-h.halfZ+r,bottom=h.z+h.halfZ-r;if(x<left||x>right||z<top||z>bottom)return true;return h.obstacles.some(o=>Math.abs(x-o.x)<o.hx+r&&Math.abs(z-o.z)<o.hz+r)}
 collision(x,z,r=.55){
   if(Math.abs(x)>this.worldHalfExtent-r||Math.abs(z)>this.worldHalfExtent-r)return true;
   for(const b of this.buildings){const hx=b.hx??b.r,hz=b.hz??b.r;if(Math.abs(x-b.x)>hx+r||Math.abs(z-b.z)>hz+r)continue;if(b.entrance){const e=b.entrance,dx=x-e.doorX,dz=z-e.doorZ,along=dx*e.normalX+dz*e.normalZ,lateral=Math.abs(dx*e.normalZ-dz*e.normalX);if(along>-.65&&along<(b.r??Math.max(hx,hz))+r+1.2&&lateral<e.halfWidth+.62)continue}return true}
   for(const b of this.villageColliders){if(Math.abs(x-b.x)>b.hx+r||Math.abs(z-b.z)>b.hz+r)continue;return true}
   return false;
 }
 characterCollision(x,z,r=.5){if(this.collision(x,z,r))return true;for(const c of this.cars){const dx=(x-c.x)/(c.halfWidth||1.1),dz=(z-c.z)/(c.halfLength||2.5);if(dx*dx+dz*dz<=(1+r/1.3)**2)return true}return false}
 cameraDistance(target,direction,maxDistance,excludeCar=null){const ray=new THREE.Ray(target.clone(),direction.clone().normalize());let closest=maxDistance;for(const b of this.buildings){if(Math.abs(target.x-b.x)>closest+b.r||Math.abs(target.z-b.z)>closest+b.r)continue;const h=b.kind==='downtown'?20:b.kind==='abandoned'?5.5:b.kind==='house'?6:7;const box=new THREE.Box3(new THREE.Vector3(b.x-b.r,0,b.z-b.r),new THREE.Vector3(b.x+b.r,h,b.z+b.r)),hit=ray.intersectBox(box,new THREE.Vector3());if(hit){const d=hit.distanceTo(target);if(d>.25)closest=Math.min(closest,d-.3)}}for(const c of this.cars){if(c===excludeCar||Math.abs(target.x-c.x)>closest+(c.halfWidth||1.1)||Math.abs(target.z-c.z)>closest+(c.halfLength||2.5))continue;const box=new THREE.Box3(new THREE.Vector3(c.x-(c.halfWidth||1.1),0,c.z-(c.halfLength||2.5)),new THREE.Vector3(c.x+(c.halfWidth||1.1),2.6,c.z+(c.halfLength||2.5))),hit=ray.intersectBox(box,new THREE.Vector3());if(hit){const d=hit.distanceTo(target);if(d>.25)closest=Math.min(closest,d-.3)}}if(this.safehouse?.root.visible){for(const b of this.safehouse.cameraWalls){const box=new THREE.Box3(new THREE.Vector3(b.x-b.hx,b.y-b.hy,b.z-b.hz),new THREE.Vector3(b.x+b.hx,b.y+b.hy,b.z+b.hz)),hit=ray.intersectBox(box,new THREE.Vector3());if(hit){const d=hit.distanceTo(target);if(d>.25)closest=Math.min(closest,d-.25)}}}return Math.max(.8,closest)}
 safeExitPosition(car){const rightX=Math.cos(car.yaw),rightZ=-Math.sin(car.yaw),forwardX=-Math.sin(car.yaw),forwardZ=-Math.cos(car.yaw);for(const [side,forward] of [[-1,0],[1,0],[0,-1],[0,1]]){const x=car.x+rightX*side*3.1+forwardX*forward*3.6,z=car.z+rightZ*side*3.1+forwardZ*forward*3.6;if(!this.characterCollision(x,z,.5))return{x,z}}return null}
 nearestHotspot(x,z){let near=null,best=Infinity;for(const h of this.hotspots){const d=Math.hypot(h.x-x,h.z-z);if(d<(h.radius||3.75)&&d<best){near=h;best=d}}return near}
 nearestMonster(x,z,range=3){return this.monsters.filter(m=>m.alive&&Math.hypot(m.x-x,m.z-z)<range).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0]||null}
 nearestCar(x,z,exclude=null){let near=null,best=6.7;for(const c of this.cars){if(c===exclude)continue;const d=Math.hypot(c.x-x,c.z-z);if(d<best){near=c;best=d}}return near}
 update(dt,time,player,driving,keys={}){
  this.currentPlayer=player;this.currentDriving=driving;
  this.elapsed+=dt;
  const sunArc=Math.sin((time-6)/24*Math.PI*2),daylight=clamp((sunArc+.04)/.42,0,1);
  this.sun.intensity=2.8*daylight+.08;this.hemisphere.intensity=1.65*daylight+.55;
  this.sun.target.position.set(player.x,0,player.z);this.sun.position.set(player.x+Math.cos(time/24*Math.PI*2)*115,Math.max(12,player.y+Math.sin((time-6)/24*Math.PI*2)*128),player.z-85);
  const greenOn=Math.floor(this.elapsed/10)%2===0;
  for(const [red,green] of this.trafficBulbs){red.material.emissiveIntensity=greenOn?.09:1.25;green.material.emissiveIntensity=greenOn?1.25:.09}
  const mode=(p,i)=>{
   p.hitCooldown=Math.max(0,(p.hitCooldown||0)-dt);
   if(!p.alive){p.respawn=Math.max(0,(p.respawn||0)-dt);if(!p.respawn){p.alive=true;p.health=100;p.x=p.startX;p.z=p.startZ;p.knockX=p.knockZ=0;p.actor.root.position.set(p.x,0,p.z)}else{p.actor.root.visible=false;return}}
   if(Math.hypot(p.x-player.x,p.z-player.z)>85){p.actor.root.visible=false;return}
   p.actor.root.visible=true;
   if(p.rest>0){p.rest-=dt;p.actor.step(dt,'idle');return;}
   const flee=Math.hypot(p.x-player.x,p.z-player.z)<3&&player.attacking;
   const speed=flee?3.5:p.pace;
   const dz=p.axis==='z'?p.dir*speed*dt:0,dx=p.axis==='x'?p.dir*speed*dt:0;
   if((p.axis==='x'&&Math.abs(p.x-p.startX)>15)||(p.axis==='z'&&Math.abs(p.z-p.startZ)>18))p.dir*=-1;
   const kx=p.knockX||0,kz=p.knockZ||0;p.knockX*=Math.exp(-dt*5);p.knockZ*=Math.exp(-dt*5);
   if(!this.collision(p.x+dx+kx*dt,p.z+dz+kz*dt,.45)&&!this.nearVehicle(p.x+dx+kx*dt,p.z+dz+kz*dt,1.1)){p.x+=dx+kx*dt;p.z+=dz+kz*dt}
   p.actor.root.position.set(p.x,0,p.z);
   p.actor.root.rotation.y=(p.axis==='x'?(p.dir>0?Math.PI/2:-Math.PI/2):(p.dir>0?Math.PI:0));
   p.actor.step(dt,flee?'run':'walk');
   if(Math.random()<dt*.02)p.rest=rand(1,3);
  };
  this.people.forEach(mode);
  const night=time>=19||time<6;
  for(const m of this.monsters){if(!m.alive){if(m.respawn>0){m.respawn-=dt;if(m.respawn<=0){m.alive=true;m.health=m.maxHealth;m.x=m.homeX;m.z=m.homeZ;m.actor.root.visible=true;m.state='patrol'}}continue}
   const dx=player.x-m.x,dz=player.z-m.z,d=Math.hypot(dx,dz);m.actor.root.visible=(!m.nightOnly||night)&&d<72;if(!m.actor.root.visible)continue;
   const homeD=Math.hypot(m.homeX-player.x,m.homeZ-player.z),detect=night?45:19,leash=m.zone.r+(night?18:5),inLeash=homeD<leash;
   if(d<detect&&inLeash){m.state='chase';m.targetX=player.x;m.targetZ=player.z}else if(m.state==='chase'){m.state='return'}
   if(m.state==='patrol'&&(--m.patrolTime<=0||Math.hypot(m.targetX-m.x,m.targetZ-m.z)<1)){const a=Math.random()*Math.PI*2,r=Math.random()*m.zone.r*.72;m.targetX=m.homeX+Math.cos(a)*r;m.targetZ=m.homeZ+Math.sin(a)*r;m.patrolTime=2+Math.random()*4}
   if(m.state==='return'){m.targetX=m.homeX;m.targetZ=m.homeZ;if(Math.hypot(m.x-m.homeX,m.z-m.homeZ)<1.5){m.state='patrol';m.patrolTime=0}}
   let tx=m.targetX-m.x,tz=m.targetZ-m.z,td=Math.hypot(tx,tz),speed=m.state==='chase'?m.chaseSpeed:m.patrolSpeed;if(m.state==='chase'&&d<1.5)td=0;
   if(td>.15){const nx=m.x+tx/td*speed*dt,nz=m.z+tz/td*speed*dt;m.actor.root.rotation.y=Math.atan2(tx,tz);if(!this.collision(nx,nz,.58)&&!this.nearVehicle(nx,nz,2.2)){m.x=nx;m.z=nz}else if(!this.collision(nx,m.z,.58)&&!this.nearVehicle(nx,m.z,2.2))m.x=nx;else if(!this.collision(m.x,nz,.58)&&!this.nearVehicle(m.x,nz,2.2))m.z=nz}
   if(Math.abs(m.knockX)+Math.abs(m.knockZ)>.1){m.x+=m.knockX*dt;m.z+=m.knockZ*dt;m.knockX*=Math.exp(-dt*5);m.knockZ*=Math.exp(-dt*5)}
   m.actor.root.position.set(m.x,0,m.z);m.actor.step(dt,m.state==='chase'?'run':m.state==='patrol'?'walk':'idle');
   if(d<1.7&&m.state==='chase'){m.attack-=dt;if(m.attack<=0){m.attack=m.attackInterval;player.health=Math.max(0,player.health-(player.blocking?1:m.attackDamage));player.damageFlash=.18}}
  }
  // Nearby civilians flee a monster that has entered its chase state.
  for(const p of this.people){if(Math.hypot(p.x-player.x,p.z-player.z)>85)continue;const threat=this.monsters.find(m=>m.alive&&m.state==='chase'&&Math.hypot(p.x-m.x,p.z-m.z)<12);if(threat){const dx=p.x-threat.x,dz=p.z-threat.z,d=Math.max(.01,Math.hypot(dx,dz));const nx=p.x+dx/d*dt*2.8,nz=p.z+dz/d*dt*2.8;if(!this.characterCollision(nx,nz,.45)){p.x=nx;p.z=nz;p.actor.root.position.set(nx,0,nz);p.actor.step(dt,'run')}}}
  this.vehiclePhysics?.step(dt,driving,keys,greenOn);
 }
 nearVehicle(x,z,radius){return this.cars.some(c=>Math.abs(c.x-x)<(c.halfWidth||1.1)+radius*.5&&Math.abs(c.z-z)<(c.halfLength||2.5)+radius*.5)}
 hitEffect(x,z,color=0xff6658,y=.14){
  const group=new THREE.Group();group.position.set(x,y,z);group.userData.life=.42;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.52,.055,6,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.92,depthWrite:false}));ring.rotation.x=-Math.PI/2;group.add(ring);
  const count=9,positions=new Float32Array(count*3),velocities=new Float32Array(count*3);for(let i=0;i<count;i++){const a=i/count*Math.PI*2,speed=1.1+(i%3)*.42;positions[i*3]=Math.cos(a)*.12;positions[i*3+1]=.12+(i%3)*.04;positions[i*3+2]=Math.sin(a)*.12;velocities[i*3]=Math.cos(a)*speed;velocities[i*3+1]=1.1+(i%4)*.22;velocities[i*3+2]=Math.sin(a)*speed}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const sparks=new THREE.Points(geometry,new THREE.PointsMaterial({color,size:.16,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending}));sparks.userData.velocities=velocities;group.add(sparks);
  this.scene.add(group);this.effects.push(group);if(this.effects.length>64){const old=this.effects.shift();this.scene.remove(old);old.traverse(o=>{o.geometry?.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}})}return group
 }
 updateEffects(dt){for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.userData.life-=dt;const k=1+dt*2.7;e.children[0]?.scale.multiplyScalar(k);for(const p of e.children){if(!p.isPoints)continue;const attr=p.geometry.attributes.position,v=p.userData.velocities;for(let n=0;n<attr.count;n++){attr.array[n*3]+=v[n*3]*dt;attr.array[n*3+1]+=v[n*3+1]*dt;attr.array[n*3+2]+=v[n*3+2]*dt;v[n*3+1]-=4.8*dt}attr.needsUpdate=true;p.material.opacity=Math.max(0,e.userData.life/.42)}if(e.children[0]?.material)e.children[0].material.opacity=Math.max(0,e.userData.life/.42);if(e.userData.life<=0){this.scene.remove(e);e.traverse(o=>{o.geometry?.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}});this.effects.splice(i,1)}}}
 defeat(m,respawn=45){m.alive=false;m.health=0;m.state='dead';m.actor.root.visible=false;m.respawn=respawn}
 regionName(x,z){if(x>410&&z>390)return'OLD MILL VILLAGE';if(x>330&&x<500&&z>30&&z<280)return'EAST BOROUGH';if(x<-180&&z>-110&&z<310)return'DARK PINE FOREST';if(x>300&&z<-280)return'BOSS TERRITORY';if(x>180&&z>180)return'COUNTRYSIDE';if(x>180&&z>70&&z<250)return'INDUSTRIAL DISTRICT';if(x>130&&z<-150)return'ABANDONED QUARTER';if(z>140)return'NORTH SUBURBS';if(z<-140)return'SOUTH SUBURBS';return'RIVERTON CITY CENTER'}
}
