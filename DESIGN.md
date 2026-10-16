# DESIGN.md — Dizaina Sistēma & Inženierijas Standarts

## 1. Saskarnes Režīms (Impeccable Design Register)
- **Primārais režīms:** **`Operate` (Darboties)** — profesionāls video saskaņošanas darbarīks. Saskarne ir ergonomiska, klusa un zibenīga, ļaujot 100% uzmanības veltīt video kadram un precīziem komentāriem.
- **3 Dials (Taste-Skill Konfigurācija):**
  - `Design Variance`: **4/10** (strukturēts, funkcionāls 2-kolonnu studijas izkārtojums).
  - `Motion Intensity`: **3/10** (Biežuma vārti: <200ms tūlītēja reakcija bez liekām animācijām).
  - `Visual Density`: **6/10** (kompakts komentāru žurnāls ar ērtiem $\ge 44\text{px}$ skārienlaukiem).

---

## 2. Tipogrāfija (Anti-Slop & Tabular Timecodes)
- **UI & Teksta fonts:** `'Plus Jakarta Sans'` (aizstāj standarta *Inter*; tīra, cilvēcīga ģeometrija ar augstu lasāmību).
- **Laika kodu & Tehniskais fonts:** `'JetBrains Mono'` ar obligātu `font-variant-numeric: tabular-nums`, lai `MM:SS` skaitļi pleijerī un sarakstā stāvētu perfekti vertikālā kolonnā.
- **Rindu garums:** Komentāru tekstam `max-w-[62ch]` un virsrakstiem `text-balance`.

---

## 3. Krāsu Sistēma (Nordic Matte & Studio Dark — WCAG 2.1 AA/AAA)

### A. Nordic Matte (Gaišais dienas režīms — bez `#FFFFFF` un `#000000`)
- **Pamatfons (`bg-canvas`):** `#E8EFF3` (maigs Ziemeļu matētais tonis, kas nenogurdina acis).
- **Darba virsma (`bg-surface`):** `#DFE8EE` / `#EAF1F6`.
- **Primārais teksts (`text-primary`):** `#002C37` (dziļš zili-melns ar augstu kontrastu).
- **Sekundārais teksts (`text-secondary`):** `#153A54` / `#2C4A5E`.
- **Robežlīnijas (`border`):** `#B2C7D4`.
- **Primārais akcents (`accent`):** `#0B626B` / `#0E7C86`.

### B. Studio Dark (Montāžas telpas tumšais režīms)
- **Pamatfons (`bg-canvas`):** `#0B131E`.
- **Darba virsma (`bg-surface`):** `#101C2E` / `#15243A`.
- **Primārais teksts (`text-primary`):** `#E8F0F6`.
- **Sekundārais teksts (`text-secondary`):** `#9FB3C8`.
- **Primārais akcents (`accent`):** `#2DD4BF` uz `#0E7C86` fona.

---

## 4. CRAP 4 Vizuālā Dizaina Principi (Reino Apse)
1. **Kontrasts (Contrast):** Aktīvais/nofiksētais laika kods (`MM:SS`) un galvenā CTA poga (*Kopēt saiti redaktoram*) skaidri izceļas pret darba virsmu.
2. **Tuvums (Proximity):** Komentāra ievades rindiņa ir tieši piesaistīta zem video pleijera (8px atstarpe), veidojot vienotu darbības bloku.
3. **Atkārtojamība (Repetition):** Vienots laika kodu kapsulu stils (`font-mono-tc`), konsekventa krāsu semantika (Dzintara `#F59E0B` = neizlabots punkts / nofiksēts TC; Smaragda `#10B981` = izlabots punkts).
4. **Izlīdzināšana (Alignment) & Zero Cards-in-Cards:** Komentāru sarakstā netiek izmantotas smagnējas "kartītes iekš kartītes" — tiek lietotas tīras horizontālas rindas (`divide-y`) ar vienotu vertikālo asi.

---

## 5. Kustības Fizika (Emil Kowalski Standard)
- **Aizliegts `transition: all`:** Visur definētas tikai konkrētas īpašības (`transform`, `opacity`, `background-color`, `border-color`, `color`).
- **Zelta līkne:** `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, ilgums `150ms–200ms` (<300ms likums).
- **GPU Laika līnija:** Video progresa josla izmanto `transform: scaleX()` ar `transform-origin: left`, nevis `width` animāciju.
- **Piekļūstamība:** Pilns `@media (prefers-reduced-motion: reduce)` un `@media (hover: hover) and (pointer: fine)` atbalsts.
