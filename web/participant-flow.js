import { publishParticipationEvent } from "../src/participation-bridge.js";

const steps = [...document.querySelectorAll(".step")];
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const progressElement = document.querySelector(".bar");
const counterValue = document.getElementById("counterValue");
const nickname = document.getElementById("nickname");
const previewName = document.getElementById("previewName");
const finalCard = document.getElementById("finalCard");
const shareStatus = document.getElementById("shareStatus");
const swipeSlider = document.getElementById("swipeSlider");
const swipeCompleteButton = document.getElementById("swipeComplete");

const totalSteps = steps.length;
let currentStep = 0;
let participantCount = 12842;
let hasCountedParticipation = false;

function getDisplayName() {
  return nickname.value.trim() || "匿名サポーター";
}

function updateProgress(index) {
  const current = index + 1;
  const label = steps[index]?.dataset.label || `ステップ${current}`;

  progressText.textContent = `${current}/${totalSteps} ${label}`;
  progressBar.style.width = `${(current / totalSteps) * 100}%`;
  progressElement.setAttribute("aria-valuemax", String(totalSteps));
  progressElement.setAttribute("aria-valuenow", String(current));
}

function showStep(index) {
  currentStep = index;
  steps.forEach((step, stepIndex) => {
    const isActive = stepIndex === index;
    step.classList.toggle("is-active", isActive);
    step.setAttribute("aria-hidden", String(!isActive));
  });

  updateProgress(index);
}

function nextStep() {
  if (currentStep < totalSteps - 1) {
    showStep(currentStep + 1);
  }
}

function buildFinalCard() {
  finalCard.replaceChildren();

  const label = document.createElement("p");
  label.textContent = "SHINJUKU COLOR SUPPORTER";

  const name = document.createElement("h3");
  name.textContent = getDisplayName();

  const description = document.createElement("p");
  description.textContent = "あなたの参加で街に色が広がっています。";

  finalCard.append(label, name, description);
}

function finalizeCard() {
  buildFinalCard();
  nextStep();
}

function markParticipationComplete() {
  if (!hasCountedParticipation) {
    participantCount += 1;
    hasCountedParticipation = true;
    counterValue.textContent = participantCount.toLocaleString("ja-JP");
    publishParticipationEvent({ name: getDisplayName() });
  }

  nextStep();
}

async function copyShareLink() {
  const url = location.href;

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API is unavailable.");
    }

    await navigator.clipboard.writeText(url);
    shareStatus.textContent = "リンクをコピーしました。";
  } catch {
    shareStatus.textContent = `コピーできませんでした。URL: ${url}`;
  }
}

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", nextStep);
});

swipeSlider.addEventListener("input", (event) => {
  const value = Number(event.target.value);
  const isComplete = value >= 100;

  swipeCompleteButton.disabled = !isComplete;
  swipeCompleteButton.setAttribute("aria-disabled", String(!isComplete));
});

swipeCompleteButton.addEventListener("click", markParticipationComplete);

nickname.addEventListener("input", () => {
  previewName.textContent = getDisplayName();
});

document.getElementById("createCard").addEventListener("click", finalizeCard);
document.getElementById("skipName").addEventListener("click", finalizeCard);

document.getElementById("downloadBtn").addEventListener("click", () => {
  shareStatus.textContent = "デモ版: 参加証画像の保存は次タスクで実装します。";
});

document.getElementById("shareBtn").addEventListener("click", copyShareLink);

showStep(0);
