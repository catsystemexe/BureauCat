
⸻

BureauCat Visual System v1

Účel

BureauCat není SaaS dashboard, CRM ani chat aplikace.

Vizuální identita má evokovat:

* pracovní spis
* úřední dokumentaci
* právní složku
* klidné soustředěné pracovní prostředí

Cílem není působit moderně za každou cenu.

Cílem je působit:

* důvěryhodně
* přehledně
* profesionálně
* dlouhodobě použitelně

⸻

Design principy

1. Content First

Obsah je důležitější než dekorace.

Preferovat:

* typografii
* spacing
* strukturu

před:

* barvami
* efekty
* animacemi

⸻

2. Minimal Color Usage

Barvy mají význam.

Barva neslouží k dekoraci.

Každá barva musí mít jednoznačnou funkci.

⸻

3. Borders Over Shadows

Primární způsob oddělení prvků:

1px solid var(--bc-line)

Ne:

box-shadow

Stíny pouze:

* dropdown
* modal
* overlay

⸻

4. Stable Layout

Rozložení se nemění.

Panely:

Zápisník
Konzultace
Dokument

jsou základní orientační body aplikace.

⸻

Barevný systém

Primary Blue

Aktivní stav.

--bc-blue: #1f6fd6;

Použití:

* aktivní záložka
* aktivní stránka zápisníku
* focus

Význam:

Aktivní

⸻

Primary Amber

AI a proces.

--bc-amber: #9b6632;

Použití:

* workflow
* doporučení AI
* stav případu

Význam:

Doporučení / proces

⸻

Text

--bc-text: #1d1d1b;

Použití:

* hlavní text
* nadpisy

⸻

Background

--bc-bg: #f6f6f4;

Použití:

* globální pozadí aplikace

⸻

Surface

--bc-surface: #ffffff;

Použití:

* všechny hlavní panely
* dokumenty
* chat

⸻

Lines

--bc-line: #e5e2dc;

Použití:

* rámečky
* oddělovače
* grid

⸻

Soft Blue

--bc-blue-soft: #eef5ff;

Použití:

* user message
* focus background

⸻

Soft Amber

--bc-amber-soft: #f5ebdd;

Použití:

* workflow card
* AI cards

⸻

Zakázané barvy

Nepoužívat bez explicitního důvodu:

Fialová
Tyrkysová
Růžová
Gradienty
Neonové barvy

⸻

Typography

Font

Jediný systémový font:

Inter

Fallback:

ui-sans-serif
system-ui

⸻

Typografická hierarchie

Case Title

56px
700

Příklad:

Untitled draft case

⸻

Panel Headers

18px
700

Příklad:

Zápisník
Konzultace
Dokument

⸻

Section Headers

15px
600

Příklad:

Situace
Cíle
Dokumenty

⸻

Body Text

14px
400

⸻

Metadata

12px
500

⸻

Radius System

Používat pouze následující hodnoty.

Main Panels

12px

⸻

Cards

10px

⸻

Buttons

8px

⸻

Pills

999px

⸻

Panel System

Global Layout

3 panely
Zápisník
Konzultace
Dokument

⸻

Panel Background

white

⸻

Header Background

white

⸻

Header Separator

1px solid var(--bc-line)

⸻

Header Height

56px

všechny panely stejně

⸻

Notebook Layer Rules

User Layer

Pozadí:

white

Ikony:

blue

⸻

Assistant Layer

Pozadí:

white

Ikony:

amber

⸻

Nepoužívat

* modré bloky
* oranžové bloky
* barevná pozadí sekcí

⸻

Chat Rules

User Message

background: var(--bc-blue-soft)

⸻

Assistant Message

background: white

⸻

Message Border

1px solid var(--bc-line)

⸻

Document Viewer

Dokument je nejdůležitější obsah.

Proto:

* bílé pozadí
* minimum dekorací
* maximum prostoru pro text

Fullscreen ikona vždy dostupná.

⸻

UI Anti-Patterns

Zakázáno:

* glassmorphism
* neumorphism
* silné stíny
* gradienty
* animované přechody panelů
* více než 2 akcentní barvy
* více než 1 hlavní font

⸻

Design Motto

BureauCat je digitální pracovní spis, ne marketingová landing page.