const screens = {
  start: document.getElementById("start-screen"),
  quiz: document.getElementById("quiz-screen"),
  result: document.getElementById("result-screen")
};

const elements = {
  startButton: document.getElementById("start-button"),
  retryButton: document.getElementById("retry-button"),
  changeButton: document.getElementById("change-button"),
  progress: document.getElementById("question-progress"),
  correctCount: document.getElementById("correct-count"),
  starCount: document.getElementById("star-count"),
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
  resultMessage: document.getElementById("result-message")
};

const state = {
  difficulty: "easy",
  totalQuestions: 10,
  questions: [],
  currentIndex: 0,
  correct: 0,
  stars: 0,
  streak: 0,
  attempts: 0,
  hintStep: 0,
  isWaiting: false
};

elements.startButton.addEventListener("click", startPractice);
elements.retryButton.addEventListener("click", startPractice);
elements.changeButton.addEventListener("click", () => showScreen("start"));
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
  state.difficulty = getSelectedValue("difficulty");
  state.totalQuestions = Number(getSelectedValue("question-count"));
  state.questions = createQuestionSet(state.totalQuestions, state.difficulty);
  state.currentIndex = 0;
  state.correct = 0;
  state.stars = 0;
  state.streak = 0;
  showScreen("quiz");
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
  const scoreRate = state.correct / state.totalQuestions;
  elements.finalCorrect.textContent = state.correct;
  elements.finalTotal.textContent = state.totalQuestions;
  elements.finalStars.textContent = state.stars;

  if (scoreRate >= 0.9) {
    elements.resultMessage.textContent = "대단해! 두자리 덧셈 우주 대장이야!";
  } else if (scoreRate >= 0.7) {
    elements.resultMessage.textContent = "잘했어! 별을 많이 모았어!";
  } else {
    elements.resultMessage.textContent = "좋아! 다시 연습하면 더 빨라질 수 있어!";
  }

  showScreen("result");
}
