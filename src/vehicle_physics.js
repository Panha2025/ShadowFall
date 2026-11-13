// Lightweight Rapier rigid-body vehicle layer. Static architecture uses simple
// box colliders; rendered GLB meshes are never used as physics geometry.
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export class VehiclePhysics{
 constructor(RAPIER,worldScene){
  this.R=RAPIER;this.scene=worldScene;this.world=new RAPIER.World({x:0,y:-9.81,z:0});this.dt=1/60;this.accumulator=0;this.steeringSensitivity=.82;this.now=0;this.eventQueue=new RAPIER.EventQueue(true);this.carByCollider=new Map();this.propByCollider=new Map();this.impactTimes=new Map();
  this.world.timestep=this.dt;
  const half=worldScene.worldHalfExtent||420,ground=RAPIER.RigidBodyDesc.fixed();const groundBody=this.world.createRigidBody(ground);
  this.world.createCollider(RAPIER.ColliderDesc.cuboid(half+8,.12,half+8).setTranslation(0,-.12,0).setFriction(1.1),groundBody);
  for(const b of [...worldScene.buildings,...(worldScene.villageColliders||[])]){const s=b.model?.scale||1,d=b.model?.dimensions,halfHeight=b.h??(b.kind==='abandoned'?2.75:Math.max(2,d?.y?s*d.y:6)*.5);
   const hx=b.hx??(b.kind==='downtown'||b.kind==='abandoned'?b.r:Math.max(1.5,d?.x?s*d.x*.5:b.r)),hz=b.hz??(b.kind==='downtown'||b.kind==='abandoned'?b.r:Math.max(1.5,d?.z?s*d.z*.5:b.r)),yaw=b.model?.root.rotation.y||0;
   const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(b.x,b.centerY??halfHeight,b.z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}));
   this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx,halfHeight,hz).setFriction(.9).setRestitution(.03),body);
  }
  for(const x of [-half,half]){const b=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x,5,0));this.world.createCollider(RAPIER.ColliderDesc.cuboid(1,5,half),b)}
  for(const z of [-half,half]){const b=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,5,z));this.world.createCollider(RAPIER.ColliderDesc.cuboid(half,5,1),b)}
  this.createCars();this.createMovableProps();this.createActorColliders();this.playerImpactAt=-10;this.npcImpactAt=new Map();
 }
 createCars(){const R=this.R;for(const car of this.scene.cars){
   const isBus=car.kind==='bus',mass=isBus?7800:1550,halfWidth=isBus?1.35:1.08,halfHeight=isBus?1.25:.66,halfLength=isBus?4.25:2.48;
   car.mass=mass;car.halfWidth=halfWidth;car.halfHeight=halfHeight;car.halfLength=halfLength;
   const rotation={x:0,y:Math.sin(car.yaw/2),z:0,w:Math.cos(car.yaw/2)};
   car.yawInertia=mass*(halfWidth*halfWidth+halfLength*halfLength)/3;
   car.body=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(car.x,halfHeight,car.z).setRotation(rotation).setAdditionalMass(mass).setLinearDamping(.3).setAngularDamping(2.4).setCanSleep(false).setCcdEnabled(true));
   car.body.setEnabledTranslations(true,false,true,true);car.body.setEnabledRotations(false,true,false,true);
   car.collider=this.world.createCollider(R.ColliderDesc.cuboid(halfWidth,halfHeight,halfLength).setFriction(1.1).setRestitution(.06),car.body);
   car.collider.setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);car.durability=100;car.disabled=false;car.impactSequence=0;car.lastImpactDamage=0;car.impactFlash=0;this.carByCollider.set(car.collider.handle,car);
  }}
 createMovableProps(){const R=this.R;for(const prop of this.scene.movableProps||[]){
   const body=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(prop.x,.56,prop.z).setAdditionalMass(prop.mass||34).setLinearDamping(1.1).setAngularDamping(1.5).setCanSleep(true).setCcdEnabled(true));
   const collider=this.world.createCollider(R.ColliderDesc.cuboid(.43,.56,.43).setFriction(.85).setRestitution(.12).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),body);prop.body=body;prop.collider=collider;this.propByCollider.set(collider.handle,prop);
  }for(const prop of this.scene.destructibleProps||[]){const body=this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(prop.x,prop.halfY,prop.z)),collider=this.world.createCollider(R.ColliderDesc.cuboid(prop.halfX,prop.halfY,prop.halfZ).setFriction(.9).setRestitution(.03).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),body);prop.body=body;prop.collider=collider;this.propByCollider.set(collider.handle,prop)}}
 createActorColliders(){const R=this.R;this.actorColliderHandles=new Set();this.playerBody=this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0,1,0));this.playerCollider=this.world.createCollider(R.ColliderDesc.capsule(.45,.34).setSensor(true).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),this.playerBody);this.actorColliderHandles.add(this.playerCollider.handle);this.personBodies=new Map();this.monsterBodies=new Map();for(const person of this.scene.people){const body=this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(person.x,.86,person.z)),collider=this.world.createCollider(R.ColliderDesc.cuboid(.34,.86,.3).setSensor(true).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),body);person.physicsBody=body;this.personBodies.set(person,body);this.actorColliderHandles.add(collider.handle)}for(const monster of this.scene.monsters){const height=monster.visualHeight||2,hx=clamp((monster.measuredDimensions?.x||.8)*.32,.28,1.5),hz=clamp((monster.measuredDimensions?.z||.8)*.32,.28,1.5),halfHeight=clamp(height*.43,.4,2.4),body=this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(monster.x,halfHeight,monster.z)),collider=this.world.createCollider(R.ColliderDesc.cuboid(hx,halfHeight,hz).setSensor(true).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),body);monster.physicsBody=body;this.monsterBodies.set(monster,body);this.actorColliderHandles.add(collider.handle)}}
 applyImpulse(body,x,z,mass,dt){body.applyImpulse({x:x*mass*dt,y:0,z:z*mass*dt},true)}
 controlCar(car,dt,controlled,keys,green){
  // Rapier's quaternion and Three.js both rotate the model's local -Z forward
  // axis to (-sin(yaw), 0, -cos(yaw)); local +X is the car's right vector.
  const body=car.body,velocity=body.linvel(),yaw=car.yaw,fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);
  const forwardSpeed=velocity.x*fx+velocity.z*fz,lateralSpeed=velocity.x*rx+velocity.z*rz,mass=car.mass;
  let longitudinal=0,steer=0,handbrake=false;
  if(car===controlled){const throttle=Number(!!keys.KeyW),brake=Number(!!keys.KeyS);steer=Number(!!keys.KeyA)-Number(!!keys.KeyD);handbrake=!!keys.Space;
   if(car.disabled){longitudinal=-Math.sign(forwardSpeed)*Math.min(7,Math.abs(forwardSpeed)*3);steer=0;handbrake=true}
   else{
   const conditionFactor=.48+.52*clamp(car.durability/100,0,1);
   if(throttle)longitudinal=forwardSpeed<-.4?Math.min(12,-forwardSpeed*5.5):forwardSpeed<23*conditionFactor?7*conditionFactor:0;
   if(brake)longitudinal=forwardSpeed>.4?-Math.min(13,forwardSpeed*7.5):forwardSpeed>-.4?-4.2:forwardSpeed>-7?-3.8:0;
   if(!throttle&&!brake)longitudinal=-Math.sign(forwardSpeed)*Math.min(1.25,Math.abs(forwardSpeed)*1.1);
   if(handbrake)longitudinal-=Math.sign(forwardSpeed)*Math.min(5.5,Math.abs(forwardSpeed)*3.5);}
  }else if(!car.parked){const red=!green&&[-350,-210,-70,0,70,210,350].some(v=>Math.abs(car.z-v)<12),target=red?0:car.trafficSpeed;longitudinal=Math.max(-10,Math.min(4.5,(target-forwardSpeed)*2.7));}
  else longitudinal=-Math.sign(forwardSpeed)*Math.min(4,Math.abs(forwardSpeed)*2.4);
  if(Math.abs(longitudinal)>.001)this.applyImpulse(body,fx*longitudinal,fz*longitudinal,mass,dt);
  const grip=handbrake?1.45:6.5;if(Math.abs(lateralSpeed)>.001)this.applyImpulse(body,-rx*lateralSpeed*grip,-rz*lateralSpeed*grip,mass,dt);
  if(controlled){const speedFactor=Math.min(1,Math.abs(forwardSpeed)/5),direction=Math.sign(forwardSpeed||1),targetYawRate=steer*this.steeringSensitivity*.72*speedFactor*direction,currentYawRate=body.angvel().y,yawAcceleration=Math.max(-4.5,Math.min(4.5,(targetYawRate-currentYawRate)*6));body.addTorque({x:0,y:yawAcceleration*car.yawInertia,z:0},true)}
 }
 applyCollisionDamage(car,amount){if(!car||amount<=0)return;car.durability=Math.max(0,car.durability-amount);car.disabled=car.durability<=0;car.lastImpactDamage=amount;car.impactSequence++;car.impactFlash=.35;this.scene.hitEffect?.(car.x,car.z,0xf6ac60,.55)}
 processCollisionEvents(velocities){this.eventQueue.drainCollisionEvents((h1,h2,started)=>{if(!started||this.actorColliderHandles?.has(h1)||this.actorColliderHandles?.has(h2))return;const a=this.carByCollider.get(h1),b=this.carByCollider.get(h2),prop=this.propByCollider.get(h1)||this.propByCollider.get(h2);if(!a&&!b)return;const key=[h1,h2].sort((x,y)=>x-y).join(':');if(this.now-(this.impactTimes.get(key)??-10)<.65)return;const va=a?velocities.get(a):null,vb=b?velocities.get(b):prop&&!prop.destroyed?velocities.get(prop):null;let relative=0;if(va&&vb)relative=Math.hypot(va.x-vb.x,va.y-vb.y,va.z-vb.z);else if(va||vb){const v=va||vb;relative=Math.hypot(v.x,v.y,v.z)}if(relative<3.1)return;this.impactTimes.set(key,this.now);const base=Math.min(30,Math.pow(relative-2.6,1.32)*1.45);if(prop){if(prop.destroyed||this.now-(prop.lastImpactAt??-10)<.55)return;prop.lastImpactAt=this.now;this.applyCollisionDamage(a||b,base*(prop.kind==='fence'?.32:.48));this.scene.hitEffect?.(prop.x,prop.z,prop.kind==='fence'?0xb87a43:0xe9bd78,.42);if(prop.kind==='fence'){prop.health=Math.max(0,prop.health-base*2.2);if(prop.health<=0){prop.destroyed=true;prop.root.visible=false;prop.body.setEnabled(false);this.scene.hitEffect?.(prop.x,prop.z,0xd7a76a,.8)}}}else{if(a)this.applyCollisionDamage(a,base*Math.min(1.35,Math.sqrt((b?.mass||a.mass)/a.mass)));if(b)this.applyCollisionDamage(b,base*Math.min(1.35,Math.sqrt((a?.mass||b.mass)/b.mass)))}});}
 step(dt,controlled,keys,green){
  this.accumulator+=Math.min(dt,.12);
  while(this.accumulator>=this.dt){for(const car of this.scene.cars)this.controlCar(car,this.dt,controlled,keys,green);const player=this.scene.currentPlayer;this.playerBody.setEnabled(!!player&&this.scene.currentDriving==null);if(player)this.playerBody.setNextKinematicTranslation({x:player.x,y:Math.max(0,player.y||0)+.9,z:player.z});for(const person of this.scene.people)if(person.physicsBody){person.physicsBody.setEnabled(!!person.alive&&!!person.actor.root.visible);if(person.alive)person.physicsBody.setNextKinematicTranslation({x:person.x,y:.86,z:person.z})}for(const monster of this.scene.monsters)if(monster.physicsBody){monster.physicsBody.setEnabled(!!monster.alive&&!!monster.actor.root.visible);if(monster.alive)monster.physicsBody.setNextKinematicTranslation({x:monster.x,y:Math.max(.4,(monster.visualHeight||2)*.43),z:monster.z})}const velocities=new Map(this.scene.cars.map(car=>[car,car.body.linvel()]));for(const prop of this.scene.movableProps||[])if(prop.body&&!prop.destroyed)velocities.set(prop,prop.body.linvel());this.world.step(this.eventQueue);this.now+=this.dt;this.processCollisionEvents(velocities);this.accumulator-=this.dt}
  for(const prop of this.scene.movableProps||[])if(prop.body&&!prop.destroyed){const p=prop.body.translation(),q=prop.body.rotation();prop.x=p.x;prop.z=p.z;prop.root.position.set(p.x,p.y,p.z);prop.root.quaternion.set(q.x,q.y,q.z,q.w)}
  for(const car of this.scene.cars){const p=car.body.translation(),q=car.body.rotation(),v=car.body.linvel();car.x=p.x;car.z=p.z;car.yaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.z*q.z));car.velocity=v.x*(-Math.sin(car.yaw))+v.z*(-Math.cos(car.yaw));car.speed=Math.hypot(v.x,v.z);car.carModel.root.position.set(p.x,0,p.z);car.carModel.root.rotation.y=car.yaw}
  this.resolveMonsterImpacts(dt);this.resolvePersonImpacts(dt);
 }
 resolveMonsterImpacts(dt){for(const car of this.scene.cars){car.impactFlash=Math.max(0,(car.impactFlash||0)-dt);if(car.speed<3)continue;for(const monster of this.scene.monsters){if(!monster.alive||Math.hypot(monster.x-car.x,monster.z-car.z)>4.2)continue;monster.vehicleHitAt??=new Map();if(this.now-(monster.vehicleHitAt.get(car.id)??-10)<.85)continue;monster.vehicleHitAt.set(car.id,this.now);const fx=-Math.sin(car.yaw),fz=-Math.cos(car.yaw),mass=clamp(Math.pow((monster.visualHeight||2.05)/2.05,1.45),.42,4),sizeFactor=clamp(1/Math.sqrt(mass),.5,1.5),damage=Math.min(65,Math.max(8,(car.speed-2.2)*4.5)*sizeFactor),push=Math.min(8,Math.max(1.8,car.speed*.5*sizeFactor));this.scene.onMonsterHit?.(monster,damage,fx*push,fz*push);this.scene.hitEffect?.(monster.x,monster.z,0xffa568,.6);this.applyCollisionDamage(car,Math.max(2,(car.speed-4)*1.3))}}}
 resolvePersonImpacts(dt){
  const player=this.scene.currentPlayer;
  for(const car of this.scene.cars){if(car.speed<3)continue;const fx=-Math.sin(car.yaw),fz=-Math.cos(car.yaw),rx=Math.cos(car.yaw),rz=-Math.sin(car.yaw);
   if(player&&this.scene.currentDriving!==car){const dx=player.x-car.x,dz=player.z-car.z,forward=dx*fx+dz*fz,lateral=dx*rx+dz*rz;
    if(Math.abs(forward)<car.halfLength+.55&&Math.abs(lateral)<car.halfWidth+.45&&Math.abs(player.y||0)<2&&this.now-this.playerImpactAt>.8){this.playerImpactAt=this.now;const distance=Math.max(.05,Math.hypot(dx,dz)),nx=distance<.5?-fx:dx/distance,nz=distance<.5?-fz:dz/distance,damage=clamp((car.speed-2.2)*1.55,4,24),push=Math.min(5,1.5+car.speed*.24);player.health=Math.max(0,player.health-damage);player.vx=(player.vx||0)+nx*push;player.vz=(player.vz||0)+nz*push;player.damageFlash=.3;this.scene.hitEffect?.(player.x,player.z,0xf36b61,.8);this.scene.onPlayerImpact?.(damage);this.applyCollisionDamage(car,Math.max(2,(car.speed-4)*.9));}
   }
   for(const person of this.scene.people){if(!person.alive||Math.abs(person.x-car.x)>car.halfLength+1||Math.abs(person.z-car.z)>car.halfLength+1)continue;const dx=person.x-car.x,dz=person.z-car.z,forward=dx*fx+dz*fz,lateral=dx*rx+dz*rz;if(Math.abs(forward)>car.halfLength+.55||Math.abs(lateral)>car.halfWidth+.45||this.now-(person.vehicleHitAt||-10)<1.2)continue;person.vehicleHitAt=this.now;const distance=Math.max(.05,Math.hypot(dx,dz)),nx=distance<.5?-fx:dx/distance,nz=distance<.5?-fz:dz/distance,damage=clamp((car.speed-2.2)*1.7,5,30),push=Math.min(3.8,1.1+car.speed*.22);person.health=Math.max(0,(person.health??100)-damage);person.knockX=nx*push;person.knockZ=nz*push;person.hitCooldown=.45;person.x+=nx*.7;person.z+=nz*.7;person.actor.root.position.set(person.x,0,person.z);person.actor.step(.08,'run');this.scene.hitEffect?.(person.x,person.z,0xf3a083,.55);this.applyCollisionDamage(car,Math.max(2,(car.speed-4)*.8));if(person.health<=0){person.alive=false;person.respawn=9;person.actor.root.visible=false;this.scene.onNpcImpact?.(person,damage,true)}else this.scene.onNpcImpact?.(person,damage,false);
   }
  }
 }
 dispose(){this.world.free()}
}
