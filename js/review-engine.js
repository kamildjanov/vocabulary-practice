import { SCREENS } from "./config.js";
import { showScreen } from "./navigation.js";
import { getState } from "./state.js";
import {
    announce,
    getRequiredElement,
    setElementText,
} from "./utils.js";
import { startMistakeReview } from "./quiz-engine.js";
import { showFinalResults } from "./results.js";

let initialized = false;

const elements = {};

function cacheElements() {
    elements.title = getRequiredElement(
        "#summary-title"
    );
    elements.message = getRequiredElement(
        "#summary-message"
    );
    elements.correct = getRequiredElement(
        "#summary-correct"
    );
    elements.mistakes = getRequiredElement(
        "#summary-mistakes"
    );
    elements.continueButton =
        getRequiredElement(
            "#summary-continue"
        );
}

function getSummaryData() {
    const { quiz } = getState();

    const totalQuestions =
        quiz.totalQuestions;
    const correctCount =
        quiz.firstRoundCorrect;
    const mistakeCount =
        quiz.firstRoundMistakes.length;

    return {
        totalQuestions,
        correctCount,
        mistakeCount,
        hasMistakes: mistakeCount > 0,
    };
}

function renderSummary() {
    const summary = getSummaryData();

    setElementText(
        elements.correct,
        `${summary.correctCount}/${summary.totalQuestions}`
    );

    setElementText(
        elements.mistakes,
        String(summary.mistakeCount)
    );

    if (summary.hasMistakes) {
        setElementText(
            elements.title,
            "Time to review"
        );

        setElementText(
            elements.message,
            summary.mistakeCount === 1
                ? "You made one mistake. Review it until you answer it correctly."
                : `You made ${summary.mistakeCount} mistakes. Review them until every answer is correct.`
        );

        setElementText(
            elements.continueButton,
            "Review Mistakes"
        );

        return;
    }

    setElementText(
        elements.title,
        "Perfect first round!"
    );

    setElementText(
        elements.message,
        "You answered every question correctly on your first attempt."
    );

    setElementText(
        elements.continueButton,
        "See Results"
    );
}

function handleContinue() {
    const { hasMistakes } =
        getSummaryData();

    if (hasMistakes) {
        startMistakeReview();
        return;
    }

    showFinalResults();
}

function bindEvents() {
    elements.continueButton.addEventListener(
        "click",
        handleContinue
    );
}

export function showFirstRoundSummary() {
    const { quiz } = getState();

    if (
        quiz.totalQuestions < 1 ||
        quiz.currentIndex <
        quiz.totalQuestions - 1
    ) {
        announce(
            "The first round is not complete yet."
        );
        return false;
    }

    renderSummary();

    showScreen(SCREENS.summary, {
        focusSelector: "#summary-continue",
    });

    const { mistakeCount } =
        getSummaryData();

    announce(
        mistakeCount > 0
            ? `First round complete. ${mistakeCount} mistakes to review.`
            : "First round complete with no mistakes."
    );

    return true;
}

export function initializeReviewEngine() {
    if (initialized) {
        return;
    }

    cacheElements();
    bindEvents();

    initialized = true;
}