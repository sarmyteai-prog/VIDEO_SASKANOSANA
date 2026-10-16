import React, { useState } from 'react';

interface FooterBarProps {
  isDark?: boolean;
}

export const FooterBar: React.FC<FooterBarProps> = ({ isDark = true }) => {
  const [showComplianceModal, setShowComplianceModal] = useState(false);

  return (
    <>
      <footer className={`mt-8 border-t py-6 px-4 rounded-2xl transition-colors w-full text-center ${
        isDark 
          ? "border-[#0B626B]/30 bg-[#0B1524]/80 text-[#CBD5E1]" 
          : "border-[#BACDD9] bg-[#DFE8EE]/90 text-[#002C37]"
      }`}>
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center gap-3 text-center w-full">
          
          {/* Zīmols un gads */}
          <div className={`flex flex-wrap items-center justify-center gap-2 text-center w-full ${isDark ? "text-[#E2ECF2]" : "text-[#002C37]"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#2DD4BF" : "#0B626B"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span className="font-extrabold tracking-wide uppercase text-xs text-balance text-center">
              KADRS &bull; Video Saskaņošanas Pleijeris
            </span>
            <span className={`text-xs font-semibold ${isDark ? "text-[#94A3B8]" : "text-[#2C4A5E]"}`}>&copy; 2026</span>
          </div>

          {/* Vienotā ES Direktīvu un Privātuma kapsulas poga */}
          <div className="flex items-center justify-center pt-0.5 w-full text-center">
            <button
              onClick={() => setShowComplianceModal(true)}
              className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border shadow-xs ${
                isDark 
                  ? "bg-[#111E32]/90 border-[#0E7C86]/60 text-[#E2ECF2] hover:border-[#2DD4BF] hover:bg-[#162740]" 
                  : "bg-[#EAF1F6] border-[#BACDD9] text-[#002C37] hover:border-[#0E7C86] hover:bg-[#E2ECF2]"
              }`}
            >
              <span className="text-[#0E7C86] dark:text-[#2DD4BF]">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </span>
              <span className="font-extrabold">
                ES Direktīvu &amp; Privātuma Standarti
              </span>
              <span className="text-[#0E7C86] dark:text-[#2DD4BF]">&bull;</span>
              <span className="opacity-80 hidden sm:inline">
                EU AI Act (Art. 50) &bull; GDPR &bull; EAA 2025
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#0E7C86]/15 dark:bg-[#2DD4BF]/15 text-[#0E7C86] dark:text-[#2DD4BF] border border-[#0E7C86]/30 dark:border-[#2DD4BF]/30 ml-1">
                INFO
              </span>
            </button>
          </div>

          {/* Autora un tehnoloģiju kredīts */}
          <div className={`pt-1 font-mono-tc text-[11px] tracking-wider uppercase font-semibold text-center text-balance w-full ${isDark ? "text-[#94A3B8]" : "text-[#2C4A5E]"}`}>
            POWERED BY{" "}
            <a
              href="https://www.threads.net/@sarmyte"
              target="_blank"
              rel="noopener noreferrer"
              className="font-extrabold text-[#0E7C86] dark:text-[#2DD4BF] underline underline-offset-4 decoration-[#0E7C86] dark:decoration-[#2DD4BF] hover:opacity-80 transition-opacity"
            >
              SARMYTE
            </a>
            {" "}&bull; ARCHITECTED WITH{" "}
            <span className="font-extrabold text-[#0E7C86] dark:text-[#2DD4BF]">
              GOOGLE ANTIGRAVITY
            </span>
          </div>
        </div>
      </footer>

      {/* ES Direktīvu & Atbilstības Modālais Logs */}
      {showComplianceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className={`max-w-2xl w-full rounded-3xl p-6 md:p-8 shadow-2xl border max-h-[90vh] overflow-y-auto ${
            isDark 
              ? "bg-[#0E1A2B] border-[#0B626B]/60 text-[#E2ECF2]" 
              : "bg-[#E8EFF3] border-[#BACDD9] text-[#002C37]"
          }`}>
            
            <div className={`flex items-center justify-between pb-4 border-b ${isDark ? "border-[#0B626B]/40" : "border-[#BACDD9]"}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isDark ? "bg-[#0B626B]/30 text-[#5EEAD4]" : "bg-[#0B626B]/15 text-[#0B626B]"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <h3 className={`font-extrabold text-base md:text-lg tracking-tight ${isDark ? "text-white" : "text-[#002C37]"}`}>
                  ES Direktīvu &amp; Privātuma Atbilstības Standarts
                </h3>
              </div>
              <button
                onClick={() => setShowComplianceModal(false)}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  isDark ? "hover:bg-[#162740] text-[#94A3B8] hover:text-white" : "hover:bg-[#DFE8EE] text-[#2C4A5E] hover:text-[#002C37]"
                }`}
                aria-label="Aizvērt"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="space-y-4 py-5 text-xs md:text-sm leading-relaxed">
              
              <div className={`p-4 rounded-2xl border shadow-2xs ${
                isDark ? "bg-[#142338] border-[#0B626B]/50" : "bg-[#DFE8EE] border-[#BACDD9]"
              }`}>
                <h4 className={`font-bold flex items-center gap-2 mb-1.5 ${isDark ? "text-[#5EEAD4]" : "text-[#002C37]"}`}>
                  <span className="w-2 h-2 rounded-full bg-[#0B626B]"></span>
                  1. ES Mākslīgā Intelekta Akts (EU AI Act — Art. 50)
                </h4>
                <p className={`${isDark ? "text-[#CBD5E1]" : "text-[#153A54]"} text-balance`}>
                  Saskaņā ar Regulas (ES) 2024/1689 50. pantu saskarne darbojas kā tiešs cilvēka vadīts (Human-in-the-loop) video saskaņošanas darbarīks. Visus laika kodu komentārus un labojumu statusus pilnībā pārvalda redaktors un montāžas autors.
                </p>
              </div>

              <div className={`p-4 rounded-2xl border shadow-2xs ${
                isDark ? "bg-[#142338] border-[#059669]/40" : "bg-[#DFE8EE] border-[#BACDD9]"
              }`}>
                <h4 className={`font-bold flex items-center gap-2 mb-1.5 ${isDark ? "text-[#6EE7B7]" : "text-[#002C37]"}`}>
                  <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
                  2. GDPR &amp; Nulles Sīkdatņu Politika (Zero-Cookie &amp; Privacy by Design)
                </h4>
                <p className={`${isDark ? "text-[#CBD5E1]" : "text-[#153A54]"} text-balance`}>
                  Video materiāli tiek straumēti tiešajā pārlūka atmiņā bez failu dublēšanas publiskās datubāzēs. Komentāru saraksts glabājas lokāli pārlūkprogrammā (LocalStorage) un koplietošanas saitēs, neizmantojot izsekošanas sīkdatnes.
                </p>
              </div>

              <div className={`p-4 rounded-2xl border shadow-2xs ${
                isDark ? "bg-[#142338] border-[#0284C7]/40" : "bg-[#DFE8EE] border-[#BACDD9]"
              }`}>
                <h4 className={`font-bold flex items-center gap-2 mb-1.5 ${isDark ? "text-[#7DD3FC]" : "text-[#002C37]"}`}>
                  <span className="w-2 h-2 rounded-full bg-[#0284C7]"></span>
                  3. Eiropas Pieejamības Akts (EAA 2025 &amp; WCAG 2.1 AA)
                </h4>
                <p className={`${isDark ? "text-[#CBD5E1]" : "text-[#153A54]"} text-balance`}>
                  Saskarne nodrošina gan profesionālu montāžas studijas tumšo režīmu, gan matēto Ziemeļu gaišo režīmu (#E8EFF3) bez žilbinoša baltuma, ar augstu teksta kontrastu un pilnu tastatūras vadību.
                </p>
              </div>

            </div>

            <div className={`pt-3 border-t flex justify-end ${isDark ? "border-[#0B626B]/40" : "border-[#BACDD9]"}`}>
              <button
                onClick={() => setShowComplianceModal(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm bg-[#0B626B] hover:bg-[#084D54] text-white shadow-md transition-all cursor-pointer"
              >
                Sapratu un aizvērt
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
