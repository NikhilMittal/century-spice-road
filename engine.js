/* Century: Spice Road — rules engine and bots.
   Pure: no DOM, no globals. Every function takes the game state G explicitly.
   Loads in the browser (window.Engine) and in Node (module.exports) for tests.

   Card data verified against the official 2024 Plan B Games rulebook,
   the BGG contract-card list, and the BGG full merchant spreadsheet.
   Spice order: Y turmeric(1) · R saffron(2) · G cardamom(3) · B cinnamon(4) */
(function(root){
'use strict';
const SP=['Y','R','G','B'];
const SPNAME={Y:'turmeric',R:'saffron',G:'cardamom',B:'cinnamon'};
const VAL=[1,2,3,4];
const TRADES=[
 [[1,1,0,0],[0,0,0,1]], [[2,0,1,0],[0,0,0,2]],
 [[2,0,0,0],[0,2,0,0]], [[2,0,0,0],[0,0,1,0]], [[3,0,0,0],[0,1,1,0]], [[3,0,0,0],[0,3,0,0]],
 [[3,0,0,0],[0,0,0,1]], [[4,0,0,0],[0,0,1,1]], [[4,0,0,0],[0,0,2,0]], [[5,0,0,0],[0,0,3,0]], [[5,0,0,0],[0,0,0,2]],
 [[0,1,0,0],[3,0,0,0]], [[0,2,0,0],[2,0,0,1]], [[0,2,0,0],[3,0,1,0]], [[0,2,0,0],[0,0,2,0]],
 [[0,3,0,0],[1,0,1,1]], [[0,3,0,0],[2,0,2,0]], [[0,3,0,0],[0,0,3,0]], [[0,3,0,0],[0,0,0,2]],
 [[0,0,1,0],[1,2,0,0]], [[0,0,1,0],[4,1,0,0]], [[0,0,1,0],[0,2,0,0]],
 [[0,0,2,0],[2,1,0,1]], [[0,0,2,0],[2,3,0,0]], [[0,0,2,0],[0,2,0,1]], [[0,0,2,0],[0,0,0,2]], [[0,0,3,0],[0,0,0,3]],
 [[0,0,0,1],[1,1,1,0]], [[0,0,0,1],[2,2,0,0]], [[0,0,0,1],[3,0,1,0]], [[0,0,0,1],[0,3,0,0]], [[0,0,0,1],[0,0,2,0]],
 [[0,0,0,2],[1,1,3,0]], [[0,0,0,2],[0,3,2,0]],
];
const GAINS=[[1,1,0,0],[1,0,1,0],[2,1,0,0],[3,0,0,0],[4,0,0,0],[0,2,0,0],[0,0,1,0],[0,0,0,1]];
const POINTS=[
 [2,2,0,0,6],[3,2,0,0,7],[2,3,0,0,8],[2,0,2,0,8],[0,4,0,0,8],
 [3,0,2,0,9],[2,1,0,1,9],
 [2,0,0,2,10],[0,2,2,0,10],[0,5,0,0,10],
 [2,0,3,0,11],[3,0,0,2,11],
 [0,3,2,0,12],[0,2,0,2,12],[0,0,4,0,12],[1,1,1,1,12],[1,0,2,1,12],[0,2,1,1,12],
 [0,2,3,0,13],[2,2,2,0,13],
 [0,0,2,2,14],[0,3,0,2,14],[2,0,0,3,14],[3,1,1,1,14],
 [0,0,5,0,15],[2,2,0,2,15],
 [0,2,0,3,16],[0,0,0,4,16],[1,3,1,1,16],
 [0,0,3,2,17],[2,0,2,2,17],
 [0,0,2,3,18],[1,1,3,1,18],
 [0,2,2,2,19],
 [0,0,0,5,20],[1,1,1,3,20]];
const START_CUBES=[[3,0,0,0],[4,0,0,0],[4,0,0,0],[3,1,0,0],[3,1,0,0]];
const CARAVAN_MAX=10;

// ---- helpers
const total=c=>c[0]+c[1]+c[2]+c[3];
const value=c=>c[0]+2*c[1]+3*c[2]+4*c[3];
const canAfford=(c,cost)=>c[0]>=cost[0]&&c[1]>=cost[1]&&c[2]>=cost[2]&&c[3]>=cost[3];
const tradeMax=(c,card)=>Math.min(...card.inp.map((x,i)=>x?Math.floor(c[i]/x):99));
const cubesTxt=arr=>arr.map((n,i)=>n?`${n} ${SPNAME[SP[i]]}`:'').filter(Boolean).join(', ')||'nothing';
const cardTxt=c=>c.type==='spice'?`a spice card (${cubesTxt(c.gain)})`:c.type==='trade'?`a trade card (${cubesTxt(c.inp)} → ${cubesTxt(c.out)})`:`the Upgrade ${c.n} card`;
function shuffle(a,rng){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function cheapest(c,n){const out=[];const cc=c.slice();for(let k=0;k<n;k++){for(let i=0;i<4;i++)if(cc[i]>0){cc[i]--;out.push(i);break}}return out}
function trimTo10(c){let over=total(c)-CARAVAN_MAX;for(let i=0;i<4&&over>0;i++){const d=Math.min(c[i],over);c[i]-=d;over-=d}}
function clone(G){return JSON.parse(JSON.stringify(G))}

// ---- deck construction (ids are stable per card so art can be cached by id)
function buildMerchantDeck(rng){let seq=0;const mk=(o)=>Object.assign({id:'m'+(++seq)},o);
  return shuffle([...TRADES.map(t=>mk({type:'trade',inp:t[0],out:t[1]})),...GAINS.map(g=>mk({type:'spice',gain:g})),mk({type:'upgrade',n:3})],rng)}
function buildPointDeck(rng){return shuffle(POINTS.map((p,i)=>({id:'p'+i,cost:p.slice(0,4),pts:p[4]})),rng)}

function makeGame(cfg,rng){
  rng=rng||Math.random;const n=cfg.players.length;
  if(n<2||n>5)throw new Error('2–5 players');
  const G={players:cfg.players.map((p,i)=>({name:p.name,ai:!!p.ai,level:p.level||'normal',owner:p.ai?'bot':(p.owner||'local'),online:p.ai?true:(p.online!==false),
      hand:[{id:'s'+i+'a',type:'spice',gain:[2,0,0,0],starter:true},{id:'s'+i+'b',type:'upgrade',n:2,starter:true}],played:[],caravan:START_CUBES[i].slice(),points:[],gold:0,silver:0})),
    mdeck:buildMerchantDeck(rng),market:[],pdeck:buildPointDeck(rng),pmarket:[],gold:n*2,silver:n*2,cur:0,phase:'play',endTriggered:false,over:false,target:n<=3?6:5,turn:1,log:[],round:1,online:!!cfg.online};
  for(let i=0;i<6;i++)G.market.push({card:G.mdeck.pop(),cubes:[0,0,0,0]});
  for(let i=0;i<5;i++)G.pmarket.push(G.pdeck.pop());
  log(G,`New game — ${n} players. The game ends the round someone claims their ${G.target}th point card.`);
  log(G,`<b>${G.players[0].name}</b> is first player.`);
  return G;
}
function log(G,t){G.log.unshift(t);if(G.log.length>120)G.log.length=120}
function coinForSlot(G,idx){if(idx===0)return G.gold>0?'gold':(G.silver>0?'silver':null);if(idx===1)return(G.gold>0&&G.silver>0)?'silver':null;return null}
function score(p){return p.points.reduce((a,c)=>a+c.pts,0)+p.gold*3+p.silver+p.caravan[1]+p.caravan[2]+p.caravan[3]}
function ranking(G){return G.players.map((p,i)=>({p,i,s:score(p)})).sort((a,b)=>b.s-a.s||b.i-a.i)} // tie: later in turn order wins

// ---- primitive moves (assume already validated)
function moveToPlayed(p,card){p.hand=p.hand.filter(c=>c!==card);p.played.push(card)}
function doPlaySpice(G,p,card){card.gain.forEach((x,i)=>p.caravan[i]+=x);moveToPlayed(p,card);log(G,`<b>${p.name}</b> played ${cubesTxt(card.gain)}.`)}
function doPlayTrade(G,p,card,times){card.inp.forEach((x,i)=>p.caravan[i]-=x*times);card.out.forEach((x,i)=>p.caravan[i]+=x*times);moveToPlayed(p,card);
  log(G,`<b>${p.name}</b> traded ${cubesTxt(card.inp.map(x=>x*times))} → ${cubesTxt(card.out.map(x=>x*times))}${times>1?` (×${times})`:''}.`)}
function doPlayUpgrade(G,p,card,ups){ups.forEach(i=>{p.caravan[i]--;p.caravan[i+1]++});moveToPlayed(p,card);
  log(G,`<b>${p.name}</b> upgraded ${ups.length} cube${ups.length!==1?'s':''}${ups.length?' ('+ups.map(i=>SPNAME[SP[i]]+'→'+SPNAME[SP[i+1]]).join(', ')+')':''}.`)}
function doAcquire(G,p,idx,payment){
  for(let k=0;k<idx;k++){p.caravan[payment[k]]--;G.market[k].cubes[payment[k]]++}
  const slot=G.market[idx];slot.cubes.forEach((x,i)=>p.caravan[i]+=x);p.hand.push(slot.card);G.market.splice(idx,1);
  if(G.mdeck.length)G.market.push({card:G.mdeck.pop(),cubes:[0,0,0,0]});
  log(G,`<b>${p.name}</b> acquired ${cardTxt(slot.card)}${idx?` for ${idx} cube${idx>1?'s':''}`:' (free)'}${total(slot.cubes)?`, collecting ${cubesTxt(slot.cubes)} from it`:''}.`);
}
function doRest(G,p){p.hand.push(...p.played);p.played=[];log(G,`<b>${p.name}</b> rested and took back ${p.hand.length} cards.`)}
function doClaim(G,p,idx){
  const pc=G.pmarket[idx];pc.cost.forEach((x,i)=>p.caravan[i]-=x);p.points.push(pc);
  const c=coinForSlot(G,idx);if(c==='gold'){G.gold--;p.gold++}else if(c==='silver'){G.silver--;p.silver++}
  G.pmarket.splice(idx,1);if(G.pdeck.length)G.pmarket.push(G.pdeck.pop());
  log(G,`<b>${p.name}</b> claimed a <b>${pc.pts}</b>-point card${c?` and a ${c} coin`:''}. (${p.points.length}/${G.target})`);
  if(p.points.length>=G.target&&!G.endTriggered){G.endTriggered=true;log(G,`<b>Final round!</b> ${p.name} has ${p.points.length} point cards — play continues to the end of this round.`)}
}
function endTurn(G){const p=G.players[G.cur];if(total(p.caravan)>CARAVAN_MAX){if(p.ai){trimTo10(p.caravan);log(G,`<b>${p.name}</b> discarded down to ${CARAVAN_MAX} cubes.`)}else{G.phase='discard';return}}advance(G)}
function advance(G){G.phase='play';const next=(G.cur+1)%G.players.length;
  if(next===0){if(G.endTriggered){G.over=true;finish(G);return}G.round++}
  G.cur=next;G.turn++}
function finish(G){const r=ranking(G);G.winner=r[0].i;log(G,`<b>Game over.</b> ${r[0].p.name} wins with ${r[0].s} points.`)}

/* One entry point for every move, human or bot, local or remote.
   Validates and applies; returns an error string, or null on success. */
function applyAction(G,seat,a){
  if(!G||G.over)return 'The game is over.';
  if(G.cur!==seat)return 'Not your turn.';
  const p=G.players[seat];if(!a||typeof a!=='object')return 'Bad action.';
  if(G.phase==='discard'){
    if(a.k!=='discard')return `Return cubes down to ${CARAVAN_MAX} first.`;
    const i=a.i|0;if(i<0||i>3||p.caravan[i]<1)return 'No such cube.';
    p.caravan[i]--;log(G,`<b>${p.name}</b> returned a ${SPNAME[SP[i]]} cube.`);
    if(total(p.caravan)<=CARAVAN_MAX)advance(G);return null;
  }
  const card=a.id?p.hand.find(c=>c.id===a.id):null;
  switch(a.k){
    case 'spice':if(!card||card.type!=='spice')return 'Card not in hand.';doPlaySpice(G,p,card);break;
    case 'trade':{if(!card||card.type!=='trade')return 'Card not in hand.';const t=a.times|0;if(t<1||t>tradeMax(p.caravan,card))return 'Not enough cubes for that trade.';doPlayTrade(G,p,card,t);break}
    case 'upgrade':{if(!card||card.type!=='upgrade')return 'Card not in hand.';const ups=Array.isArray(a.ups)?a.ups.map(x=>x|0):[];if(ups.length>card.n)return 'Too many upgrades.';
      const w=p.caravan.slice();for(const i of ups){if(i<0||i>2||w[i]<1)return 'Invalid upgrade.';w[i]--;w[i+1]++}doPlayUpgrade(G,p,card,ups);break}
    case 'acquire':{const idx=a.idx|0;if(idx<0||idx>=G.market.length)return 'No such card.';if(idx>total(p.caravan))return 'Not enough cubes to reach that card.';
      const pay=Array.isArray(a.pay)?a.pay.map(x=>x|0):[];if(pay.length!==idx)return 'Choose one cube per card to the left.';
      const w=p.caravan.slice();for(const i of pay){if(i<0||i>3||w[i]<1)return 'You do not have those cubes.';w[i]--}doAcquire(G,p,idx,pay);break}
    case 'claim':{const idx=a.idx|0;if(idx<0||idx>=G.pmarket.length)return 'No such card.';if(!canAfford(p.caravan,G.pmarket[idx].cost))return 'You cannot afford that card.';doClaim(G,p,idx);break}
    case 'rest':doRest(G,p);break;
    default:return 'Unknown action.';
  }
  endTurn(G);return null;
}

/* ================================================================
   BOTS — three levels.
   easy:   greedy one-ply with noise (makes mistakes)
   normal: greedy one-ply (values cubes 1/2/3/4, nearness to point cards)
   hard:   two-ply search over its own turns with a fuller evaluation
   ================================================================ */
function legalActions(G,seat){
  const p=G.players[seat],out=[];
  if(G.phase==='discard'){for(let i=0;i<4;i++)if(p.caravan[i])out.push({k:'discard',i});return out}
  G.pmarket.forEach((pc,idx)=>{if(canAfford(p.caravan,pc.cost))out.push({k:'claim',idx})});
  for(const card of p.hand){
    if(card.type==='spice')out.push({k:'spice',id:card.id});
    else if(card.type==='trade'){const m=tradeMax(p.caravan,card);for(let t=1;t<=m;t++)out.push({k:'trade',id:card.id,times:t})}
    else{const seen=new Set();const rec=(c,left,seq)=>{if(seq.length){const key=seq.slice().sort().join('');if(!seen.has(key)){seen.add(key);out.push({k:'upgrade',id:card.id,ups:seq.slice()})}}
        if(!left)return;for(let i=0;i<3;i++)if(c[i]>0){c[i]--;c[i+1]++;seq.push(i);rec(c,left-1,seq);seq.pop();c[i]++;c[i+1]--}};rec(p.caravan.slice(),card.n,[])}
  }
  const n=total(p.caravan);G.market.forEach((slot,idx)=>{if(idx<=n)out.push({k:'acquire',idx,pay:cheapest(p.caravan,idx)})});
  if(p.played.length)out.push({k:'rest'});
  return out;
}
// Simulate our own move on a clone, resolve any discard, and hand the turn straight back to us
// (opponents are not modelled). Decks are hidden so refills do not leak information.
function simulate(G,seat,a){
  const H=clone(G);H.mdeck=[];H.pdeck=[];H.players[seat].ai=true;H.log=[];
  const err=applyAction(H,seat,a);if(err)return null;
  if(H.over)return H;H.cur=seat;H.phase='play';return H;
}
function evalState(G,seat){ // static evaluation from one seat's point of view
  const p=G.players[seat];
  // banked points count fully; cubes count at a discount so converting them into a card is always progress
  let s=p.points.reduce((a,c)=>a+c.pts,0)+p.gold*3+p.silver;
  s+=value(p.caravan)*0.7;
  // how close the caravan is to the best point card on offer (small: the search sees actual claims)
  let close=0;for(const pc of G.pmarket){const short=pc.cost.reduce((a,x,i)=>a+Math.max(0,x-p.caravan[i])*VAL[i],0);close=Math.max(close,pc.pts*Math.max(0,1-short/value(pc.cost))*0.2)}
  s+=close;
  // engine quality: what the hand+played can generate per cycle
  let eng=0;for(const c of [...p.hand,...p.played]){if(c.type==='trade')eng+=Math.max(0,value(c.out)-value(c.inp))*Math.min(3,Math.floor(CARAVAN_MAX/Math.max(1,total(c.inp))));else if(c.type==='spice')eng+=value(c.gain);else eng+=c.n*1.5}
  s+=Math.min(eng,36)*0.15;
  s-=Math.max(0,p.hand.length+p.played.length-7)*1.2;   // bloated hands mean more rests
  s+=p.points.length*1.5;                                // tempo: cards claimed bring the end closer on our terms
  return s;
}
function greedyOptions(G,seat){ // the one-ply heuristic (normal)
  const p=G.players[seat],opts=[];
  const evalCaravan=c=>{let best=0,close=0;for(const pc of G.pmarket){if(canAfford(c,pc.cost))best=Math.max(best,pc.pts);else{const short=pc.cost.reduce((a,x,i)=>a+Math.max(0,x-c[i])*VAL[i],0);close=Math.max(close,pc.pts*Math.max(0,1-short/value(pc.cost))*0.5)}}return value(c)+best*1.2+close};
  const base=evalCaravan(p.caravan);
  G.pmarket.forEach((pc,idx)=>{if(canAfford(p.caravan,pc.cost)){const coin=coinForSlot(G,idx);const cv=coin==='gold'?3:coin==='silver'?1:0;const left=p.caravan.map((x,i)=>x-pc.cost[i]);opts.push({a:{k:'claim',idx},score:pc.pts+cv+value(left)*0.35+(G.endTriggered?6:0)+8})}});
  p.hand.forEach(card=>{
    if(card.type==='spice'){const c=p.caravan.map((x,i)=>x+card.gain[i]);trimTo10(c);opts.push({a:{k:'spice',id:card.id},score:evalCaravan(c)-base+2})}
    else if(card.type==='trade'){const m=tradeMax(p.caravan,card);let bt=0,bs=-1e9;for(let t=1;t<=m;t++){const c=p.caravan.map((x,i)=>x-card.inp[i]*t+card.out[i]*t);trimTo10(c);const s=evalCaravan(c)-base;if(s>bs){bs=s;bt=t}}if(m>0)opts.push({a:{k:'trade',id:card.id,times:bt},score:bs+2})}
    else{let best=null;const rec=(c,left,seq)=>{const s=evalCaravan(c)-base;if(!best||s>best.s)best={s,seq:seq.slice()};if(!left)return;for(let i=0;i<3;i++)if(c[i]>0){c[i]--;c[i+1]++;seq.push(i);rec(c,left-1,seq);seq.pop();c[i]++;c[i+1]--}};rec(p.caravan.slice(),card.n,[]);if(best&&best.seq.length)opts.push({a:{k:'upgrade',id:card.id,ups:best.seq},score:best.s+2})}
  });
  const cubesN=total(p.caravan);
  G.market.forEach((slot,idx)=>{if(idx>cubesN)return;const card=slot.card;let worth=0;
    if(card.type==='spice')worth=value(card.gain)+1;else if(card.type==='trade')worth=(value(card.out)-value(card.inp))*Math.max(1,Math.floor(CARAVAN_MAX/Math.max(1,total(card.out))))+1;else worth=card.n*2;
    const pay=cheapest(p.caravan,idx);const cost=pay.reduce((a,i)=>a+VAL[i],0);const handPenalty=Math.max(0,p.hand.length+p.played.length-7)*2;
    opts.push({a:{k:'acquire',idx,pay},score:worth+value(slot.cubes)-cost*1.1-handPenalty+(G.round<3?2:0)-(G.endTriggered?8:0)})});
  opts.push({a:{k:'rest'},score:p.played.length*2.2-(p.hand.length?1.5:0)+(p.hand.length===0?10:0)});
  opts.sort((a,b)=>b.score-a.score);return opts;
}
function aiChoose(G,seat,level,rng){
  rng=rng||Math.random;level=level||'normal';
  if(G.phase==='discard'){const p=G.players[seat];for(let i=0;i<4;i++)if(p.caravan[i])return{k:'discard',i};return null}
  if(level==='hard'){
    const acts=legalActions(G,seat);let best=null;
    for(const a of acts){
      const H=simulate(G,seat,a);if(!H)continue;
      let v=evalState(H,seat);
      if(!H.over){let b2=-1e9;for(const a2 of legalActions(H,seat)){const H2=simulate(H,seat,a2);if(H2)b2=Math.max(b2,evalState(H2,seat))}if(b2>-1e9)v=v*0.4+b2*0.6}
      if(a.k==='claim')v+=1;                      // points in hand beat points in theory
      if(a.k==='acquire')v-=G.endTriggered?8:1;   // a new card costs a turn to become useful
      if(a.k==='rest')v-=0.5;
      if(!best||v>best.v)best={v,a};
    }
    return best?best.a:{k:'rest'};
  }
  const opts=greedyOptions(G,seat);
  if(level==='easy'){ // a beginner: half the time takes any legal move, and only claims when a card is cheap
    if(rng()<0.5){const acts=legalActions(G,seat).filter(a=>a.k!=='claim'||G.pmarket[a.idx].pts<=10);return acts[Math.floor(rng()*acts.length)]}
    return opts[Math.min(opts.length-1,Math.floor(rng()*2))].a}
  return opts[0].a;
}

const Engine={SP,SPNAME,VAL,TRADES,GAINS,POINTS,START_CUBES,CARAVAN_MAX,
  total,value,canAfford,tradeMax,cheapest,trimTo10,cubesTxt,cardTxt,clone,
  makeGame,applyAction,legalActions,coinForSlot,score,ranking,log,
  aiChoose,evalState,simulate,greedyOptions};
if(typeof module!=='undefined'&&module.exports)module.exports=Engine;else root.Engine=Engine;
})(typeof window!=='undefined'?window:globalThis);
