/* Century: Spice Road — online play. WebRTC data channels via PeerJS; the host is authoritative.
   The host persists the game + room code locally after every change, so a closed tab or dropped
   connection can be resumed under the same room ID; guests reconnect automatically and reclaim
   their seat by name. Shared state lives here: S (game), UI (this device's selection), NET. */
'use strict';
let S=null;                 // authoritative game state (host / hot-seat) or the latest copy (guest)
let UI={mode:'idle'};       // this device's in-progress selection — never shared
const NET={mode:'local',role:null,peer:null,host:null,conns:new Map(),code:null,myId:'local',mySeat:null,lobby:null,name:'',attempt:0,retryTimer:null};

/* ================================================================
   NETWORK — WebRTC data channels via PeerJS; the host is authoritative.
   The host persists the game + room code locally after every change,
   so a closed tab or dropped connection can be resumed under the same
   room ID; guests reconnect automatically and reclaim their seat by name.
   ================================================================ */
const ROOM_PREFIX='csr-v1-';
// STUN for direct connections, plus a public TURN relay (Open Relay Project) for networks that block peer-to-peer.
const PEER_CFG={debug:0,config:{iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},{urls:['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp'],username:'openrelayproject',credential:'openrelayproject'}]}};
const CONNECT_TIMEOUT=15000;
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode=()=>Array.from({length:5},()=>CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join('');
const cleanName=s=>String(s||'').replace(/[<>]/g,'').trim().slice(0,18)||'Trader';
function netReset(){clearTimeout(NET.retryTimer);NET.retryTimer=null;try{NET.peer&&NET.peer.destroy()}catch(e){}NET.mode='local';NET.role=null;NET.peer=null;NET.host=null;NET.conns=new Map();NET.code=null;NET.myId='local';NET.mySeat=null;NET.lobby=null;NET.attempt=0;renderHeader()}
function peerAvailable(){return typeof window.Peer==='function'}

// ---- host persistence
function saveHost(){if(NET.role!=='host'||!S||!S.online)return;try{if(S.over)localStorage.removeItem('csr-host');else localStorage.setItem('csr-host',JSON.stringify({S,code:NET.code,name:NET.name,t:Date.now()}))}catch(e){}}
function loadHost(){try{const j=JSON.parse(localStorage.getItem('csr-host'));if(j&&j.S&&j.S.players&&j.code&&!j.S.over)return j}catch(e){}return null}
function clearHost(){try{localStorage.removeItem('csr-host')}catch(e){}}
function saveGuest(){if(NET.role!=='guest'||!S)return;try{if(S.over)localStorage.removeItem('csr-guest');else localStorage.setItem('csr-guest',JSON.stringify({code:NET.code,name:NET.name,t:Date.now()}))}catch(e){}}
function loadGuest(){try{const j=JSON.parse(localStorage.getItem('csr-guest'));if(j&&j.code&&j.name&&Date.now()-j.t<12*3600e3)return j}catch(e){}return null}
function clearGuest(){try{localStorage.removeItem('csr-guest')}catch(e){}}

// ---- host
function attachConn(conn){conn.on('data',m=>onHostMsg(conn,m));conn.on('close',()=>onGuestLeft(conn));conn.on('error',()=>onGuestLeft(conn));setTimeout(()=>{if(!conn.open)try{conn.close()}catch(e){}},CONNECT_TIMEOUT+2000)}
function openHostPeer(opts){ // opts: {fresh:true} picks a new code on collision; resume keeps it
  const code=NET.code;const peer=new Peer(ROOM_PREFIX+code,PEER_CFG);NET.peer=peer;
  peer.on('open',()=>{NET.attempt=0;renderHeader();if(S&&S.online){toast(`Room ${code} is open again`);render()}else showLobby()});
  peer.on('connection',attachConn);
  peer.on('disconnected',()=>{ // lost the signaling server (e.g. host's internet blipped); existing data channels may survive
    if(peer.destroyed||NET.peer!==peer)return;renderHeader('reconnecting');
    NET.retryTimer=setTimeout(()=>{if(!peer.destroyed&&NET.peer===peer)try{peer.reconnect()}catch(e){}},1500)});
  peer.on('error',e=>{
    if(NET.peer!==peer)return;
    if(e.type==='unavailable-id'){ // the old session may still hold the id for a moment
      if(opts.fresh){NET.code=genCode();try{peer.destroy()}catch(x){}return openHostPeer(opts)}
      if(NET.attempt++<8){toast('Room ID still held by the old session — retrying…');try{peer.destroy()}catch(x){}NET.retryTimer=setTimeout(()=>openHostPeer(opts),3000);return}
      return netError({message:`Room ${code} could not be reopened. Try again in a minute.`});
    }
    if(e.type==='network'||e.type==='server-error'||e.type==='socket-error'||e.type==='socket-closed'){
      if(NET.attempt++<30){renderHeader('reconnecting');try{peer.destroy()}catch(x){}NET.retryTimer=setTimeout(()=>openHostPeer(opts),4000);return}
      return netError({message:'The connection service could not be reached for a while. Your game is saved — choose Resume from New game when you are back online.'});
    }
    if(e.type==='peer-unavailable')return; // a guest we tried to reach is gone; handled by close
    console.warn('peer error',e);
  });
}
function hostGame(name){
  netReset();NET.mode='online';NET.role='host';NET.myId='host';NET.name=name;NET.code=genCode();
  NET.lobby=[{name,owner:'host',ai:false,online:true}];
  showLobby('Opening room…');openHostPeer({fresh:true});
}
function resumeHost(saved){
  netReset();NET.mode='online';NET.role='host';NET.myId='host';NET.name=saved.name;NET.code=saved.code;
  S=saved.S;S.players.forEach(p=>{if(!p.ai&&p.owner!=='host')p.online=false});
  NET.mySeat=S.players.findIndex(p=>p.owner==='host');UI={mode:'idle'};
  Engine.log(S,`<b>Game resumed</b> in room ${NET.code}. Other players reconnect by joining with the same name.`);
  closeModal();render();openHostPeer({fresh:false});saveHost();maybeAI();
}
function onHostMsg(conn,m){
  if(!m||typeof m!=='object')return;
  if(m.t==='hello'){
    const name=cleanName(m.name);
    if(S&&S.online){ // game in progress: a dropped player reclaims their seat by name
      const seat=S.players.findIndex(p=>!p.ai&&p.owner!=='host'&&!p.online&&p.name===name);
      if(seat<0){conn.send({t:'err',msg:S.players.some(p=>p.name===name&&p.online)?`Someone is already playing as ${name}.`:'That game is already in progress.',fatal:true});return}
      S.players[seat].owner=conn.peer;S.players[seat].online=true;NET.conns.set(conn.peer,conn);Engine.log(S,`<b>${name}</b> reconnected.`);afterChange();return;
    }
    if(!NET.lobby){conn.send({t:'err',msg:'The host is not in a lobby.',fatal:true});return}
    if(NET.lobby.length>=5){conn.send({t:'err',msg:'The room is full (5 seats).',fatal:true});return}
    NET.conns.set(conn.peer,conn);
    let n=name,k=2;while(NET.lobby.some(x=>x.name===n))n=name+' '+(k++);
    NET.lobby.push({name:n,owner:conn.peer,ai:false,online:true});broadcastLobby();showLobby();
  }else if(m.t==='act'){
    if(!S)return;const seat=S.players.findIndex(p=>p.owner===conn.peer);if(seat<0)return;
    const err=Engine.applyAction(S,seat,m.a);if(err){conn.send({t:'err',msg:err});return}afterChange();
  }
}
function onGuestLeft(conn){
  if(NET.role!=='host')return;if(NET.conns.get(conn.peer)!==conn)return;NET.conns.delete(conn.peer);
  if(S&&S.online){const p=S.players.find(x=>x.owner===conn.peer);if(p&&p.online){p.online=false;Engine.log(S,`<b>${p.name}</b> lost connection — they can rejoin with the same name, or you can hand their seat to a bot.`);afterChange()}}
  else if(NET.lobby){NET.lobby=NET.lobby.filter(x=>x.owner!==conn.peer);broadcastLobby();showLobby()}
}
function broadcastLobby(){if(NET.role!=='host'||!NET.lobby)return;const msg={t:'lobby',code:NET.code,players:NET.lobby.map(x=>({name:x.name,ai:x.ai,host:x.owner==='host'}))};NET.conns.forEach(c=>{if(c.open)c.send(msg)})}
function broadcastState(){if(NET.role!=='host'||!S||!S.online)return;NET.conns.forEach((c,id)=>{if(!c.open)return;const seat=S.players.findIndex(p=>p.owner===id);if(seat>=0)c.send({t:'state',S,seat})})}
function hostStart(){
  if(NET.lobby.length<2){toast('Need at least 2 players.');return}
  closeModal();newGame({players:NET.lobby.map(x=>({name:x.name,ai:x.ai,level:x.level,owner:x.owner})),online:true});NET.mySeat=S.players.findIndex(p=>p.owner==='host');NET.lobby=null;render();
}

// ---- guest
function joinGame(code,name,auto){
  const attempt=auto?(NET.attempt||0):0;
  netReset();NET.mode='online';NET.role='guest';NET.name=name;NET.code=code;NET.attempt=attempt;
  const peer=new Peer(PEER_CFG);NET.peer=peer;
  if(auto)showDisconnected();else showLobby('Connecting…');
  peer.on('open',id=>{NET.myId=id;const conn=peer.connect(ROOM_PREFIX+code,{serialization:'json',reliable:true});NET.host=conn;
    const timer=setTimeout(()=>{if(NET.host!==conn||conn.open)return;try{conn.close()}catch(e){} // ICE never completed — WebRTC gives no close event for this
      if(S&&S.online)disconnected();else netError({message:`Found room ${code} but could not open a direct connection to the host (timed out). This is usually a network that blocks peer-to-peer traffic — try again, or from a different network / mobile hotspot.`})},CONNECT_TIMEOUT);
    conn.on('open',()=>{clearTimeout(timer);NET.attempt=0;conn.send({t:'hello',name});renderHeader()});
    conn.on('data',onGuestMsg);
    conn.on('close',()=>{if(NET.host===conn)disconnected()});conn.on('error',()=>{if(NET.host===conn)disconnected()});
  });
  peer.on('error',e=>{
    if(NET.peer!==peer)return;
    if(e.type==='peer-unavailable'){if(S&&S.online)disconnected();else netError({message:`No room “${code}” was found. Check the code — the host must have the game open.`});return}
    if(e.type==='network'||e.type==='server-error'||e.type==='socket-error'||e.type==='socket-closed'){if(S&&S.online)disconnected();else netError(e);return}
    console.warn('peer error',e);
  });
}
function onGuestMsg(m){
  if(!m||typeof m!=='object')return;
  if(m.t==='lobby'){NET.lobby=m.players;NET.code=m.code;showLobby()}
  else if(m.t==='state'){const turnChanged=!S||S.turn!==m.S.turn||S.phase!==m.S.phase;S=m.S;NET.mySeat=m.seat;NET.attempt=0;if(turnChanged)UI={mode:'idle'};if($('#modals .lobby')||$('#modals .dc'))closeModal();saveGuest();render()}
  else if(m.t==='err'){toast(m.msg);if(m.fatal){clearGuest();netReset();showMenu()}}
}
function disconnected(){ // keep trying to get back to the host; the host may be resuming from a closed tab
  if(NET.role!=='guest')return;
  NET.attempt=(NET.attempt||0)+1;
  showDisconnected();
  clearTimeout(NET.retryTimer);
  if(NET.attempt<=60)NET.retryTimer=setTimeout(()=>joinGame(NET.code,NET.name,true),Math.min(3000+NET.attempt*500,8000));
}
function showDisconnected(){
  const n=NET.attempt||0,gaveUp=n>60;
  $('#modals').innerHTML=`<div class="overlay"><div class="modal dc"><h2>Connection lost</h2>
  <p>The link to the host dropped. ${gaveUp?'Automatic retries have stopped.':`Trying to reconnect to room <b>${esc(NET.code)}</b> as <b>${esc(NET.name)}</b>… <span class="num">(attempt ${n})</span>`}</p>
  <p style="color:var(--parch-muted);font-size:14px">If the host closed their tab, ask them to reopen the site and choose <i>Resume</i> — your seat is kept and this will reconnect on its own.</p>
  <div class="foot"><button class="btn" id="mLeave">Leave game</button><button class="btn primary" id="mRejoin">Retry now</button></div></div></div>`;
  $('#mLeave').onclick=()=>{clearGuest();netReset();closeModal();showMenu()};
  $('#mRejoin').onclick=()=>{clearTimeout(NET.retryTimer);joinGame(NET.code,NET.name,true)};
}
function netError(e){
  const hosted=location.hostname.endsWith('claude.ai')||location.protocol==='file:';
  const msg=hosted?'Online play needs the standalone site — open <a href="https://nikhilmittal.github.io/century-spice-road/">nikhilmittal.github.io/century-spice-road</a> and host from there.':(e&&e.message?esc(e.message):'The connection service could not be reached.');
  netReset();
  $('#modals').innerHTML=`<div class="overlay"><div class="modal"><h2>Could not connect</h2><p>${msg}</p><div class="foot"><button class="btn primary" id="mClose">Back</button></div></div></div>`;
  $('#mClose').onclick=()=>{closeModal();showMenu()};
}
let toastTimer=null;
function toast(msg){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800)}
function renderHeader(state){const el=$('#roomchip');if(!el)return;
  if(NET.mode==='online'&&NET.code){const live=NET.peer&&NET.peer.open&&state!=='reconnecting';el.innerHTML=`<span class="chip ${live?'':'warn'}">Room <b>${esc(NET.code)}</b> · ${NET.role==='host'?'hosting':'guest'}${live?'':' · reconnecting…'}</span>`}else el.innerHTML=''}

