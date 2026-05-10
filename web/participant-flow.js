const cards = [...document.querySelectorAll("[data-step]")];
const progressItems = [...document.querySelectorAll(".progress-item")];
const counter = document.querySelector("[data-counter]");
const nicknameInput = document.querySelector("[data-nickname]");
const passName = document.querySelector("[data-pass-name]");
const finalName = document.querySelector("[data-final-name]");
const statusMessage = document.querySelector("[data-status-message]");
const swipeTrack = document.querySelector("[data-swipe-track]");
const swipeHandle = document.querySelector("[data-swipe-handle]");

let currentStep = 0;
let participantCount = 127;
let hasCountedParticipation = false;

function getDisplayName() {
    const value = nicknameInput?.value.trim();
    return value || "Guest";
}

function setStep(stepIndex) {
    currentStep = Math.max(0, Math.min(stepIndex, cards.length - 1));

    cards.forEach((card, index) => {
        card.classList.toggle("is-visible", index === currentStep);
    });

    progressItems.forEach((item, index) => {
        item.classList.toggle("is-active", index === currentStep);
        item.classList.toggle("is-complete", index < currentStep);
    });

    if (currentStep === 2 && !hasCountedParticipation) {
        hasCountedParticipation = true;
        participantCount += 1;
        counter.textContent = String(participantCount);
    }

    if (currentStep >= 3) {
        updatePassName();
    }
}

function updatePassName() {
    const displayName = getDisplayName();

    if (passName) {
        passName.textContent = displayName;
    }

    if (finalName) {
        finalName.textContent = displayName;
    }
}

function copyShareLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("participant", getDisplayName());

    navigator.clipboard?.writeText(url.toString())
        .then(() => {
            statusMessage.textContent = "共有リンクをコピーしました。";
        })
        .catch(() => {
            statusMessage.textContent = "コピーのデモ: " + url.toString();
        });
}

function savePassImage() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const displayName = getDisplayName();

    canvas.width = 1200;
    canvas.height = 630;

    context.fillStyle = "#17211b";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = context.createRadialGradient(930, 150, 40, 930, 150, 360);
    gradient.addColorStop(0, "#ff6b35");
    gradient.addColorStop(1, "rgba(255, 107, 53, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#fffaf0";
    context.font = "700 42px sans-serif";
    context.fillText("DOOH Live Moment", 92, 120);

    context.font = "900 104px sans-serif";
    context.fillText(displayName, 92, 315);

    context.fillStyle = "rgba(255, 250, 240, 0.72)";
    context.font = "500 34px sans-serif";
    context.fillText("あなたの参加がビジョンに反映されました", 92, 412);

    const link = document.createElement("a");
    link.download = "dooh-participation-pass.png";
    link.href = canvas.toDataURL("image/png");
    link.click();

    statusMessage.textContent = "参加証画像を保存しました。";
}

function completeSwipe() {
    swipeTrack.classList.add("is-complete");
    setTimeout(() => setStep(2), 280);
}

document.querySelectorAll("[data-next]").forEach((button) => {
    button.addEventListener("click", () => setStep(currentStep + 1));
});

document.querySelector("[data-reset]")?.addEventListener("click", () => {
    hasCountedParticipation = false;
    participantCount = 127;
    counter.textContent = String(participantCount);
    swipeTrack.classList.remove("is-complete");
    statusMessage.textContent = "この画面はデモです。";
    setStep(0);
});

document.querySelector("[data-copy-link]")?.addEventListener("click", copyShareLink);
document.querySelector("[data-save-image]")?.addEventListener("click", savePassImage);
nicknameInput?.addEventListener("input", updatePassName);

swipeHandle?.addEventListener("pointerdown", (event) => {
    const bounds = swipeTrack.getBoundingClientRect();
    const startX = event.clientX;
    const maxOffset = bounds.width - swipeHandle.offsetWidth - 16;

    swipeHandle.setPointerCapture(event.pointerId);

    function onMove(moveEvent) {
        const offset = Math.max(0, Math.min(moveEvent.clientX - startX, maxOffset));
        swipeHandle.style.left = `${8 + offset}px`;

        if (offset > maxOffset * 0.82) {
            swipeHandle.style.left = "";
            swipeHandle.removeEventListener("pointermove", onMove);
            swipeHandle.removeEventListener("pointerup", onUp);
            completeSwipe();
        }
    }

    function onUp() {
        swipeHandle.style.left = "";
        swipeHandle.removeEventListener("pointermove", onMove);
        swipeHandle.removeEventListener("pointerup", onUp);
    }

    swipeHandle.addEventListener("pointermove", onMove);
    swipeHandle.addEventListener("pointerup", onUp);
});

setStep(0);
