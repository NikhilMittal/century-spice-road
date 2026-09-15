/* Rules-engine tests. Run with `node --test tests/` or open tests/index.html in a browser. */
(function(root){
'use strict';
const isNode=typeof module!=='undefined'&&module.exports;
const Engine=isNode?require('../engine.js'):root.Engine;
const assert=isNode?require('node:assert/strict'):root.assert;
const test=isNode?require('node:test').test:root.test;
const {SP,VAL,TRADES,GAINS,POINTS,makeGame,applyAction,legalActions,aiChoose,score,ranking,total,value,tradeMax}=Engine;

// deterministic rng (mulberry32) so failures reproduce
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const humans=n=>({players:Array.from({length:n},(_,i)=>({name:'P'+i}))});
const cur=G=>G.players[G.cur];
const handOf=(G,seat,type)=>G.players[seat].hand.find(c=>c.type===type);
const ok=(G,seat,a)=>{const e=applyAction(G,seat,a);assert.equal(e,null,`expected success, got: ${e} for ${JSON.stringify(a)}`)};

// ---------- card data
test('deck composition matches the published game',()=>{
  assert.equal(TRADES.length,34);assert.equal(GAINS.length,8);assert.equal(POINTS.length,36);
  const uniq=a=>new Set(a.map(x=>JSON.stringify(x))).size;
  assert.equal(uniq(TRADES),34);assert.equal(uniq(POINTS),36);assert.equal(uniq(GAINS),8);
});
test('every point card follows the 1/2/3/4 + diversity formula',()=>{
  for(const p of POINTS){const colours=p.slice(0,4).filter(x=>x).length;const bonus=colours===4?2:colours===3?1:0;
    assert.equal(value(p.slice(0,4))+bonus,p[4],`card ${p}`)}
});
test('no trade card loses value',()=>{for(const [i,o] of TRADES)assert.ok(value(o)>=value(i),`${i} -> ${o}`)});

// ---------- setup
test('setup follows the rulebook for each player count',()=>{
  for(let n=2;n<=5;n++){const G=makeGame(humans(n),rng(n));
    assert.equal(G.market.length,6);assert.equal(G.pmarket.length,5);
    assert.equal(G.mdeck.length,43-6);assert.equal(G.pdeck.length,36-5);
    assert.equal(G.gold,2*n);assert.equal(G.silver,2*n);
    assert.equal(G.target,n<=3?6:5);
    const starts=[[3,0,0,0],[4,0,0,0],[4,0,0,0],[3,1,0,0],[3,1,0,0]];
    G.players.forEach((p,i)=>{assert.deepEqual(p.caravan,starts[i]);assert.equal(p.hand.length,2);
      assert.ok(p.hand.some(c=>c.type==='spice'&&c.gain[0]===2));assert.ok(p.hand.some(c=>c.type==='upgrade'&&c.n===2))});
  }
  assert.throws(()=>makeGame(humans(1)));assert.throws(()=>makeGame(humans(6)));
});
test('same seed gives the same deal',()=>{
  const a=makeGame(humans(3),rng(7)),b=makeGame(humans(3),rng(7));
  assert.deepEqual(a.market.map(s=>s.card.id),b.market.map(s=>s.card.id));assert.deepEqual(a.pmarket.map(c=>c.id),b.pmarket.map(c=>c.id));
});

// ---------- turn structure
test('only the current player may act',()=>{
  const G=makeGame(humans(2),rng(1));
  assert.match(applyAction(G,1,{k:'rest'}),/Not your turn/);
  assert.equal(G.cur,0);
});
test('play a spice card: cubes added, card moves to played, turn passes',()=>{
  const G=makeGame(humans(2),rng(1));const c=handOf(G,0,'spice');
  ok(G,0,{k:'spice',id:c.id});
  assert.deepEqual(G.players[0].caravan,[5,0,0,0]);assert.equal(G.players[0].hand.length,1);assert.equal(G.players[0].played[0],c);
  assert.equal(G.cur,1);assert.equal(G.turn,2);
});
test('cannot play a card you do not hold',()=>{
  const G=makeGame(humans(2),rng(1));
  assert.match(applyAction(G,0,{k:'spice',id:'nope'}),/not in hand/i);
  assert.match(applyAction(G,0,{k:'trade',id:handOf(G,0,'spice').id,times:1}),/not in hand/i);
});
test('upgrade: raises one level per step, rejects brown and overspend',()=>{
  const G=makeGame(humans(2),rng(1));const u=handOf(G,0,'upgrade');
  assert.match(applyAction(G,0,{k:'upgrade',id:u.id,ups:[0,0,0]}),/Too many/);
  assert.match(applyAction(G,0,{k:'upgrade',id:u.id,ups:[3]}),/Invalid/);
  assert.match(applyAction(G,0,{k:'upgrade',id:u.id,ups:[1]}),/Invalid/); // no red to upgrade yet
  ok(G,0,{k:'upgrade',id:u.id,ups:[0,1]}); // Y->R then that R->G
  assert.deepEqual(G.players[0].caravan,[2,0,1,0]);
});
test('upgrade may stop early (zero steps is allowed)',()=>{
  const G=makeGame(humans(2),rng(1));const u=handOf(G,0,'upgrade');ok(G,0,{k:'upgrade',id:u.id,ups:[]});
  assert.deepEqual(G.players[0].caravan,[3,0,0,0]);assert.equal(G.players[0].played.length,1);
});
test('trade: repeatable up to what you can pay',()=>{
  const G=makeGame(humans(2),rng(1));const p=G.players[0];
  const card={id:'t',type:'trade',inp:[2,0,0,0],out:[0,0,1,0]};p.hand.push(card);p.caravan=[6,0,0,0];
  assert.equal(tradeMax(p.caravan,card),3);
  assert.match(applyAction(G,0,{k:'trade',id:'t',times:4}),/Not enough/);
  assert.match(applyAction(G,0,{k:'trade',id:'t',times:0}),/Not enough/);
  ok(G,0,{k:'trade',id:'t',times:3});assert.deepEqual(p.caravan,[0,0,3,0]);
});
test('rest returns played cards to hand',()=>{
  const G=makeGame(humans(2),rng(1));const c=handOf(G,0,'spice');ok(G,0,{k:'spice',id:c.id});ok(G,1,{k:'rest'});
  ok(G,0,{k:'rest'});assert.equal(G.players[0].hand.length,2);assert.equal(G.players[0].played.length,0);
});

// ---------- acquire
test('acquire: leftmost is free, the row slides and refills',()=>{
  const G=makeGame(humans(2),rng(1));const first=G.market[0].card,second=G.market[1].card,deckTop=G.mdeck[G.mdeck.length-1];
  ok(G,0,{k:'acquire',idx:0,pay:[]});
  assert.ok(G.players[0].hand.includes(first));assert.equal(G.market[0].card,second);assert.equal(G.market[5].card,deckTop);assert.equal(G.market.length,6);
});
test('acquire: one cube of your choice on each card to the left, collected by whoever takes them',()=>{
  const G=makeGame(humans(2),rng(1));G.players[0].caravan=[2,1,0,0];
  assert.match(applyAction(G,0,{k:'acquire',idx:2,pay:[0]}),/one cube per card/);
  assert.match(applyAction(G,0,{k:'acquire',idx:2,pay:[3,0]}),/do not have/);
  assert.match(applyAction(G,0,{k:'acquire',idx:4,pay:[0,0,0,0]}),/Not enough cubes to reach/);
  ok(G,0,{k:'acquire',idx:2,pay:[1,0]}); // red on card 1, yellow on card 2
  assert.deepEqual(G.players[0].caravan,[1,0,0,0]);
  assert.deepEqual(G.market[0].cubes,[0,1,0,0]);assert.deepEqual(G.market[1].cubes,[1,0,0,0]);
  ok(G,1,{k:'acquire',idx:0,pay:[]}); // player 1 takes the leftmost card and its red cube
  assert.deepEqual(G.players[1].caravan,[4,1,0,0]);
});

// ---------- claim & coins
test('claim: pays cubes, takes the card, gold from slot 0 and silver from slot 1',()=>{
  const G=makeGame(humans(2),rng(1));
  G.players[0].caravan=G.pmarket[0].cost.slice();ok(G,0,{k:'claim',idx:0});
  assert.equal(G.players[0].points.length,1);assert.equal(G.players[0].gold,1);assert.equal(G.gold,3);assert.deepEqual(G.players[0].caravan,[0,0,0,0]);
  assert.equal(G.pmarket.length,5);
  G.players[1].caravan=G.pmarket[1].cost.slice();ok(G,1,{k:'claim',idx:1});
  assert.equal(G.players[1].silver,1);assert.equal(G.silver,3);
  G.players[0].caravan=G.pmarket[3].cost.slice();ok(G,0,{k:'claim',idx:3});
  assert.equal(G.players[0].gold,1);assert.equal(G.players[0].silver,0); // no coin beyond slot 1
});
test('claim: cannot afford is rejected',()=>{
  const G=makeGame(humans(2),rng(1));assert.match(applyAction(G,0,{k:'claim',idx:0}),/cannot afford/);
});
test('when the gold runs out the silver pile slides to the leftmost slot',()=>{
  const G=makeGame(humans(2),rng(1));G.gold=0;G.silver=2;
  G.players[0].caravan=G.pmarket[0].cost.slice();ok(G,0,{k:'claim',idx:0});
  assert.equal(G.players[0].silver,1);
  G.players[1].caravan=G.pmarket[1].cost.slice();ok(G,1,{k:'claim',idx:1});
  assert.equal(G.players[1].silver,0); // slot 1 has nothing above it now
});

// ---------- caravan limit
test('a human over 10 cubes must discard before the turn passes',()=>{
  const G=makeGame(humans(2),rng(1));G.players[0].caravan=[9,0,0,0];const c=handOf(G,0,'spice');
  ok(G,0,{k:'spice',id:c.id});
  assert.equal(G.phase,'discard');assert.equal(G.cur,0);
  assert.match(applyAction(G,0,{k:'rest'}),/Return cubes/);
  assert.match(applyAction(G,0,{k:'discard',i:3}),/No such cube/);
  ok(G,0,{k:'discard',i:0});
  assert.equal(G.phase,'play');assert.equal(G.cur,1);assert.equal(total(G.players[0].caravan),10);
});
test('a bot over 10 cubes discards its cheapest cubes automatically',()=>{
  const G=makeGame({players:[{name:'B',ai:true},{name:'H'}]},rng(1));G.players[0].caravan=[8,0,0,1];const c=handOf(G,0,'spice');
  ok(G,0,{k:'spice',id:c.id});
  assert.equal(G.phase,'play');assert.deepEqual(G.players[0].caravan,[9,0,0,1]);
});

// ---------- game end & scoring
test('game ends after the round in which someone reaches the target',()=>{
  const G=makeGame(humans(3),rng(2));const p=G.players[1];
  p.points=Array.from({length:5},(_,i)=>({id:'x'+i,cost:[0,0,0,0],pts:6}));
  ok(G,0,{k:'rest'});
  p.caravan=G.pmarket[0].cost.slice();ok(G,1,{k:'claim',idx:0}); // 6th card
  assert.ok(G.endTriggered);assert.ok(!G.over,'others still finish the round');
  ok(G,2,{k:'rest'});
  assert.ok(G.over);assert.equal(typeof G.winner,'number');
  assert.match(applyAction(G,0,{k:'rest'}),/over/);
});
test('score = cards + 3/gold + 1/silver + 1 per non-turmeric cube; ties go to the later seat',()=>{
  const p={points:[{pts:10},{pts:7}],gold:2,silver:1,caravan:[5,1,1,1]};assert.equal(score(p),10+7+6+1+3);
  const G={players:[{name:'a',points:[{pts:10}],gold:0,silver:0,caravan:[0,0,0,0]},{name:'b',points:[{pts:10}],gold:0,silver:0,caravan:[0,0,0,0]}]};
  assert.equal(ranking(G)[0].i,1);
});

// ---------- bots
test('legalActions only returns actions the engine accepts',()=>{
  const r=rng(11);
  for(let g=0;g<20;g++){const G=makeGame({players:[{name:'a',ai:true},{name:'b',ai:true},{name:'c',ai:true}]},r);
    for(let t=0;t<30&&!G.over;t++){const acts=legalActions(G,G.cur);assert.ok(acts.length>0);
      for(const a of acts){const H=Engine.clone(G);assert.equal(applyAction(H,H.cur,a),null,JSON.stringify(a))}
      applyAction(G,G.cur,acts[Math.floor(r()*acts.length)]);}
  }
});
for(const level of ['easy','normal','hard']){
  test(`${level} bots play whole games without illegal moves`,()=>{
    const r=rng(level.length*13);
    for(let g=0;g<(level==='hard'?4:12);g++){const n=2+(g%4);
      const G=makeGame({players:Array.from({length:n},(_,i)=>({name:'B'+i,ai:true,level}))},r);
      let turns=0;while(!G.over&&turns<600){const a=aiChoose(G,G.cur,level,r);const e=applyAction(G,G.cur,a);assert.equal(e,null,`${level}: ${e} ${JSON.stringify(a)}`);turns++}
      assert.ok(G.over,`${level} game did not finish in 600 turns`);
      assert.equal(G.players.filter(p=>p.points.length>=G.target).length>=1,true);
    }
  });
}
test('hard bot does not lose to normal bot on average (head-to-head)',()=>{
  const r=rng(99);let hardWins=0,N=16;
  for(let g=0;g<N;g++){const hardSeat=g%2;
    const G=makeGame({players:[{name:'A',ai:true,level:hardSeat===0?'hard':'normal'},{name:'B',ai:true,level:hardSeat===1?'hard':'normal'}]},r);
    let t=0;while(!G.over&&t++<600){applyAction(G,G.cur,aiChoose(G,G.cur,G.players[G.cur].level,r))}
    if(G.winner===hardSeat)hardWins++;
  }
  assert.ok(hardWins>=N*0.5,`hard won ${hardWins}/${N}`);
});
})(typeof globalThis!=='undefined'?globalThis:window);
