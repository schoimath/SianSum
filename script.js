const screens = {
  start: document.getElementById("start-screen"),
  quiz: document.getElementById("quiz-screen"),
  result: document.getElementById("result-screen")
};

const elements = {
  startButton: document.getElementById("start-button"),
  musicToggleButton: document.getElementById("music-toggle-button"),
  retryButton: document.getElementById("retry-button"),
  changeButton: document.getElementById("change-button"),
  homeButton: document.getElementById("home-button"),
  resetRecordsButton: document.getElementById("reset-records-button"),
  progress: document.getElementById("question-progress"),
  correctCount: document.getElementById("correct-count"),
  starCount: document.getElementById("star-count"),
  elapsedTime: document.getElementById("elapsed-time"),
  streakBadge: document.getElementById("streak-badge"),
  topNumber: document.getElementById("top-number"),
  bottomNumber: document.getElementById("bottom-number"),
  answerInput: document.getElementById("answer-input"),
  feedback: document.getElementById("feedback-message"),
  sparkleArea: document.getElementById("sparkle-area"),
  clearButton: document.getElementById("clear-button"),
  submitButton: document.getElementById("submit-button"),
  hintButton: document.getElementById("hint-button"),
  hintPanel: document.getElementById("hint-panel"),
  finalCorrect: document.getElementById("final-correct"),
  finalTotal: document.getElementById("final-total"),
  finalStars: document.getElementById("final-stars"),
  finalTime: document.getElementById("final-time"),
  resultMessage: document.getElementById("result-message"),
  recordMode: document.getElementById("record-mode"),
  bestRecordCard: document.getElementById("best-record-card"),
  recentRecordList: document.getElementById("recent-record-list")
};

const STORAGE_KEY = "sian-sum-records-v1";
const APP_VERSION = "0.2.0";

const state = {
  difficulty: "easy",
  totalQuestions: 5,
  questions: [],
  currentIndex: 0,
  correct: 0,
  stars: 0,
  streak: 0,
  attempts: 0,
  hintStep: 0,
  isWaiting: false,
  startTime: 0,
  elapsedMs: 0,
  timerId: null,
  lastResultKey: "",
  musicEnabled: true,
  audioReady: false,
  audioContext: null,
  bgmTimerId: null,
  bgmStep: 0
};

document.addEventListener("click", handleGlobalClickSound, true);
elements.startButton.addEventListener("click", startPractice);
elements.musicToggleButton.addEventListener("click", toggleMusic);
elements.retryButton.addEventListener("click", startPractice);
elements.changeButton.addEventListener("click", () => showScreen("start"));
elements.homeButton.addEventListener("click", () => showScreen("start"));
elements.resetRecordsButton.addEventListener("click", resetCurrentRecords);
elements.clearButton.addEventListener("click", clearAnswer);
elements.submitButton.addEventListener("click", submitAnswer);
elements.hintButton.addEventListener("click", showNextHint);

document.querySelectorAll("[data-key]").forEach((button) => {
  button.addEventListener("click", () => addDigit(button.dataset.key));
});

document.addEventListener("keydown", (event) => {
  if (!screens.quiz.classList.contains("active") || state.isWaiting) return;

  if (/^\d$/.test(event.key)) {
    event.preventDefault();
    addDigit(event.key);
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    eraseDigit();
  }

  if (event.key === "Enter") {
    event.preventDefault();
    submitAnswer();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

function showScreen(screenName) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[screenName].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startPractice() {
  ensureAudio();
  startBackgroundMusic();
  stopTimer();
  state.difficulty = getSelectedValue("difficulty");
  state.totalQuestions = Number(getSelectedValue("question-count"));
  state.questions = createQuestionSet(state.totalQuestions, state.difficulty);
  state.currentIndex = 0;
  state.correct = 0;
  state.stars = 0;
  state.streak = 0;
  state.elapsedMs = 0;
  state.lastResultKey = getRecordKey(state.difficulty, state.totalQuestions);
  showScreen("quiz");
  startTimer();
  loadQuestion();
}

function getSelectedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

function createQuestionSet(count, difficulty) {
  const questions = [];

  while (questions.length < count) {
    const type = difficulty === "mixed"
      ? (Math.random() < 0.5 ? "easy" : "normal")
      : difficulty;
    const nextQuestion = generateQuestion(type);
    const previous = questions[questions.length - 1];

    if (!previous || previous.a !== nextQuestion.a || previous.b !== nextQuestion.b) {
      questions.push(nextQuestion);
    }
  }

  return questions;
}

function generateQuestion(type) {
  while (true) {
    const a = randomNumber(10, 99);
    const b = randomNumber(10, 99);
    const onesSum = (a % 10) + (b % 10);
    const total = a + b;

    if (type === "easy" && onesSum <= 9 && total <= 99) {
      return { a, b, answer: total, type };
    }

    if (type === "normal" && onesSum >= 10 && total <= 198) {
      return { a, b, answer: total, type };
    }
  }
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function loadQuestion() {
  const question = getCurrentQuestion();
  state.attempts = 0;
  state.hintStep = 0;
  state.isWaiting = false;

  elements.topNumber.textContent = question.a;
  elements.bottomNumber.textContent = question.b;
  elements.answerInput.value = "";
  elements.feedback.className = "feedback-message";
  elements.feedback.textContent = "숫자 버튼을 누르고 제출해요.";
  elements.hintPanel.hidden = true;
  elements.hintPanel.innerHTML = "";
  elements.streakBadge.hidden = state.streak < 2;
  updateStatus();
}

function getCurrentQuestion() {
  return state.questions[state.currentIndex];
}

function updateStatus() {
  elements.progress.textContent = `${state.currentIndex + 1} / ${state.totalQuestions}`;
  elements.correctCount.textContent = state.correct;
  elements.starCount.textContent = state.stars;
  elements.elapsedTime.textContent = formatDuration(state.elapsedMs);
}

function addDigit(digit) {
  if (state.isWaiting || elements.answerInput.value.length >= 3) return;
  elements.answerInput.value += digit;
}

function eraseDigit() {
  elements.answerInput.value = elements.answerInput.value.slice(0, -1);
}

function clearAnswer() {
  if (state.isWaiting) return;
  elements.answerInput.value = "";
}

function submitAnswer() {
  if (state.isWaiting) return;

  const value = elements.answerInput.value.trim();
  if (!value) {
    setFeedback("답을 입력해 줘!", "try");
    return;
  }

  const question = getCurrentQuestion();
  if (Number(value) === question.answer) {
    handleCorrectAnswer();
  } else {
    handleSoftRetry();
  }
}

function handleCorrectAnswer() {
  state.correct += 1;
  state.stars += 1;
  state.streak += 1;
  state.isWaiting = true;
  updateStatus();
  setFeedback("정답! 별 하나 획득!", "good");
  playCorrectSound();
  elements.streakBadge.hidden = state.streak < 2;
  showSparkles();

  setTimeout(goToNextQuestion, 850);
}

function handleSoftRetry() {
  state.attempts += 1;
  state.streak = 0;
  elements.streakBadge.hidden = true;
  elements.answerInput.value = "";
  setFeedback("괜찮아. 일의 자리부터 다시 더해 보자.", "try");
  playWrongSound();

  if (state.attempts >= 2) {
    state.hintStep = Math.max(state.hintStep, 2);
    renderHints();
  }
}

function goToNextQuestion() {
  state.currentIndex += 1;
  if (state.currentIndex >= state.totalQuestions) {
    showResults();
  } else {
    loadQuestion();
  }
}

function setFeedback(message, type) {
  elements.feedback.textContent = message;
  elements.feedback.className = `feedback-message ${type}`;
}

function handleGlobalClickSound(event) {
  if (!event.target.closest("button, .choice-card, .pill-choice")) return;

  ensureAudio();
  playButtonSound();
}

function showSparkles() {
  elements.sparkleArea.innerHTML = "";
  const points = [
    ["18%", "26%"],
    ["72%", "20%"],
    ["42%", "12%"],
    ["64%", "62%"]
  ];

  points.forEach(([x, y], index) => {
    const sparkle = document.createElement("span");
    sparkle.className = "sparkle";
    sparkle.textContent = "★";
    sparkle.style.setProperty("--x", x);
    sparkle.style.setProperty("--y", y);
    sparkle.style.animationDelay = `${index * 0.08}s`;
    elements.sparkleArea.appendChild(sparkle);
  });

  setTimeout(() => {
    elements.sparkleArea.innerHTML = "";
  }, 950);
}

function showNextHint() {
  state.hintStep = Math.min(state.hintStep + 1, getHintLines(getCurrentQuestion()).length);
  renderHints();
}

function renderHints() {
  const lines = getHintLines(getCurrentQuestion()).slice(0, state.hintStep);
  elements.hintPanel.hidden = lines.length === 0;
  elements.hintPanel.innerHTML = lines.map((line) => `<p>${line}</p>`).join("");
}

function getHintLines(question) {
  const aOnes = question.a % 10;
  const bOnes = question.b % 10;
  const aTens = Math.floor(question.a / 10);
  const bTens = Math.floor(question.b / 10);
  const onesSum = aOnes + bOnes;
  const carry = onesSum >= 10 ? 1 : 0;
  const onesDigit = onesSum % 10;

  if (carry) {
    return [
      `1단계: 일의 자리부터 더해요. ${aOnes} + ${bOnes} = ${onesSum}`,
      `2단계: ${onesDigit}을 쓰고 1을 십의 자리로 올려요.`,
      `3단계: 십의 자리: ${aTens} + ${bTens} + 1 = ${aTens + bTens + 1}`,
      `정답: ${question.answer}`
    ];
  }

  return [
    `1단계: 일의 자리부터 더해요. ${aOnes} + ${bOnes} = ${onesSum}`,
    `2단계: 받아올림이 없으니 일의 자리는 ${onesSum}이에요.`,
    `3단계: 십의 자리: ${aTens} + ${bTens} = ${aTens + bTens}`,
    `정답: ${question.answer}`
  ];
}

function showResults() {
  stopTimer();
  const record = createRecord();
  const recordState = saveRecord(record);
  const scoreRate = state.correct / state.totalQuestions;
  elements.finalCorrect.textContent = state.correct;
  elements.finalTotal.textContent = state.totalQuestions;
  elements.finalStars.textContent = state.stars;
  elements.finalTime.textContent = formatDuration(record.elapsedMs);

  if (recordState.isNewBest && recordState.hadBest) {
    elements.resultMessage.textContent = "시안이가 기록을 깼어! 축하해!";
  } else if (scoreRate >= 0.9) {
    elements.resultMessage.textContent = "대단해! 두자리 덧셈 우주 대장이야!";
  } else if (scoreRate >= 0.7) {
    elements.resultMessage.textContent = "잘했어! 별을 많이 모았어!";
  } else {
    elements.resultMessage.textContent = "좋아! 다시 연습하면 더 빨라질 수 있어!";
  }

  renderRecords(state.lastResultKey);
  showScreen("result");
}

function startTimer() {
  state.startTime = performance.now();
  state.timerId = window.setInterval(() => {
    state.elapsedMs = performance.now() - state.startTime;
    updateStatus();
  }, 250);
  updateStatus();
}

function stopTimer() {
  if (!state.timerId) return;
  state.elapsedMs = performance.now() - state.startTime;
  window.clearInterval(state.timerId);
  state.timerId = null;
}

function createRecord() {
  const finishedAt = new Date();

  return {
    id: `${finishedAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    difficulty: state.difficulty,
    totalQuestions: state.totalQuestions,
    elapsedMs: Math.round(state.elapsedMs),
    finishedAt: finishedAt.toISOString()
  };
}

function getRecordKey(difficulty, totalQuestions) {
  return `${difficulty}-${totalQuestions}`;
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function saveRecord(record) {
  const records = loadRecords();
  const key = getRecordKey(record.difficulty, record.totalQuestions);
  const current = records[key] || { best: null, recent: [] };
  const hadBest = Boolean(current.best);
  const isNewBest = !current.best || record.elapsedMs < current.best.elapsedMs;

  records[key] = {
    best: isNewBest ? record : current.best,
    recent: [record, ...current.recent].slice(0, 5)
  };
  saveRecords(records);

  return { isNewBest, hadBest };
}

function renderRecords(key) {
  const records = loadRecords();
  const current = records[key] || { best: null, recent: [] };
  const [difficulty, totalQuestions] = key.split("-");

  elements.recordMode.textContent = `${getDifficultyLabel(difficulty)} · ${totalQuestions}문제`;
  elements.bestRecordCard.innerHTML = current.best
    ? `
      <span>최고 기록</span>
      <strong>${formatDuration(current.best.elapsedMs)}</strong>
      <time datetime="${current.best.finishedAt}">${formatDateTime(current.best.finishedAt)}</time>
    `
    : "아직 최고 기록이 없어요.";

  elements.recentRecordList.innerHTML = "";
  if (!current.recent.length) {
    const item = document.createElement("li");
    item.className = "empty-record";
    item.textContent = "최근 기록이 없어요.";
    elements.recentRecordList.appendChild(item);
    return;
  }

  current.recent.forEach((record) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${formatDuration(record.elapsedMs)}</strong>
      <time datetime="${record.finishedAt}">${formatDateTime(record.finishedAt)}</time>
    `;
    elements.recentRecordList.appendChild(item);
  });
}

function resetCurrentRecords() {
  const password = window.prompt("모든 기록을 지우려면 비밀번호를 입력해 주세요.");
  if (password === null) return;

  if (password !== "1234") {
    window.alert("비밀번호가 맞지 않아요.");
    return;
  }

  saveRecords({});
  renderRecords(state.lastResultKey || getRecordKey(state.difficulty, state.totalQuestions));
  window.alert("모든 기록을 지웠어요.");
}

function getDifficultyLabel(difficulty) {
  return {
    easy: "쉬움",
    normal: "보통",
    mixed: "섞임"
  }[difficulty] || difficulty;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}분 ${seconds}초`;
}

function formatDateTime(value) {
  const date = new Date(value);
  const dateText = date.toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit"
  });
  const timeText = date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });

  return `${dateText} ${timeText}`;
}

function toggleMusic() {
  state.musicEnabled = !state.musicEnabled;
  elements.musicToggleButton.textContent = state.musicEnabled ? "음악 켜짐" : "음악 꺼짐";
  elements.musicToggleButton.setAttribute("aria-pressed", String(state.musicEnabled));

  if (state.musicEnabled) {
    ensureAudio();
    startBackgroundMusic();
  } else {
    stopBackgroundMusic();
  }
}

function ensureAudio() {
  if (state.audioReady) {
    state.audioContext?.resume?.();
    return;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  state.audioContext = new AudioContext();
  state.audioReady = true;
  state.audioContext.resume?.();
}

function playButtonSound() {
  const ctx = state.audioContext;
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(620, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(920, ctx.currentTime + 0.045);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.1);
}

function playCorrectSound() {
  if (!state.audioContext) return;

  playTone(659.25, 0.13, 0.075, "triangle");
  window.setTimeout(() => playTone(783.99, 0.14, 0.075, "triangle"), 90);
  window.setTimeout(() => playTone(1046.5, 0.22, 0.08, "sine"), 180);
}

function playWrongSound() {
  if (!state.audioContext) return;

  playTone(392, 0.16, 0.055, "triangle");
  window.setTimeout(() => playTone(293.66, 0.24, 0.05, "triangle"), 130);
}

function startBackgroundMusic() {
  if (!state.musicEnabled || state.bgmTimerId || !state.audioContext) return;

  playBackgroundStep();
  state.bgmTimerId = window.setInterval(playBackgroundStep, 520);
}

function stopBackgroundMusic() {
  if (!state.bgmTimerId) return;

  window.clearInterval(state.bgmTimerId);
  state.bgmTimerId = null;
}

function playBackgroundStep() {
  const ctx = state.audioContext;
  if (!ctx) return;

  const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 783.99];
  const bass = [261.63, 329.63, 392, 329.63];
  playTone(melody[state.bgmStep % melody.length], 0.22, 0.035, "sine");

  if (state.bgmStep % 2 === 0) {
    playTone(bass[Math.floor(state.bgmStep / 2) % bass.length], 0.34, 0.018, "triangle");
  }

  state.bgmStep += 1;
}

function playTone(frequency, duration, volume, type) {
  const ctx = state.audioContext;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration + 0.02);
}
