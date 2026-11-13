import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {AssetBank,createAnimator} from './assets.js';
import {WorldScene} from './world.js';

const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>a+(b-a)*v;
const canvas=$('#game');
const storageKey='neon_county_rebuilt_stage_1_v1';
let persistent={cash:450,health:100,quest:0};
try{persistent={...persistent,...JSON.parse(localStorage.getItem(storageKey)||'{}')}}catch(e){}
const settingsKey='neon_county_controls_v1';
const controls={lookSensitivity:.0022,cameraFollow:9.5,walkSpeed:3.6,runSpeed:6.7,steering:.82,carCameraDistance:12.2};
try{Object.assign(controls,JSON.parse(localStorage.getItem(settingsKey)||'{}'))}catch{}
let running=false,paused=true,mapOpen=false,mapRefresh=0,keys={},cameraYaw=0,cameraPitch=.22,sensitivity=controls.lookSensitivity,world,bank,hero;
let modelFacing=0,currentCar=null,clock=14,elapsed=0,toaster=0,interactCooldown=0,sprintToggle=false,insideSafehouse=false,safehouseReturn=null,cameraFollowSensitivity=controls.cameraFollow,walkSpeed=controls.walkSpeed,runSpeed=controls.runSpeed,vehicleSteering=controls.steering,vehicleCameraDistance=controls.carCameraDistance,cameraManualLook=0,simulationAccumulator=0;
let player={x:-11,z:10,y:0,vy:0,yaw:0,vx:0,vz:0,stamina:100,energy:100,attacking:0,speed:0,health:100,grounded:true,blocking:false,landTime:0,jumpTime:0,turnTime:0,damageFlash:0};
let captain=null,isHero=false,attackCooldown=0,specialCooldown=0,shieldCooldown=0,shieldProjectile=null,audioContext=null,seenVehicleImpact=0;
let cameraZoom=6.4;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.03;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.3));
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(68,window.innerWidth/window.innerHeight,.07,600);
const cameraTarget=new THREE.Vector3(-11,1.65,10),cameraPosition=new THREE.Vector3(-11,4.4,17);
let lastFrame=0,frames=0,frameWallAccum=0,frameRate=0;
const missions=[
 {title:'Welcome to Riverton',label:'Talk to Sam on the western sidewalk.',dest:[-22,17]},
 {title:'A City Break',label:'Visit the café at the corner and buy coffee with E.',dest:[-20,-20]},
 {title:'First Wheels',label:'Enter a car with F, drive east to the City Contact at 71,24 and press E.',dest:[71,24]},
 {title:'Riverton is Yours',label:'Stage 1 complete. Explore the streets, shops and cars.',dest:[71,24]}
];
function save(){try{localStorage.setItem(storageKey,JSON.stringify(persistent))}catch(e){}}
function notify(msg){toaster=4;$('#toast').textContent=msg}
function houseDoorTransition(){const layer=$('#doorTransition');if(!layer)return;layer.classList.add('active');setTimeout(()=>layer.classList.remove('active'),260)}
function drawWorldMap(){if(!world)return;const canvas=$('#worldMapCanvas'),ctx=canvas.getContext('2d'),size=canvas.width,extent=world.worldHalfExtent,pad=48,scale=(size-pad*2)/(extent*2),xy=(x,z)=>({x:pad+(x+extent)*scale,y:size-pad-(z+extent)*scale}),colors=['#e88370','#a78bda','#7fa775','#d5ad68','#d99a58','#e5a14d'];
 ctx.clearRect(0,0,size,size);ctx.fillStyle='#17272d';ctx.fillRect(0,0,size,size);
 const patch=(x,z,w,h,c,label)=>{const p=xy(x-w/2,z+h/2);ctx.fillStyle=c;ctx.fillRect(p.x,p.y,w*scale,h*scale);ctx.fillStyle='#eff4e6aa';ctx.font='700 11px system-ui';ctx.textAlign='center';const q=xy(x,z);ctx.fillText(label,q.x,q.y)};
 patch(-280,85,205,300,'#314735','WOODLAND');patch(0,310,340,190,'#566344','RURAL LAND');patch(280,155,205,230,'#4e4e49','INDUSTRIAL PARK');patch(260,-310,220,210,'#393d3c','DERELICT AREA');patch(0,0,285,285,'#34443e','RIVERTON');patch(390,165,110,220,'#394a42','EAST BOROUGH');patch(460,450,130,130,'#495847','OLD MILL VILLAGE');
 ctx.strokeStyle='#616b6d';ctx.lineCap='square';for(const road of world.majorRoads){const width=Math.abs(road)<100?15:11;ctx.lineWidth=Math.max(1,width*scale);let a=xy(road,-extent),b=xy(road,extent);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();a=xy(-extent,road);b=xy(extent,road);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
 ctx.strokeStyle='#687173';ctx.lineWidth=3*scale;for(const road of world.residentialRoads){let a=xy(road,-142),b=xy(road,142);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();a=xy(-142,road);b=xy(142,road);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
 ctx.strokeStyle='#7b8580';ctx.lineWidth=7*scale;{let a=xy(350,350),b=xy(425,350),c=xy(425,450),d=xy(455,450);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke()}
 for(const village of world.villages||[]){const p=xy(village.x,village.z);ctx.strokeStyle='#bad58a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(village.width,village.depth)*scale*.5,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#dbe5d0';ctx.font='700 9px system-ui';ctx.textAlign='center';ctx.fillText(village.name.toUpperCase(),p.x,p.y-7)}
 for(const building of world.buildings){const p=xy(building.x,building.z),r=Math.max(2,building.r*scale*.65);ctx.fillStyle=building.kind==='shop'?'#80d3cc':building.kind==='downtown'?'#c7b39a':'#9eaaa1';ctx.fillRect(p.x-r,p.y-r,r*2,r*2)}
 for(const zone of world.dangerZones){const p=xy(zone.x,zone.z),r=zone.r*scale,c=colors[world.dangerZones.indexOf(zone)%colors.length];ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=c+'22';ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=2;ctx.stroke();if(zone.name!=='Downtown Outbreak'){ctx.fillStyle='#f0e9dc';ctx.font='700 10px system-ui';ctx.textAlign='center';ctx.fillText(zone.name,p.x,p.y-r-7)}}
 const nearestHouse=world.hotspots.filter(h=>h.type==='house').sort((a,b)=>Math.hypot(a.x+11,a.z-10)-Math.hypot(b.x+11,b.z-10))[0];ctx.textAlign='left';ctx.font='700 9px system-ui';for(const h of world.hotspots){const p=xy(h.x,h.z);ctx.fillStyle=h.type==='finish'?'#ffd65e':h.type==='garage'?'#8ec2e4':h.type==='house'?'#a7d58a':'#f5df9a';ctx.beginPath();ctx.arc(p.x,p.y,h.type==='house'?5.2:4.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#dbe5e6';const label=h.type==='coffee'?'CAFÉ':h.type==='garage'?'GARAGE':h.type==='guide'?'SAM':h.type==='house'?(h===nearestHouse?'HOUSE · E':''):'CONTACT';if(label)ctx.fillText(label,p.x+6,p.y-5)}
 for(const car of world.cars){const p=xy(car.x,car.z);ctx.fillStyle=car===currentCar?'#ffd65e':'#8498a0';ctx.fillRect(p.x-2,p.y-3,4,6)}
 for(const monster of world.monsters){if(!monster.alive||!monster.actor.root.visible)continue;const p=xy(monster.x,monster.z);ctx.fillStyle=monster.boss?'#ff9a3e':monster.type==='spider'?'#e8ce67':'#f06c5c';ctx.beginPath();ctx.arc(p.x,p.y,monster.boss?4.5:3,0,Math.PI*2);ctx.fill()}
 const dest=missions[clamp(persistent.quest,0,3)].dest,objective=xy(dest[0],dest[1]);ctx.fillStyle='#ffd65e';ctx.beginPath();ctx.moveTo(objective.x,objective.y-7);ctx.lineTo(objective.x+7,objective.y);ctx.lineTo(objective.x,objective.y+7);ctx.lineTo(objective.x-7,objective.y);ctx.closePath();ctx.fill();
 const mapX=currentCar?currentCar.x:insideSafehouse&&safehouseReturn?safehouseReturn.x:player.x,mapZ=currentCar?currentCar.z:insideSafehouse&&safehouseReturn?safehouseReturn.z:player.z,playerDot=xy(mapX,mapZ),angle=cameraYaw;ctx.save();ctx.translate(playerDot.x,playerDot.y);ctx.rotate(angle);ctx.fillStyle='#fff4a7';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(8,9);ctx.lineTo(0,5);ctx.lineTo(-8,9);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 $('#mapPlayerCoords').textContent=`PLAYER ${Math.round(mapX)}, ${Math.round(mapZ)}${insideSafehouse?' · IN SAFE HOUSE':''}`;
 const legend=$('#mapZones');if(!legend.dataset.ready){legend.innerHTML=world.dangerZones.map((zone,i)=>{const types=[...new Set(world.monsters.filter(m=>m.zone===zone).map(m=>m.label))].join(' · ');return`<div class="map-zone-entry" style="--zone-color:${colors[i%colors.length]}"><b>${zone.name}</b><span>${types||'Unknown threat'}</span></div>`}).join('');legend.dataset.ready='true'}
}
function toggleWorldMap(force){mapOpen=force===undefined?!mapOpen:force;$('#worldMap').classList.toggle('hidden',!mapOpen);if(mapOpen){keys={};cameraManualLook=0;if(document.pointerLockElement)document.exitPointerLock();drawWorldMap()}}
function transform(){if(currentCar)return notify('Exit the vehicle before transforming');isHero=!isHero;const active=isHero?captain:hero,other=isHero?hero:captain;if(other)other.root.visible=false;active.root.visible=true;active.root.position.set(player.x,player.y,player.z);active.root.rotation.y=player.yaw;$('#formLabel').textContent=isHero?'CAPTAIN AMERICA · HERO MODE':'REMY · CIVILIAN MODE';$('#transformButton').textContent=isHero?'REMY · T':'CAPTAIN · T';$('#combatStatus').textContent=isHero?'CAPTAIN · SHIELD Q / AREA R':'REMY · PUNCH / AREA R';const flash=new THREE.PointLight(isHero?0x6fbaff:0xffdfa0,28,10);flash.position.set(player.x,1.4,player.z);scene.add(flash);setTimeout(()=>scene.remove(flash),320);notify(isHero?'TRANSFORMED · CAPTAIN AMERICA':'TRANSFORMED · REMY');}
function sound(freq=180,duration=.09,type='triangle'){try{audioContext??=new AudioContext();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.055,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+duration)}catch{}}
function floatDamage(value,x,z){const pos=new THREE.Vector3(x,2.1,z).project(camera),el=document.createElement('span');el.className='damage-number';el.textContent='−'+value;el.style.left=`${(pos.x*.5+.5)*innerWidth}px`;el.style.top=`${(-pos.y*.5+.5)*innerHeight}px`;$('#monsterOverlay').appendChild(el);setTimeout(()=>el.remove(),700)}
function damageMonster(m,damage,kx=0,kz=0){if(!m?.alive)return;m.health=Math.max(0,m.health-damage);m.knockX+=kx;m.knockZ+=kz;floatDamage(damage,m.x,m.z);sound(m.boss?95:210,.07,'sawtooth');world.hitEffect?.(m.x,m.z,m.boss?0xffa63d:0xff6658);if(m.health<=0){world.defeat(m,m.boss?100:45);persistent.cash+=m.boss?300:50;persistent.health=Math.min(100,persistent.health+10);save();notify(`${m.boss?'Boss':'Monster'} defeated · reward added`)} }
function attack(){if(attackCooldown>0)return;attackCooldown=isHero?.48:.65;player.attacking=.4;const target=world.nearestMonster(player.x,player.z,isHero?4.2:2.6);if(target){const forwardX=Math.sin(player.yaw),forwardZ=-Math.cos(player.yaw),dx=target.x-player.x,dz=target.z-player.z,front=dx*forwardX+dz*forwardZ;if(front<-.8&&Math.hypot(dx,dz)>1.2){notify('Turn toward the monster to land a hit');return}damageMonster(target,isHero?34:22,forwardX*2.2,forwardZ*2.2);notify(isHero?'Shield strike landed':'Remy punch landed')}else notify(isHero?'Shield strike · no monster in range':'Punch · no monster in range')}
function special(){if(specialCooldown>0||player.energy<35)return;specialCooldown=2.4;player.energy-=35;let hits=0;for(const m of world.monsters){if(m.alive&&m.actor.root.visible&&Math.hypot(m.x-player.x,m.z-player.z)<8){damageMonster(m,isHero?55:28);hits++}}save();notify(hits?`Area shockwave hit ${hits} monster${hits>1?'s':''}`:'Area shockwave · no monsters nearby')}
function throwShield(){if(!isHero||shieldCooldown>0||shieldProjectile)return;const shieldName='24_+Captain_america-Civil_War-WP001';let source=null;captain.content.traverse(o=>{if(!source&&o.isMesh&&o.name.startsWith(shieldName))source=o});if(!source){notify('Captain shield mesh missing');return}captain.root.updateMatrixWorld(true);const projectile=source.clone();projectile.applyMatrix4(source.matrixWorld);projectile.matrixAutoUpdate=true;scene.add(projectile);const forward=new THREE.Vector3(Math.sin(player.yaw),0,-Math.cos(player.yaw)),target=world.nearestMonster(player.x,player.z,24);let direction=forward;if(target){const toward=new THREE.Vector3(target.x-projectile.position.x,0,target.z-projectile.position.z).normalize();if(toward.dot(forward)>.15)direction=toward}shieldProjectile={root:projectile,state:'out',time:0,hit:new Set(),dir:direction.clone()};shieldCooldown=2.5;sound(540,.14,'square')}
function updateShield(dt){if(!shieldProjectile)return;const s=shieldProjectile;s.time+=dt;s.root.rotation.z+=dt*13;if(s.state==='out'){s.root.position.addScaledVector(s.dir,dt*22);for(const m of world.monsters){if(m.alive&&m.actor.root.visible&&!s.hit.has(m)&&Math.hypot(m.x-s.root.position.x,m.z-s.root.position.z)<1.5){s.hit.add(m);damageMonster(m,m.boss?50:60,s.dir.x*3,s.dir.z*3);s.state='return';break}}if(s.time>1.25)s.state='return'}else{const hand=new THREE.Vector3(player.x,player.y+1.25,player.z);s.dir.copy(hand).sub(s.root.position).normalize();s.root.position.addScaledVector(s.dir,dt*28);if(s.root.position.distanceTo(hand)<1||s.time>3.5){scene.remove(s.root);shieldProjectile=null}}}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
window.addEventListener('resize',resize);resize();
function quality(name){let low=name==='low',high=name==='high';renderer.shadowMap.enabled=!low;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,low?.82:high?1.6:1.15));
 if(world){world.sun.castShadow=!low;world.sun.shadow.mapSize.set(high?2048:1024,high?2048:1024);world.sun.shadow.map?.dispose();world.sun.shadow.map=null;}
 resize();}
function start(){running=true;paused=false;$('#loading').classList.add('hidden');$('#hud').classList.remove('hidden');$('#pause').classList.add('hidden');notify('Click the scene to capture the mouse · WASD moves · Esc releases it');}
function togglePause(force){if(!running)return;
 paused=force===undefined?!paused:force;
 $('#pause').classList.toggle('hidden',!paused);
 if(paused){keys={};player.vx=0;player.vz=0;player.blocking=false;$('#sprintButton').classList.remove('key-held');if(document.pointerLockElement)document.exitPointerLock();}
}
$('#enter').addEventListener('click',start);
$('#resume').addEventListener('click',()=>togglePause(false));
$('#quality').addEventListener('change',e=>quality(e.target.value));
$('#closeWorldMap').addEventListener('click',()=>toggleWorldMap(false));
$('#worldMap').addEventListener('click',e=>{if(e.target.id==='worldMap')toggleWorldMap(false)});
function updateSetting(key,value){controls[key]=Number(value);try{localStorage.setItem(settingsKey,JSON.stringify(controls))}catch{};sensitivity=controls.lookSensitivity;cameraFollowSensitivity=controls.cameraFollow;walkSpeed=controls.walkSpeed;runSpeed=controls.runSpeed;vehicleSteering=controls.steering;vehicleCameraDistance=controls.carCameraDistance;if(world?.vehiclePhysics)world.vehiclePhysics.steeringSensitivity=vehicleSteering}
for(const [id,key] of [['lookSensitivity','lookSensitivity'],['cameraFollow','cameraFollow'],['walkSpeed','walkSpeed'],['runSpeed','runSpeed'],['vehicleSteering','steering'],['vehicleCameraDistance','carCameraDistance']]){const input=$('#'+id);input.value=controls[key];input.addEventListener('input',e=>updateSetting(key,e.target.value))}
$('#facing').addEventListener('change',e=>modelFacing=Number(e.target.value));
$('#transformButton').addEventListener('click',transform);
$('#sprintButton').addEventListener('click',()=>{sprintToggle=!sprintToggle;$('#sprintButton').setAttribute('aria-pressed',String(sprintToggle));$('#sprintButton').textContent=sprintToggle?'RUN ON':'RUN · SHIFT'});

function toCar(){
 if(currentCar){
   const car=currentCar,exit=world.safeExitPosition(car);if(!exit){notify('There is no safe space beside this vehicle');return}
   currentCar=null;car.driven=false;car.parked=true;player.x=exit.x;player.z=exit.z;player.y=0;player.vx=0;player.vz=0;player.grounded=true;cameraManualLook=0;
   hero.root.visible=!isHero;if(captain)captain.root.visible=isHero;notify('Exited vehicle safely');return;
 }
 const car=world.nearestCar(player.x,player.z);
 if(!car){notify('Approach a vehicle · Press F to Drive');return}
 currentCar=car;seenVehicleImpact=car.impactSequence;car.parked=false;car.driven=true;cameraYaw=-car.yaw;
 player.x=car.x;player.z=car.z;player.y=0;player.vx=0;player.vz=0;cameraManualLook=0;hero.root.visible=false;if(captain)captain.root.visible=false;notify('Driving · W accelerate · S brake/reverse · A left · D right · Space handbrake · F exit');
}
function use(){
 if(insideSafehouse){const h=world.safehouse;if(Math.hypot(player.x-h.exitX,player.z-h.exitZ)>2.8){notify('Walk to the front door to leave the house');return}houseDoorTransition();insideSafehouse=false;world.safehouse.root.visible=false;const spot=safehouseReturn||{x:-11,z:10,yaw:0};player.x=spot.x;player.z=spot.z;player.yaw=spot.yaw??0;player.vx=player.vz=player.vy=0;player.y=0;player.grounded=true;safehouseReturn=null;notify('Back outside · House exit');return}
 if(currentCar)return notify('Exit the vehicle before using a house door');
 const hot=world.nearestHotspot(player.x,player.z);
 if(!hot){notify('Explore the streets to find conversations, a café and garage');return}
 if(hot.type==='guide'){
   if(persistent.quest===0){persistent.quest=1;persistent.cash+=75;save();notify('Sam: Welcome to Riverton! Here is $75 for a coffee and a fresh start.');}
   else notify('Sam: Head downtown—there are shops and people everywhere!');
 }else if(hot.type==='coffee'){
   if(persistent.cash>=12){persistent.cash-=12;persistent.health=clamp(persistent.health+15,0,100);if(persistent.quest===1)persistent.quest=2;save();notify('You bought fresh coffee · -$12 · +15 health');}
   else notify('Not enough money for coffee');
 }else if(hot.type==='garage'){
   const serviceCar=currentCar||world.nearestCar(player.x,player.z);if(serviceCar&&serviceCar.durability<100){if(persistent.cash>=50){persistent.cash-=50;serviceCar.durability=100;serviceCar.disabled=false;save();notify('Vehicle repaired · $50');}else notify('Garage: vehicle repair costs $50');}
   else if(persistent.cash>=50){persistent.cash-=50;persistent.health=100;save();notify('Garage service · -$50 · Health restored');}
   else notify('Garage service costs $50');
 }else if(hot.type==='house'){
   if(!persistent.safehouseSaved){persistent.safehouseSaved=true;save()}
   houseDoorTransition();safehouseReturn={x:hot.x,z:hot.z,yaw:hot.entrance.facingYaw,house:hot.house};insideSafehouse=true;world.safehouse.root.visible=true;player.x=world.safehouse.spawnX;player.z=world.safehouse.spawnZ;player.y=player.vy=player.vx=player.vz=0;player.yaw=0;player.grounded=true;cameraYaw=0;cameraManualLook=0;notify('House interior · Walk to the front door to exit');
 }else if(hot.type==='finish'){
   if(persistent.quest===2){persistent.quest=3;persistent.cash+=300;save();notify('DELIVERY COMPLETE · +$300 · Stage 1 adventure complete');}
   else notify('City Contact: Good to see you. Keep exploring Riverton!');
 }
}
function keydown(e){
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'){if(mapOpen){e.preventDefault();toggleWorldMap(false)}else if(running){e.preventDefault();togglePause();}return}
 if(e.code==='KeyM'){if(running&&!paused)toggleWorldMap();return}
 if(!running||paused||mapOpen)return;
 keys[e.code]=true;
 if(e.repeat)return;
 if(e.code==='KeyF')toCar();
 if(e.code==='KeyE')use();
 if(e.code==='KeyT')transform();
 if(e.code==='KeyR')special();
 if(e.code==='KeyQ')throwShield();
 if(e.code==='ShiftLeft'||e.code==='ShiftRight')$('#sprintButton').classList.add('key-held');
 if(e.code==='Space'&&!currentCar&&player.grounded){player.vy=6.6;player.grounded=false;player.jumpTime=.34;}
 if(e.code==='KeyH'){persistent.health=Math.min(100,persistent.health+25);save();notify('Restored 25 health')}
}
window.addEventListener('keydown',keydown);
window.addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='ShiftLeft'||e.code==='ShiftRight')$('#sprintButton').classList.remove('key-held');if(e.code==='Space'&&currentCar)keys.KeySpace=false});
window.addEventListener('blur',()=>{if(running)togglePause(true)});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('mousedown',e=>{if(e.button===2&&running&&!paused){player.blocking=isHero;$('#toast').textContent=isHero?'Blocking':'Block is available in Hero mode'}});
window.addEventListener('mouseup',e=>{if(e.button===2)player.blocking=false});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(e.deltaY===0)return;const zoomStep=e.deltaY<0?-1:1;if(currentCar){vehicleCameraDistance=clamp(vehicleCameraDistance+zoomStep*.6,6,16);updateSetting('carCameraDistance',vehicleCameraDistance);$('#vehicleCameraDistance').value=vehicleCameraDistance}else cameraZoom=clamp(cameraZoom+zoomStep*.55,3.6,10.5)},{passive:false});
canvas.addEventListener('click',()=>{
 if(!running||paused)return;
 if(document.pointerLockElement!==canvas){canvas.requestPointerLock?.();attack();return}
 attack();
});
window.addEventListener('mousemove',e=>{
 if(!running||paused||document.pointerLockElement!==canvas)return;
 cameraYaw+=e.movementX*sensitivity;cameraManualLook=2.8;
 cameraPitch=clamp(cameraPitch-e.movementY*sensitivity,-.32,.72);
});
// The camera starts directly BEHIND the player, looking along -Z.
// D/right is positive camera-right; A/left is negative camera-right. No reversed keys.
function updateMovement(dt){
 if(currentCar){
   const car=currentCar;player.x=car.x;player.z=car.z;player.yaw=car.yaw;player.vx=0;player.vz=0;player.y=0;player.grounded=true;
   cameraManualLook=Math.max(0,cameraManualLook-dt);
   if(cameraManualLook===0){const targetYaw=-car.yaw,delta=Math.atan2(Math.sin(targetYaw-cameraYaw),Math.cos(targetYaw-cameraYaw));cameraYaw+=delta*(1-Math.exp(-dt*cameraFollowSensitivity*.58))}
   $('#speedbox').classList.remove('hidden');$('#speed').textContent=Math.round(car.speed*3.6);
   hero.root.visible=false;if(captain)captain.root.visible=false;
   return;
 }
 $('#speedbox').classList.add('hidden');hero.root.visible=!isHero;captain.root.visible=isHero;
 const fwd=Number(!!keys.KeyW)-Number(!!keys.KeyS),side=Number(!!keys.KeyD)-Number(!!keys.KeyA);
 const length=Math.hypot(fwd,side);
 const sprint=(sprintToggle||!!keys.ShiftLeft||!!keys.ShiftRight)&&player.stamina>1;
 const crouch=!!keys.ControlLeft||!!keys.ControlRight;
 const speed=crouch?2:sprint?runSpeed:walkSpeed;
 let targetX=0,targetZ=0;
 if(length>0){
   targetX=(Math.sin(cameraYaw)*fwd+Math.cos(cameraYaw)*side)/length*speed;
   targetZ=(-Math.cos(cameraYaw)*fwd+Math.sin(cameraYaw)*side)/length*speed;
 }
 const accel=length? (sprint?21:16):19,deltaX=targetX-player.vx,deltaZ=targetZ-player.vz,deltaLen=Math.hypot(deltaX,deltaZ),maxDelta=accel*dt;
 if(deltaLen>maxDelta&&deltaLen>0){player.vx+=deltaX/deltaLen*maxDelta;player.vz+=deltaZ/deltaLen*maxDelta}else{player.vx=targetX;player.vz=targetZ}
 const oldGround=player.grounded;
 player.vy-=19.5*dt;player.y+=player.vy*dt;
 if(player.y<=0){const impactSpeed=Math.max(0,-player.vy);player.y=0;player.vy=0;player.grounded=true;if(!oldGround){player.landTime=.26;if(impactSpeed>12){const fallDamage=clamp((impactSpeed-11)*2.1,3,25);player.health=Math.max(0,player.health-fallDamage);player.damageFlash=.28;world.hitEffect?.(player.x,player.z,0xc7a07d,.12);notify(`Hard landing · −${Math.round(fallDamage)} health`)}}}else player.grounded=false;
 const collides=(x,z)=>insideSafehouse?world.safehouseCollision(x,z,.48):world.characterCollision(x,z,.48);
 if(!collides(player.x+player.vx*dt,player.z))player.x+=player.vx*dt;else player.vx=0;
 if(!collides(player.x,player.z+player.vz*dt))player.z+=player.vz*dt;else player.vz=0;
 player.speed=Math.hypot(player.vx,player.vz);
 if(player.landTime>0)player.landTime=Math.max(0,player.landTime-dt);if(player.jumpTime>0)player.jumpTime=Math.max(0,player.jumpTime-dt);if(player.turnTime>0)player.turnTime=Math.max(0,player.turnTime-dt);
 const viewFx=Math.sin(cameraYaw),viewFz=-Math.cos(cameraYaw),velocityForward=player.vx*viewFx+player.vz*viewFz;
 const backward=(fwd<0&&!side)||(length===0&&velocityForward<-.18);
 if(player.speed>.08){const face=backward?Math.atan2(-player.vx,player.vz):Math.atan2(player.vx,-player.vz),turn=Math.atan2(Math.sin(face-player.yaw),Math.cos(face-player.yaw));if(Math.abs(turn)>2.25&&!backward&&length>0)player.turnTime=.38;player.yaw+=turn*(1-Math.exp(-dt*7.8));}
 player.stamina=clamp(player.stamina+(sprint&&length>0?-16:18)*dt,0,100);
 if(player.attacking>0)player.attacking=Math.max(0,player.attacking-dt);
 const active=isHero?captain:hero;active.root.position.set(player.x,player.y,player.z);active.root.rotation.y=player.yaw;active.pivot.rotation.y=modelFacing;
 let mode='idle';if(!player.grounded)mode=player.vy>.35?'jump':'fall';else if(player.landTime>0)mode='land';else if(player.blocking&&isHero)mode='fight';else if(player.turnTime>0)mode='turn';else if(player.speed>.16){if(backward)mode=sprint&&player.speed>walkSpeed?'runBackward':'backward';else mode=sprint&&player.speed>walkSpeed?'run':'walk'}
 if(!isHero){const animMode=mode==='fall'?'land':mode;const action=player.attacking>0?(hero.actions.punch||hero.actions.fight):hero.actions[animMode]||hero.actions.idle;const base=mode==='run'||mode==='runBackward'?runSpeed:walkSpeed;action.timeScale=mode==='run'||mode==='runBackward'||mode==='walk'||mode==='backward'?clamp(player.speed/Math.max(.1,base),.65,1.25):1;hero.step(dt,player.attacking>0?(hero.actions.punch?'punch':'fight'):animMode)}
 if(crouch){hero.root.scale.y=.89}else{hero.root.scale.y=1}
}
function updateCamera(dt){
 const p=currentCar?currentCar:player;
 const forward=new THREE.Vector3(Math.sin(cameraYaw),0,-Math.cos(cameraYaw));
 const dist=currentCar?vehicleCameraDistance:cameraZoom;
 const lookAhead=currentCar?clamp(currentCar.velocity*.16,-3,5):0;
 const carForward=currentCar?new THREE.Vector3(-Math.sin(currentCar.yaw),0,-Math.cos(currentCar.yaw)):new THREE.Vector3();
 const desiredTarget=new THREE.Vector3(p.x+carForward.x*lookAhead,currentCar?1.35:1.43+p.y,p.z+carForward.z*lookAhead);
 const desiredPosition=desiredTarget.clone().addScaledVector(forward,-dist*Math.cos(cameraPitch));
 desiredPosition.y+=1.15+Math.sin(cameraPitch)*dist;
 const desiredVector=desiredPosition.clone().sub(desiredTarget),desiredDistance=desiredVector.length();
 const safeDistance=world.cameraDistance(desiredTarget,desiredVector.normalize(),desiredDistance,currentCar);
 if(safeDistance<desiredDistance)desiredPosition.copy(desiredTarget).addScaledVector(desiredVector.normalize(),safeDistance);
 const factor=1-Math.exp(-dt*(safeDistance<desiredDistance?18:cameraFollowSensitivity));
 cameraPosition.lerp(desiredPosition,factor);cameraTarget.lerp(desiredTarget,factor);
 camera.position.copy(cameraPosition);camera.lookAt(cameraTarget);
}
function updateUI(dt){
 const q=missions[clamp(persistent.quest,0,3)];
 $('#missionTitle').textContent=q.title;$('#missionText').textContent=persistent.quest===3?'Stage 1 complete. Optional: follow red minimap marks to clear an outbreak zone.':q.label;$('#step').textContent=`0${Math.min(3,persistent.quest+1)} / 03`;
 $('#cash').textContent='$'+persistent.cash.toLocaleString();$('#healthValue').textContent=persistent.health;
 $('#staminaValue').textContent=Math.round(player.stamina);$('#staminabar').style.width=player.stamina+'%';$('#healthbar').style.width=persistent.health+'%';
 $('#energyValue').textContent=Math.round(player.energy);$('#energybar').style.width=player.energy+'%';
 $('#vehicleDamage').classList.toggle('hidden',!currentCar);if(currentCar){const durability=clamp(currentCar.durability,0,100);$('#vehicleHealthValue').textContent=Math.round(durability);$('#vehicleHealthBar').style.width=durability+'%';if(currentCar.impactSequence!==seenVehicleImpact){seenVehicleImpact=currentCar.impactSequence;sound(92,.12,'sawtooth');if(currentCar.disabled)notify('Vehicle disabled · repair at a garage');else if(currentCar.lastImpactDamage>=7)notify(`Crash damage · vehicle ${Math.round(durability)}%`)} }
 player.energy=clamp(player.energy+dt*8,0,100);specialCooldown=Math.max(0,specialCooldown-dt);shieldCooldown=Math.max(0,shieldCooldown-dt);
 $('#combatStatus').textContent=isHero?`CAPTAIN · Q ${shieldProjectile?'RETURN':shieldCooldown>0?shieldCooldown.toFixed(1)+'s':'SHIELD'} / R ${specialCooldown>0?specialCooldown.toFixed(1)+'s':'AREA'}`:`REMY · PUNCH / R ${specialCooldown>0?specialCooldown.toFixed(1)+'s':'AREA'}`;
 const h=Math.floor(clock)%24,m=Math.floor(clock%1*60);$('#clock').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
 const hot=!currentCar&&world.nearestHotspot(player.x,player.z),car=!currentCar&&world.nearestCar(player.x,player.z);
 const monster=!currentCar&&world.nearestMonster(player.x,player.z,3.5);
 const exitNear=insideSafehouse&&Math.hypot(player.x-world.safehouse.exitX,player.z-world.safehouse.exitZ)<=2.8;
 const action=insideSafehouse?(exitNear?{key:'E',label:'Press E to Exit House'}:null):currentCar?{key:'F',label:'Exit vehicle'}:car?{key:'F',label:'Press F to Drive'}:hot?{key:'E',label:hot.label}:monster?{key:'LMB',label:'Attack monster'}:null;
 $('#hint').classList.toggle('hidden',!action);if(action)$('#hint').innerHTML=`<kbd>${action.key}</kbd><span>${action.label.replaceAll('<','')}</span>`;
 toaster=Math.max(0,toaster-dt);if(toaster===0)$('#toast').textContent='';
 const ctx=$('#minimap').getContext('2d'),w=220,mh=220,cx=110,cy=110,scale=.235,extent=world.worldHalfExtent;
 ctx.clearRect(0,0,w,mh);ctx.save();ctx.beginPath();ctx.arc(cx,cy,108,0,Math.PI*2);ctx.clip();ctx.fillStyle='#14252e';ctx.fillRect(0,0,w,mh);
 const mapX=insideSafehouse&&safehouseReturn?safehouseReturn.x:player.x,mapZ=insideSafehouse&&safehouseReturn?safehouseReturn.z:player.z;
 ctx.translate(cx,cy);ctx.rotate(-cameraYaw);ctx.translate(-mapX*scale,-mapZ*scale);
 ctx.fillStyle='#243b3c';ctx.fillRect(-extent*scale,-extent*scale,extent*2*scale,extent*2*scale);
 ctx.fillStyle='#596266';for(const a of world.majorRoads||[-70,0,70]){const width=Math.abs(a)<100?15:11;ctx.fillRect((a-width/2)*scale,-extent*scale,width*scale,extent*2*scale);ctx.fillRect(-extent*scale,(a-width/2)*scale,extent*2*scale,width*scale)}
 ctx.fillStyle='#424d4e';for(const a of world.residentialRoads||[]){ctx.fillRect((a-3.25)*scale,-142*scale,6.5*scale,284*scale);ctx.fillRect(-142*scale,(a-3.25)*scale,284*scale,6.5*scale)}
 ctx.fillStyle='#697271';ctx.fillRect((350-4)*scale,(350-4)*scale,75*scale,8*scale);ctx.fillRect((425-4)*scale,(350-4)*scale,8*scale,100*scale);ctx.fillRect((425)*scale,(450-4)*scale,30*scale,8*scale);
 for(const village of world.villages||[]){ctx.beginPath();ctx.arc(village.x*scale,village.z*scale,Math.max(village.width,village.depth)*scale*.5,0,Math.PI*2);ctx.strokeStyle='#b9d88c';ctx.lineWidth=2;ctx.stroke()}
 ctx.fillStyle='#8a9d91';for(let b of world.buildings)ctx.fillRect((b.x-b.r)*scale,(b.z-b.r)*scale,b.r*2*scale,b.r*2*scale);
 ctx.fillStyle='#b9e798';for(const h of world.hotspots){if(h.type!=='house'||Math.hypot(h.x-mapX,h.z-mapZ)>120)continue;ctx.beginPath();ctx.arc(h.x*scale,h.z*scale,3,0,Math.PI*2);ctx.fill()}
 for(const zone of world.dangerZones){ctx.beginPath();ctx.arc(zone.x*scale,zone.z*scale,zone.r*scale,0,Math.PI*2);ctx.fillStyle='#e55a4d22';ctx.fill();ctx.strokeStyle='#e8756377';ctx.lineWidth=1;ctx.stroke()}
 for(const m of world.monsters){if(!m.alive||!m.actor.root.visible||Math.hypot(m.x-player.x,m.z-player.z)>32)continue;ctx.beginPath();ctx.arc(m.x*scale,m.z*scale,m.boss?3.2:2.2,0,Math.PI*2);ctx.fillStyle=m.boss?'#ff9a3e':m.type==='spider'?'#e7c45d':'#f05a52';ctx.fill()}
 ctx.fillStyle='#b3dee1';for(let p of world.people){ctx.beginPath();ctx.arc(p.x*scale,p.z*scale,1.5,0,6.28);ctx.fill()}
 ctx.fillStyle='#e6dca3';for(let car of world.cars)ctx.fillRect((car.x-2)*scale,(car.z-1)*scale,4*scale,2*scale);
 ctx.fillStyle='#ffd65e';const target=missions[clamp(persistent.quest,0,3)].dest;ctx.beginPath();ctx.arc(target[0]*scale,target[1]*scale,4.8,0,6.28);ctx.fill();
 ctx.restore();ctx.strokeStyle='#dde7e6';ctx.fillStyle='#efffff';ctx.beginPath();ctx.moveTo(cx,cy-8);ctx.lineTo(cx-5,cy+7);ctx.lineTo(cx+5,cy+7);ctx.closePath();ctx.fill();ctx.stroke();
 if(player.damageFlash>0){player.damageFlash=Math.max(0,player.damageFlash-dt);if(!document.querySelector('.damage-flash')){const flash=document.createElement('div');flash.className='damage-flash';document.body.appendChild(flash);setTimeout(()=>flash.remove(),210)}}
 const overlay=$('#monsterOverlay'),v=new THREE.Vector3();if(!overlay._tags){overlay._tags=world.monsters.map(m=>{const el=document.createElement('div');el.className='enemy-tag'+(m.boss?' boss':'');el.innerHTML=`<b>${m.label.toUpperCase()}</b><i><em></em></i>`;overlay.appendChild(el);return el})}
 world.monsters.forEach((m,i)=>{const el=overlay._tags[i];if(!m.alive||!m.actor.root.visible||Math.hypot(m.x-player.x,m.z-player.z)>38){el.style.display='none';return}v.set(m.x,m.visualHeight+.55,m.z);v.project(camera);if(v.z>1||Math.abs(v.x)>1.15||Math.abs(v.y)>1.15){el.style.display='none';return}el.style.display='block';el.style.left=`${(v.x*.5+.5)*innerWidth}px`;el.style.top=`${(-v.y*.5+.5)*innerHeight}px`;el.querySelector('em').style.width=`${clamp(m.health/m.maxHealth*100,0,100)}%`});
}
function animate(ts){requestAnimationFrame(animate);const wallDt=lastFrame?Math.max(0,(ts-lastFrame)/1000):0;lastFrame=ts;
 if(!running||paused||!world)return;
 // Preserve game time through slow frames with small bounded simulation steps.
 // Software rendering may stutter without slowing movement and combat.
 simulationAccumulator+=Math.min(.25,wallDt);while(simulationAccumulator>=1/60){const dt=1/60;simulationAccumulator-=dt;elapsed+=dt;clock=(clock+dt*.008)%24;attackCooldown=Math.max(0,attackCooldown-dt);player.attacking=Math.max(0,player.attacking-dt);updateMovement(dt);const healthBefore=player.health;world.update(dt,clock,player,currentCar,keys);if(player.health<healthBefore)sound(92,.12,'square');world.updateEffects(dt);updateShield(dt);updateCamera(dt)}
 persistent.health=player.health;updateUI(Math.min(.25,wallDt));
 if(mapOpen){mapRefresh-=wallDt;if(mapRefresh<=0){drawWorldMap();mapRefresh=.3}}
   renderer.render(scene,camera);
 frameWallAccum+=wallDt;frames++;if(frameWallAccum>1){frameRate=Math.round(frames/frameWallAccum);frames=0;frameWallAccum=0;$('#district').textContent=`${insideSafehouse?'SAFE HOUSE':world.regionName(player.x,player.z)} · ${frameRate} FPS`}
}
requestAnimationFrame(animate);
async function init(){
 try{
   await RAPIER.init();
   $('#loadMessage').textContent='Loading textured human, car, architectural and vegetation models…';
   bank=new AssetBank((done,total,key)=>{
     $('#loadMessage').textContent=`Checking realistic GLB models: ${done}/${total}`;
     $('#loadfill').style.width=Math.round(done/total*100)+'%';
   });
   await bank.load();
   world=new WorldScene(scene,bank);
   world.configurePhysics(RAPIER);world.vehiclePhysics.steeringSensitivity=vehicleSteering;world.onMonsterHit=(m,damage,kx,kz)=>damageMonster(m,damage,kx,kz);world.onPlayerImpact=damage=>{sound(105,.12,'square');notify(`Vehicle impact · −${Math.round(damage)} health`)};world.onNpcImpact=(person,damage,down)=>notify(down?'Civilian incapacitated · recovering':'Civilian struck · collision damage');
   hero=createAnimator(bank,'remy',1.79);
   if(!hero)throw new Error('Unable to create real skinned player character');
   player.health=persistent.health;captain=bank.instance('captain',{height:1.9});if(!captain)throw new Error('Captain America GLB did not load');captain.root.position.set(player.x,0,player.z);captain.root.visible=false;
   scene.add(hero.root,captain.root);hero.root.position.set(player.x,0,player.z);
   // Choose the model facing direction in Pause > Settings if the publisher model is oriented differently.
   let clipCount=['idle','walk','run'].filter(k=>bank.get(k)?.animations?.length).length;
   $('#loadMessage').textContent='Your downloaded 3D assets loaded: playable scene ready.';
   $('#loadInfo').textContent=`Remy and Captain America loaded · ${clipCount} Remy Mixamo clips · ${world.monsters.length} mixed monsters across ${world.dangerZones.length} encounter zones · ${world.cars.length} cars · ${world.buildings.length} imported buildings.`;
   $('#enter').textContent='▶ ENTER RIVERTON';$('#enter').disabled=false;
   renderer.render(scene,camera);
 }catch(error){
   console.error('Stage 1 realistic model setup failed',error);
   $('#loadMessage').textContent='REAL ASSET INSTALLATION NEEDED';
   $('#loadInfo').textContent=`${error.message} This is deliberate: the game will not silently replace realistic humans or cars with old cube-shaped placeholders. Unzip the project and run START_STAGE1.command on your Mac.`;
   $('#loadfill').style.background='#de826b';$('#enter').textContent='REAL 3D MODELS MISSING';$('#enter').disabled=true;
 }
}
init();
// Exposed for smoke tests and developer console; not a UI control.
window.NeonCountyStage1={get player(){return player},get world(){return world},get hero(){return hero},get captain(){return captain},get scene(){return scene},get camera(){return camera},get assets(){return bank},get renderer(){return renderer},get fps(){return frameRate},get car(){return currentCar},get transformed(){return isHero},get mapOpen(){return mapOpen},get insideSafehouse(){return insideSafehouse},get progress(){return persistent},get sprintToggle(){return sprintToggle},get shieldProjectile(){return shieldProjectile},get controls(){return {...controls}},movementMap:{W:'forward',S:'backward',A:'left',D:'right'},get cameraYaw(){return cameraYaw},set cameraYaw(v){cameraYaw=v}};
