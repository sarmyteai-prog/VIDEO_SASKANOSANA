# PRODUCT.md — KADRS • Video Saskaņošanas Pleijeris

## 1. Produkta Misija & Stratēģija (Jesse James Garrett — 1. Slānis: Strategy)
**KADRS** ir tīrs, zibenīgs TV melnās montāžas (`.mp4`) saskaņošanas darbarīks (*Kollaborate.tv* stilā), kas ļauj redaktoram un producentam jebkurā diennakts laikā (24/7) noskatīties garu montāžas materiālu pa taisno pārlūkā bez faila lejupielādes un atstāt precīzus laika kodu (`MM:SS`) komentārus.

### Lietotāju Sāpes, ko Risinām:
1. **Milzīgi video faili:** Garas TV epizodes (30–60 min) nav iespējams nosūtīt čatā, un redaktors nevēlas gaidīt vairāku gigabaitu lejupielādi savā datorā vai telefonā.
2. **Montāžista izslēgts dators:** Saskaņošanai jāstrādā 24/7 no mākoņa (Google Drive / Dropbox / tiešais MP4), neatkarīgi no lokālās darbstacijas.
3. **Laika kodu pierakstīšanas berze:** Skatoties video un pierakstot komentārus blociņā vai WhatsApp, redaktors tērē laiku manuāli pauzējot un pārrakstot minūtes un sekundes.

---

## 2. Mērogs & Lietotājstāsti (2. Slānis: Scope & Agile User Stories)
- **US-01 (Mākoņa Straumēšana 24/7):** Kā redaktore es vēlos atvērt atsūtīto saiti un uzreiz skatīties video pārlūkā bez reģistrācijas un bez faila lejupielādes.
- **US-02 (Auto-Pauze un Laika Koda Fiksācija):** Kā redaktore es vēlos, lai brīdī, kad sāku rakstīt komentāru, video pats nopauzējas un nofiksē precīzu sekundi (`MM:SS`).
- **US-03 (1-Klikšķa Laika Lēciens):** Kā montāžas režisore es vēlos uzklikšķināt uz jebkura komentāra laika koda (`MM:SS`), lai pleijeris uzreiz aizlektu uz konkrēto vietu.
- **US-04 (Izpildes Kontrole & Eksports):** Kā montāžas režisore es vēlos atzīmēt izlabotos punktus (`✓`), atcelt nejaušu dzēšanu (*Undo*) un ar 1 klikšķi nokopēt tīru komentāru sarakstu kā tekstu.

---

## 3. Struktūra & Heuristikas (3. Slānis: Structure & Jakob Nielsen 10 Heuristics)
1. **Sistēmas statusa redzamība:** Skaidrs vizuāls un `aria-live` indikators, kad video ir automātiski nopauzēts un laika kods (`MM:SS`) ir nofiksēts.
2. **Atbilstība reālajai pasaulei:** Standarta TV montāžas terminoloģija latviešu valodā (`Laika kods`, `Izlabots`, `Melnā montāža`).
3. **Lietotāja kontrole un brīvība (Undo):** Dzēšot komentāru vai notīrot izlabotos, parādās 5 sekunžu **«Atcelt (Undo)»** josla.
4. **Lietošanas elastība:** Tastatūras īsceļi profesionāļiem (`Space` — pauze/atskaņot, `←`/`→` — ±5s, `C` — fokusēt komentāru).
5. **Nulles liekā trokšņa (Distill):** Nekādu sarežģītu zīmēšanas rīku, viļņu formu vai XML eksportu — tikai pleijeris un komentāri.

---

## 4. Piekļūstamības Spektra Matrica (Microsoft Inclusive Design & EAA 2025)
- **Redze (Situatīva / Pastāvīga):** Divi pilnvērtīgi režīmi — *Studio Dark* (`#0B131E` tumšai montāžas telpai) un *Nordic Matte Light* (`#E8EFF3` dienasgaismai bez dedzinoša `#FFFFFF` baltuma). Kontrasts $\ge 4.5:1$ (WCAG 2.1 AA/AAA).
- **Kustības & Motorika:** Visi interaktīvie mērķi (pogas, laika kodi, izvēles rūtiņas) ir vismaz $40\text{–}44\text{px}$ augsti; darbību pogas (Rediģēt / Dzēst) ir pieejamas gan ar skārienu, gan ar `Tab` taustiņu (nevis paslēptas tikai zem peles `hover`).
- **Kognīcija & Nogurums:** Tabulārie cipari (`tabular-nums`) laika kodiem, lai cipari nelēkātu; skaidrs progress (`X/Y izlaboti`).
