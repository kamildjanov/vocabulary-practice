const CONFETTI_COLORS = Object.freeze([
    "#e30613",
    "#b7000b",
    "#ffffff",
    "#ffd166",
    "#168447",
]);

const SPARKLE_COLORS = Object.freeze([
    "#e30613",
    "#ffd166",
    "#168447",
]);

const activeTimers = new Set();

let effectsContainer = null;
let scoreRing = null;

function getElements() {
    effectsContainer ??= document.querySelector(
        "#results-effects"
    );
    scoreRing ??= document.querySelector(
        "#result-ring"
    );

    if (!(effectsContainer instanceof HTMLElement)) {
        throw new Error(
            "The results effects container was not found."
        );
    }

    if (!(scoreRing instanceof HTMLElement)) {
        throw new Error(
            "The result score ring was not found."
        );
    }
}

function prefersReducedMotion() {
    return window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;
}

function randomBetween(minimum, maximum) {
    return (
        Math.random() *
        (maximum - minimum) +
        minimum
    );
}

function randomItem(items) {
    return items[
        Math.floor(Math.random() * items.length)
    ];
}

function setManagedTimeout(callback, delay) {
    const timerId = window.setTimeout(() => {
        activeTimers.delete(timerId);
        callback();
    }, delay);

    activeTimers.add(timerId);

    return timerId;
}

function removeAfterAnimation(
    element,
    fallbackDelay
) {
    const removeElement = () => {
        element.remove();
    };

    element.addEventListener(
        "animationend",
        removeElement,
        { once: true }
    );

    setManagedTimeout(
        removeElement,
        fallbackDelay
    );
}

function createConfettiPiece(index) {
    const piece = document.createElement("span");

    piece.className = "confetti-piece";
    piece.setAttribute("aria-hidden", "true");

    const duration = randomBetween(2.2, 4.1);
    const delay = randomBetween(0, 0.85);
    const drift = randomBetween(-9, 9);
    const rotation = randomBetween(450, 1100);
    const width = randomBetween(0.45, 0.85);
    const height = randomBetween(0.7, 1.35);

    piece.style.left = `${randomBetween(1, 99)}%`;
    piece.style.width = `${width}rem`;
    piece.style.height = `${height}rem`;
    piece.style.backgroundColor =
        randomItem(CONFETTI_COLORS);
    piece.style.borderRadius =
        index % 3 === 0 ? "50%" : "0.15rem";

    piece.style.setProperty(
        "--confetti-duration",
        `${duration}s`
    );
    piece.style.setProperty(
        "--confetti-delay",
        `${delay}s`
    );
    piece.style.setProperty(
        "--confetti-drift",
        `${drift}rem`
    );
    piece.style.setProperty(
        "--confetti-rotation",
        `${rotation}deg`
    );

    removeAfterAnimation(
        piece,
        (duration + delay + 0.5) * 1000
    );

    return piece;
}

function runConfetti() {
    getElements();

    const fragment =
        document.createDocumentFragment();

    for (let index = 0; index < 72; index += 1) {
        fragment.append(
            createConfettiPiece(index)
        );
    }

    effectsContainer.append(fragment);
}

function createSparkle() {
    const sparkle = document.createElement("span");

    sparkle.className = "sparkle";
    sparkle.setAttribute("aria-hidden", "true");

    const duration = randomBetween(1.2, 2.1);
    const delay = randomBetween(0, 0.8);
    const size = randomBetween(0.45, 1.1);

    sparkle.style.left =
        `${randomBetween(8, 92)}%`;
    sparkle.style.top =
        `${randomBetween(8, 88)}%`;
    sparkle.style.width = `${size}rem`;
    sparkle.style.height = `${size}rem`;
    sparkle.style.backgroundColor =
        randomItem(SPARKLE_COLORS);

    sparkle.style.setProperty(
        "--sparkle-duration",
        `${duration}s`
    );
    sparkle.style.setProperty(
        "--sparkle-delay",
        `${delay}s`
    );

    removeAfterAnimation(
        sparkle,
        (duration + delay + 0.5) * 1000
    );

    return sparkle;
}

function runSparkles() {
    getElements();

    const fragment =
        document.createDocumentFragment();

    for (let index = 0; index < 24; index += 1) {
        fragment.append(createSparkle());
    }

    effectsContainer.append(fragment);
}

function runPulse() {
    getElements();

    scoreRing.classList.add(
        "is-gentle-pulse"
    );
}

export function clearResultEffects() {
    getElements();

    activeTimers.forEach((timerId) => {
        window.clearTimeout(timerId);
    });

    activeTimers.clear();
    effectsContainer.replaceChildren();

    scoreRing.classList.remove(
        "is-gentle-pulse"
    );
}

export function runResultEffect(effectName) {
    clearResultEffects();

    if (prefersReducedMotion()) {
        return;
    }

    switch (effectName) {
        case "confetti":
            runConfetti();
            break;

        case "sparkle":
            runSparkles();
            break;

        case "pulse":
            runPulse();
            break;

        case "standard":
        default:
            break;
    }
}