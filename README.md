# Century: Spice Road — browser table

A fan-made, single-file browser implementation of **Century: Spice Road** (Emerson Matsuuchi, Plan B Games) for 2–5 players: hot-seat humans and/or bots.

- Full official card set: 36 point cards, 43 merchant cards (34 trade · 8 spice · 1 Upgrade 3) plus the starter *Spice 2* / *Upgrade 2* cards.
- Rules per the 2024 rulebook: one action per turn (Play / Acquire / Rest / Claim), 10-cube caravan limit, gold/silver coin piles that slide, end trigger at 5 point cards (6 with 2–3 players), tie-break to the later player in turn order.
- All card illustrations, coins and cubes are drawn procedurally in SVG — no published artwork is used.
- **Play online with friends:** one player hosts and shares a 5-letter room code or link; others join from their own devices. Peer-to-peer over WebRTC (PeerJS for signaling) — the host's browser runs the game, no game server. The host's browser saves the game after every move, so a closed tab or dropped connection can be resumed under the same room code; guests reconnect automatically and keep their seats (or the host can hand a seat to a bot). Uses STUN plus a public TURN relay so most networks can connect.
- No build step, no backend: open `index.html` in a browser (online play needs an internet connection for signaling).

**Play now:** https://nikhilmittal.github.io/century-spice-road/

## Sources
- [Rulebook (Plan B Games, 2024)](https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Century-Spice-Road-Rules_2024_compressed.pdf)
- [Point card list (BGG)](https://boardgamegeek.com/thread/1871993/list-of-contract-objective-victory-point-cards) · [Merchant card list (BGG)](https://boardgamegeek.com/thread/2067607)

Century: Spice Road is © Plan B Games. This is an unofficial project for personal play.
