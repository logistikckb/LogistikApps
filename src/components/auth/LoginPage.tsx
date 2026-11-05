import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePwa } from '../../context/PwaContext';
import { ConnectionWarningBanner } from '../common/ConnectionWarningBanner';
import { 
  LogIn, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  ShieldAlert, 
  X,
  User,
  Download,
  Smartphone,
  HelpCircle,
  Sparkles,
  Mic,
  MicOff,
  Volume2
} from 'lucide-react';

interface LoginPageProps {
  onOpenBroadcast?: () => void;
}

// Kamus angka bahasa Indonesia beserta variasi kemiripan bunyi (homofon) saat diucapkan
const HOMOPHONE_DIGIT_MAP: Record<string, number> = {
  // 0
  nol: 0,
  null: 0,
  nul: 0,
  nur: 0,
  no: 0,
  kosong: 0,
  osong: 0,
  zero: 0,
  hero: 0,
  o: 0,
  oh: 0,
  // 1
  satu: 1,
  sato: 1,
  sat: 1,
  atu: 1,
  suatu: 1,
  batu: 1,
  ratu: 1,
  wan: 1,
  one: 1,
  // 2
  dua: 2,
  duwa: 2,
  tua: 2,
  doa: 2,
  gua: 2,
  jua: 2,
  tu: 2,
  two: 2,
  // 3
  tiga: 3,
  tika: 3,
  tega: 3,
  liga: 3,
  diga: 3,
  tri: 3,
  three: 3,
  // 4
  empat: 4,
  pat: 4,
  ampat: 4,
  empa: 4,
  tempat: 4,
  lompat: 4,
  for: 4,
  four: 4,
  // 5
  lima: 5,
  limo: 5,
  bima: 5,
  rima: 5,
  dima: 5,
  delima: 5,
  five: 5,
  // 6
  enam: 6,
  nam: 6,
  anam: 6,
  nem: 6,
  senam: 6,
  tanam: 6,
  six: 6,
  // 7
  tujuh: 7,
  tuju: 7,
  tujuhh: 7,
  setuju: 7,
  cucu: 7,
  seven: 7,
  // 8
  delapan: 8,
  lapan: 8,
  dlapan: 8,
  kelapan: 8,
  kapan: 8,
  papan: 8,
  eight: 8,
  // 9
  sembilan: 9,
  smbilan: 9,
  semilan: 9,
  sembilang: 9,
  milan: 9,
  nine: 9,
};

const SPECIAL_NUMBER_WORDS: Record<string, string> = {
  sepuluh: '10',
  sebelas: '11',
  seratus: '100',
  seribu: '1000',
};

const NUMBER_MULTIPLIERS = new Set(['belas', 'puluh', 'ratus', 'ribu']);

const FILLER_WORDS = new Set([
  'user',
  'username',
  'akun',
  'id',
  'nama',
  'pin',
  'kode',
  'password',
  'sandi',
  'login',
  'masuk',
  'nomor',
  'angka',
  'dengan',
  'adalah',
]);

// Normalisasi fonetik Bahasa Indonesia untuk menyamakan konsonan yang mirip bunyinya (misal: "atmin" == "admin", "logistic" == "logistik")
function normalizeIndonesianPhonetic(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/ph/g, 'f')
    .replace(/sy|sh|z/g, 's')
    .replace(/kh|ch/g, 'k')
    .replace(/v/g, 'f')
    .replace(/d/g, 't')
    .replace(/b/g, 'p')
    .replace(/g|c|q/g, 'k')
    .replace(/j/g, 'c')
    .replace(/y/g, 'i')
    .replace(/(.)\1+/g, '$1');
}

// Hitung skor kemiripan Levenshtein antara dua string (0.0 = berbeda total, 1.0 = sama persis)
function calculateSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : (maxLen - matrix[len1][len2]) / maxLen;
}

// Cek apakah sebuah kata punya kemiripan tinggi dengan kata bilangan bahasa Indonesia
function resolveSpokenDigitToken(token: string): number | undefined {
  if (HOMOPHONE_DIGIT_MAP[token] !== undefined) {
    return HOMOPHONE_DIGIT_MAP[token];
  }
  // Cek kemiripan huruf untuk kata angka panjang (>= 4 huruf, misal "smbln" -> 9, "dlpn" -> 8, "tujh" -> 7)
  if (token.length >= 3) {
    const coreNumberWords: Array<[string, number]> = [
      ['nol', 0],
      ['kosong', 0],
      ['satu', 1],
      ['dua', 2],
      ['tiga', 3],
      ['empat', 4],
      ['lima', 5],
      ['enam', 6],
      ['tujuh', 7],
      ['delapan', 8],
      ['lapan', 8],
      ['sembilan', 9],
    ];
    let bestDigit: number | undefined;
    let bestScore = 0;
    for (const [word, val] of coreNumberWords) {
      const score = Math.max(
        calculateSimilarity(token, word),
        calculateSimilarity(normalizeIndonesianPhonetic(token), normalizeIndonesianPhonetic(word))
      );
      if (score >= 0.75 && score > bestScore) {
        bestScore = score;
        bestDigit = val;
      }
    }
    return bestDigit;
  }
  return undefined;
}

// Konversi deretan token angka (satuan per digit, belasan, puluhan, ratusan) menjadi string digit PIN
function parseIndonesianNumberSequence(tokens: string[]): string {
  let result = '';
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];

    // 1. Jika token sudah berupa deretan angka murni (misal "399339" atau "39")
    if (/^\d+$/.test(t)) {
      result += t;
      i++;
      continue;
    }

    // 2. Kata khusus ("sepuluh", "sebelas", "seratus")
    if (t === 'sepuluh') {
      result += '10';
      i++;
      continue;
    }
    if (t === 'sebelas') {
      result += '11';
      i++;
      continue;
    }
    if (t === 'seratus') {
      // Cek apakah diikuti angka puluhan/belasan/satuan (contoh: "seratus dua puluh tiga" -> 123)
      const next1 = tokens[i + 1];
      const next1Digit = next1 !== undefined ? resolveSpokenDigitToken(next1) : undefined;
      if (next1 === 'sepuluh') {
        result += '110';
        i += 2;
      } else if (next1 === 'sebelas') {
        result += '111';
        i += 2;
      } else if (next1Digit !== undefined) {
        const next2 = tokens[i + 2];
        if (next2 === 'belas') {
          result += `11${next1Digit}`;
          i += 3;
        } else if (next2 === 'puluh') {
          const next3 = tokens[i + 3];
          const next3Digit = next3 !== undefined ? resolveSpokenDigitToken(next3) : undefined;
          if (next3Digit !== undefined && !NUMBER_MULTIPLIERS.has(tokens[i + 4] || '')) {
            result += `1${next1Digit}${next3Digit}`;
            i += 4;
          } else {
            result += `1${next1Digit}0`;
            i += 3;
          }
        } else {
          result += `10${next1Digit}`;
          i += 2;
        }
      } else {
        result += '100';
        i++;
      }
      continue;
    }

    // 3. Cek nilai satuan 0 - 9
    const digit = resolveSpokenDigitToken(t);
    if (digit !== undefined) {
      const next1 = tokens[i + 1];

      // Belasan: "dua belas" -> 12, "sembilan belas" -> 19
      if (next1 === 'belas' && digit >= 1 && digit <= 9) {
        result += `1${digit}`;
        i += 2;
        continue;
      }

      // Puluhan: "tiga puluh sembilan" -> 39, "dua puluh" -> 20
      if (next1 === 'puluh' && digit >= 1 && digit <= 9) {
        const next2 = tokens[i + 2];
        const next2Digit = next2 !== undefined ? resolveSpokenDigitToken(next2) : undefined;
        const next3 = tokens[i + 3];

        // Jika diikuti satuan (1-9) dan satuan itu bukan bagian dari "puluh/belas/ratus" berikutnya
        if (
          next2Digit !== undefined &&
          next2Digit >= 1 &&
          next2Digit <= 9 &&
          !NUMBER_MULTIPLIERS.has(next3 || '')
        ) {
          result += `${digit}${next2Digit}`;
          i += 3;
        } else {
          result += `${digit}0`;
          i += 2;
        }
        continue;
      }

      // Ratusan: "tiga ratus sembilan puluh sembilan" -> 399
      if (next1 === 'ratus' && digit >= 1 && digit <= 9) {
        const next2 = tokens[i + 2];
        const next2Digit = next2 !== undefined ? resolveSpokenDigitToken(next2) : undefined;
        if (next2 === 'sepuluh') {
          result += `${digit}10`;
          i += 3;
        } else if (next2 === 'sebelas') {
          result += `${digit}11`;
          i += 3;
        } else if (next2Digit !== undefined) {
          const next3 = tokens[i + 3];
          if (next3 === 'belas') {
            result += `${digit}1${next2Digit}`;
            i += 4;
          } else if (next3 === 'puluh') {
            const next4 = tokens[i + 4];
            const next4Digit = next4 !== undefined ? resolveSpokenDigitToken(next4) : undefined;
            if (next4Digit !== undefined && !NUMBER_MULTIPLIERS.has(tokens[i + 5] || '')) {
              result += `${digit}${next2Digit}${next4Digit}`;
              i += 5;
            } else {
              result += `${digit}${next2Digit}0`;
              i += 4;
            }
          } else {
            result += `${digit}0${next2Digit}`;
            i += 3;
          }
        } else {
          result += `${digit}00`;
          i += 2;
        }
        continue;
      }

      // Ejaan per digit biasa ("tiga", "sembilan", ...)
      result += String(digit);
      i++;
      continue;
    }

    i++;
  }

  return result.replace(/\D/g, '').slice(0, 8);
}

export function LoginPage({ onOpenBroadcast }: LoginPageProps) {
  const { login, usersList, sessionExpiredNotice, clearSessionExpiredNotice } = useAuth();
  const { 
    isStandalone, 
    promptInstall, 
    openInstallGuide,
    isUpdateAvailable,
    updateInfo,
    isCheckingUpdate,
    checkForUpdate,
    setShowUpdateModal,
    currentVersion
  } = usePwa();

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Voice Login States
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [matchedAccountHint, setMatchedAccountHint] = useState('');

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const latestParsedRef = useRef<{ username: string; pin: string; hasSpoken: boolean }>({
    username: '',
    pin: '',
    hasSpoken: false,
  });

  // Fungsi Suara Balasan (Text-to-Speech Bahasa Indonesia)
  const speakFeedback = useCallback((message: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'id-ID';
      utterance.rate = 1.02;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find((v) => v.lang.toLowerCase().includes('id'));
      if (idVoice) {
        utterance.voice = idVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis errors on restricted browsers
    }
  }, []);

  // Bersihkan mikrofon saat keluar dari halaman Login
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  // Pencarian akun terdaftar paling mirip (Fuzzy Levenshtein + Kemiripan Fonetik + Kecocokan PIN)
  const findClosestRegisteredUser = useCallback(
    (spokenCandidate: string, extractedPin: string) => {
      const cleanSpoken = spokenCandidate.toLowerCase().trim();
      if (!cleanSpoken || usersList.length === 0) {
        return { matchedUsername: cleanSpoken, similarityScore: 0, isExactOrClose: false };
      }

      const phoneticSpoken = normalizeIndonesianPhonetic(cleanSpoken);
      let bestUser = usersList[0];
      let highestScore = -1;

      for (const u of usersList) {
        const uname = u.username.toLowerCase().trim();
        const fullName = u.nama.toLowerCase().trim();
        const firstName = fullName.split(' ')[0] || '';
        const roleName = (u.role || '').toLowerCase().trim();

        const unamePhonetic = normalizeIndonesianPhonetic(uname);
        const firstPhonetic = normalizeIndonesianPhonetic(firstName);

        // Skor kemiripan huruf langsung
        const rawUnameScore = calculateSimilarity(cleanSpoken, uname);
        const rawFirstScore = calculateSimilarity(cleanSpoken, firstName);
        const rawFullScore = calculateSimilarity(cleanSpoken, fullName);
        const rawRoleScore = roleName ? calculateSimilarity(cleanSpoken, roleName) * 0.9 : 0;

        // Skor kemiripan fonetik (misal "atmin" == "admin" -> 1.0)
        const phoneticUnameScore = calculateSimilarity(phoneticSpoken, unamePhonetic);
        const phoneticFirstScore = calculateSimilarity(phoneticSpoken, firstPhonetic);

        // Bonus jika substring terkandung (misal "adminlogistik" mengandung "admin")
        const substringBonus =
          uname.includes(cleanSpoken) || cleanSpoken.includes(uname) ? 0.18 : 0;

        let baseScore = Math.max(
          rawUnameScore,
          rawFirstScore,
          rawFullScore,
          rawRoleScore,
          phoneticUnameScore * 0.96,
          phoneticFirstScore * 0.92
        ) + substringBonus;

        // Bonus akurasi jika PIN yang terucap juga cocok dengan PIN user tersebut di database
        if (extractedPin.length >= 4 && u.pin && u.pin.trim() === extractedPin) {
          baseScore += 0.35;
        }

        if (baseScore > highestScore) {
          highestScore = baseScore;
          bestUser = u;
        }
      }

      // Koreksi otomatis ke akun terdaftar yang paling mirip
      if (highestScore >= 0.42) {
        return {
          matchedUsername: bestUser.username,
          similarityScore: highestScore,
          isExactOrClose: true,
        };
      }

      return {
        matchedUsername: cleanSpoken,
        similarityScore: highestScore,
        isExactOrClose: false,
      };
    },
    [usersList]
  );

  // Parser cerdas satu transkrip menjadi pasangan Username + PIN beserta skor akurasinya
  const parseSingleTranscript = useCallback(
    (rawText: string, currentUsername: string) => {
      const cleaned = rawText
        .toLowerCase()
        .replace(/[.,!?;:\-/\\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleaned) {
        return {
          parsedUsername: currentUsername.trim(),
          parsedPin: '',
          confidenceScore: 0,
        };
      }

      const rawTokens = cleaned.split(' ');
      const wordParts: string[] = [];
      const numberTokens: string[] = [];

      for (const token of rawTokens) {
        if (!token || FILLER_WORDS.has(token)) continue;

        const isDigitWord =
          /^\d+$/.test(token) ||
          SPECIAL_NUMBER_WORDS[token] !== undefined ||
          NUMBER_MULTIPLIERS.has(token) ||
          resolveSpokenDigitToken(token) !== undefined;

        if (isDigitWord) {
          numberTokens.push(token);
        } else {
          // Cek jika kata dan angka menempel tanpa spasi (contoh: "atmin399339" atau "399339")
          const attachedMatch = token.match(/^([a-z]+)(\d+)$/);
          if (attachedMatch) {
            const [, wordPart, numPart] = attachedMatch;
            if (!FILLER_WORDS.has(wordPart)) {
              const maybeDigit = resolveSpokenDigitToken(wordPart);
              if (maybeDigit !== undefined) {
                numberTokens.push(String(maybeDigit));
              } else {
                wordParts.push(wordPart);
              }
            }
            numberTokens.push(numPart);
          } else if (numberTokens.length === 0) {
            wordParts.push(token);
          }
        }
      }

      const resolvedPin = parseIndonesianNumberSequence(numberTokens);

      let resolvedUsername = currentUsername.trim();
      let userScore = 0;

      if (wordParts.length > 0) {
        const joinedCandidate = wordParts.join('');
        const { matchedUsername, similarityScore } = findClosestRegisteredUser(
          joinedCandidate,
          resolvedPin
        );
        resolvedUsername = matchedUsername;
        userScore = similarityScore;
      } else if (resolvedUsername) {
        const { matchedUsername, similarityScore } = findClosestRegisteredUser(
          resolvedUsername,
          resolvedPin
        );
        resolvedUsername = matchedUsername;
        userScore = similarityScore;
      } else if (resolvedPin.length >= 4 && usersList.length > 0) {
        // Jika hanya PIN yang terdengar jelas dan hanya ada 1 user aktif dengan PIN tersebut
        const pinMatchedUsers = usersList.filter(
          (u) => u.status === 'Aktif' && u.pin && u.pin.trim() === resolvedPin
        );
        if (pinMatchedUsers.length === 1) {
          resolvedUsername = pinMatchedUsers[0].username;
          userScore = 0.85;
        }
      }

      // Hitung total skor kandidat untuk seleksi multi-alternatif
      const exactCredMatch = usersList.some(
        (u) =>
          u.username.toLowerCase() === resolvedUsername.toLowerCase() &&
          u.pin &&
          u.pin.trim() === resolvedPin
      );

      const confidenceScore =
        userScore +
        (resolvedPin.length >= 4 ? 0.5 : resolvedPin.length * 0.08) +
        (exactCredMatch ? 1.5 : 0);

      return {
        parsedUsername: resolvedUsername,
        parsedPin: resolvedPin,
        confidenceScore,
      };
    },
    [findClosestRegisteredUser, usersList]
  );

  // Fungsi utama eksekusi Login (baik dari ketik manual maupun otomatis dari suara)
  const executeLogin = useCallback(
    async (targetUsername: string, targetPin: string) => {
      setErrorMsg('');
      setSuccessMsg('');

      // Koreksi kemiripan username sekali lagi sebelum dikirim ke database
      const rawUser = targetUsername.trim();
      const cleanPin = targetPin.trim();
      const { matchedUsername } = findClosestRegisteredUser(rawUser, cleanPin);
      const finalUsername = matchedUsername || rawUser;

      if (finalUsername && finalUsername !== rawUser) {
        setUsername(finalUsername);
      }

      if (!finalUsername) {
        const msg = 'Harap masukkan Username Anda!';
        setErrorMsg(msg);
        speakFeedback('Harap masukkan atau ucapkan username Anda.');
        usernameInputRef.current?.focus();
        return;
      }
      if (!cleanPin) {
        const msg = 'Harap masukkan Kode PIN Anda!';
        setErrorMsg(msg);
        speakFeedback('Harap masukkan atau ucapkan kode PIN Anda.');
        pinInputRef.current?.focus();
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await login(finalUsername, cleanPin);
        if (!res.success) {
          const failMessage = res.message || 'Login gagal. Periksa kembali Username dan PIN Anda.';
          setErrorMsg(failMessage);
          setPin('');
          speakFeedback(`Maaf, ${failMessage} Silakan coba lagi.`);
          pinInputRef.current?.focus();
        } else {
          setSuccessMsg('Login berhasil! Mengalihkan...');
          speakFeedback('Login berhasil, selamat bertugas.');
        }
      } catch (err: any) {
        const errText = err.message || 'Terjadi gangguan saat memverifikasi kredensial.';
        setErrorMsg(errText);
        speakFeedback(`Maaf, ${errText}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [findClosestRegisteredUser, login, speakFeedback]
  );

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    await executeLogin(username, pin);
  };

  // Toggle sistem pengenalan suara (One-Tap Voice Login dengan Multi-Alternative Fuzzy Matching)
  const handleToggleVoiceLogin = () => {
    if (isSubmitting) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
      return;
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      const unsupportedMsg = 'Browser perangkat ini belum mendukung fitur pengenalan suara. Silakan ketik manual.';
      setErrorMsg(unsupportedMsg);
      speakFeedback(unsupportedMsg);
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setVoiceTranscript('');
    setMatchedAccountHint('');
    latestParsedRef.current = {
      username: username.trim(),
      pin: '',
      hasSpoken: false,
    };

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = true;
      // Ambil hingga 5 alternatif pendengaran terbaik untuk dicocokkan dengan daftar akun & PIN
      recognition.maxAlternatives = 5;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        // Kumpulkan seluruh kombinasi alternatif transkrip dari hasil pengenalan suara
        const candidateTranscripts: string[] = [];
        const maxAlt = event.results[0]?.length || 1;

        for (let altIdx = 0; altIdx < maxAlt; altIdx++) {
          let phrase = '';
          for (let resIdx = 0; resIdx < event.results.length; resIdx++) {
            const altItem = event.results[resIdx][altIdx] || event.results[resIdx][0];
            if (altItem?.transcript) {
              phrase += altItem.transcript + ' ';
            }
          }
          const trimmed = phrase.trim();
          if (trimmed && !candidateTranscripts.includes(trimmed)) {
            candidateTranscripts.push(trimmed);
          }
        }

        const primaryTranscript = candidateTranscripts[0] || '';
        setVoiceTranscript(primaryTranscript);

        // Evaluasi seluruh alternatif dan pilih kandidat dengan kecocokan Username & PIN tertinggi
        let bestParsed = parseSingleTranscript(primaryTranscript, username);
        for (let idx = 1; idx < candidateTranscripts.length; idx++) {
          const candidateParsed = parseSingleTranscript(candidateTranscripts[idx], username);
          if (candidateParsed.confidenceScore > bestParsed.confidenceScore) {
            bestParsed = candidateParsed;
          }
        }

        latestParsedRef.current = {
          username: bestParsed.parsedUsername,
          pin: bestParsed.parsedPin,
          hasSpoken: true,
        };

        if (bestParsed.parsedUsername) {
          setUsername(bestParsed.parsedUsername);
          setMatchedAccountHint(
            bestParsed.parsedPin
              ? `Akun: ${bestParsed.parsedUsername} • PIN: ${bestParsed.parsedPin.length} digit`
              : `Akun: ${bestParsed.parsedUsername}`
          );
        }
        if (bestParsed.parsedPin) {
          setPin(bestParsed.parsedPin);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          const permMsg = 'Akses mikrofon ditolak. Izinkan mikrofon di browser atau ketik manual.';
          setErrorMsg(permMsg);
          speakFeedback(permMsg);
        } else if (event.error === 'no-speech') {
          const noSpeechMsg = 'Tidak ada suara terdengar. Silakan tekan mikrofon dan ucapkan Username beserta PIN.';
          setErrorMsg(noSpeechMsg);
          speakFeedback('Tidak ada suara yang terdengar, silakan coba lagi.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        const { username: finalUser, pin: finalPin, hasSpoken } = latestParsedRef.current;

        if (!hasSpoken) return;

        if (finalUser && finalPin.length >= 4) {
          // Otomatis langsung masuk jika Username dan PIN sudah terisi
          executeLogin(finalUser, finalPin);
        } else if (finalUser && finalPin.length === 0) {
          const msg = `Akun "${finalUser}" terdeteksi, namun Kode PIN belum terdengar. Ucapkan Username diikuti angka PIN.`;
          setErrorMsg(msg);
          speakFeedback(`Akun ${finalUser} terdeteksi. Silakan ucapkan atau masukkan kode PIN Anda.`);
          pinInputRef.current?.focus();
        } else if (!finalUser && finalPin.length > 0) {
          const msg = 'Kode PIN terdeteksi, namun Username belum disebutkan. Silakan sebutkan Username beserta PIN.';
          setErrorMsg(msg);
          speakFeedback('Kode PIN terdeteksi, silakan sebutkan atau ketik username Anda.');
          usernameInputRef.current?.focus();
        } else {
          const msg = 'Suara belum lengkap. Ucapkan Username lalu angka PIN (contoh: "admin 3 9 9 3 3 9").';
          setErrorMsg(msg);
          speakFeedback('Suara belum lengkap. Silakan ucapkan username diikuti kode PIN Anda.');
        }
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setErrorMsg('Gagal mengaktifkan mikrofon. Silakan coba lagi atau ketik manual.');
    }
  };

  return (
    <div className="min-h-screen p-4 flex flex-col justify-center items-center bg-slate-100/60 text-slate-800">
      <div className="w-full max-w-md space-y-3.5 my-auto">
        
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center p-2.5 bg-slate-900 text-white rounded-2xl shadow-xs">
            <img 
              src="/icons/icon.svg" 
              alt="Logo" 
              className="w-10 h-10 object-contain rounded-lg"
            />
          </div>

          <h1 className="text-xl font-bold text-slate-900 tracking-tight m-0">
            Masuk ke Sistem
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Masukkan Username dan Kode PIN untuk melanjutkan
          </p>
        </div>

        {/* Banner Peringatan Koneksi Terputus (Offline) */}
        <ConnectionWarningBanner />

        {/* Security Auto-Logout Notification Banner */}
        {sessionExpiredNotice && (
          <div 
            id="session-expired-alert"
            className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start justify-between gap-2 text-xs"
          >
            <div className="flex items-start gap-2 min-w-0">
              <ShieldAlert size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-bold block">Sesi Telah Berakhir</span>
                <p className="text-[11px] text-amber-800 m-0 leading-tight">
                  {sessionExpiredNotice}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={clearSessionExpiredNotice}
              className="text-amber-600 hover:text-amber-900 p-0.5 rounded cursor-pointer"
              title="Tutup"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Form Login Container */}
        <div className="bg-white p-5 sm:p-6 border border-slate-200/90 shadow-sm rounded-2xl">
          
          {/* PWA Update Notice if a new code version is waiting */}
          {isUpdateAvailable && (
            <div className="mb-4 p-3 bg-gradient-to-r from-blue-900 to-cyan-950 text-white rounded-2xl border border-cyan-400/60 shadow-md flex items-center justify-between gap-2.5 animate-pulse text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-xs">
                  <Sparkles size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-black block leading-tight text-white">
                    Pembaruan Kode Tersedia (v{updateInfo?.version || 'Baru'})
                  </span>
                  <span className="text-[10px] text-cyan-200 font-medium">
                    Versi baru aplikasi siap dipasang.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUpdateModal(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-cyan-400 to-blue-400 hover:from-cyan-300 hover:to-blue-300 text-slate-950 text-xs font-black rounded-xl shadow-xs cursor-pointer shrink-0 transition-transform active:scale-95"
              >
                Perbarui
              </button>
            </div>
          )}

          {/* PWA Install Promotion Banner / Button before Login */}
          {!isStandalone ? (
            <div 
              id="login-pwa-install-banner"
              className="mb-4 p-3 bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-indigo-50/90 border border-blue-200/90 rounded-2xl flex items-center justify-between gap-2.5 shadow-2xs text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Smartphone size={16} className="text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 tracking-tight">
                      Install Aplikasi (PWA)
                    </span>
                    <span className="px-1.5 py-0.2 bg-blue-200/80 text-blue-900 text-[9px] font-black rounded-md">
                      App
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 m-0 truncate">
                    Pasang di HP / Laptop untuk akses cepat
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  id="login-quick-install-btn"
                  onClick={promptInstall}
                  className="px-2.5 sm:px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all active:scale-95"
                  title="Pasang aplikasi CKBLogistic ke layar utama"
                >
                  <Download size={13} className="text-cyan-300 animate-bounce" />
                  <span>Install</span>
                </button>
                <button
                  type="button"
                  id="login-open-guide-btn"
                  onClick={openInstallGuide}
                  className="p-1.5 text-slate-500 hover:text-slate-800 bg-white/90 hover:bg-white rounded-xl border border-slate-200 text-xs transition-colors cursor-pointer"
                  title="Petunjuk instalasi iOS / Android / Komputer"
                >
                  <HelpCircle size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div 
              id="login-pwa-standalone-badge"
              className="mb-4 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold shadow-2xs"
            >
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span>Aplikasi CKBLogistic Terpasang (Mode PWA)</span>
            </div>
          )}

          {/* Alert Feedback */}
          {errorMsg && (
            <div className="mb-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span className="font-medium">{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => speakFeedback(errorMsg)}
                className="text-rose-500 hover:text-rose-800 p-0.5 rounded shrink-0 cursor-pointer"
                title="Putar ulang suara peringatan"
              >
                <Volume2 size={14} />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4" autoComplete="off">
            {/* Username Field */}
            <div className="space-y-1.5">
              <label htmlFor="login-account-id" className="block text-xs font-bold text-slate-700">
                Username / Akun
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User size={16} />
                </div>
                <input
                  id="login-account-id"
                  name="cbk_account_id"
                  ref={usernameInputRef}
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck="false"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username..."
                  autoFocus
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent text-slate-800 transition-colors placeholder:text-slate-400 font-medium"
                />
              </div>
            </div>

            {/* PIN Code Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="login-pin-input" className="block text-xs font-bold text-slate-700">
                  Kode PIN
                </label>
                <span className="text-[10px] text-slate-400">
                  {pin.length > 0 ? `${pin.length} / 8 digit` : 'Maks. 8 digit'}
                </span>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  id="login-pin-input"
                  name="cbk_pin_code"
                  ref={pinInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Masukkan PIN..."
                  disabled={isSubmitting}
                  className={`w-full pl-10 pr-10 py-2.5 text-base bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent font-mono tracking-widest text-slate-800 transition-colors font-bold text-center placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-normal placeholder:text-sm placeholder:font-normal ${
                    showPin ? 'pin-mask-visible' : 'pin-mask-hidden'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  title={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Tombol Mikrofon Ringkas (One-Tap Voice Login) di bawah kolom PIN */}
              <div className="pt-0.5 flex flex-col items-center gap-1">
                <button
                  type="button"
                  id="voice-login-btn"
                  disabled={isSubmitting}
                  onClick={handleToggleVoiceLogin}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50 ${
                    isListening
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 ring-2 ring-rose-200/70'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/90'
                  }`}
                  title="Klik lalu ucapkan Username diikuti Kode PIN untuk masuk otomatis"
                >
                  {isListening ? (
                    <>
                      <MicOff size={14} className="text-rose-600 animate-bounce shrink-0" />
                      <span>Mendengarkan... Ucapkan Username & PIN</span>
                    </>
                  ) : (
                    <>
                      <Mic size={14} className="text-blue-600 shrink-0" />
                      <span>Login Suara (Ucap Username & PIN)</span>
                    </>
                  )}
                </button>

                {voiceTranscript ? (
                  <p className="text-[11px] text-slate-500 m-0 text-center truncate max-w-full">
                    Terdengar: <span className="font-semibold text-slate-700">"{voiceTranscript}"</span>
                    {matchedAccountHint && (
                      <span className="text-emerald-700 font-bold ml-1">({matchedAccountHint})</span>
                    )}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 m-0 text-center">
                    Contoh ucap: <span className="font-medium text-slate-500">"admin 3 9 9 3 3 9"</span> atau <span className="font-medium text-slate-500">"admin tiga puluh sembilan..."</span>
                  </p>
                )}
              </div>
            </div>

            {/* Action Submit Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting || !username.trim() || !pin.trim()}
                id="login-submit-btn"
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    <span>Masuk ke Aplikasi</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer Info */}
          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Lock size={11} className="text-slate-400" />
              <span>PIN & Akses Terenkripsi</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">v{currentVersion}</span>
              <button
                type="button"
                onClick={() => checkForUpdate(true)}
                disabled={isCheckingUpdate}
                className="text-[10px] font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer disabled:opacity-50"
              >
                {isCheckingUpdate ? 'Mengecek...' : 'Cek Update'}
              </button>
            </div>
          </div>
        </div>

        {/* Pre-login PWA Install Quick Help */}
        {!isStandalone && (
          <div className="text-center pt-0.5">
            <button
              type="button"
              id="login-install-help-btn"
              onClick={openInstallGuide}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer hover:underline"
            >
              <Smartphone size={13} className="text-blue-700" />
              <span>Panduan Pasang Aplikasi di Android, iOS Safari & Komputer</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
