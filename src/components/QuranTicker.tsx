import { useState, useEffect } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Pause, Play, RotateCw } from 'lucide-react';

interface AyahItem {
  number: number;
  numberInSurah: number;
  arabicText: string;
  translation: string;
}

interface SurahData {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
  ayahs: AyahItem[];
}

export function QuranTicker() {
  const [surahData, setSurahData] = useState<SurahData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Random surah 1..114 on start
  const [surahNumber, setSurahNumber] = useState<number>(() => Math.floor(Math.random() * 114) + 1);

  // Fetch complete Surah data when surahNumber changes
  const fetchSurah = async (sNum: number) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${sNum}/editions/quran-uthmani,id.indonesian`);
      const data = await res.json();

      if (data.code === 200 && data.data && data.data.length >= 2) {
        const arSurah = data.data[0];
        const idSurah = data.data[1];

        const ayahsList: AyahItem[] = arSurah.ayahs.map((arItem: { number: number; numberInSurah: number; text: string }, index: number) => {
          const idItem = idSurah.ayahs[index];
          return {
            number: arItem.number,
            numberInSurah: arItem.numberInSurah,
            arabicText: arItem.text,
            translation: idItem ? idItem.text : ''
          };
        });

        setSurahData({
          number: arSurah.number,
          name: arSurah.name,
          englishName: arSurah.englishName,
          numberOfAyahs: arSurah.numberOfAyahs,
          ayahs: ayahsList
        });
      } else {
        setErrorMsg('Gagal memuat data Surah');
      }
    } catch (e) {
      console.error("Error fetching surah:", e);
      setErrorMsg('Koneksi terganggu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurah(surahNumber);
  }, [surahNumber]);

  const pickNewSurah = () => {
    let nextNum = Math.floor(Math.random() * 114) + 1;
    if (nextNum === surahNumber) {
      nextNum = (surahNumber % 114) + 1;
    }
    setSurahNumber(nextNum);
  };

  const handleNextSurah = () => {
    setSurahNumber(prev => (prev < 114 ? prev + 1 : 1));
  };

  const handlePrevSurah = () => {
    setSurahNumber(prev => (prev > 1 ? prev - 1 : 114));
  };

  if (loading) {
    return (
      <div className="glass-box h-12 flex items-center px-4 mb-6 !rounded-2xl text-xs text-slate-500 font-bold animate-pulse">
        <BookOpen size={16} className="mr-2 text-sky-500" /> Memuat Surah Al-Qur'an...
      </div>
    );
  }

  if (errorMsg || !surahData || surahData.ayahs.length === 0) {
    return (
      <div className="glass-box h-12 flex items-center justify-between px-4 mb-6 !rounded-2xl text-xs text-slate-600 font-bold">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-sky-500" />
          <span>Al-Qur'an (Gagal Memuat)</span>
        </div>
        <button 
          onClick={() => fetchSurah(surahNumber)}
          className="text-xs bg-sky-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-sky-600 transition-all cursor-pointer"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const currentAyah = surahData?.ayahs[0];
  const totalChars = surahData ? surahData.ayahs.reduce((acc, a) => acc + a.arabicText.length + a.translation.length, 0) : 0;
  // Kecepatan membaca sangat santai dan pelan (sekitar 5 karakter per detik, minimal 160 detik)
  const dynamicDuration = Math.max(160, Math.round(totalChars / 5));

  return (
    <div className="glass-box min-h-[52px] py-1.5 flex flex-col md:flex-row items-stretch md:items-center overflow-hidden mb-6 !rounded-2xl border border-white/60 shadow-xs gap-2 md:gap-0">
      {/* Header Label + Surah Badge */}
      <div className="bg-sky-500/10 text-sky-700 border-b md:border-b-0 md:border-r border-white/40 flex items-center justify-between md:justify-start px-3.5 py-1 font-bold text-xs tracking-wider shrink-0 gap-2">
        <div className="flex items-center gap-1.5">
          <BookOpen size={16} className="text-sky-600 shrink-0" />
          <span className="font-extrabold uppercase">AL-QUR'AN</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] bg-white/80 border border-sky-200 text-sky-800 px-2 py-0.5 rounded-full font-extrabold tracking-tight">
            QS. {surahData.englishName.toUpperCase()} ({surahData.numberOfAyahs} Ayat)
          </span>
        </div>
      </div>

      {/* Main Text Content: Continuously Joined Ayahs from 1 to End */}
      <div 
        className="flex-1 flex items-center bg-transparent overflow-hidden px-4 text-sm relative group cursor-pointer" 
        title="Teks berjalan menyambung dari Ayat 1 sampai akhir Surah (Klik untuk Pause/Play)"
        onClick={() => setIsPaused(!isPaused)}
      >
        <div 
          className="font-semibold flex items-center py-1.5 animate-marquee-slow whitespace-nowrap min-w-max"
          style={{ 
            animationDuration: `${dynamicDuration}s`,
            animationPlayState: isPaused ? 'paused' : 'running' 
          }}
        >
          <div className="inline-flex items-center gap-6">
            {surahData.ayahs.map((a) => (
              <div key={a.numberInSurah} className="inline-flex items-center gap-2.5">
                <span className="text-[10px] font-bold text-sky-700 bg-sky-100/90 px-1.5 py-0.5 rounded-md border border-sky-200 shrink-0">
                  {a.numberInSurah}
                </span>
                <span className="font-bold text-lg sm:text-xl text-orange-600 font-arabic drop-shadow-2xs" dir="rtl">
                  {a.arabicText}
                </span>
                <span className="font-medium text-slate-800 text-xs sm:text-sm">
                  "{a.translation}"
                </span>
                <span className="text-amber-600 font-extrabold text-base mx-1 font-arabic">۝</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls: Prev Surah, Play/Pause, Next Surah, Change Surah Random */}
      <div className="flex items-center justify-end gap-1 px-3 border-t md:border-t-0 md:border-l border-white/40 shrink-0 py-1 bg-white/20 md:bg-transparent">
        <button
          onClick={handlePrevSurah}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-white/80 transition-all cursor-pointer hover:text-sky-700"
          title="Surah Sebelumnya"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          onClick={() => setIsPaused(!isPaused)}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-white/80 transition-all cursor-pointer hover:text-sky-700"
          title={isPaused ? "Lanjutkan Teks Berjalan" : "Jeda (Pause)"}
        >
          {isPaused ? <Play size={15} className="text-amber-600 fill-amber-500" /> : <Pause size={15} />}
        </button>

        <button
          onClick={handleNextSurah}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-white/80 transition-all cursor-pointer hover:text-sky-700"
          title="Surah Berikutnya"
        >
          <ChevronRight size={16} />
        </button>

        <button
          onClick={pickNewSurah}
          className="ml-1 px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-800 text-[10px] font-bold border border-sky-300/40 flex items-center gap-1 transition-all cursor-pointer"
          title="Acak Surah Lain"
        >
          <RotateCw size={12} />
          <span className="hidden sm:inline">Acak Surah</span>
        </button>
      </div>
    </div>
  );
}


