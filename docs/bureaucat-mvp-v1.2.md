BureauCat MVP Specification v1.2

Finální specifikace pro Step 3 (Replit Build)

⸻

1. Účel systému

BureauCat je nástroj pro budování, správu a zpřesňování modelu případu.

Není:

* právník
* rozhodovací autorita
* expertní systém

Je:

* analytický partner
* správce znalostí případu
* pomocník při orientaci v dokumentech
* nástroj pro identifikaci rizik, rozporů a nejasností

⸻

2. Základní princip

Centrem systému není AI.

Centrem systému je:

Case Model

AI pouze pomáhá model budovat a aktualizovat.

⸻

3. Filosofie odpovědnosti

BureauCat neuchovává objektivní pravdu.

BureauCat uchovává pracovní model případu.

AI:

* navrhuje
* analyzuje
* upozorňuje na rozpory
* upozorňuje na nejistoty

Uživatel:

* rozhoduje
* schvaluje
* upravuje model případu
* nese odpovědnost za jeho obsah

Rozpor mezi Journalem a dokumentací není chyba systému.

Je to informace.

⸻

4. Architektonický model

Documents
     ↓
 Evidence
     ↓
 Case Model
     ↑
     AI
     ↑
    Chat

Case Model je autoritativní zdroj informací.

Chat i AI jsou pracovní nástroje.

⸻

5. Hlavní objekty

Case

Jedna řešená situace.

Příklady:

* dědictví
* reklamace
* škola
* pojišťovna
* přestupek

⸻

Pole:

id
title
area
status
created_at
updated_at

⸻

Status:

draft
active
closed

⸻

Case vzniká okamžitě při zahájení intake dialogu.

Po dokončení intake přechází do stavu:

active

⸻

Document

Zdrojová evidence.

⸻

Pole:

id
case_id
filename
filetype
original_file
extracted_text
ai_summary
created_at

⸻

Podporované formáty:

PDF
DOCX
TXT
JPG
PNG

⸻

Fotografie a skeny:

* OCR přes GPT Vision
* extrahovaný text je uložen stejně jako běžný dokument
* položky vzniklé pouze z OCR mají výchozí Evidence State = Unverified
* systém doporučuje ověření oproti originálu

⸻

6. Journal

Journal představuje aktuální model případu.

Je hlavní navigací systému.

⸻

Sekce:

Description
Goals
Risks
Open Questions
Strategy

________

Upřesnění Description:
- description není jeden souvislý text.
- description je kolekce Journal Items v sekci Description

Příklad zápisu:
Description

[FACT]
Vozidlo bylo zakoupeno dne 12.5.

[CLAIM]
Úřad tvrdí, že převod neproběhl.

[FACT]
Uživatel je veden jako vlastník v registru.

⸻

7. Journal Item

Základní stavební kámen systému.

⸻

Struktura:

id
section
item_type
title
value
explanation
evidence_state
status
display_order
source_links[]
created_at
updated_at

⸻

Item Types

FACT
CLAIM
GOAL
QUESTION
ACTION
RISK

⸻

Evidence State

Verified

✅

Podloženo dokumentací.

⸻

Inferred

🟦

Odvozeno AI.

⸻

Unverified

🟨

Nepodloženo dokumentací.

⸻

Conflict

🟥

Rozpor mezi Journalem a evidencí.

⸻

Status

active
resolved
obsolete

⸻

Editace Journal Item

Journal Item lze upravit uživatelem.

Po editaci:
- systém zachová source_links
- systém přepočítá evidence_state
- pokud upravený obsah odporuje zdroji, položka dostane Evidence State = conflict

_____

Source Links

Každá položka musí být dohledatelná.

Formát:

{
  "document_name": "Výzva pojišťovny",
  "quoted_text": "účastník doplní podklady do 15 dnů"
}

⸻

Přesné pozice:

page
paragraph
coordinates

nejsou součástí MVP.

⸻

8. Princip rozporů

Uživatel může změnit jakoukoli položku.

Systém změnu neblokuje.

⸻

Příklad:

Dokument:

15.6.

Journal:

25.6.

⸻

Systém označí:

🟥 Conflict

⸻

Odpovědnost zůstává na uživateli.

⸻

Evidence State Recheck

Po:
- schválení AI Suggestion
- editaci Journal Item
- nahrání nového dokumentu

systém provede přepočet Evidence State.

Cílem je zajistit, aby Evidence State odpovídal aktuálnímu stavu evidence.

_____

9. AI Suggestions

AI nikdy nezapisuje přímo do Journalu.

⸻

Workflow:

AI vytvoří návrh
↓
User schválí
↓
Vznikne Journal Item

⸻

Stavy:

pending
approved
rejected

⸻

Upřesnění:
Schválení může proběhnout:
- Approve as-is
- Edit + Approve

Backend:
POST /api/suggestions/:id/approve

{
  "edited_item": {...}
}

____


10. Chat

Chat je pracovní prostor.

Není pamětí systému.

⸻

Použití:

* dotazy
* analýza
* vysvětlování
* návrhy
* plánování

⸻

Pamětí systému je Journal.

⸻

11. Intake

Každý případ začíná intake dialogem.

____

Case vzniká okamžitě při zahájení intake dialogu ve stavu draft.

Intake odpovědi se ukládají jako běžné ChatMessages.

Nevzniká samostatná entita Intake.

⸻

Otázky:

1. Co se děje?
2. Jaký je váš cíl?
3. Jaké dokumenty máte?
4. Existují termíny nebo lhůty?

⸻

Pokud uživatel nezná odpověď:

AI pokračuje.

Chybějící informace navrhne jako:

Open Questions

⸻

Po dokončení intake:

AI navrhne první Journal Items.

Po schválení:

Case přechází do stavu:

active

⸻

12. Layout

Primární rozhraní

Desktop / iPad Landscape

⸻

┌──────────────┬─────────────────┬──────────────┐
│   JOURNAL    │      CHAT       │   EVIDENCE   │
└──────────────┴─────────────────┴──────────────┘

⸻

Levý panel

Journal

Sekce:

Description
Goals
Risks
Open Questions
Strategy

⸻

Střední panel

Chat

⸻

Pravý panel

Pravý panel má 3 režimy:

1. Help State – výchozí stav
2. Evidence Panel – detail vybrané Journal Item
3. Document View – zobrazení dokumentu

⸻

13. Evidence Panel

Po kliknutí na položku Journalu zobrazí:

Title
Value
Explanation
Evidence State
Zdroj
Citace

⸻

Pokud existuje dokument:

umožní otevření dokumentu.

⸻

Pokud dokument neexistuje:

zobrazí:

User Statement

nebo jiný dostupný zdroj.

⸻

14. Document View

Document View je režim pravého panelu.

⸻

Obsahuje:

* dokument
* extrahovaný text
* AI summary

Ve spodní části zobrazuje:
* Položky z tohoto dokumentu

⸻

Volitelně:

barevné zvýraznění citací.

Barvy:

🟥 Risk
🟨 Open Question
🟩 Fact / Goal

⸻

Implementace MVP:

jednoduchý string matching.

Pokud se citace nenajde:

žádná chyba.

Pouze bez zvýraznění.

⸻

15. Mobilní verze

Není součástí MVP.

⸻

MVP:

Desktop-first

⸻

Mobilní layout je odložen.

Předpokládaná verze:

1.3+

⸻

Návrh:

Tab 1
Journal
Tab 2
Chat
Tab 3
Documents

⸻

16. Prompt architektura

Používají se samostatné prompty pro:

Intake
Document Analysis
Chat
Meeting Preparation

⸻

Veškeré AI výstupy jsou JSON.

⸻

Každý AI výstup musí projít:

Schema Validation

⸻

Pokud validace selže:

* zobrazí se assistant_reply
* návrhy se zahodí

⸻

AI nikdy nesmí zapisovat přímo do Journalu.

⸻

17. Context Assembly

Chat

AI dostává:

Case
Journal
Document Summaries
Posledních 10 zpráv
Aktuální zprávu

⸻

Analýza dokumentu

AI dostává:

Case
Journal
Analyzovaný dokument

⸻

Intake

AI dostává:

Case
Dosavadní intake odpovědi

⸻

Journal je serializován kompaktně.

Příklad:

[RISK] Lhůta pro doplnění podkladů | 25.6.2026 | conflict
[GOAL] Získat náhradu škody | verified
[QUESTION] Kdy bylo doručení? | unverified

⸻

18. Limity MVP

Dokument:

max 10 000 znaků

⸻

Pokud je větší:

* použije se AI summary
* uživatel je upozorněn

⸻

Pokročilé chunkování není součástí MVP.

⸻

19. Architektonický test

Pokud vypneme GPT API:

musí fungovat:

Case
Documents
Journal
Evidence Panel

⸻

Přestanou fungovat:

AI Chat
Analýzy
Návrhy
Intake

⸻

Pokud tento test projde:

architektura je správně oddělena od AI vrstvy.

⸻

20. Scope MVP

Součást MVP:

✅ Case
✅ Documents
✅ Journal
✅ Journal Items
✅ Intake
✅ Chat
✅ AI Suggestions
✅ Evidence Panel
✅ Meeting Preparation

⸻

Není součástí MVP:

❌ Timeline
❌ Knowledge Graph
❌ Realtime přepis
❌ Audio monitoring
❌ Kalendář
❌ Notifikace
❌ Sdílení případů
❌ Multi-user
❌ Workflow engine
❌ Pokročilé OCR mapování
❌ Přesné pozice citací v dokumentu
❌ Mobilní optimalizace
❌ Historie verzí Journal Item
❌ Přesné mapování citací na pozice v dokumentu

⸻

21. API

# CASE
GET    /api/cases
POST   /api/cases
GET    /api/cases/:id
PATCH  /api/cases/:id

# DOCUMENTS
POST   /api/cases/:id/documents
GET    /api/documents/:id

# CHAT
POST   /api/cases/:id/chat
GET    /api/cases/:id/messages

# JOURNAL
GET    /api/cases/:id/journal
PATCH  /api/journal/:id
DELETE /api/journal/:id

# SUGGESTIONS
POST   /api/suggestions/:id/approve
POST   /api/suggestions/:id/reject

Approve endpoint podporuje dva režimy:

1. Approve as-is
2. Edit + Approve

Payload pro Edit + Approve:

{
  "edited_item": {...}
}

# MEETING PREP
POST   /api/cases/:id/meeting-prep


VýstupFinální pravidlo:
Journal představuje autoritativní pracovní model případu.
Dokumenty představují evidenci.
Pokud vznikne rozpor mezi Journalem a evidencí, systém jej označí, ale neblokuje.
