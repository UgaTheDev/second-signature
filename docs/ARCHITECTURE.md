# Architecture

```mermaid
flowchart LR
  subgraph In["What comes in"]
    Phone["Her phone line<br/>Twilio calls + conferences"]
    Nessie["The bank<br/>Nessie: purchases, deposits"]
    CRS["Who she is<br/>CRS: identity, credit file, deceased flag"]
    World["The outside world<br/>Treasury DNE / FS-133 notices<br/>FTC alerts: Apify actor → Elastic"]
  end

  subgraph Decide["What decides (server/, FastAPI)"]
    Shield["Scam Shield<br/>Cartesia Ink + Claude Haiku<br/>shield.py"]
    Estate["Estate desk<br/>estate.py + Claude Opus 'Why?'"]
    Triage["Overnight triage<br/>Claude Opus · triage.py"]
    Voice["Voice agent<br/>Pipecat · Cartesia Sonic · Claude Haiku<br/>bot.py, calltools.py, verify.py"]
    Droid["Factory Droid<br/>policy.md edits · review.py"]
  end

  Gate{{"gate.py: AI may hold, call, draft, explain<br/>only a human releases, posts, signs, moves money"}}

  subgraph Out["Who sees it, who signs"]
    Convex[("Convex<br/>cases · actions · transcript<br/>estates · append-only journal")]
    Dash["Dashboard<br/>Next.js on Vercel, live queries"]
    Human["Controller + analyst"]
    People["Dolores + Susan"]
  end

  Phone --> Shield
  Phone <--> Voice
  Nessie --> Triage
  Nessie --> Estate
  CRS --> Triage
  CRS --> Estate
  CRS --> Voice
  World --> Triage
  World --> Estate
  Shield --> Gate
  Triage --> Gate
  Estate --> Gate
  Voice --> Gate
  Droid --> Gate
  Gate --> Convex
  Convex --> Dash
  Dash --> Human
  Human -- "sign / release / approve diff" --> Gate
  Shield -- "whisper" --> People
  Voice -- "calm call, family bridge" --> People
```

**The three beats on this map**
1. **The fake collector:** Phone → Scam Shield → whisper to Dolores. The 24-hour hold on gift cards goes through the gate.
2. **Harold's books:** Nessie deposits, CRS and Treasury notices → estate desk → gate → Convex journal → the controller signs.
3. **The calm call:** voice agent ↔ Dolores, verified from CRS, with an offer to bridge Susan.
