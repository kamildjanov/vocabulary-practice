import {
    QUIZ_DIRECTIONS,
    QUIZ_SETTINGS,
    SCREENS,
    getLanguageById,
} from "./config.js";
import {
    goHome,
    showScreen,
} from "./navigation.js";
import {
    advanceQuizQuestion,
    getState,
    initializeQuiz,
    recordFirstRoundAnswer,
    resolveReviewAnswer,
    setCurrentQuizAnswer,
    startReview,
} from "./state.js";
import {
    showFirstRoundSummary,
} from "./review-engine.js";
import {
    showFinalResults,
} from "./results.js";
import {
    announce,
    createElement,
    focusElement,
    getRequiredElement,
    normalizeComparableText,
    normalizeWhitespace,
    setButtonEnabled,
    shuffle,
} from "./utils.js";

let initialized = false;
let renderedAnswers = [];

const elements = {};

function cacheElements() {
    elements.studentName = getRequiredElement(
        "#quiz-student-name"
    );
    elements.modeLabel = getRequiredElement(
        "#quiz-mode-label"
    );
    elements.progressText = getRequiredElement(
        "#quiz-progress-text"
    );
    elements.progressTrack = getRequiredElement(
        "#quiz-progress-track"
    );
    elements.progressBar = getRequiredElement(
        "#quiz-progress-bar"
    );
    elements.reviewRemaining = getRequiredElement(
        "#review-remaining"
    );
    elements.direction = getRequiredElement(
        "#quiz-direction"
    );
    elements.question = getRequiredElement(
        "#quiz-question"
    );
    elements.answers = getRequiredElement(
        "#quiz-answers"
    );
    elements.feedback = getRequiredElement(
        "#quiz-feedback"
    );
    elements.next = getRequiredElement(
        "#quiz-next"
    );
    elements.exit = getRequiredElement(
        "#quiz-exit"
    );

    elements.exitDialog = getRequiredElement(
        "#exit-dialog"
    );
    elements.exitStay = getRequiredElement(
        "#exit-stay"
    );
    elements.exitLeave = getRequiredElement(
        "#exit-leave"
    );
}

function getAlternativeSignatures(value) {
    return normalizeWhitespace(value)
        .split("/")
        .map((part) =>
            normalizeComparableText(part)
                .replace(
                    /[^\p{L}\p{N}]+/gu,
                    " "
                )
                .replace(/\s+/g, " ")
                .trim()
        )
        .filter(Boolean);
}

function getAnswerSignature(value) {
    return [...getAlternativeSignatures(value)]
        .sort((first, second) =>
            first.localeCompare(second)
        )
        .join("|");
}

function areAnswersAmbiguous(
    firstAnswer,
    secondAnswer
) {
    const firstSignature =
        getAnswerSignature(firstAnswer);
    const secondSignature =
        getAnswerSignature(secondAnswer);

    if (
        !firstSignature ||
        !secondSignature
    ) {
        return true;
    }

    if (firstSignature === secondSignature) {
        return true;
    }

    const firstAlternatives = new Set(
        getAlternativeSignatures(firstAnswer)
    );
    const secondAlternatives =
        getAlternativeSignatures(secondAnswer);

    return secondAlternatives.some(
        (alternative) =>
            firstAlternatives.has(alternative)
    );
}

function getDirectionFields(
    direction,
    languageField
) {
    if (
        direction ===
        QUIZ_DIRECTIONS.englishToTranslation
    ) {
        return {
            promptField: "english",
            answerField: languageField,
        };
    }

    return {
        promptField: languageField,
        answerField: "english",
    };
}

function getOppositeDirection(direction) {
    return direction ===
        QUIZ_DIRECTIONS.englishToTranslation
        ? QUIZ_DIRECTIONS.translationToEnglish
        : QUIZ_DIRECTIONS.englishToTranslation;
}

function chooseRandomDirection() {
    return Math.random() < 0.5
        ? QUIZ_DIRECTIONS.englishToTranslation
        : QUIZ_DIRECTIONS.translationToEnglish;
}

function hasUnambiguousPrompt(
    entry,
    entries,
    direction,
    languageField
) {
    const {
        promptField,
        answerField,
    } = getDirectionFields(
        direction,
        languageField
    );

    const promptSignature =
        getAnswerSignature(entry[promptField]);
    const correctAnswer =
        entry[answerField];

    return entries.every((candidate) => {
        if (candidate.id === entry.id) {
            return true;
        }

        const candidatePromptSignature =
            getAnswerSignature(
                candidate[promptField]
            );

        if (
            candidatePromptSignature !==
            promptSignature
        ) {
            return true;
        }

        return !areAnswersAmbiguous(
            correctAnswer,
            candidate[answerField]
        );
    });
}

function getUniqueDistractorCandidates(
    entry,
    entries,
    answerField
) {
    const correctAnswer =
        entry[answerField];
    const seenSignatures = new Set();

    return shuffle(entries)
        .filter(
            (candidate) =>
                candidate.id !== entry.id
        )
        .filter((candidate) => {
            const candidateAnswer =
                normalizeWhitespace(
                    candidate[answerField]
                );
            const signature =
                getAnswerSignature(
                    candidateAnswer
                );

            if (
                !candidateAnswer ||
                !signature ||
                seenSignatures.has(signature) ||
                areAnswersAmbiguous(
                    correctAnswer,
                    candidateAnswer
                )
            ) {
                return false;
            }

            seenSignatures.add(signature);
            return true;
        })
        .map((candidate) =>
            normalizeWhitespace(
                candidate[answerField]
            )
        );
}

function selectDistractors(
    entry,
    entries,
    answerField
) {
    const requiredCount =
        QUIZ_SETTINGS.answerChoiceCount - 1;
    const candidates =
        getUniqueDistractorCandidates(
            entry,
            entries,
            answerField
        );

    for (
        let attempt = 0;
        attempt < 24;
        attempt += 1
    ) {
        const selected = [];

        for (const candidate of shuffle(
            candidates
        )) {
            const overlapsSelected =
                selected.some(
                    (selectedAnswer) =>
                        areAnswersAmbiguous(
                            selectedAnswer,
                            candidate
                        )
                );

            if (overlapsSelected) {
                continue;
            }

            selected.push(candidate);

            if (
                selected.length ===
                requiredCount
            ) {
                return selected;
            }
        }
    }

    return [];
}

function tryBuildQuestion(
    entry,
    entries,
    direction,
    languageField
) {
    const {
        promptField,
        answerField,
    } = getDirectionFields(
        direction,
        languageField
    );

    const prompt = normalizeWhitespace(
        entry[promptField]
    );
    const correctAnswer =
        normalizeWhitespace(
            entry[answerField]
        );

    if (!prompt || !correctAnswer) {
        return null;
    }

    if (
        !hasUnambiguousPrompt(
            entry,
            entries,
            direction,
            languageField
        )
    ) {
        return null;
    }

    const distractors =
        selectDistractors(
            entry,
            entries,
            answerField
        );

    if (
        distractors.length !==
        QUIZ_SETTINGS.answerChoiceCount - 1
    ) {
        return null;
    }

    return Object.freeze({
        id: `${entry.id}--${direction}`,
        entryId: entry.id,
        direction,
        prompt,
        correctAnswer,
        answerChoices: Object.freeze([
            correctAnswer,
            ...distractors,
        ]),
    });
}

function buildQuestion(
    entry,
    entries,
    languageField
) {
    const preferredDirection =
        chooseRandomDirection();

    const preferredQuestion =
        tryBuildQuestion(
            entry,
            entries,
            preferredDirection,
            languageField
        );

    if (preferredQuestion) {
        return preferredQuestion;
    }

    const alternateQuestion =
        tryBuildQuestion(
            entry,
            entries,
            getOppositeDirection(
                preferredDirection
            ),
            languageField
        );

    if (alternateQuestion) {
        return alternateQuestion;
    }

    throw new Error(
        `A clear four-choice question could not be created for “${entry.english}”.`
    );
}

function buildQuizQuestions(
    entries,
    languageField
) {
    if (
        !Array.isArray(entries) ||
        entries.length <
            QUIZ_SETTINGS.answerChoiceCount
    ) {
        throw new Error(
            `This lesson group needs at least ${QUIZ_SETTINGS.answerChoiceCount} valid vocabulary entries.`
        );
    }

    return shuffle(
        entries.map((entry) =>
            buildQuestion(
                entry,
                entries,
                languageField
            )
        )
    );
}

function getCurrentQuestion() {
    const { quiz } = getState();

    if (quiz.mode === "review") {
        return quiz.reviewQueue[0] ?? null;
    }

    return (
        quiz.questions[
            quiz.currentIndex
        ] ?? null
    );
}

function getDirectionLabel(
    question,
    languageName
) {
    if (
        question.direction ===
        QUIZ_DIRECTIONS.englishToTranslation
    ) {
        return `English → ${languageName}`;
    }

    return `${languageName} → English`;
}

function updateProgress({
    answered = false,
    answerWasCorrect = false,
} = {}) {
    const { quiz } = getState();

    let percentage = 0;

    if (quiz.mode === "review") {
        const initialMistakeCount =
            quiz.firstRoundMistakes.length;
        const remainingCount =
            quiz.reviewQueue.length;
        const completedCount =
            initialMistakeCount -
            remainingCount +
            (
                answered &&
                answerWasCorrect
                    ? 1
                    : 0
            );

        percentage =
            initialMistakeCount > 0
                ? Math.round(
                      (
                          completedCount /
                          initialMistakeCount
                      ) * 100
                  )
                : 100;

        elements.modeLabel.textContent =
            "Mistake review";
        elements.progressText.textContent =
            `${remainingCount} remaining`;

        elements.reviewRemaining.hidden =
            false;
        elements.reviewRemaining.textContent =
            `Mistakes remaining: ${remainingCount}`;
    } else {
        const completedCount =
            quiz.currentIndex +
            (answered ? 1 : 0);

        percentage =
            quiz.totalQuestions > 0
                ? Math.round(
                      (
                          completedCount /
                          quiz.totalQuestions
                      ) * 100
                  )
                : 0;

        elements.modeLabel.textContent =
            "Quiz";
        elements.progressText.textContent =
            `${Math.min(
                quiz.currentIndex + 1,
                quiz.totalQuestions
            )} of ${quiz.totalQuestions}`;

        elements.reviewRemaining.hidden =
            true;
        elements.reviewRemaining.textContent =
            "";
    }

    const safePercentage = Math.min(
        Math.max(percentage, 0),
        100
    );

    elements.progressBar.style.width =
        `${safePercentage}%`;

    elements.progressTrack.setAttribute(
        "aria-valuenow",
        String(safePercentage)
    );
}

function createAnswerButton(
    answer,
    index
) {
    const button = createElement("button", {
        className: "answer-option",
        attributes: {
            type: "button",
            "data-answer-index": index,
            "aria-label":
                `Answer ${index + 1}: ${answer}`,
        },
    });

    const indexElement = createElement(
        "span",
        {
            className: "answer-index",
            text: String(index + 1),
            attributes: {
                "aria-hidden": "true",
            },
        }
    );

    const textElement = createElement(
        "span",
        {
            className: "answer-text",
            text: answer,
        }
    );

    const markElement = createElement(
        "span",
        {
            className: "answer-mark",
            attributes: {
                "aria-hidden": "true",
            },
        }
    );

    button.append(
        indexElement,
        textElement,
        markElement
    );

    return button;
}

function resetAnswerArea() {
    elements.feedback.textContent = "";
    elements.feedback.className =
        "feedback";

    elements.next.textContent = "Next";

    setButtonEnabled(
        elements.next,
        false
    );
}

function renderAnswerChoices(question) {
    renderedAnswers = shuffle(
        question.answerChoices
    );

    const fragment =
        document.createDocumentFragment();

    renderedAnswers.forEach(
        (answer, index) => {
            fragment.append(
                createAnswerButton(
                    answer,
                    index
                )
            );
        }
    );

    elements.answers.replaceChildren(
        fragment
    );
}

function updateNextButtonLabel() {
    const { quiz } = getState();

    if (quiz.mode === "review") {
        elements.next.textContent =
            quiz.reviewQueue.length === 1
                ? "Finish Review"
                : "Continue";
        return;
    }

    elements.next.textContent =
        quiz.currentIndex ===
        quiz.totalQuestions - 1
            ? "See Summary"
            : "Next";
}

function resetQuizCardScroll() {
    const quizCard =
        elements.answers.closest(
            ".quiz-card"
        );

    if (
        quizCard instanceof
        HTMLElement
    ) {
        quizCard.scrollTop = 0;
        quizCard.scrollLeft = 0;
    }
}

function renderCurrentQuestion() {
    const state = getState();
    const language = getLanguageById(
        state.languageId
    );
    const question =
        getCurrentQuestion();

    if (!language || !question) {
        return false;
    }

    elements.studentName.textContent =
        state.studentName;
    elements.direction.textContent =
        getDirectionLabel(
            question,
            language.name
        );
    elements.question.textContent =
        question.prompt;

    resetAnswerArea();
    renderAnswerChoices(question);
    updateNextButtonLabel();
    updateProgress();
    resetQuizCardScroll();

    const firstAnswer =
        elements.answers.querySelector(
            ".answer-option"
        );

    if (
        firstAnswer instanceof
        HTMLButtonElement
    ) {
        focusElement(firstAnswer);
    }

    return true;
}

function getAnswerButtons() {
    return [
        ...elements.answers.querySelectorAll(
            ".answer-option"
        ),
    ];
}

function addAnswerMark(
    button,
    mark
) {
    const markElement =
        button.querySelector(
            ".answer-mark"
        );

    if (markElement) {
        markElement.textContent = mark;
    }
}

function showAnswerFeedback(
    selectedIndex,
    question,
    isCorrect
) {
    const answerButtons =
        getAnswerButtons();

    answerButtons.forEach(
        (button, index) => {
            const answer =
                renderedAnswers[index];

            const exactCorrectAnswer =
                getAnswerSignature(answer) ===
                getAnswerSignature(
                    question.correctAnswer
                );

            button.disabled = true;

            if (exactCorrectAnswer) {
                button.classList.add(
                    "is-correct"
                );
                addAnswerMark(button, "✓");
                return;
            }

            if (index === selectedIndex) {
                button.classList.add(
                    "is-incorrect"
                );
                addAnswerMark(button, "×");
                return;
            }

            button.classList.add(
                "is-faded"
            );
        }
    );

    if (isCorrect) {
        elements.feedback.textContent =
            "Correct!";
        elements.feedback.className =
            "feedback is-correct";
    } else {
        elements.feedback.textContent =
            `Not quite. The correct answer is “${question.correctAnswer}”.`;
        elements.feedback.className =
            "feedback is-incorrect";
    }

    setButtonEnabled(
        elements.next,
        true
    );

    updateNextButtonLabel();

    updateProgress({
        answered: true,
        answerWasCorrect: isCorrect,
    });
}

function selectAnswer(answerIndex) {
    const state = getState();

    if (state.quiz.currentAnswer) {
        return;
    }

    const question =
        getCurrentQuestion();
    const selectedAnswer =
        renderedAnswers[answerIndex];

    if (
        !question ||
        typeof selectedAnswer !== "string"
    ) {
        return;
    }

    const isCorrect =
        getAnswerSignature(
            selectedAnswer
        ) ===
        getAnswerSignature(
            question.correctAnswer
        );

    const answerRecord = {
        questionId: question.id,
        selectedAnswer,
        isCorrect,
    };

    setCurrentQuizAnswer(answerRecord);

    if (
        state.quiz.mode ===
        "first-round"
    ) {
        recordFirstRoundAnswer({
            question,
            selectedAnswer,
            isCorrect,
        });
    }

    showAnswerFeedback(
        answerIndex,
        question,
        isCorrect
    );

    announce(
        isCorrect
            ? "Correct answer."
            : `Incorrect. The correct answer is ${question.correctAnswer}.`
    );
}

function finishFirstRoundOrAdvance() {
    const { quiz } = getState();

    const isLastQuestion =
        quiz.currentIndex >=
        quiz.totalQuestions - 1;

    if (isLastQuestion) {
        showFirstRoundSummary();
        return;
    }

    advanceQuizQuestion();
    renderCurrentQuestion();
}

function finishReviewOrAdvance() {
    const state = getState();
    const question =
        state.quiz.reviewQueue[0];
    const currentAnswer =
        state.quiz.currentAnswer;

    if (!question || !currentAnswer) {
        return;
    }

    resolveReviewAnswer({
        question,
        isCorrect:
            currentAnswer.isCorrect,
    });

    if (
        getState().quiz.reviewCompleted
    ) {
        showFinalResults();
        return;
    }

    renderCurrentQuestion();
}

function handleNextQuestion() {
    const { quiz } = getState();

    if (!quiz.currentAnswer) {
        return;
    }

    if (quiz.mode === "review") {
        finishReviewOrAdvance();
        return;
    }

    finishFirstRoundOrAdvance();
}

function openExitDialog() {
    if (elements.exitDialog.open) {
        return;
    }

    elements.exitDialog.showModal();
    focusElement(elements.exitStay);
}

function closeExitDialog() {
    if (elements.exitDialog.open) {
        elements.exitDialog.close();
    }

    focusElement(elements.exit);
}

function leaveQuiz() {
    if (elements.exitDialog.open) {
        elements.exitDialog.close();
    }

    goHome();
}

function handleAnswerClick(event) {
    event.preventDefault();

    const button = event.target.closest(
        ".answer-option"
    );

    if (
        !(button instanceof
            HTMLButtonElement) ||
        button.disabled
    ) {
        return;
    }

    const answerIndex = Number(
        button.dataset.answerIndex
    );

    if (!Number.isInteger(answerIndex)) {
        return;
    }

    selectAnswer(answerIndex);
}

function handleKeyboardControls(event) {
    if (
        getState().currentScreen !==
            SCREENS.quiz ||
        elements.exitDialog.open ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
    ) {
        return;
    }

    const answerKeyIndex =
        QUIZ_SETTINGS.keyboardAnswerKeys.indexOf(
            event.key
        );

    if (answerKeyIndex >= 0) {
        event.preventDefault();

        const button =
            getAnswerButtons()[
                answerKeyIndex
            ];

        if (
            button instanceof
                HTMLButtonElement &&
            !button.disabled
        ) {
            selectAnswer(
                answerKeyIndex
            );
        }

        return;
    }

    if (
        event.key === "Enter" &&
        !elements.next.disabled
    ) {
        event.preventDefault();
        handleNextQuestion();
    }
}

function bindEvents() {
    elements.answers.addEventListener(
        "click",
        handleAnswerClick
    );

    elements.next.addEventListener(
        "click",
        handleNextQuestion
    );

    elements.exit.addEventListener(
        "click",
        openExitDialog
    );

    elements.exitStay.addEventListener(
        "click",
        closeExitDialog
    );

    elements.exitLeave.addEventListener(
        "click",
        leaveQuiz
    );

    elements.exitDialog.addEventListener(
        "cancel",
        (event) => {
            event.preventDefault();
            closeExitDialog();
        }
    );

    document.addEventListener(
        "keydown",
        handleKeyboardControls
    );
}

function prepareQuizScreen() {
    const { studentName } = getState();

    elements.studentName.textContent =
        studentName;

    showScreen(SCREENS.quiz, {
        focus: false,
    });

    renderCurrentQuestion();
}

export function startFirstRoundQuiz() {
    const state = getState();
    const language = getLanguageById(
        state.languageId
    );
    const entries =
        state.selectedGroup?.entries;

    if (
        !language ||
        !Array.isArray(entries) ||
        entries.length === 0
    ) {
        announce(
            "The selected quiz could not be started."
        );
        return false;
    }

    try {
        const questions =
            buildQuizQuestions(
                entries,
                language.field
            );

        initializeQuiz(questions);
        prepareQuizScreen();

        return true;
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "The quiz could not be created.";

        console.error(error);
        announce(message);
        window.alert(message);

        return false;
    }
}

export function startMistakeReview() {
    const { quiz } = getState();

    if (
        quiz.firstRoundMistakes.length ===
        0
    ) {
        showFinalResults();
        return;
    }

    startReview();
    prepareQuizScreen();
}

export function initializeQuizEngine() {
    if (initialized) {
        return;
    }

    cacheElements();
    bindEvents();

    initialized = true;
}
