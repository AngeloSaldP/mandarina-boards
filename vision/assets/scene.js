const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js';
const moment = document.body.dataset.moment;
const stage = document.querySelector('.moment-stage');
const canvas = document.querySelector('.scene-canvas');
const poster = document.querySelector('#poster');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let THREE, renderer, scene, camera, cameraStart, cameraEnd, clock, group, living, book, layers = [], eyes = [], fins = [];
let pointer = {x:0,y:0}, follow = {x:0,y:0,vx:0,vy:0}, activated = false, playing = false, story = 0, started = performance.now();
let blinkAt = performance.now() + 2600, blinkStart = 0, clapStart = 0, focaLift = 0, focaLiftTarget = 0;

function setStory(p) {
  story = Math.max(0, Math.min(1, p));
  const color = document.querySelector('#colourPoster');
  const sceneArt = document.querySelector('#scenePoster');
  if (color) color.style.opacity = String(Math.max(0, Math.min(1, (story - .2) / .42)));
  if (sceneArt) sceneArt.style.opacity = String(Math.max(0, Math.min(.76, (story - .53) / .28 * .76)));
  const live = Math.max(0, Math.min(1, (story - .72) / .18));
  if (canvas) canvas.style.opacity = String(live);
  const mode = story < .24 ? 'sketch' : story < .63 ? 'colour' : story < .83 ? 'handover' : 'scene';
  stage.dataset.mode = mode;
  stage.style.setProperty('--story-progress', String(story));
  document.querySelector('#progress')?.style.setProperty('--progress', `${story * 100}%`);
  document.querySelector('#progress')?.parentElement.style.setProperty('--progress', `${story * 100}%`);
  if (live > 0 && !reduced) loadScene();
}

function spotMap() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d'); x.fillStyle = '#85776a'; x.fillRect(0,0,512,512);
  let seed = 941;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i=0;i<78;i++) { const r=7+rand()*25; x.globalAlpha=.15+rand()*.3; x.fillStyle=i%3?'#453b34':'#d0c3b3'; x.beginPath(); x.ellipse(rand()*512,rand()*512,r*1.4,r*.65,rand()*Math.PI,0,Math.PI*2); x.fill(); }
  x.globalAlpha=1; const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

function glassesMap() {
  const c=document.createElement('canvas'); c.width=1024;c.height=280; const x=c.getContext('2d');
  x.strokeStyle='#211a17';x.lineWidth=18;x.lineCap='round';x.lineJoin='round';
  x.beginPath();x.roundRect(38,38,390,190,72);x.roundRect(596,38,390,190,72);x.moveTo(428,108);x.quadraticCurveTo(512,72,596,108);x.moveTo(32,74);x.lineTo(6,42);x.moveTo(992,74);x.lineTo(1018,42);x.stroke();
  x.lineWidth=11;x.beginPath();x.moveTo(420,234);x.quadraticCurveTo(510,278,604,234);x.stroke();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function uiTexture(index) {
  const c=document.createElement('canvas');c.width=640;c.height=400;const x=c.getContext('2d');
  x.fillStyle='#172027';x.fillRect(0,0,640,400);x.fillStyle='rgba(238,138,60,.12)';x.fillRect(0,0,640,index===0?58:28);
  if(index===0){x.fillStyle='#efaa70';x.font='bold 36px sans-serif';x.fillText('NORTH / DASHBOARD',28,43);x.fillStyle='#eee5d8';x.font='500 44px Georgia';x.fillText('A clearer signal',30,114);}
  x.strokeStyle='rgba(232,204,161,.23)';x.lineWidth=1;for(let j=0;j<4;j++){x.beginPath();x.moveTo(32,155+j*47);x.lineTo(608,155+j*47);x.stroke();}
  x.fillStyle=['#ee8a3c','#90c7bd','#dda57c'][index%3];for(let j=0;j<6;j++){const h=20+((j*31+index*19)%74);x.fillRect(48+j*82,340-h,30,h);}
  if(index===0){x.fillStyle='#b8afa4';x.font='36px sans-serif';x.fillText('LIVE SYSTEM / 04 SIGNALS',30,384);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function buildSketchScene() {
  const desk=new THREE.Group();desk.position.set(0,.08,0);scene.add(desk);book=desk;
  const leather=new THREE.MeshStandardMaterial({color:0x351d14,roughness:.52,metalness:.02});
  const page=new THREE.MeshStandardMaterial({color:0xe9ddc4,roughness:.84});
  const base=new THREE.Mesh(new THREE.BoxGeometry(7.4,.42,4.8),leather);base.position.y=.18;desk.add(base);
  const block=new THREE.Mesh(new THREE.BoxGeometry(7.3,.14,4.68),page);block.position.y=.43;desk.add(block);
  const cover=new THREE.Mesh(new THREE.BoxGeometry(7.45,.1,4.82),leather);cover.position.y=.53;desk.add(cover);
  const rim=new THREE.Mesh(new THREE.BoxGeometry(6.9,.012,4.27),new THREE.MeshStandardMaterial({color:0xaa7144,roughness:.55}));rim.position.y=.59;desk.add(rim);
  const seal=new THREE.Mesh(new THREE.CylinderGeometry(.43,.48,.16,40),new THREE.MeshStandardMaterial({color:0x8e2236,roughness:.28,metalness:.08}));seal.position.set(0,.7,0);desk.add(seal);
  const monogram=document.createElement('canvas');monogram.width=monogram.height=256;const mc=monogram.getContext('2d');mc.fillStyle='#8e2236';mc.beginPath();mc.arc(128,128,120,0,Math.PI*2);mc.fill();mc.strokeStyle='#ee8a3c';mc.lineWidth=8;mc.stroke();mc.fillStyle='#f2b27a';mc.font='italic 150px Georgia';mc.textAlign='center';mc.textBaseline='middle';mc.fillText('M',128,128);
  const initial=new THREE.Mesh(new THREE.CircleGeometry(.39,40),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(monogram)}));initial.rotation.x=-Math.PI/2;initial.position.set(0,.79,0);desk.add(initial);
  const lamp=new THREE.SpotLight(0xffbd7b,24,22,Math.PI/5,.55,1.4);lamp.position.set(-3,8,-2);lamp.target=desk;scene.add(lamp);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=256;const g=glowCanvas.getContext('2d');const gr=g.createRadialGradient(128,128,4,128,128,128);gr.addColorStop(0,'rgba(255,185,107,.26)');gr.addColorStop(.4,'rgba(238,138,60,.10)');gr.addColorStop(1,'rgba(238,138,60,0)');g.fillStyle=gr;g.fillRect(0,0,256,256);
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(13,8),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.set(0,-.09,-.1);scene.add(glow);
}

function buildFoca() {
  living=new THREE.Group();living.position.set(0,1.55,1.0);living.scale.setScalar(1.18);scene.add(living);group=living;
  const fur=new THREE.MeshStandardMaterial({map:spotMap(),roughness:.95});
  const body=new THREE.Mesh(new THREE.SphereGeometry(1,40,32),fur);body.scale.set(1.42,1.06,.86);body.position.y=.05;living.add(body);living.userData.body=body;
  const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.31,24,18),new THREE.MeshStandardMaterial({color:0xb9aa98,roughness:1}));muzzle.scale.set(1.25,.74,.35);muzzle.position.set(0,-.28,.72);living.add(muzzle);
  for(const s of [-1,1]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.33,22,18),fur);ear.scale.set(.8,1,.54);ear.position.set(s*1.14,.68,.05);living.add(ear);}
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.44),new THREE.MeshBasicMaterial({map:glassesMap(),transparent:true,depthWrite:false}));glass.position.set(0,.22,.79);glass.rotation.x=-.05;living.add(glass);living.userData.glass=glass;
  for(const s of [-1,1]){const eye=new THREE.Group();eye.position.set(s*.42,.14,.81);living.add(eye);const white=new THREE.Mesh(new THREE.SphereGeometry(.105,16,12),new THREE.MeshBasicMaterial({color:0xf8eee2}));white.scale.set(1,.88,.52);eye.add(white);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.048,14,10),new THREE.MeshBasicMaterial({color:0x211914}));pupil.position.z=.07;eye.add(pupil);eyes.push({eye,white,pupil,side:s});}
  const finMat=new THREE.MeshStandardMaterial({color:0x796a5d,roughness:.95});for(const s of [-1,1]){const pivot=new THREE.Group();pivot.position.set(s*1.18,-.17,.16);living.add(pivot);const fin=new THREE.Mesh(new THREE.SphereGeometry(.48,22,16),finMat);fin.scale.set(.77,.23,1.05);fin.rotation.z=s*.25;fin.position.set(s*.25,-.12,.1);pivot.add(fin);fins.push({pivot,side:s});}
  const eyeLight=new THREE.PointLight(0xffc98f,3,4);eyeLight.position.set(-2,4,5);scene.add(eyeLight);
}

function buildHolo() {
  const spread=new THREE.Group();spread.position.set(0,.02,.5);scene.add(spread);book=spread;
  const parchment=new THREE.MeshStandardMaterial({color:0xe9ddc4,roughness:.88});
  for(const side of [-1,1]){const p=new THREE.Mesh(new THREE.BoxGeometry(3.3,.12,4.25),parchment);p.position.set(side*1.65,.02,0);spread.add(p);for(let row=0;row<6;row++){const len=row===0?2.15:1.55+(row%3)*.28;const line=new THREE.Mesh(new THREE.BoxGeometry(len,.014,.022),new THREE.MeshBasicMaterial({color:row===0?0x885b3a:0x9c8a70}));line.position.set(side*1.65,.09,-1.25+row*.48);spread.add(line);}}
  const holoGroup=new THREE.Group();holoGroup.position.set(0,.52,.12);holoGroup.scale.setScalar(innerWidth<700?2:1);spread.add(holoGroup);group=holoGroup;
  const mats=[0,1,2,3].map(i=>new THREE.MeshBasicMaterial({map:uiTexture(i),transparent:true,opacity:.78,side:THREE.DoubleSide,depthWrite:false}));
  for(let i=0;i<4;i++){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3.65,2.3),mats[i]);mesh.position.set((i-1.5)*.035,.05+i*.02,-.08-i*.055);mesh.rotation.x=-.48+i*.025;mesh.userData={index:i,baseY:.05+i*.02,baseZ:-.08-i*.055,baseX:(i-1.5)*.035};layers.push(mesh);holoGroup.add(mesh);}
  const scanCanvas=document.createElement('canvas');scanCanvas.width=2;scanCanvas.height=8;const ctx=scanCanvas.getContext('2d');ctx.clearRect(0,0,2,8);ctx.fillStyle='rgba(255,204,143,.28)';ctx.fillRect(0,0,2,1);
  const scan=new THREE.Mesh(new THREE.PlaneGeometry(4.2,2.58),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(scanCanvas),transparent:true,opacity:.3,depthWrite:false}));scan.position.set(0,.3,.2);scan.rotation.x=-.16;holoGroup.add(scan);
  const rim=new THREE.PointLight(0xffa356,8,12);rim.position.set(0,3,3);scene.add(rim);
}

async function loadScene() {
  if(renderer || reduced && moment==='sketch') return;
  try {
    THREE=await import(THREE_URL);
    const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
    renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<700?1:1.25));renderer.setSize(w,h,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(36,w/h,.1,80);
    cameraStart=new THREE.Vector3(0,innerWidth<700?29:16,2);cameraEnd=new THREE.Vector3(0,innerWidth<700?(moment==='foca'?17:25):11,innerWidth<700?(moment==='foca'?15:18):7.7);
    camera.position.copy(moment==='sketch'?cameraStart:cameraEnd);camera.lookAt(0,0,0);
    scene.add(new THREE.HemisphereLight(0xffe0bf,0x21120f,1.3));const key=new THREE.DirectionalLight(0xffc98c,1.8);key.position.set(-5,9,6);scene.add(key);
    if(moment==='sketch') buildSketchScene();else if(moment==='foca') buildFoca();else buildHolo();
    clock=new THREE.Clock();
    const ro=new ResizeObserver(()=>{if(!renderer)return;const nw=Math.max(1,stage.clientWidth),nh=Math.max(1,stage.clientHeight);renderer.setSize(nw,nh,false);camera.aspect=nw/nh;if(moment==='sketch'){cameraStart.set(0,innerWidth<700?29:16,2);cameraEnd.set(0,innerWidth<700?25:11,innerWidth<700?18:7.7);}else camera.position.set(0,innerWidth<700?(moment==='foca'?17:25):11,innerWidth<700?(moment==='foca'?15:18):7.7);if(moment==='holo'&&group)group.scale.setScalar(innerWidth<700?2:1);camera.updateProjectionMatrix();});ro.observe(stage);
    document.addEventListener('visibilitychange',()=>{if(document.hidden) renderer?.setAnimationLoop(null);else renderer?.setAnimationLoop(render);});
    renderer.setAnimationLoop(render);
    if(moment!=='sketch'){canvas.style.opacity='1';const posterMascot=document.querySelector('.poster-mascot'),posterHologram=document.querySelector('.poster-hologram');if(posterMascot)posterMascot.style.opacity='0';if(posterHologram)posterHologram.style.opacity='0';}
    window.__visionReady=true;
  } catch (error) {
    stage.dataset.fallback='true';window.__visionFallback=String(error?.message||error);console.warn('3D scene stayed on its poster.',error?.message||error);
  }
}

function smooth(a,b,t){t=Math.max(0,Math.min(1,t));return a+(b-a)*(t*t*(3-2*t));}
function render() {
  if(!renderer)return;
  const now=performance.now(),dt=Math.min(clock.getDelta(),.05),time=(now-started)/1000;
  if(moment==='foca'&&living){
    const stiffness=170,damping=26;const ax=(pointer.x-follow.x)*stiffness-follow.vx*damping;follow.vx=(follow.vx||0)+ax*dt;follow.x+=follow.vx*dt;const ay=(pointer.y-follow.y)*stiffness-follow.vy*damping;follow.vy=(follow.vy||0)+ay*dt;follow.y+=follow.vy*dt;
    living.rotation.y=follow.x*.12;living.rotation.x=-follow.y*.08;living.position.y=1.55+Math.sin(time*Math.PI/2)*.012+focaLift;
    living.userData.body.scale.y=1.06*(1+.0075*(1+Math.sin(time*Math.PI/2)));
    focaLift+=(focaLiftTarget-focaLift)*Math.min(1,dt*12);
    for(const {pupil} of eyes){pupil.position.x=follow.x*.035;pupil.position.y=follow.y*.025;pupil.position.z=.07;}
    if(now>blinkAt&&!blinkStart){blinkStart=now;blinkAt=now+2000+Math.random()*4000;}
    const blink=blinkStart?Math.max(0,1-Math.abs(now-blinkStart-95)/95):0;if(blinkStart&&now-blinkStart>210)blinkStart=0;
    for(const {white} of eyes)white.scale.y=.88*(1-.93*blink);
    if(clapStart){const p=Math.min(1,(now-clapStart)/620),raise=smooth(0,1,Math.min(1,p*2))*(1-smooth(0,1,Math.max(0,(p-.57)/.43)));for(const {pivot,side} of fins)pivot.rotation.z=side*(-.12-.7*raise);living.userData.glass.position.y=.22+.07*raise;if(p>=1){clapStart=0;living.userData.glass.position.y=.22;for(const {pivot} of fins)pivot.rotation.z=0;}}
  }
  if(moment==='holo'&&group){const spread=activated?1:0;group.rotation.x=pointer.y*.045;group.rotation.y=pointer.x*.06;for(const l of layers){const i=l.userData.index;l.position.x=smooth(l.userData.baseX,l.userData.baseX+(i-1.5)*.11,spread);l.position.y=smooth(l.userData.baseY,l.userData.baseY+.5+i*.18,spread);l.position.z=smooth(l.userData.baseZ,l.userData.baseZ+.12+i*.12,spread);l.material.opacity=smooth(.5,.88,spread);l.rotation.z=smooth(0,(i-1.5)*.018,spread);}}
  if(moment==='sketch'&&book){const t=Math.max(0,Math.min(1,(story-.72)/.28));camera.position.lerpVectors(cameraStart,cameraEnd,smooth(0,1,t));camera.lookAt(0,0,0);book.rotation.y=.02*Math.sin(time*.22)*t;}
  renderer.render(scene,camera);
}

if(moment==='sketch'){
  const storyEl=document.querySelector('#story');
  const update=()=>{const r=storyEl.getBoundingClientRect(),span=storyEl.offsetHeight-innerHeight;setStory(span>0?Math.max(0,Math.min(1,-r.top/span)):0);};
  addEventListener('scroll',update,{passive:true});addEventListener('resize',update);update();
  document.querySelector('#play').addEventListener('click',()=>{if(reduced){setStory(1);return;}playing=true;const from=story;const began=performance.now();const tick=now=>{if(!playing)return;const p=Math.min(1,(now-began)/6200);setStory(from+(1-from)*p);if(p<1)requestAnimationFrame(tick);else playing=false;};requestAnimationFrame(tick);});
} else {
  if(moment==='foca'){
    stage.addEventListener('pointermove',e=>{const r=stage.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width-.5)*2;pointer.y=((e.clientY-r.top)/r.height-.5)*2;},{passive:true});
    stage.addEventListener('pointerleave',()=>{pointer.x=0;pointer.y=0;});
    document.querySelector('#play').addEventListener('click',()=>{clapStart=performance.now();focaLiftTarget=.09;setTimeout(()=>focaLiftTarget=0,180);});
  } else {
    stage.addEventListener('pointermove',e=>{const r=stage.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width-.5)*2;pointer.y=((e.clientY-r.top)/r.height-.5)*2;activated=e.clientX>r.left+r.width*.2&&e.clientX<r.right-r.width*.2&&e.clientY>r.top+r.height*.3&&e.clientY<r.top+r.height*.78;},{passive:true});stage.addEventListener('pointerleave',()=>{activated=false;pointer.x=0;pointer.y=0;},{passive:true});
    const control=document.querySelector('#play');control.addEventListener('click',()=>{activated=!activated;control.setAttribute('aria-pressed',String(activated));control.textContent=activated?'Lay it back':'Lift the project';});
    control.addEventListener('focus',()=>{activated=true;control.setAttribute('aria-pressed','true');});control.addEventListener('blur',()=>{activated=false;control.setAttribute('aria-pressed','false');});
  }
  if(!reduced)requestAnimationFrame(()=>requestAnimationFrame(loadScene));
}
