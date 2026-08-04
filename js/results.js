import {
    RESULT_BANDS,
    SCREENS,
    getLanguageById,
    getLevelById,
} from "./config.js";
import {
    clearResultEffects,
    runResultEffect,
} from "./effects.js";
import {
    goHome,
    showScreen,
} from "./navigation.js";
import {
    submitQuizResult,
} from "./result-submitter.js";
import {
    getState,
    resetForAnotherUnit,
} from "./state.js";
import {
    renderUnitAccordion,
} from "./unit-builder.js";
import {
    announce,
    calculatePercentage,
    getRequiredElement,
    setElementText,
} from "./utils.js";

let initialized = false;

const elements = {};

function cacheElements() {
    elements.percentage = getRequiredElement(
        "#result-percentage"
    );
    elements.scoreRing = getRequiredElement(
        "#result-ring"
    );
    elements.icon = getRequiredElement(
        "#result-icon"
    );
    elements.message = getRequiredElement(
        "#result-message"
    );
    elements.name = getRequiredElement(
        "#result-name"
    );
    elements.score = getRequiredElement(
        "#result-score"
    );
    elements.level = getRequiredElement(
        "#result-level"
    );
    elements.group = getRequiredElement(
        "#result-group"
    );

    elements.retake = getRequiredElement(
        "#result-retake"
    );
    elements.anotherUnit = getRequiredElement(
        "#result-another-unit"
    );
    elements.home = getRequiredElement(
        "#result-home"
    );
}

function getResultBand(percentage) {
    return (
        RESULT_BANDS.find(
            (band) =>
                percentage >= band.minimum
        ) ?? RESULT_BANDS.at(-1)
    );
}

function getSelectedUnitName(state) {
    if (
        !state.levelData ||
        !Array.isArray(state.levelData.units)
    ) {
        return "";
    }

    return (
        state.levelData.units.find(
            (unit) =>
                unit.id ===
                state.selectedUnitId
        )?.name ?? ""
    );
}

function getResultData() {
    const state = getState();

    const level = getLevelById(
        state.levelId
    );

    const language = getLanguageById(
        state.languageId
    );

    const totalQuestions =
        state.quiz.totalQuestions;

    const correctCount =
        state.quiz.firstRoundCorrect;

    const percentage =
        calculatePercentage(
            correctCount,
            totalQuestions
        );

    const unitName =
        getSelectedUnitName(state);

    const groupName =
        state.selectedGroup?.name ?? "";

    return {
        state,
        levelName:
            level?.name ??
            state.levelData?.level?.name ??
            "",
        languageName:
            language?.name ?? "",
        totalQuestions,
        correctCount,
        percentage,
        unitName,
        groupName,
        resultBand:
            getResultBand(percentage),
    };
}

function isResultReady(resultData) {
    const answeredCount =
        resultData.correctCount +
        resultData.state.quiz
            .firstRoundMistakes.length;

    return (
        resultData.totalQuestions > 0 &&
        answeredCount ===
            resultData.totalQuestions
    );
}

function resetScoreRing() {
    elements.scoreRing.classList.remove(
        "is-gentle-pulse"
    );

    elements.scoreRing.style.setProperty(
        "--score-angle",
        "0deg"
    );
}

function animateScoreRing(percentage) {
    const scoreAngle =
        percentage * 3.6;

    resetScoreRing();

    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            elements.scoreRing.style.setProperty(
                "--score-angle",
                `${scoreAngle}deg`
            );
        });
    });
}

function renderResultDetails(resultData) {
    const {
        state,
        levelName,
        totalQuestions,
        correctCount,
        percentage,
        unitName,
        groupName,
        resultBand,
    } = resultData;

    setElementText(
        elements.percentage,
        `${percentage}%`
    );

    setElementText(
        elements.icon,
        resultBand.icon
    );

    setElementText(
        elements.message,
        resultBand.message
    );

    setElementText(
        elements.name,
        state.studentName
    );

    setElementText(
        elements.score,
        `${correctCount}/${totalQuestions}`
    );

    setElementText(
        elements.level,
        levelName
    );

    setElementText(
        elements.group,
        unitName
            ? `${unitName} — ${groupName}`
            : groupName
    );

    elements.scoreRing.setAttribute(
        "aria-label",
        `Final score: ${percentage} percent, ${correctCount} correct out of ${totalQuestions}`
    );

    animateScoreRing(percentage);
}

async function submitResult(resultData) {
    const {
        state,
        levelName,
        languageName,
        totalQuestions,
        correctCount,
        unitName,
        groupName,
    } = resultData;

    if (
        !state.quiz.attemptId ||
        !state.studentName ||
        !languageName ||
        !levelName ||
        !unitName ||
        !groupName
    ) {
        console.warn(
            "The quiz result was not submitted because required information is missing."
        );

        return;
    }

    try {
        await submitQuizResult({
            submissionId:
                state.quiz.attemptId,
            studentName:
                state.studentName,
            score:
                correctCount,
            totalQuestions,
            language:
                languageName,
            level:
                levelName,
            unitName,
            lessonGroup:
                groupName,
        });
    } catch (error) {
        console.warn(
            "The quiz result could not be submitted to Supabase.",
            error
        );
    }
}

function openAnotherUnitScreen() {
    clearResultEffects();
    resetForAnotherUnit();

    const state = getState();

    const level = getLevelById(
        state.levelId
    );

    const levelNameElement =
        getRequiredElement(
            "#unit-level-name"
        );

    const loadingElement =
        getRequiredElement(
            "#unit-loading"
        );

    const errorElement =
        getRequiredElement(
            "#unit-error"
        );

    setElementText(
        levelNameElement,
        level?.name ??
            state.levelData?.level?.name ??
            ""
    );

    loadingElement.hidden = true;
    errorElement.hidden = true;
    errorElement.textContent = "";

    if (
        state.levelData &&
        Array.isArray(
            state.levelData.units
        )
    ) {
        renderUnitAccordion(
            state.levelData
        );
    }

    showScreen(SCREENS.unit, {
        focusSelector:
            ".accordion-trigger",
    });

    announce(
        "Choose another lesson group."
    );
}

async function retakeQuiz() {
    clearResultEffects();

    const { startFirstRoundQuiz } =
        await import("./quiz-engine.js");

    startFirstRoundQuiz();
}

function returnHome() {
    clearResultEffects();
    goHome();
}

function bindEvents() {
    elements.retake.addEventListener(
        "click",
        () => {
            void retakeQuiz();
        }
    );

    elements.anotherUnit.addEventListener(
        "click",
        openAnotherUnitScreen
    );

    elements.home.addEventListener(
        "click",
        returnHome
    );
}

export function showFinalResults() {
    const resultData =
        getResultData();

    if (!isResultReady(resultData)) {
        announce(
            "The quiz results are not ready yet."
        );

        return false;
    }

    clearResultEffects();
    renderResultDetails(resultData);

    showScreen(SCREENS.results, {
        focusSelector: "#result-retake",
    });

    runResultEffect(
        resultData.resultBand.effect
    );

    void submitResult(resultData);

    announce(
        `${resultData.resultBand.message} You scored ${resultData.correctCount} out of ${resultData.totalQuestions}, or ${resultData.percentage} percent.`
    );

    return true;
}

export function initializeResults() {
    if (initialized) {
        return;
    }

    cacheElements();
    bindEvents();

    initialized = true;
}
