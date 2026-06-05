BureauCat V2 – Working Model

Účel systému

BureauCat není projektový manažer ani CRM.

BureauCat je AI pracovní stůl určený pro řešení konkrétních lidských případů:

* dopis z úřadu
* spor se školou
* reklamace
* dědictví
* sousedský spor
* pracovní problém
* komunikace s institucemi

Typické případy jsou časově omezené, mají konkrétní cíl a po vyřešení končí.

⸻

Základní princip

Každý případ se skládá z jedné nebo více situací.

Situace představuje aktuální stav případu v určité fázi jeho vývoje.

Situace vznikají postupně.

Nové informace často vedou k vytvoření nové situace nebo zpřesnění stávající.

Příklad:

Situace 1:
“Přišel mi dopis z úřadu.”

Situace 2:
“Jedná se o výzvu k doplnění podkladů.”

Situace 3:
“Bylo zahájeno správní řízení.”

⸻

Datový model

Případ

Nejvyšší organizační jednotka.

Obsahuje:

* název případu
* seznam situací
* seznam dokumentů
* historii konzultací

Příklad:

“Dědictví po otci”

“Spor se školou”

“Výzva finančního úřadu”

⸻

Situace

Základní pracovní jednotka systému.

Každá situace obsahuje:

Uživatelská vrstva

* Popis situace
* Cíle
* Dokumenty

AI vrstva

* Analýza
* Poznatky
* Otázky
* Rizika
* Akční plán

⸻

Uživatelská vrstva

Obsah vytváří a spravuje uživatel.

AI může pomáhat s formulací.

Popis situace

Stručný popis aktuálního stavu.

Není považován za definitivní.

Může být průběžně upravován a zpřesňován.

Příklad:

“Přišel mi dopis z úřadu.”

Později:

“Jedná se o výzvu k doplnění podkladů pro řízení XY.”

⸻

Cíle

Seznam úkolů nebo výsledků, kterých chce uživatel dosáhnout.

Každý cíl může být:

* aktivní
* splněný
* archivovaný

Příklad:

☑ Pochopit obsah dopisu

☐ Připravit odpověď

☐ Připravit návštěvu úřadu

Cíle mohou postupně přibývat.

Splněné cíle zůstávají součástí historie případu.

⸻

Dokumenty

Dokumenty vztahující se k dané situaci.

Příklady:

* PDF
* DOCX
* TXT
* email
* obrázky
* fotografie

Každý dokument může mít:

* název
* stručný popis
* obsah
* automaticky extrahovaný text

⸻

AI vrstva

Obsah vytváří primárně BureauCat.

Uživatel může návrhy schvalovat, upravovat nebo odmítat.

⸻

Analýza

Stručné průběžné zhodnocení situace.

Odpovídá na otázku:

“Jak BureauCat chápe aktuální stav případu?”

⸻

Poznatky

Fakta získaná z dokumentů nebo konzultace.

Poznatek musí být dohledatelný ke zdroji.

Příklad:

* Lhůta pro odpověď je 15 dní.
* Úřad požaduje doplnění příloh.
* Řízení bylo zahájeno dne 12. 5. 2025.

⸻

Otázky

Nejasnosti a chybějící informace.

Příklad:

* Byla dodržena zákonná lhůta?
* Existuje potvrzení o doručení?
* Má uživatel kopii smlouvy?

Otázky mohou být:

* otevřené
* zodpovězené

⸻

Rizika

Možné negativní důsledky.

Příklad:

* Hrozí zmeškání lhůty.
* Chybí důležitý dokument.
* Hrozí finanční sankce.

Rizika mohou být:

* aktivní
* vyřešená

⸻

Akční plán

Konkrétní doporučené kroky.

Příklad:

1. Vyžádat si spis.
2. Připravit seznam příloh.
3. Odeslat odpověď.
4. Připravit se na jednání.

Akční plán představuje doporučení BureauCatu, nikoliv závazné pokyny.

⸻

UI princip

Levý panel – Přehled případu

Obsahuje stručný přehled:

* Situace
* Cíle
* Analýza
* Poznatky
* Otázky
* Rizika
* Akční plán

Slouží jako navigace a rychlý přehled.

⸻

Střední panel – Konzultace

Hlavní pracovní prostor.

Slouží pro:

* komunikaci s BureauCatem
* pokládání dotazů
* analýzu dokumentů
* vytváření návrhů

⸻

Pravý panel – Detail

Obsahuje záložky:

Dokumenty

* seznam dokumentů
* obsah dokumentu

Poznatky

* rozpracované poznatky
* zdroje poznatků

Strategie

* podrobná analýza
* doporučení
* akční plán
* příprava na jednání

⸻

Zásady

1. Uživatel vlastní situaci.
2. AI navrhuje, nerozhoduje.
3. Každé tvrzení by mělo mít zdroj.
4. Situace se může v čase měnit.
5. Cíle se mohou průběžně měnit.
6. BureauCat má pomáhat orientaci v problému, nikoliv uživatele zahlcovat.