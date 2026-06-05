
BureauCat V2 UI Blueprint
_______________________
Status: Approved
Version: 1.0
Date: 2026-06-05
______________________

SCOPE:
Tento dokument popisuje:

- UX model
- informační architekturu
- vlastnictví dat
- rozložení panelů

Neřeší:

- databázové schéma
- API návrhy
- implementační detaily
- AI model
______________________

CORE PRINCIPLE:
Situation is the primary working unit.

One Situation equals one notebook page.

The notebook page contains:
- user-owned information
- AI-owned information

Both describe the same situation.

__________________
Layout

┌──────────────────────────────────────────────────────┐
│ Název případu                                        │
└──────────────────────────────────────────────────────┘
┌──────────────┬───────────────────┬───────────────────┐
│ ZÁPISNÍK     │ KONZULTACE        │ DETAIL            │
│              │                   │                   │
│ Situace      │ Chat              │ Dokumenty         │
│ Cíle         │                   │ Poznatky          │
│ Dokumenty    │                   │ Strategie         │
│              │                   │                   │
│ Analýza      │                   │                   │
│ Poznatky     │                   │                   │
│ Otázky       │                   │                   │
│ Rizika       │                   │                   │
│ Postup       │                   │                   │
└──────────────┴───────────────────┴───────────────────┘

⸻

Levý panel = Zápisník

Nadpis:

ZÁPISNÍK

Pod ním:

[1] [2] [3] [+]

Význam:

Situace = stránka zápisníku

Nikoli:

Situace = samostatný objekt UI

⸻

Modrá vrstva (uživatel)

Pořadí:

Situace
Cíle
Dokumenty

Vlastník:

USER

AI může navrhnout.

USER schvaluje.

⸻

Oranžová vrstva (AI)

Pořadí:

Analýza
Poznatky
Otázky
Rizika
Postup

Vlastník:

AI

USER může:

* schválit
* upravit
* zamítnout

⸻

Konzultace

Pouze chat.

Žádné další widgety.

Žádné dokumenty.

Žádný zápisník.

⸻

Pravý panel

Tři stabilní záložky:

Dokumenty

Seznam dokumentů
Obsah dokumentu

⸻

Poznatky

Fakta
Citace
Odkazy na dokumenty

⸻

Strategie

Analýza
Doporučení
Akční plán
Příprava na jednání

⸻
