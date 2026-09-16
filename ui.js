/* Century: Spice Road — table UI: rendering, this device's interaction, animations, menus, persistence, boot.
   Depends on engine.js (rules), art.js (card faces), net.js (S, UI, NET and online play). */
'use strict';
const {SP,SPNAME,total,value,canAfford,tradeMax,cheapest,cubesTxt,score,coinForSlot}=Engine;
const {cube,coin,cubesHTML,pointFace,merchantFace,cardBack,camelSVG,bowlSVG}=Art;
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LEVELS={easy:'Easy',normal:'Normal',hard:'Hard'};
const BOT_NAMES=['Amira','Bashir','Cyra','Darius','Esen'];

/* ================================================================
   GAME FLOW
   ================================================================ */
function newGame(cfg){S=Engine.makeGame(cfg);UI={mode:'idle'};Anim.prev=null;afterChange()}
function afterChange(){save();render();broadcastState();maybeAI()}
const cur=()=>S.players[S.cur];
const controls=p=>!p.ai&&(NET.mode==='local'||p.owner===NET.myId);
const viewSeat=()=>NET.mode==='online'&&NET.mySeat!=null?NET.mySeat:S.cur;
function myTurn(){const s=viewSeat();return !S.over&&S.cur===s&&controls(S.players[s])}
function dispatch(a){
  UI={mode:'idle'};
  if(NET.role==='guest'){if(NET.host&&NET.host.open)NET.host.send({t:'act',a});else toast('Not connected to the host.');render();return}
  const err=Engine.applyAction(S,viewSeat(),a);if(err)toast(err);afterChange();
}
let aiTimer=null;
function maybeAI(){ // bots run on the host / local device only
  if(!S||S.over||NET.role==='guest')return;const p=cur();if(!p.ai)return;
  clearTimeout(aiTimer);const seat=S.cur,game=S;
  aiTimer=setTimeout(()=>{if(S!==game||S.over||S.cur!==seat||!cur().ai)return;
    const a=Engine.aiChoose(S,seat,p.level);const err=a?Engine.applyAction(S,seat,a):'no move';
    if(err){console.warn('bot move rejected',err,a);Engine.applyAction(S,seat,{k:'rest'})}
    afterChange()},S.players.every(x=>x.ai)?600:950);
}

/* ================================================================
   HUMAN INTERACTION (this device's seat)
   ================================================================ */
function onHandCard(card){if(!myTurn()||S.phase!=='play'||UI.mode!=='idle')return;const p=cur();
  if(card.type==='spice'){dispatch({k:'spice',id:card.id});return}
  if(card.type==='trade'){const m=tradeMax(p.caravan,card);if(m<1)return;if(m===1){dispatch({k:'trade',id:card.id,times:1});return}UI={mode:'trade',card,max:m,times:m};render();return}
  if(card.type==='upgrade'){if(p.caravan[0]+p.caravan[1]+p.caravan[2]<1)return;UI={mode:'upgrade',card,left:card.n,ups:[],work:p.caravan.slice()};render()}}
function onMarketCard(idx){if(!myTurn()||S.phase!=='play'||UI.mode!=='idle')return;const p=cur();if(idx>total(p.caravan))return;
  if(idx===0){dispatch({k:'acquire',idx:0,pay:[]});return}UI={mode:'pay',idx,pay:cheapest(p.caravan,idx)};render()}
function onPointCard(idx){if(!myTurn()||S.phase!=='play'||UI.mode!=='idle')return;if(!canAfford(cur().caravan,S.pmarket[idx].cost))return;dispatch({k:'claim',idx})}
function onRest(){if(!myTurn()||S.phase!=='play'||UI.mode!=='idle')return;dispatch({k:'rest'})}
function onCube(i){if(!myTurn())return;const p=cur();
  if(S.phase==='discard'){dispatch({k:'discard',i});return}
  if(UI.mode==='upgrade'){if(i>2||UI.left<1||UI.work[i]<1)return;UI.work[i]--;UI.work[i+1]++;UI.ups.push(i);UI.left--;render();return}
  if(UI.mode==='pay'){if(UI.pay.length>=UI.idx)return;const used=UI.pay.filter(x=>x===i).length;if(p.caravan[i]-used<1)return;UI.pay.push(i);render();return}}
function cancelUI(){UI={mode:'idle'};render()}
function confirmUI(){if(UI.mode==='upgrade')dispatch({k:'upgrade',id:UI.card.id,ups:UI.ups});else if(UI.mode==='pay'){if(UI.pay.length!==UI.idx)return;dispatch({k:'acquire',idx:UI.idx,pay:UI.pay})}else if(UI.mode==='trade')dispatch({k:'trade',id:UI.card.id,times:UI.times})}
function undoUpgrade(){if(UI.mode!=='upgrade'||!UI.ups.length)return;const i=UI.ups.pop();UI.work[i]++;UI.work[i+1]--;UI.left++;render()}

/* ================================================================
   ANIMATION — FLIP for cards, flights for cubes and coins.
   Before a re-render we note where every card and anchor sits; afterwards
   we compare with the previous game state to decide what moved where.
   ================================================================ */
const Anim={on:!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches),prev:null,layer:null};
const EASE='cubic-bezier(.2,.8,.2,1)';
function fxLayer(){if(!Anim.layer){Anim.layer=document.createElement('div');Anim.layer.id='fx';document.body.appendChild(Anim.layer)}return Anim.layer}
function rects(){const m=new Map();document.querySelectorAll('[data-cid],[data-anchor]').forEach(el=>{const k=el.dataset.cid!=null?'c:'+el.dataset.cid:'a:'+el.dataset.anchor;if(!m.has(k))m.set(k,el.getBoundingClientRect())});return m}
const mid=r=>({x:r.left+r.width/2,y:r.top+r.height/2});
function fly(html,from,to,opts){ // a loose piece travelling between two rects
  if(!from||!to)return;const o=Object.assign({dur:480,delay:0,size:26,scaleTo:1,fade:false},opts);
  const el=document.createElement('div');el.className='fx-piece';el.style.width=o.size+'px';el.style.height=o.size+'px';el.innerHTML=html;
  const a=mid(from),b=mid(to);el.style.left=(a.x-o.size/2)+'px';el.style.top=(a.y-o.size/2)+'px';fxLayer().appendChild(el);
  const anim=el.animate([{transform:'translate(0,0) scale(1)',opacity:1,offset:0},{transform:`translate(${(b.x-a.x)*0.5}px,${(b.y-a.y)*0.5-28}px) scale(1.15)`,opacity:1,offset:.5},{transform:`translate(${b.x-a.x}px,${b.y-a.y}px) scale(${o.scaleTo})`,opacity:o.fade?0:1,offset:1}],{duration:o.dur,delay:o.delay,easing:EASE,fill:'forwards'});
  anim.onfinish=()=>el.remove();
}
function ghostCard(html,from,to){ // a card leaving the table (claimed) shrinks into its new owner's panel
  if(!from||!to)return;const el=document.createElement('div');el.className='fx-piece';el.style.width=from.width+'px';el.style.height=from.height+'px';el.style.left=from.left+'px';el.style.top=from.top+'px';el.innerHTML=html;fxLayer().appendChild(el);
  const a=mid(from),b=mid(to);
  el.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${b.x-a.x}px,${b.y-a.y}px) scale(.25)`,opacity:0}],{duration:560,easing:EASE,fill:'forwards'}).onfinish=()=>el.remove();
}
function flyCubes(counts,from,to,opts){let k=0;counts.forEach((n,i)=>{for(let j=0;j<n;j++,k++)fly(cube(SP[i],'lg'),from,to,Object.assign({delay:k*45,size:24},opts))})}
function pulse(el){if(el)el.animate([{boxShadow:'0 0 0 0 rgba(244,220,140,0)'},{boxShadow:'0 0 0 6px rgba(244,220,140,.55)'},{boxShadow:'0 0 0 0 rgba(244,220,140,0)'}],{duration:600,easing:'ease-out'})}
function animateChanges(before,prev,next){
  const after=rects();
  // 1. cards that are still on screen: move from their old spot; brand-new table cards slide in from the deck
  after.forEach((r,k)=>{if(!k.startsWith('c:'))return;const el=document.querySelector(`[data-cid="${CSS.escape(k.slice(2))}"]`);if(!el)return;const b=before.get(k);
    if(b){const dx=b.left-r.left,dy=b.top-r.top;if(Math.abs(dx)>1||Math.abs(dy)>1)el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:400,easing:EASE})}
    else{const kind=el.dataset.kind;const deck=after.get(kind==='pt'?'a:pdeck':kind==='mc'?'a:mdeck':null);
      if(deck){const dx=deck.left-r.left,dy=deck.top-r.top;el.animate([{transform:`translate(${dx}px,${dy}px) scale(.92)`,opacity:.3},{transform:'none',opacity:1}],{duration:460,easing:EASE})}
      else el.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:260,easing:'ease-out'})}});
  const seatHome=seat=>(viewSeat()===seat&&after.get('a:caravan'))||after.get('a:pl-'+seat);
  // 2. per player: what changed in their caravan, and why
  prev.players.forEach((pp,seat)=>{const np=next.players[seat];if(!np)return;
    const gained=np.caravan.map((x,c)=>Math.max(0,x-pp.caravan[c])),spent=pp.caravan.map((x,c)=>Math.max(0,x-np.caravan[c]));
    const home=seatHome(seat);
    const claimed=pp.points.length<np.points.length?np.points[np.points.length-1]:null;
    const acquired=np.hand.find(c=>!pp.hand.some(h=>h.id===c.id)&&prev.market.some(s=>s.card.id===c.id));
    const played=np.played.find(c=>!pp.played.some(h=>h.id===c.id));
    if(claimed){const b=before.get('c:'+claimed.id);flyCubes(spent,home,b,{scaleTo:.6,fade:true});ghostCard(pointFace(claimed),b,home);
      if(np.gold>pp.gold)fly(coin(true),before.get('a:pile-gold'),home,{size:30,delay:250});if(np.silver>pp.silver)fly(coin(false),before.get('a:pile-silver'),home,{size:30,delay:250})}
    else if(acquired){const idx=prev.market.findIndex(s=>s.card.id===acquired.id);
      for(let k=0;k<idx;k++){const target=before.get('c:'+prev.market[k].card.id);fly(cube(SP[pickSpent(spent,k)],'lg'),home,target,{delay:k*60,size:24,scaleTo:.6})}
      flyCubes(gained,before.get('c:'+acquired.id),home,{delay:200})}
    else if(played){const dest=after.get('c:'+played.id)||home;
      if(played.type==='spice')flyCubes(gained,dest,home);
      else if(played.type==='trade'){flyCubes(spent,home,dest,{scaleTo:.5,fade:true});flyCubes(gained,dest,home,{delay:260})}
      else pulse(viewSeat()===seat?document.querySelector('[data-anchor="caravan"]'):document.querySelector(`[data-anchor="pl-${seat}"]`))}
    else if(total(spent)&&!total(gained))flyCubes(spent,home,after.get('a:bowls'),{scaleTo:.4,fade:true}); // discard
  });
}
function pickSpent(spent,k){let n=0;for(let i=0;i<4;i++){for(let j=0;j<spent[i];j++){if(n===k)return i;n++}}return 0}

/* ================================================================
   RENDER
   ================================================================ */
function pileHTML(gold,n){if(n<=0)return '';const k=Math.min(n,4);let h=`<span class="pile" data-anchor="pile-${gold?'gold':'silver'}">`;for(let i=0;i<k;i++)h+=`<svg viewBox="0 0 100 100" style="top:${(k-1-i)*2.5}px;left:${i*1.2}px"><use href="#coin${gold?'G':'S'}"/></svg>`;return h+`</span><span class="num">×${n}</span>`}
function render(){
  renderHeader();
  if(!S){$('#app').innerHTML='';return}
  const before=Anim.on&&Anim.prev?rects():null;
  const vs=viewSeat(),p=S.players[vs],turnP=cur();
  const me=myTurn()&&S.phase==='play',idle=me&&UI.mode==='idle';
  const goldSlot=S.gold>0?0:-1,silverSlot=S.gold>0?1:0;
  // hints: which point cards are one play away, and which hand cards get you there
  const reach=idle?Engine.reachable(S,vs):[];
  const nearIdx=new Set(reach.map(r=>r.idx)),enablers=new Map();
  reach.forEach(r=>{const pts=S.pmarket[r.idx].pts;enablers.set(r.action.id,Math.max(enablers.get(r.action.id)||0,pts))});
  const pm=S.pmarket.map((pc,idx)=>{
    const coins=(idx===goldSlot?pileHTML(true,S.gold):'')+(idx===silverSlot?pileHTML(false,S.silver):'');
    const ok=idle&&canAfford(p.caravan,pc.cost),near=!ok&&nearIdx.has(idx);
    return `<div class="slot"><div class="coins">${coins}</div><button class="card ${ok?'clickable':(idle&&!near?'dim':'')} ${near?'near':''}" data-cid="${pc.id}" data-kind="pt" ${ok?`data-pt="${idx}" title="Claim this card"`:`disabled title="${near?'One play away':''}"`}>${pointFace(pc)}${near?'<span class="tip">1 play away</span>':''}</button></div>`}).join('');
  const mm=S.market.map((slot,idx)=>{
    const ok=idle&&idx<=total(p.caravan);
    return `<div class="slot"><div class="coins"><span class="free">${idx===0?'FREE':`${idx} CUBE${idx>1?'S':''}`}</span></div><button class="card ${ok?'clickable':(idle?'dim':'')}" data-cid="${slot.card.id}" data-kind="mc" ${ok?`data-mk="${idx}" title="Acquire this card"`:'disabled'}>${merchantFace(slot.card)}${total(slot.cubes)?`<span class="tip">${cubesHTML(slot.cubes)}</span>`:''}</button></div>`}).join('');
  const others=S.players.map((q,i)=>`<div class="pl ${i===S.cur?'active':''}" data-anchor="pl-${i}">
      <div class="name"><span>${esc(q.name)} ${q.ai?`<span class="tag">${LEVELS[q.level]||''} bot</span>`:''}${S.online&&i===vs?'<span class="tag">you</span>':''}${S.online&&!q.ai&&!q.online?'<span class="tag off">offline</span>':''}</span><small>${q.points.length}/${S.target} cards · ${score(q)} pts</small></div>
      <div class="minicaravan">${cubesHTML(q.caravan)||'<span style="font-size:12px;color:var(--parch-muted)">empty caravan</span>'}</div>
      <div class="meta"><span>hand ${q.hand.length}</span><span>played ${q.played.length}</span><span>${coin(true)} ${q.gold}</span><span>${coin(false)} ${q.silver}</span>${S.online&&NET.role==='host'&&!q.ai&&!q.online?`<button class="btn small" data-botify="${i}">Hand seat to a bot</button>`:''}</div></div>`).join('');

  const shownCaravan=UI.mode==='upgrade'?UI.work:p.caravan;
  let slots='';const cnt=total(shownCaravan);let k=0;
  const discarding=myTurn()&&S.phase==='discard';
  shownCaravan.forEach((c,i)=>{const usedInPay=UI.mode==='pay'?UI.pay.filter(x=>x===i).length:0;
    for(let j=0;j<c;j++,k++){const inPay=UI.mode==='pay'&&j<usedInPay;
      const clickable=discarding||(me&&((UI.mode==='upgrade'&&i<3&&UI.left>0)||(UI.mode==='pay'&&!inPay&&UI.pay.length<UI.idx)));
      slots+=`<div class="cslot ${k>=10?'over':''}"><button class="cubebtn ${inPay?'sel':''}" ${clickable?`data-cube="${i}"`:'disabled'} title="${SPNAME[SP[i]]}">${cube(SP[i],'lg')}</button></div>`}});
  for(;k<10;k++)slots+='<div class="cslot"></div>';
  // preview of a trade before committing
  let preview='';if(UI.mode==='trade'){const c=p.caravan.map((x,i)=>x-UI.card.inp[i]*UI.times+UI.card.out[i]*UI.times);preview=`<div class="preview"><span>After ×${UI.times}:</span>${cubesHTML(c)}<span class="num ${total(c)>10?'over':''}">${total(c)} / 10${total(c)>10?' — you will return the extra':''}</span></div>`}
  const hand=p.hand.map(c=>{let ok=idle;let why='';
    if(c.type==='trade'&&tradeMax(p.caravan,c)<1){ok=false;why='Not enough cubes'}
    if(c.type==='upgrade'&&p.caravan[0]+p.caravan[1]+p.caravan[2]<1){ok=false;why='Nothing to upgrade'}
    const sel=UI.mode!=='idle'&&UI.card&&UI.card.id===c.id;const en=enablers.get(c.id);
    return `<button class="card ${ok?'clickable':(idle?'dim':'')} ${sel?'sel':''} ${en?'enables':''}" data-cid="${c.id}" data-kind="hand" ${ok?`data-hand="${c.id}" title="${en?`Play this and you can claim a ${en}-point card`:'Play this card'}"`:`disabled title="${why}"`}>${merchantFace(c,c.starter)}${c.type==='trade'&&me?`<span class="tip">×${tradeMax(p.caravan,c)} max</span>`:''}${en?`<span class="badge">→ ${en} pts</span>`:''}</button>`}).join('')
    ||'<div style="color:var(--muted);padding:8px 4px">No cards in hand — rest to take your played cards back.</div>';
  const played=p.played.map(c=>`<span class="card" data-cid="${c.id}" data-kind="played">${merchantFace(c,c.starter)}</span>`).join('')||'<div style="color:var(--muted);padding:6px 4px;font-size:14px">Nothing played yet this cycle.</div>';

  let prompt='';
  if(S.over)prompt=`<div class="prompt"><div class="msg"><b>Game over.</b> ${esc(S.players[S.winner].name)} wins.</div><button class="btn primary" id="btnScore">Show final scores</button></div>`;
  else if(!myTurn())prompt=`<div class="prompt"><div class="msg">${turnP.ai?`${esc(turnP.name)} is thinking…`:S.online&&!turnP.online?`Waiting for ${esc(turnP.name)} to reconnect…`:`Waiting for ${esc(turnP.name)}…`}</div></div>`;
  else if(S.phase==='discard')prompt=`<div class="prompt"><div class="msg"><b>Caravan over capacity.</b> Click cubes to return ${cnt-10} to the bowls.</div></div>`;
  else if(UI.mode==='idle')prompt=`<div class="actions"><span>Choose one action — play a card from your hand, acquire a merchant card, claim a point card, or</span><button class="btn" id="btnRest">Rest — take back ${p.played.length} played card${p.played.length!==1?'s':''}</button></div>`;
  else if(UI.mode==='trade')prompt=`<div class="prompt"><div class="msg">Trade ${cubesTxt(UI.card.inp)} → ${cubesTxt(UI.card.out)}. How many times?<div class="payrow" style="margin-top:6px">${Array.from({length:UI.max},(_,k)=>`<button class="btn small ${UI.times===k+1?'on':''}" data-times="${k+1}">×${k+1}</button>`).join('')}</div>${preview}</div><button class="btn primary" id="btnConfirm">Trade</button><button class="btn small" id="btnCancel">Cancel</button></div>`;
  else if(UI.mode==='upgrade')prompt=`<div class="prompt"><div class="msg">Upgrade ${UI.card.n}: click cubes in your caravan to raise them one level (${UI.left} left). You may stop early.</div><button class="btn small" id="btnUndo" ${UI.ups.length?'':'disabled'}>Undo</button><button class="btn primary" id="btnConfirm">Done</button><button class="btn small" id="btnCancel">Cancel</button></div>`;
  else if(UI.mode==='pay')prompt=`<div class="prompt"><div class="msg">Acquire card #${UI.idx+1}: place one cube on each card to its left. Click caravan cubes to choose (any colour).<div class="payrow" style="margin-top:6px">${UI.pay.map((i,k)=>`<button class="payslot cubebtn" data-unpay="${k}" title="Remove">${cube(SP[i],'lg')}</button>`).join('')}${Array.from({length:UI.idx-UI.pay.length},()=>'<span class="payslot"></span>').join('')}</div></div><button class="btn small" id="btnCheap">Cheapest</button><button class="btn primary" id="btnConfirm" ${UI.pay.length===UI.idx?'':'disabled'}>Confirm</button><button class="btn small" id="btnCancel">Cancel</button></div>`;

  const who=S.online?`${esc(p.name)} <span class="tag" style="color:var(--muted);border-color:var(--line)">you</span> — ${S.cur===vs?'your turn':`${esc(turnP.name)}'s turn`}`:`${esc(p.name)}${p.ai?` <span class="tag" style="color:var(--muted);border-color:var(--line)">${LEVELS[p.level]||''} bot</span>`:''} — your turn`;
  $('#app').innerHTML=`
  <div class="stack">
    <div class="mat"><h2><span>Point cards</span><span class="hint">gold = 3 pts · silver = 1 pt</span></h2>
      <div class="row">${pm}<div class="deck" data-anchor="pdeck">${cardBack('pt')}<div class="cnt">${S.pdeck.length}</div></div></div></div>
    <div class="mat"><h2><span>Merchant cards</span><span class="hint">leftmost is free · each card to the left costs 1 cube</span></h2>
      <div class="row">${mm}<div class="deck" data-anchor="mdeck">${cardBack('mc')}<div class="cnt">${S.mdeck.length}</div></div></div></div>
    <div class="mat"><h2><span>Caravans</span><span class="hint">Round ${S.round}${S.endTriggered?' · final round':''}</span></h2><div class="players">${others}</div></div>
    <div class="mat you">
      <div class="head"><span class="who">${who}</span><span style="color:var(--muted);font-size:14px">${p.points.length}/${S.target} point cards · ${score(p)} pts so far</span></div>
      <div class="caravan">${camelSVG}<div class="slots" data-anchor="caravan">${slots}</div><span class="cap num ${cnt>10?'over':''}">${cnt} / 10</span></div>
      ${prompt}
      <h2 style="margin-top:12px"><span>Hand</span><span class="hint">${p.hand.length} card${p.hand.length!==1?'s':''}</span></h2>
      <div class="hand">${hand}</div>
      <h2 style="margin-top:8px"><span>Played this cycle</span></h2>
      <div class="hand played">${played}</div>
      <div class="legend"><span>${cube('Y')} turmeric</span><span>${cube('R')} saffron</span><span>${cube('G')} cardamom</span><span>${cube('B')} cinnamon</span><span>— upgrade ladder left to right; only non-turmeric cubes score 1 each at the end</span><span class="bowls" data-anchor="bowls">${SP.map(bowlSVG).join('')}</span></div>
    </div>
  </div>
  <div class="scroll"><h2><span>Log</span><span class="hint">turn ${S.turn}</span></h2><div class="log">${S.log.map(l=>`<div>${l}</div>`).join('')}</div></div>`;

  document.querySelectorAll('[data-pt]').forEach(e=>e.onclick=()=>onPointCard(+e.dataset.pt));
  document.querySelectorAll('[data-mk]').forEach(e=>e.onclick=()=>onMarketCard(+e.dataset.mk));
  document.querySelectorAll('[data-hand]').forEach(e=>e.onclick=()=>onHandCard(p.hand.find(c=>c.id===e.dataset.hand)));
  document.querySelectorAll('[data-cube]').forEach(e=>e.onclick=()=>onCube(+e.dataset.cube));
  document.querySelectorAll('[data-times]').forEach(e=>e.onclick=()=>{UI.times=+e.dataset.times;render()});
  document.querySelectorAll('[data-unpay]').forEach(e=>e.onclick=()=>{UI.pay.splice(+e.dataset.unpay,1);render()});
  document.querySelectorAll('[data-botify]').forEach(e=>e.onclick=()=>{const q=S.players[+e.dataset.botify];q.ai=true;q.owner='bot';q.online=true;q.level=q.level||'normal';Engine.log(S,`<b>${q.name}</b>'s seat is now played by a bot.`);afterChange()});
  const b=id=>document.getElementById(id);
  if(b('btnRest'))b('btnRest').onclick=onRest;
  if(b('btnCancel'))b('btnCancel').onclick=cancelUI;
  if(b('btnConfirm'))b('btnConfirm').onclick=confirmUI;
  if(b('btnUndo'))b('btnUndo').onclick=undoUpgrade;
  if(b('btnCheap'))b('btnCheap').onclick=()=>{UI.pay=cheapest(p.caravan,UI.idx);render()};
  if(b('btnScore'))b('btnScore').onclick=showScores;
  wireZoom();
  if(before&&Anim.prev)try{animateChanges(before,Anim.prev,S)}catch(e){console.warn('animation skipped',e)}
  Anim.prev=Engine.clone(S);
}

/* ================================================================
   CARD ZOOM — press and hold (touch), hover for a moment (mouse), or right-click any card
   ================================================================ */
function findCard(id){
  for(const pc of S.pmarket)if(pc.id===id)return {card:pc,kind:'pt'};
  for(const s of S.market)if(s.card.id===id)return {card:s.card,kind:'mc',cubes:s.cubes};
  for(const p of S.players){for(const c of p.hand)if(c.id===id)return {card:c,kind:'mc'};for(const c of p.played)if(c.id===id)return {card:c,kind:'mc'};for(const c of p.points)if(c.id===id)return {card:c,kind:'pt'}}
  return null;
}
function cardCaption(f){
  const c=f.card;
  if(f.kind==='pt'){const vs=viewSeat(),p=S.players[vs];const short=c.cost.map((x,i)=>Math.max(0,x-p.caravan[i]));
    return `<b>${c.pts} points</b> · needs ${cubesTxt(c.cost)}${canAfford(p.caravan,c.cost)?' — <span class="ok">you can claim this now</span>':total(short)?` — you are short ${cubesTxt(short)}`:''}`}
  if(c.type==='spice')return `<b>Spice card</b> · gain ${cubesTxt(c.gain)}`;
  if(c.type==='trade')return `<b>Trade card</b> · give ${cubesTxt(c.inp)} for ${cubesTxt(c.out)}, as many times as you can pay${f.cubes&&total(f.cubes)?` · comes with ${cubesTxt(f.cubes)} on it`:''}`;
  return `<b>Upgrade ${c.n}</b> · raise cubes one level (turmeric → saffron → cardamom → cinnamon), up to ${c.n} times, stopping early if you like`;
}
let zoomTimer=null,zoomSuppressClick=false;
function showZoom(id){const f=findCard(id);if(!f)return;let z=$('#zoom');if(!z){z=document.createElement('div');z.id='zoom';document.body.appendChild(z)}
  z.innerHTML=`<div class="zcard">${f.kind==='pt'?pointFace(f.card):merchantFace(f.card,f.card.starter)}</div><div class="zcap">${cardCaption(f)}<div class="zhint">release or click anywhere to close</div></div>`;
  z.classList.add('show');z.onclick=hideZoom;zoomSuppressClick=true}
function hideZoom(){const z=$('#zoom');if(z)z.classList.remove('show');clearTimeout(zoomTimer);zoomTimer=null;setTimeout(()=>{zoomSuppressClick=false},50)}
function wireZoom(){
  document.querySelectorAll('.card[data-cid]').forEach(el=>{const id=el.dataset.cid;
    el.onpointerdown=e=>{if(e.button!==0)return;clearTimeout(zoomTimer);zoomTimer=setTimeout(()=>showZoom(id),e.pointerType==='mouse'?650:420)};
    el.onpointerup=el.onpointerleave=el.onpointercancel=()=>{clearTimeout(zoomTimer);if($('#zoom')&&$('#zoom').classList.contains('show'))hideZoom()};
    el.onpointerenter=e=>{if(e.pointerType==='mouse'){clearTimeout(zoomTimer);zoomTimer=setTimeout(()=>showZoom(id),900)}};
    el.oncontextmenu=e=>{e.preventDefault();showZoom(id)};
    el.addEventListener('click',e=>{if(zoomSuppressClick){e.stopImmediatePropagation();e.preventDefault()}},true);
  });
}

/* ================================================================
   MENUS
   ================================================================ */
function closeModal(){$('#modals').innerHTML=''}
const levelSelect=(id,val)=>`<select id="${id}" class="lvl" title="Bot strength">${Object.entries(LEVELS).map(([k,v])=>`<option value="${k}" ${k===(val||'normal')?'selected':''}>${v}</option>`).join('')}</select>`;
function showMenu(){
  $('#modals').innerHTML=`<div class="overlay"><div class="modal"><h2>New game</h2>
  <div class="menu">
    <button class="mopt" id="mLocal"><b>Same device</b><span>Pass the screen around, or play against bots.</span></button>
    <button class="mopt" id="mHost"><b>Host online</b><span>Get a room code; friends join from their own devices. Your browser runs the game.</span></button>
    <button class="mopt" id="mJoin"><b>Join online</b><span>Enter a friend's room code.</span></button>
    ${(()=>{const r=loadHost();return r&&!(NET.role==='host'&&NET.code===r.code)?`<button class="mopt" id="mResume"><b>Resume room ${esc(r.code)}</b><span>Your saved online game — round ${r.S.round}, ${r.S.players.length} players. Guests reconnect automatically.</span></button>`:''})()}
  </div>
  <div class="foot"><button class="btn" id="mCancel">Cancel</button></div></div></div>`;
  $('#mCancel').onclick=closeModal;$('#mLocal').onclick=showSetup;$('#mHost').onclick=()=>showOnlineForm('host');$('#mJoin').onclick=()=>showOnlineForm('join');
  if($('#mResume'))$('#mResume').onclick=()=>{const r=loadHost();if(r)resumeHost(r)};
}
function showOnlineForm(kind,code=''){
  const name=NET.name||localStorage.getItem('csr-name')||'';
  $('#modals').innerHTML=`<div class="overlay"><div class="modal setup"><h2>${kind==='host'?'Host an online game':'Join an online game'}</h2>
  <p>${kind==='host'?'You will get a 5-letter room code and a link to share. Keep this tab open — it runs the game for everyone.':'Ask the host for their room code, or open the link they shared.'}</p>
  <label class="lbl" for="nName">Your name</label><input type="text" id="nName" value="${esc(name)}" maxlength="18" placeholder="Your name">
  ${kind==='join'?`<label class="lbl" for="nCode">Room code</label><input type="text" id="nCode" value="${esc(code)}" maxlength="5" placeholder="ABCDE" style="text-transform:uppercase;letter-spacing:.2em;font-family:Cinzel,serif">`:''}
  <div class="foot"><button class="btn" id="mBack">Back</button><button class="btn primary" id="mGo">${kind==='host'?'Create room':'Join'}</button></div></div></div>`;
  $('#mBack').onclick=showMenu;
  const go=()=>{const n=cleanName($('#nName').value);try{localStorage.setItem('csr-name',n)}catch(e){}
    if(!peerAvailable()){netError({message:'The connection library did not load. Check your internet connection and reload.'});return}
    if(kind==='host')hostGame(n);else{const c=($('#nCode').value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(c.length!==5){toast('Room codes are 5 letters.');return}joinGame(c,n)}};
  $('#mGo').onclick=go;
  document.querySelectorAll('#modals input').forEach(i=>i.onkeydown=e=>{if(e.key==='Enter')go()});
  $('#nName').focus();
}
function showLobby(status){
  const host=NET.role==='host';const players=host?NET.lobby:(NET.lobby||[]);
  const link=`${location.origin}${location.pathname}?room=${NET.code||''}`;
  const rows=players.map((x,i)=>`<div class="lrow"><span class="num" style="color:var(--parch-muted)">${i+1}</span><span>${esc(x.name)}${x.ai?` <span class="tag">${LEVELS[x.level]||'Normal'} bot</span>`:''}${(host?x.owner==='host':x.host)?' <span class="tag">host</span>':''}${!host&&x.name===NET.name?' <span class="tag">you</span>':''}</span>${host&&x.owner!=='host'?`<button class="btn small" data-kick="${i}">Remove</button>`:'<span></span>'}</div>`).join('');
  $('#modals').innerHTML=`<div class="overlay"><div class="modal lobby"><h2>${host?'Your room':'Room'} ${esc(NET.code||'')}</h2>
  ${status?`<p>${esc(status)}</p>`:''}
  ${NET.code&&!status?`<p>Share this link or the code: <a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a> <button class="btn small" id="mCopy">Copy link</button></p>`:''}
  <div class="lrows">${rows||'<p style="color:var(--parch-muted)">Waiting for players…</p>'}</div>
  <p style="color:var(--parch-muted);font-size:14px">Seat order is turn order. ${host?'2–5 players; add bots to fill empty seats.':'The host starts the game when everyone is in.'}</p>
  <div class="foot"><button class="btn" id="mLeave">Leave</button>${host?`<span class="botadd">${levelSelect('botLevel',NET.botLevel)}<button class="btn" id="mBot" ${players.length>=5?'disabled':''}>Add bot</button></span><button class="btn" id="mShuffle">Shuffle seats</button><button class="btn primary" id="mStart" ${players.length<2?'disabled':''}>Start game</button>`:''}</div></div></div>`;
  $('#mLeave').onclick=()=>{clearGuest();netReset();closeModal();if(!S)showMenu();else render()};
  if($('#mCopy'))$('#mCopy').onclick=()=>{navigator.clipboard?.writeText(link).then(()=>toast('Link copied'),()=>toast(link))};
  if(host){
    document.querySelectorAll('[data-kick]').forEach(e=>e.onclick=()=>{const x=NET.lobby[+e.dataset.kick];if(x.owner!=='host'&&x.owner!=='bot'){const c=NET.conns.get(x.owner);if(c){c.send({t:'err',msg:'The host removed you from the room.',fatal:true});setTimeout(()=>c.close(),300)}NET.conns.delete(x.owner)}NET.lobby.splice(+e.dataset.kick,1);broadcastLobby();showLobby()});
    $('#botLevel').onchange=e=>{NET.botLevel=e.target.value};
    $('#mBot').onclick=()=>{const names=BOT_NAMES.filter(n=>!NET.lobby.some(x=>x.name===n));NET.lobby.push({name:names[0]||'Bot',owner:'bot',ai:true,level:$('#botLevel').value,online:true});broadcastLobby();showLobby()};
    $('#mShuffle').onclick=()=>{for(let i=NET.lobby.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[NET.lobby[i],NET.lobby[j]]=[NET.lobby[j],NET.lobby[i]]}broadcastLobby();showLobby()};
    $('#mStart').onclick=hostStart;
  }
}
function showSetup(){
  const prev=S&&!S.online?S.players.map(q=>({name:q.name,ai:q.ai,level:q.level})):[{name:'You',ai:false},{name:'Amira',ai:true,level:'normal'},{name:'Bashir',ai:true,level:'normal'}];
  let n=prev.length;const names=['You',...BOT_NAMES];
  const draw=()=>{
    const rows=Array.from({length:n},(_,i)=>{const q=prev[i]||{name:names[i],ai:i>0,level:'normal'};
      return `<div class="prow"><span class="num" style="color:var(--parch-muted)">${i+1}</span><input type="text" id="pname${i}" value="${esc(q.name)}" maxlength="18"><select id="pai${i}"><option value="0" ${q.ai?'':'selected'}>Human</option><option value="1" ${q.ai?'selected':''}>Bot</option></select>${levelSelect('plvl'+i,q.level)}</div>`}).join('');
    $('#modals').innerHTML=`<div class="overlay"><div class="modal setup"><h2>Same device</h2>
      <p>Seat 2–5 players. Humans share this screen (hot-seat). Bot strength: <b>Easy</b> plays loosely and makes mistakes, <b>Normal</b> trades sensibly, <b>Hard</b> plans two turns ahead. Seat order is turn order — seat 1 is first player with 3 turmeric; seats 2–3 get 4; seats 4–5 get 3 turmeric + 1 saffron.</p>
      <div style="display:flex;align-items:center;gap:10px;margin:10px 0;flex-wrap:wrap"><span>Players</span><span class="seg">${[2,3,4,5].map(k=>`<button data-n="${k}" class="${k===n?'on':''}">${k}</button>`).join('')}</span><span style="color:var(--parch-muted);font-size:14px">ends at ${n<=3?6:5} point cards</span></div>
      ${rows}<div class="foot"><button class="btn" id="mBack">Back</button><button class="btn primary" id="mStart">Start game</button></div></div></div>`;
    const read=()=>{for(let i=0;i<n;i++)prev[i]={name:$('#pname'+i).value||names[i],ai:$('#pai'+i).value==='1',level:$('#plvl'+i).value}};
    document.querySelectorAll('[data-n]').forEach(e=>e.onclick=()=>{read();n=+e.dataset.n;draw()});
    $('#mBack').onclick=showMenu;
    $('#mStart').onclick=()=>{read();const players=Array.from({length:n},(_,i)=>({name:prev[i].name.trim()||names[i],ai:prev[i].ai,level:prev[i].level}));closeModal();netReset();newGame({players})};
  };draw();
}
// player colours for the timeline: fixed by seat, from a CVD-checked categorical palette
const SERIES=['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4'];
function timelineHTML(){
  const H=S.history||[];if(H.length<2)return '';
  const n=S.players.length,W=640,Hh=240,L=36,R=110,T=16,B=30;
  const maxT=H[H.length-1].t,maxS=Math.max(10,...H.map(h=>Math.max(...h.s)));
  const x=t=>L+(t-1)/Math.max(1,maxT-1)*(W-L-R),y=s=>T+(1-s/maxS)*(Hh-T-B);
  // series: score after each turn, starting from 0 at turn 1
  const series=S.players.map((p,i)=>[{t:1,s:0},...H.map(h=>({t:h.t,s:h.s[i]}))]);
  const step=maxS>40?20:maxS>20?10:5;const ticks=[];for(let v=0;v<=maxS;v+=step)ticks.push(v);
  const lines=series.map((pts,i)=>`<path d="${pts.map((q,j)=>(j?'L':'M')+x(q.t).toFixed(1)+' '+y(q.s).toFixed(1)).join(' ')}" fill="none" stroke="${SERIES[i]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  const ends=series.map((pts,i)=>{const q=pts[pts.length-1];return `<circle cx="${x(q.t).toFixed(1)}" cy="${y(q.s).toFixed(1)}" r="4" fill="${SERIES[i]}" stroke="#F1E1BF" stroke-width="2"/>`}).join('');
  // end labels, nudged apart so they never overlap
  const lab=series.map((pts,i)=>({i,yy:y(pts[pts.length-1].s),name:S.players[i].name,s:pts[pts.length-1].s})).sort((a,b)=>a.yy-b.yy);
  for(let k=1;k<lab.length;k++)if(lab[k].yy-lab[k-1].yy<14)lab[k].yy=lab[k-1].yy+14;
  const labels=lab.map(l=>`<text x="${W-R+10}" y="${(l.yy+4).toFixed(1)}" font-size="12" fill="#2B1B12" font-family="Alegreya Sans,sans-serif"><tspan fill="${SERIES[l.i]}">●</tspan> ${esc(l.name)} <tspan fill="#6E5238">${l.s}</tspan></text>`).join('');
  const grid=ticks.map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#B89A6B" stroke-opacity=".35"/><text x="${L-6}" y="${(y(v)+4).toFixed(1)}" font-size="11" text-anchor="end" fill="#6E5238" font-family="Alegreya Sans,sans-serif">${v}</text>`).join('');
  const xt=[1,...Array.from({length:Math.floor(maxT/10)},(_,k)=>(k+1)*10)].filter(v=>v<=maxT);if(xt[xt.length-1]!==maxT)xt.push(maxT);
  const xlab=xt.map(v=>`<text x="${x(v).toFixed(1)}" y="${Hh-8}" font-size="11" text-anchor="middle" fill="#6E5238" font-family="Alegreya Sans,sans-serif">${v}</text>`).join('');
  return `<h3>Points over the game</h3><div class="tl" id="tl"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Score of each player after every turn">${grid}${lines}${ends}${labels}${xlab}<text x="${(L+(W-R))/2}" y="${Hh+2}" font-size="10" text-anchor="middle" fill="#6E5238" font-family="Alegreya Sans,sans-serif">turn</text><g id="tlx" style="display:none"><line y1="${T}" y2="${Hh-B}" stroke="#2B1B12" stroke-opacity=".5" stroke-dasharray="3 3"/></g></svg><div class="tltip" id="tltip"></div></div>`;
}
function wireTimeline(){
  const box=$('#tl');if(!box)return;const svg=box.querySelector('svg'),xline=$('#tlx'),tip=$('#tltip');const H=S.history;
  const W=640,L=36,R=110,maxT=H[H.length-1].t;
  svg.onmousemove=e=>{const r=svg.getBoundingClientRect();const px=(e.clientX-r.left)/r.width*W;let t=Math.round(1+(px-L)/(W-L-R)*(maxT-1));t=Math.max(1,Math.min(maxT,t));
    const h=[...H].reverse().find(q=>q.t<=t);const sx=L+(t-1)/Math.max(1,maxT-1)*(W-L-R);
    xline.style.display='';xline.firstElementChild.setAttribute('x1',sx);xline.firstElementChild.setAttribute('x2',sx);
    const who=S.players[h?h.seat:0];const what=h?({claim:`claimed ${h.d} pts`,trade:`traded (+${h.d} value)`,spice:`gained ${h.d} value`,acquire:h.d?`acquired card #${h.d+1}`:'acquired the free card',upgrade:'upgraded',rest:'rested'})[h.k]:'';
    tip.innerHTML=`<b>Turn ${t}</b> · ${esc(who.name)} ${what}<br>${S.players.map((p,i)=>`<span style="color:${SERIES[i]}">●</span> ${esc(p.name)} ${h?h.s[i]:0}`).join(' &nbsp; ')}`;
    tip.style.display='block';const tx=Math.min(r.width-tip.offsetWidth-8,Math.max(0,(e.clientX-r.left)+12));tip.style.left=tx+'px';tip.style.top=(e.clientY-r.top+12)+'px'};
  svg.onmouseleave=()=>{xline.style.display='none';tip.style.display='none'};
}
function statsHTML(){
  const H=S.history||[];if(!H.length)return '';
  const rows=S.players.map((p,i)=>{const mine=H.filter(h=>h.seat===i);const best=Math.max(0,...mine.filter(h=>h.k==='trade').map(h=>h.d));const claims=mine.filter(h=>h.k==='claim');
    return `<tr><td><span style="color:${SERIES[i]}">●</span> ${esc(p.name)}</td><td class="num">${claims.length}</td><td class="num">${claims.length?Math.max(...claims.map(h=>h.d)):'—'}</td><td class="num">${best||'—'}</td><td class="num">${mine.filter(h=>h.k==='acquire').length}</td><td class="num">${mine.filter(h=>h.k==='rest').length}</td></tr>`}).join('');
  return `<h3>How the game went</h3><table class="score stats"><thead><tr><th>Player</th><th>Claims</th><th>Best card</th><th>Best trade</th><th>Acquired</th><th>Rests</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function showScores(){
  const rows=Engine.ranking(S).map(r=>`<tr class="${r.i===S.winner?'win':''}"><td><span style="color:${SERIES[r.i]}">●</span> ${esc(r.p.name)}</td><td class="num">${r.p.points.reduce((a,c)=>a+c.pts,0)} <small style="color:var(--parch-muted)">(${r.p.points.length})</small></td><td class="num">${r.p.gold*3} <small style="color:var(--parch-muted)">(${r.p.gold})</small></td><td class="num">${r.p.silver}</td><td class="num">${r.p.caravan[1]+r.p.caravan[2]+r.p.caravan[3]}</td><td class="num"><b>${r.s}</b></td></tr>`).join('');
  $('#modals').innerHTML=`<div class="overlay"><div class="modal wide"><h2>Final scores</h2><p>Point cards + 3 per gold + 1 per silver + 1 per non-turmeric cube left in the caravan. Ties go to the player later in turn order.</p>
  <table class="score"><thead><tr><th>Player</th><th>Cards</th><th>Gold</th><th>Silver</th><th>Cubes</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
  ${timelineHTML()}${statsHTML()}
  <div class="foot"><button class="btn" id="mClose">Close</button>${NET.role==='guest'?'':'<button class="btn primary" id="mNew">New game</button>'}</div></div></div>`;
  wireTimeline();
  $('#mClose').onclick=closeModal;if($('#mNew'))$('#mNew').onclick=()=>{closeModal();if(NET.role==='host'){NET.lobby=S.players.map(p=>({name:p.name,owner:p.owner,ai:p.ai,level:p.level,online:p.online})).filter(p=>p.ai||p.online);showLobby()}else showMenu()};
}
function showRules(){
  $('#modals').innerHTML=`<div class="overlay"><div class="modal rules"><h2>How to play</h2>
  <p>You lead a caravan trading four spices of rising value — ${cube('Y')} turmeric, ${cube('R')} saffron, ${cube('G')} cardamom, ${cube('B')} cinnamon. Build a hand of merchant cards, turn cheap spices into rare ones, and spend them on point cards.</p>
  <h3>Your turn — exactly one action</h3>
  <ul><li><b>Play</b> a card from your hand. <i>Spice</i> cards add cubes. <i>Trade</i> cards swap the cubes above the arrow for those below — as many times in a row as you can pay. <i>Upgrade</i> cards raise a cube one step (turmeric→saffron→cardamom→cinnamon), 2 or 3 times; you may stop early.</li>
  <li><b>Acquire</b> a merchant card from the row: the leftmost is free; for any other, place one cube of your choice on each card to its left. Cubes sitting on a card come with it. The row slides left and refills.</li>
  <li><b>Rest</b>: take every card you've played back into your hand.</li>
  <li><b>Claim</b> a point card by returning the cubes shown. The leftmost card also gives a gold coin (3 pts), the second a silver (1 pt) — when gold runs out the silver pile moves to the leftmost slot.</li></ul>
  <h3>Caravan limit</h3><p>At the end of your turn you may hold at most 10 cubes; return any extra.</p>
  <h3>Game end</h3><p>When someone claims their 5th point card (6th with 2–3 players) the round is finished so everyone has had equal turns. Score point cards, coins, and 1 per non-turmeric cube left. Ties go to the player later in turn order.</p>
  <h3>Setup</h3><p>Each player starts with a <i>Spice 2 turmeric</i> card and an <i>Upgrade 2</i> card (purple-framed starters). Starting cubes by turn order: 3 · 4 · 4 · 3+1 saffron · 3+1 saffron. Coins: 2× players each of gold and silver. Five point cards and six merchant cards are dealt face up.</p>
  <h3>Bots</h3><p><b>Easy</b> plays loosely and makes mistakes. <b>Normal</b> trades sensibly one turn at a time. <b>Hard</b> searches two of its own turns ahead and values its trading engine; it wins about nine games in ten against Normal.</p>
  <h3>Playing online</h3><p>One player hosts and shares a 5-letter room code or link; the others join from their own devices. The host's browser runs the game, so it must stay open. The host's browser saves the game after every move, so if that tab closes or loses internet, reopening the site offers <i>Resume</i> under the same room code; guests reconnect on their own and keep their seats. A dropped guest can also rejoin by name, or the host can hand their seat to a bot. Connections are peer-to-peer (WebRTC); no game data is stored on a server.</p>
  <h3>Sources</h3>
  <ul><li><a href="https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Century-Spice-Road-Rules_2024_compressed.pdf" target="_blank" rel="noopener">Official rulebook (Plan B Games, 2024 edition)</a></li>
  <li><a href="https://boardgamegeek.com/thread/1871993/list-of-contract-objective-victory-point-cards" target="_blank" rel="noopener">All 36 point cards (BGG)</a> · <a href="https://boardgamegeek.com/thread/2067607" target="_blank" rel="noopener">All 43 merchant cards (BGG)</a></li>
  <li><a href="https://boardgamegeek.com/boardgame/209685/century-spice-road" target="_blank" rel="noopener">Century: Spice Road on BoardGameGeek</a> — designed by Emerson Matsuuchi, art by Fernanda Suárez.</li></ul>
  <p style="color:var(--parch-muted);font-size:14px">Fan-made, unofficial implementation for personal play. Card illustrations here are original procedural drawings in the spirit of the game, not the published artwork. Century: Spice Road is © Plan B Games.</p>
  <div class="foot"><button class="btn primary" id="mClose">Back to the table</button></div></div></div>`;
  $('#mClose').onclick=closeModal;
}

/* ================================================================
   PERSISTENCE + BOOT
   ================================================================ */
function save(){saveHost();if(NET.mode!=='local'||!S||S.online)return;try{localStorage.setItem('csr-state3',JSON.stringify({S}))}catch(e){}}
function load(){try{const j=JSON.parse(localStorage.getItem('csr-state3'));if(j&&j.S&&j.S.players)return j}catch(e){}return null}
window.claude?.hot?.snapshot?.(()=>(NET.mode==='local'?{S}:{}));
function start(hot){
  const room=new URLSearchParams(location.search).get('room');
  const saved=(hot&&hot.S)?hot:load();
  if(saved){S=saved.S;if(!S.phase)S.phase='play';S.players.forEach(p=>{if(!p.owner)p.owner=p.ai?'bot':'local';if(p.online==null)p.online=true;if(!p.level)p.level='normal'});if(!S.history)S.history=[];UI={mode:'idle'};render();maybeAI()}
  else newGame({players:[{name:'You',ai:false},{name:'Amira',ai:true,level:'normal'},{name:'Bashir',ai:true,level:'normal'}]});
  if(room){history.replaceState(null,'',location.pathname);showOnlineForm('join',room.toUpperCase());return}
  const hostSaved=loadHost();
  if(hostSaved){$('#modals').innerHTML=`<div class="overlay"><div class="modal"><h2>Resume your online game?</h2><p>You were hosting room <b>${esc(hostSaved.code)}</b> — round ${hostSaved.S.round}, ${hostSaved.S.players.map(p=>esc(p.name)).join(', ')}. Resuming reopens the same room; the other players reconnect automatically and keep their seats.</p>
    <div class="foot"><button class="btn" id="mDiscard">Discard it</button><button class="btn primary" id="mResume">Resume room ${esc(hostSaved.code)}</button></div></div></div>`;
    $('#mDiscard').onclick=()=>{clearHost();closeModal()};$('#mResume').onclick=()=>resumeHost(hostSaved);return}
  const guestSaved=loadGuest();
  if(guestSaved){$('#modals').innerHTML=`<div class="overlay"><div class="modal"><h2>Rejoin your game?</h2><p>You were playing as <b>${esc(guestSaved.name)}</b> in room <b>${esc(guestSaved.code)}</b>. If the host still has it open (or resumes it), you can pick up your seat.</p>
    <div class="foot"><button class="btn" id="mNo">No thanks</button><button class="btn primary" id="mYes">Rejoin</button></div></div></div>`;
    $('#mNo').onclick=()=>{clearGuest();closeModal()};$('#mYes').onclick=()=>joinGame(guestSaved.code,guestSaved.name,false)}
}
$('#btnNew').onclick=showMenu;$('#btnRules').onclick=showRules;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#modals').innerHTML&&!$('#modals .lobby'))closeModal()});
window.addEventListener('beforeunload',e=>{if(NET.role==='host'&&S&&S.online&&!S.over){e.preventDefault();e.returnValue=''}});
window.claude?.hot?.ready?window.claude.hot.ready(start):start(window.claude?.hot?.data??{});
