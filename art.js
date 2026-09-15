/* Century: Spice Road — procedural art: 3D cubes, reeded coins, card faces (landscape vignettes for point
   cards, merchant portraits for merchant cards), card backs, table props. Deterministic per card id. */
(function(root){
'use strict';
const {SP,cubesTxt}=Engine;
/* ================================================================
   ART — procedural card faces, cubes, coins (deterministic per card id)
   ================================================================ */
const CUBE={Y:['#F5D35A','#DCA61C','#A6790C'],R:['#E86A4F','#C43A2A','#8C2519'],G:['#6BB878','#3E8A4E','#265A33'],B:['#956040','#6B3A1F','#452412']};
function cubeSym(k){const[t,l,r]=CUBE[k];return `<symbol id="c${k}" viewBox="0 0 20 20"><polygon points="10,1.5 18.5,6 10,10.5 1.5,6" fill="${t}"/><polygon points="1.5,6 10,10.5 10,19 1.5,14.5" fill="${l}"/><polygon points="10,10.5 18.5,6 18.5,14.5 10,19" fill="${r}"/><polyline points="1.5,6 10,10.5 18.5,6" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".6"/><line x1="10" y1="10.5" x2="10" y2="19" stroke="#000" stroke-opacity=".25" stroke-width=".6"/></symbol>`}
function coinSym(id,c){ // c: [hi, mid, lo, rim]
  const star=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4,b=a+Math.PI/8;return `${50+Math.cos(a)*22},${50+Math.sin(a)*22} ${50+Math.cos(b)*9},${50+Math.sin(b)*9}`}).join(' ');
  const dots=Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return `<circle cx="${50+Math.cos(a)*40}" cy="${50+Math.sin(a)*40}" r="1.3" fill="${c[3]}" opacity=".8"/>`}).join('');
  return `<radialGradient id="g${id}" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="${c[0]}"/><stop offset=".5" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></radialGradient>
  <symbol id="${id}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="49" fill="${c[2]}"/><circle cx="50" cy="50" r="47" fill="url(#g${id})"/>
  <circle cx="50" cy="50" r="46" fill="none" stroke="${c[3]}" stroke-width="2.5" stroke-dasharray="1.8 1.8" opacity=".9"/>
  <circle cx="50" cy="50" r="35" fill="none" stroke="${c[3]}" stroke-width="1.2" opacity=".8"/><circle cx="50" cy="50" r="33" fill="none" stroke="${c[0]}" stroke-width=".8" opacity=".7"/>
  ${dots}<polygon points="${star}" fill="${c[3]}" opacity=".85"/><polygon points="${star}" fill="none" stroke="${c[0]}" stroke-width=".8" opacity=".6"/><circle cx="50" cy="50" r="5" fill="${c[0]}" opacity=".9"/>
  <ellipse cx="38" cy="30" rx="16" ry="8" fill="#fff" opacity=".18" transform="rotate(-35 38 30)"/></symbol>`;
}
document.getElementById('defs').innerHTML=
  SP.map(cubeSym).join('')+coinSym('coinG',['#FFF3C4','#DDAE3E','#7A5210','#8A5E12'])+coinSym('coinS',['#FFFFFF','#CDD2D8','#5F656E','#7B818A'])+
  `<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7E3A1"/><stop offset=".3" stop-color="#C9962B"/><stop offset=".55" stop-color="#F4DC8C"/><stop offset=".8" stop-color="#B07F22"/><stop offset="1" stop-color="#8A5E12"/></linearGradient>
   <linearGradient id="parch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3E5C5"/><stop offset="1" stop-color="#DFC79A"/></linearGradient>
   <linearGradient id="leather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A2C1B"/><stop offset="1" stop-color="#2B1810"/></linearGradient>
   <linearGradient id="plum" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4E2F5C"/><stop offset="1" stop-color="#2E1A38"/></linearGradient>
   <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .18 0"/></filter>
   <pattern id="lattice" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M6 0 L12 6 L6 12 L0 6 Z" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1"/><circle cx="6" cy="6" r="1" fill="#fff" fill-opacity=".15"/></pattern>`;

const cube=(k,cls='')=>`<svg class="cube ${cls}" viewBox="0 0 20 20"><use href="#c${k}"/></svg>`;
const coin=(g,cls='')=>`<svg class="coin ${cls}" viewBox="0 0 100 100"><use href="#coin${g?'G':'S'}"/></svg>`;
function cubesHTML(arr,lg){let h='';arr.forEach((n,i)=>{for(let k=0;k<n;k++)h+=cube(SP[i],lg?'lg':'')});return h}
function cubesSVG(arr,cx,cy,size,gap){ // centered row in an svg
  const list=[];arr.forEach((n,i)=>{for(let k=0;k<n;k++)list.push(SP[i])});
  const w=list.length*size+(list.length-1)*gap;let x=cx-w/2;
  return list.map(k=>{const s=`<use href="#c${k}" x="${x}" y="${cy-size/2}" width="${size}" height="${size}"/>`;x+=size+gap;return s}).join('');
}
function rng(seed){let a=0;for(const ch of String(seed))a=(a*31+ch.charCodeAt(0))>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const pick=(r,arr)=>arr[Math.floor(r()*arr.length)];

// ---- point card: landscape vignette + gold medallion + cost band
const PALS=[
 {sky:['#F6C27A','#E8844A'],sun:'#FFF1B0',far:'#B4553A',mid:'#7A2E24',near:'#3F1710',water:'#E9A15E'},
 {sky:['#7FB4D8','#EAD9B0'],sun:'#FFFBE6',far:'#8EA9A0',mid:'#4E6B5E',near:'#2D3A2A',water:'#6FA3C4'},
 {sky:['#3A2A6B','#E6704B'],sun:'#FFD27A',far:'#6B2F5A',mid:'#3C1740',near:'#1C0B22',water:'#B8557A'},
 {sky:['#0E1A3C','#2B3F7A'],sun:'#F4F1D6',far:'#22355F',mid:'#131F3C',near:'#080E1F',water:'#1E3A6B',night:true},
 {sky:['#F1D9A8','#D89A5C'],sun:'#FFF6CC',far:'#C2865A',mid:'#8E5A3A',near:'#4E2E1C',water:'#8FB5B0'},
];
const artCache=new Map();
function scene(seed){
  if(artCache.has('s'+seed))return artCache.get('s'+seed);
  const r=rng(seed),p=pick(r,PALS),id='sc'+seed.replace(/\W/g,'');
  const X=8,Y=8,W=104,H=92,B=Y+H; // illustration box
  let s=`<defs><linearGradient id="${id}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient><clipPath id="${id}c"><rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="3"/></clipPath></defs><g clip-path="url(#${id}c)"><rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="url(#${id}k)"/>`;
  if(p.night)for(let i=0;i<22;i++)s+=`<circle cx="${X+r()*W}" cy="${Y+r()*50}" r="${.4+r()*.6}" fill="#fff" opacity="${.5+r()*.5}"/>`;
  const sx=X+20+r()*64,sy=Y+18+r()*22;
  s+=`<circle cx="${sx}" cy="${sy}" r="16" fill="${p.sun}" opacity=".18"/><circle cx="${sx}" cy="${sy}" r="${p.night?6:8}" fill="${p.sun}" opacity=".95"/>`;
  // far hills / dunes
  const hills=(base,amp,col)=>{let d=`M${X} ${base}`;for(let x=X;x<=X+W;x+=13)d+=` Q${x+6} ${base-amp*(.4+r())} ${x+13} ${base-amp*(.2+r()*.5)}`;return`<path d="${d} L${X+W} ${B} L${X} ${B}Z" fill="${col}"/>`};
  s+=hills(Y+58,12,p.far);
  const type=pick(r,['city','pyramids','harbor','oasis','fortress','temple']);
  const g=B-16; // ground line
  const m=p.mid,n=p.near;
  if(type==='harbor'||type==='oasis'){s+=hills(Y+66,8,m)}
  if(type==='city'){
    let x=X-4;while(x<X+W+4){const w=8+r()*12,h=12+r()*22;s+=`<rect x="${x}" y="${g-h}" width="${w}" height="${h+2}" fill="${m}"/>`;
      if(r()<.5)s+=`<path d="M${x} ${g-h} a${w/2} ${w/2} 0 0 1 ${w} 0Z" fill="${m}"/>`;
      if(r()<.35){const mx=x+w-2;s+=`<rect x="${mx}" y="${g-h-16}" width="2.4" height="18" fill="${m}"/><circle cx="${mx+1.2}" cy="${g-h-17}" r="1.6" fill="${m}"/>`}
      x+=w+2+r()*4}
    s+=`<rect x="${X}" y="${g}" width="${W}" height="18" fill="${n}"/>`;
    for(let i=0;i<3;i++){const px=X+10+r()*84;s+=palm(px,g+2,n)}
  }else if(type==='pyramids'){
    const k=2+Math.floor(r()*2);for(let i=0;i<k;i++){const px=X+14+i*36+r()*10,h=22+r()*20,w=h*1.6;s+=`<polygon points="${px-w/2},${g+2} ${px},${g-h} ${px+w/2},${g+2}" fill="${m}"/><polygon points="${px},${g-h} ${px+w/2},${g+2} ${px+w*.1},${g+2}" fill="${n}" opacity=".7"/>`}
    s+=`<path d="M${X} ${g} Q${X+30} ${g-4} ${X+60} ${g} T${X+W} ${g} L${X+W} ${B} L${X} ${B}Z" fill="${n}"/>`;
    s+=palm(X+12+r()*20,g+3,n)+`<path d="M${X+70} ${g+8} q6 -6 12 0" stroke="${m}" stroke-width="1.2" fill="none"/>`;
  }else if(type==='harbor'){
    s+=`<rect x="${X}" y="${g-6}" width="${W}" height="24" fill="${p.water}"/>`;
    for(let i=0;i<6;i++)s+=`<rect x="${X+r()*W}" y="${g-4+r()*14}" width="${4+r()*12}" height=".8" fill="#fff" opacity=".35"/>`;
    for(let i=0;i<3;i++){const bx=X+14+i*34+r()*8,by=g-2+r()*8;s+=`<path d="M${bx-9} ${by} L${bx+9} ${by} L${bx+6} ${by+4} L${bx-6} ${by+4}Z" fill="${n}"/><polygon points="${bx},${by-1} ${bx},${by-15} ${bx+8},${by-2}" fill="${p.sun}" opacity=".9"/><rect x="${bx-.5}" y="${by-16}" width="1" height="16" fill="${n}"/>`}
    s+=`<rect x="${X+W-18}" y="${g-30}" width="6" height="26" fill="${m}"/><polygon points="${X+W-20},${g-30} ${X+W-15},${g-38} ${X+W-10},${g-30}" fill="${m}"/><circle cx="${X+W-15}" cy="${g-28}" r="1.6" fill="${p.sun}"/>`;
  }else if(type==='oasis'){
    s+=`<ellipse cx="${X+W/2}" cy="${g+6}" rx="34" ry="7" fill="${p.water}"/><rect x="${X}" y="${g+10}" width="${W}" height="10" fill="${n}"/>`;
    for(let i=0;i<5;i++)s+=palm(X+8+r()*88,g+4-r()*4,i<2?m:n);
    for(let i=0;i<2;i++){const tx=X+20+r()*70;s+=`<polygon points="${tx-8},${g+2} ${tx},${g-8} ${tx+8},${g+2}" fill="${m}"/>`}
  }else if(type==='fortress'){
    const wy=g-16;s+=`<rect x="${X}" y="${wy}" width="${W}" height="20" fill="${m}"/>`;
    for(let x=X;x<X+W;x+=8)s+=`<rect x="${x}" y="${wy-4}" width="4" height="5" fill="${m}"/>`;
    for(let i=0;i<3;i++){const tx=X+10+i*40+r()*6,h=26+r()*10;s+=`<rect x="${tx-6}" y="${g-h}" width="12" height="${h+4}" fill="${m}"/><rect x="${tx-7}" y="${g-h-3}" width="14" height="4" fill="${m}"/><polygon points="${tx-1},${g-h-3} ${tx-1},${g-h-12} ${tx+6},${g-h-9}" fill="${p.sun}" opacity=".85"/>`}
    s+=`<path d="M${X+W/2-6} ${g+4} a6 6 0 0 1 12 0 v${B-g}h-12Z" fill="${n}"/><rect x="${X}" y="${g+4}" width="${W}" height="14" fill="${n}"/>`;
  }else{ // temple
    const tx=X+W/2,tw=56,th=26;
    s+=`<rect x="${tx-tw/2-4}" y="${g-2}" width="${tw+8}" height="6" fill="${m}"/><polygon points="${tx-tw/2-3},${g-th} ${tx},${g-th-12} ${tx+tw/2+3},${g-th}" fill="${m}"/>`;
    for(let i=0;i<6;i++){const cx=tx-tw/2+4+i*(tw-8)/5;s+=`<rect x="${cx-2}" y="${g-th+1}" width="4" height="${th-3}" fill="${m}"/>`}
    s+=`<rect x="${tx-tw/2-3}" y="${g-th}" width="${tw+6}" height="2" fill="${m}"/><rect x="${X}" y="${g+4}" width="${W}" height="14" fill="${n}"/>`;
    s+=palm(X+10,g+4,n)+palm(X+W-12,g+4,n);
  }
  s+=`<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="url(#lattice)" opacity=".25"/></g>`;
  artCache.set('s'+seed,s);return s;
}
function palm(x,y,c){return `<path d="M${x} ${y} q1 -12 3 -22" stroke="${c}" stroke-width="1.4" fill="none"/>`+[ -1,-.5,.2,.8,1.3 ].map(a=>`<path d="M${x+3} ${y-22} q${a*8} -3 ${a*11} 4" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`).join('')}
function frame(tint){ // ornate double frame with corner ornaments
  const corner=(x,y,sx,sy)=>`<g transform="translate(${x} ${y}) scale(${sx} ${sy})"><path d="M0 0 h10 q-6 1 -8 5 q-1 -4 -2 -5 M0 0 v10 q1 -6 5 -8" fill="none" stroke="url(#gold)" stroke-width="1.4"/><circle cx="3" cy="3" r="1.4" fill="url(#gold)"/></g>`;
  return `<rect x="1" y="1" width="118" height="166" rx="7" fill="${tint}"/><rect x="3.5" y="3.5" width="113" height="161" rx="5" fill="none" stroke="url(#gold)" stroke-width="1.6"/><rect x="6" y="6" width="108" height="156" rx="3.5" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".6"/>`+
    corner(5,5,1,1)+corner(115,5,-1,1)+corner(5,163,1,-1)+corner(115,163,-1,-1);
}
function pointFace(pc){
  const key='pf'+pc.id;if(artCache.has(key))return artCache.get(key);
  const bandY=108;
  const svg=`<svg class="face" viewBox="0 0 120 168" role="img" aria-label="${pc.pts} points for ${cubesTxt(pc.cost)}">
   ${frame('#C8642A')}
   <rect x="7" y="7" width="106" height="98" rx="3" fill="#E8D6AE"/>
   ${scene(pc.id)}
   <rect x="8" y="8" width="104" height="92" rx="3" fill="none" stroke="#3B1F10" stroke-width="1"/>
   <path d="M20 12 h80 l6 8 l-6 8 h-80 l6 -8Z" fill="#7A2318" opacity=".9"/><path d="M20 12 h80 l6 8 l-6 8 h-80 l6 -8Z" fill="none" stroke="url(#gold)" stroke-width="1"/>
   <circle cx="60" cy="20" r="15" fill="#2B1810"/><circle cx="60" cy="20" r="14" fill="url(#gold)"/><circle cx="60" cy="20" r="11" fill="#3B1F10"/><circle cx="60" cy="20" r="11" fill="none" stroke="#F4DC8C" stroke-width=".6" opacity=".8"/>
   <text x="60" y="25.5" text-anchor="middle" font-family="Cinzel,Marcellus,serif" font-weight="800" font-size="15" fill="#F4DC8C">${pc.pts}</text>
   <rect x="7" y="${bandY}" width="106" height="52" rx="3" fill="url(#leather)"/><rect x="9.5" y="${bandY+2.5}" width="101" height="47" rx="2" fill="none" stroke="url(#gold)" stroke-width=".9" opacity=".9"/>
   <rect x="7" y="${bandY}" width="106" height="52" rx="3" fill="url(#lattice)" opacity=".5"/>
   ${cubesSVG(pc.cost,60,bandY+26,15,2.5)}
   <rect x="1" y="1" width="118" height="166" rx="7" filter="url(#grain)" opacity=".5" pointer-events="none"/>
  </svg>`;
  artCache.set(key,svg);return svg;
}
// ---- merchant card: portrait + function band
const SKIN=['#F1C9A5','#D9A276','#B87A50','#8D5A3B','#5E3A26'];
const CLOTH=['#8A2E2A','#2F5D8A','#3E7A55','#6B3E8C','#B36A1F','#274E4B','#7C2B5A','#4A4A8A'];
function portrait(seed,bg){
  const key='pt'+seed;if(artCache.has(key))return artCache.get(key);
  const r=rng(seed),id='po'+seed.replace(/\W/g,'');
  const skin=pick(r,SKIN),robe=pick(r,CLOTH),cloth2=pick(r,CLOTH),hair=pick(r,['#1E1410','#3B2A1E','#5A4032','#8A7A6A','#D9D2C4']);
  const head=pick(r,['turban','fez','hood','scarf','cap','bare']);const beard=r()<.55;const female=head==='scarf'||(head==='bare'&&r()<.5);
  let s=`<defs><radialGradient id="${id}b" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></radialGradient><clipPath id="${id}c"><rect x="8" y="8" width="104" height="90" rx="3"/></clipPath></defs>
  <g clip-path="url(#${id}c)"><rect x="8" y="8" width="104" height="90" fill="url(#${id}b)"/>
  <path d="M28 98 V52 a32 32 0 0 1 64 0 V98Z" fill="#000" opacity=".16"/><path d="M31 98 V52 a29 29 0 0 1 58 0 V98Z" fill="none" stroke="url(#gold)" stroke-width="1" opacity=".7"/>`;
  // shoulders/robe
  s+=`<path d="M22 100 Q24 70 46 64 L60 70 L74 64 Q96 70 98 100Z" fill="${robe}"/><path d="M46 64 L60 70 L74 64 L70 100 L50 100Z" fill="${cloth2}" opacity=".8"/><path d="M60 70 L64 100 L56 100Z" fill="url(#gold)" opacity=".8"/>`;
  s+=`<path d="M22 100 Q24 70 46 64 L52 78 L40 100Z" fill="#000" opacity=".15"/>`;
  // neck & head
  s+=`<rect x="54" y="52" width="12" height="14" rx="3" fill="${skin}"/><path d="M54 58 h12 v6 a6 3 0 0 1 -12 0Z" fill="#000" opacity=".2"/>`;
  s+=`<ellipse cx="60" cy="44" rx="12.5" ry="14.5" fill="${skin}"/>`;
  if(!beard||female){}else s+=`<path d="M49 46 q1 16 11 18 q10 -2 11 -18 q-4 10 -11 10 q-7 0 -11 -10Z" fill="${hair}"/>`;
  // hair
  if(head==='bare'||head==='cap')s+=`<path d="M47.5 42 q0 -14 12.5 -14 q12.5 0 12.5 14 q-3 -7 -12.5 -7 q-9.5 0 -12.5 7Z" fill="${hair}"/>`;
  if(female)s+=`<path d="M47.5 44 q-3 12 0 22 q4 -6 3 -18Z M72.5 44 q3 12 0 22 q-4 -6 -3 -18Z" fill="${hair}"/>`;
  // face features
  s+=`<ellipse cx="55.5" cy="43" rx="1.3" ry="1.6" fill="#1E1410"/><ellipse cx="64.5" cy="43" rx="1.3" ry="1.6" fill="#1E1410"/><path d="M53 39.5 q2.5 -1.5 5 0 M62 39.5 q2.5 -1.5 5 0" stroke="${hair}" stroke-width="1" fill="none"/><path d="M58.5 51 q1.5 1 3 0" stroke="#7A3A2A" stroke-width=".9" fill="none"/><path d="M60 44 q1.5 3 0 5" stroke="#000" stroke-opacity=".2" stroke-width=".8" fill="none"/>`;
  if(r()<.5)s+=`<circle cx="72" cy="48" r="1.4" fill="url(#gold)"/>`;
  // headwear
  if(head==='turban')s+=`<ellipse cx="60" cy="33" rx="16" ry="9.5" fill="${cloth2}"/><path d="M44 33 q8 -6 16 -3 q8 -3 16 3 q-8 -1 -16 2 q-8 -3 -16 -2Z" fill="#000" opacity=".2"/><path d="M45 34 q15 8 30 0" stroke="url(#gold)" stroke-width="1.4" fill="none"/><circle cx="60" cy="28" r="2.4" fill="url(#gold)"/><circle cx="60" cy="28" r="1.1" fill="#7A2318"/>`;
  else if(head==='fez')s+=`<path d="M49 34 l2 -12 h18 l2 12Z" fill="#A72A1E"/><ellipse cx="60" cy="22" rx="9" ry="2.2" fill="#C43A2A"/><path d="M69 23 q4 3 3 9" stroke="#1E1410" stroke-width="1" fill="none"/>`;
  else if(head==='hood')s+=`<path d="M40 60 q-4 -32 20 -34 q24 2 20 34 q-8 -22 -20 -22 q-12 0 -20 22Z" fill="${robe}"/><path d="M44 56 q0 -22 16 -24 q16 2 16 24" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1"/>`;
  else if(head==='scarf')s+=`<path d="M45 42 q0 -16 15 -16 q15 0 15 16 q-2 -8 -15 -8 q-13 0 -15 8Z" fill="${cloth2}"/><path d="M45 42 q-3 14 2 24 M75 42 q3 14 -2 24" stroke="${cloth2}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M48 31 q12 -4 24 0" stroke="url(#gold)" stroke-width="1.2" fill="none"/>`;
  else if(head==='cap')s+=`<path d="M47 36 q13 -14 26 0Z" fill="${cloth2}"/><path d="M47 36 h26" stroke="url(#gold)" stroke-width="1.2"/>`;
  s+=`<rect x="8" y="8" width="104" height="90" fill="url(#lattice)" opacity=".18"/></g>`;
  artCache.set(key,s);return s;
}
const MBG=[['#7A4A2A','#2E1A0E'],['#5C3A6E','#22122B'],['#3F6F6B','#122624'],['#8A5A22','#3A2410'],['#6B2E3A','#2A1016'],['#345A8A','#101E33']];
function merchantFace(c,starter){
  const key='mf'+c.id;if(artCache.has(key))return artCache.get(key);
  const r=rng(c.id),bg=pick(r,MBG);
  let band='';const by=102;
  if(c.type==='spice'){band=`<text x="60" y="${by+12}" text-anchor="middle" font-family="Cinzel,serif" font-size="7" letter-spacing="1.5" fill="#F4DC8C">SPICE</text>${cubesSVG(c.gain,60,by+34,16,3)}`}
  else if(c.type==='trade'){band=`${cubesSVG(c.inp,60,by+13,13,2)}<path d="M52 ${by+25} h16 v6 h5 l-13 9 l-13 -9 h5Z" fill="url(#gold)"/>${cubesSVG(c.out,60,by+50,13,2)}`}
  else{band=`<path d="M52 ${by+40} h16 v-14 h6 l-14 -13 l-14 13 h6Z" fill="url(#gold)"/><text x="60" y="${by+53}" text-anchor="middle" font-family="Cinzel,serif" font-weight="800" font-size="13" fill="#F4DC8C">UPGRADE ${c.n}</text>`+
    Array.from({length:c.n},(_,i)=>`<circle cx="${60-(c.n-1)*6+i*12}" cy="${by+10}" r="3.2" fill="none" stroke="#F4DC8C" stroke-width="1.2"/>`).join('')}
  const label=c.type==='spice'?`Spice card: gain ${cubesTxt(c.gain)}`:c.type==='trade'?`Trade ${cubesTxt(c.inp)} for ${cubesTxt(c.out)}`:`Upgrade ${c.n}`;
  const svg=`<svg class="face" viewBox="0 0 120 168" role="img" aria-label="${label}">
   ${frame(starter?'#5B3A7A':'#3B2545')}
   <rect x="7" y="7" width="106" height="92" rx="3" fill="#2B1810"/>
   ${portrait(c.id,bg)}
   <rect x="8" y="8" width="104" height="90" rx="3" fill="none" stroke="#1A0E12" stroke-width="1"/>
   <rect x="7" y="${by}" width="106" height="58" rx="3" fill="url(#plum)"/><rect x="9.5" y="${by+2.5}" width="101" height="53" rx="2" fill="none" stroke="url(#gold)" stroke-width=".9" opacity=".9"/>
   <rect x="7" y="${by}" width="106" height="58" rx="3" fill="url(#lattice)" opacity=".35"/>
   ${band}
   <rect x="1" y="1" width="118" height="166" rx="7" filter="url(#grain)" opacity=".45" pointer-events="none"/>
  </svg>`;
  artCache.set(key,svg);return svg;
}
function cardBack(kind){ // 'pt' orange · 'mc' purple
  const c=kind==='pt'?['#C8642A','#7A3512']:['#5E3A78','#2E1A38'];
  return `<svg viewBox="0 0 120 168"><defs><linearGradient id="bk${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs>
   <rect x="1" y="1" width="118" height="166" rx="7" fill="url(#bk${kind})"/><rect x="1" y="1" width="118" height="166" rx="7" fill="url(#lattice)" opacity=".7"/>
   <rect x="5" y="5" width="110" height="158" rx="5" fill="none" stroke="url(#gold)" stroke-width="1.6"/><rect x="9" y="9" width="102" height="150" rx="3" fill="none" stroke="url(#gold)" stroke-width=".6" opacity=".7"/>
   <circle cx="60" cy="78" r="26" fill="none" stroke="url(#gold)" stroke-width="1.4"/><circle cx="60" cy="78" r="21" fill="none" stroke="url(#gold)" stroke-width=".7"/>
   <polygon points="${Array.from({length:16},(_,i)=>{const a=i*Math.PI/8,rr=i%2?7:17;return `${60+Math.cos(a)*rr},${78+Math.sin(a)*rr}`}).join(' ')}" fill="url(#gold)"/><circle cx="60" cy="78" r="4" fill="${c[1]}"/>
   <text x="60" y="118" text-anchor="middle" font-family="Cinzel,serif" font-size="7.5" letter-spacing="2.5" fill="#F4DC8C" opacity=".85">${kind==='pt'?'POINT CARDS':'MERCHANTS'}</text>
   <rect x="1" y="1" width="118" height="166" rx="7" filter="url(#grain)" opacity=".4"/></svg>`;
}
const camelSVG=`<svg class="camel" viewBox="0 0 160 60"><path d="M6 52 h8 l4 -18 q6 -8 14 -6 l6 4 q10 -10 30 -8 q14 -14 26 -8 q6 -8 8 -20 l6 2 l2 10 q10 6 8 20 l16 0 l4 22 h-8 l-6 -14 l-8 0 l-2 14 h-8 l0 -14 q-14 6 -30 2 l-2 12 h-8 l0 -14 q-10 2 -14 -2 l-6 16 h-8 l2 -18 l-6 6 l-4 12Z" fill="#2B1B12"/></svg>`;
const bowlSVG=k=>`<svg viewBox="0 0 44 34"><ellipse cx="22" cy="28" rx="19" ry="4" fill="#000" opacity=".35"/><path d="M4 16 q18 -4 36 0 l-5 12 q-13 4 -26 0Z" fill="#6E4A2E"/><path d="M4 16 q18 -4 36 0 q-18 5 -36 0Z" fill="#8A6240"/>${[[14,12],[22,9],[30,12],[18,14],[26,14],[22,16]].map(([x,y])=>`<use href="#c${k}" x="${x-5}" y="${y-5}" width="10" height="10"/>`).join('')}</svg>`;


root.Art={cube,coin,cubesHTML,cubesSVG,pointFace,merchantFace,cardBack,camelSVG,bowlSVG};
})(window);
