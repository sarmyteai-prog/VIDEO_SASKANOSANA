# 🎬 KADRS • Tīrs Video Saskaņošanas Pleijeris (Kollaborate.tv stils)

Minimālistiska, ātra un tīra tīmekļa lietotne TV melnās montāžas video (`.mp4`) saskaņošanai pārlūkā 24/7:
- **Mākoņa straumēšana 24/7 (bez lejupielādes):** Atbalsta Google Drive saites (ar iebūvētu HTTP 206 Range straumēšanas tiltu `/api/gdrive` un Drive Iebūvēto pleijeri), Dropbox saites un tiešās `.mp4` saites, kā arī lokālu `.mp4` failu priekšskatījumu.
- **Automātiska pauze un laika koda (`MM:SS`) fiksācija:** Tiklīdz redaktors sāk rakstīt komentāru ievades rindiņā zem video, pleijeris automātiski nopauzējas un nofiksē precīzu sekundi (`MM:SS`).
- **Interaktīvs komentāru saraksts:** Labajā pusē visi komentāri sakārtoti hronoloģiski pēc laika koda. Uzklikšķinot uz `MM:SS`, video uzreiz aizlec uz attiecīgo sekundi. Komentārus var atzīmēt kā izlabotus (`✓`) un ar 1 klikšķi nokopēt kā tīru teksta sarakstu.
- **Koplietošanas saite redaktoram:** Poga **"Kopēt saiti redaktoram"** uzģenerē tiešo saiti ar ielādētu video, projekta nosaukumu un komentāriem.

## Lokālā palaišana
```powershell
Set-Location "E:\ANTIGRAVITY\PROJEKTI\VIDEO_SASKANOSANA"; npm install; npm run dev
```
