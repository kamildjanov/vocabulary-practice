const createInitialQuizState = () => ({
    mode: "first-round",
    questions: [],
    currentIndex: 0,
    currentAnswer: null,
    firstRoundCorrect: 0,
    firstRoundMistakes: [],
    reviewQueue: [],
    reviewCompleted: false,
    totalQuestions: 0,
});

const createInitialState = () => ({
    currentScreen: "welcome",
    studentName: "",
    languageId: "",
    levelId: "",
    levelData: null,
    selectedUnitId: "",
    selectedGroupId: "",
    selectedGroup: null,
    quiz: createInitialQuizState(),
});

let state = createInitialState();
const listeners = new Set();

function notifyListeners() {
    const snapshot = getState();

    listeners.forEach((listener) => {
        listener(snapshot);
    });
}

function updateState(updater) {
    const nextState =
        typeof updater === "function"
            ? updater(state)
            : {
                ...state,
                ...updater,
            };

    state = nextState;
    notifyListeners();

    return getState();
}

function cloneQuizState(quiz) {
    return {
        ...quiz,
        questions: [...quiz.questions],
        firstRoundMistakes: [...quiz.firstRoundMistakes],
        reviewQueue: [...quiz.reviewQueue],
        currentAnswer: quiz.currentAnswer
            ? { ...quiz.currentAnswer }
            : null,
    };
}

export function getState() {
    return {
        ...state,
        quiz: cloneQuizState(state.quiz),
    };
}

export function subscribe(listener) {
    if (typeof listener !== "function") {
        throw new TypeError("State listener must be a function.");
    }

    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

export function setCurrentScreen(screenName) {
    if (typeof screenName !== "string" || !screenName.trim()) {
        throw new TypeError("A valid screen name is required.");
    }

    return updateState((currentState) => ({
        ...currentState,
        currentScreen: screenName.trim(),
    }));
}

export function setStudentName(studentName) {
    const normalizedName =
        typeof studentName === "string"
            ? studentName.trim().replace(/\s+/g, " ")
            : "";

    return updateState((currentState) => ({
        ...currentState,
        studentName: normalizedName,
    }));
}

export function setLanguage(languageId) {
    const normalizedLanguageId =
        typeof languageId === "string"
            ? languageId.trim()
            : "";

    return updateState((currentState) => ({
        ...currentState,
        languageId: normalizedLanguageId,
    }));
}

export function setLevel(levelId) {
    const normalizedLevelId =
        typeof levelId === "string"
            ? levelId.trim()
            : "";

    return updateState((currentState) => {
        const levelChanged =
            currentState.levelId !== normalizedLevelId;

        return {
            ...currentState,
            levelId: normalizedLevelId,
            levelData: levelChanged
                ? null
                : currentState.levelData,
            selectedUnitId: levelChanged
                ? ""
                : currentState.selectedUnitId,
            selectedGroupId: levelChanged
                ? ""
                : currentState.selectedGroupId,
            selectedGroup: levelChanged
                ? null
                : currentState.selectedGroup,
            quiz: levelChanged
                ? createInitialQuizState()
                : currentState.quiz,
        };
    });
}

export function setLevelData(levelData) {
    if (
        levelData !== null &&
        (typeof levelData !== "object" || Array.isArray(levelData))
    ) {
        throw new TypeError(
            "Level data must be an object or null."
        );
    }

    return updateState((currentState) => ({
        ...currentState,
        levelData,
    }));
}

export function setLessonGroup({
    unitId,
    groupId,
    group,
}) {
    if (
        typeof unitId !== "string" ||
        typeof groupId !== "string" ||
        !unitId.trim() ||
        !groupId.trim() ||
        !group ||
        typeof group !== "object"
    ) {
        throw new TypeError(
            "A valid unit and lesson group are required."
        );
    }

    return updateState((currentState) => ({
        ...currentState,
        selectedUnitId: unitId.trim(),
        selectedGroupId: groupId.trim(),
        selectedGroup: group,
        quiz: createInitialQuizState(),
    }));
}

export function clearLessonGroup() {
    return updateState((currentState) => ({
        ...currentState,
        selectedUnitId: "",
        selectedGroupId: "",
        selectedGroup: null,
        quiz: createInitialQuizState(),
    }));
}

export function initializeQuiz(questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new TypeError(
            "Quiz questions must be a non-empty array."
        );
    }

    return updateState((currentState) => ({
        ...currentState,
        quiz: {
            ...createInitialQuizState(),
            questions: [...questions],
            totalQuestions: questions.length,
        },
    }));
}

export function setCurrentQuizAnswer(answerRecord) {
    if (
        answerRecord !== null &&
        (
            typeof answerRecord !== "object" ||
            Array.isArray(answerRecord)
        )
    ) {
        throw new TypeError(
            "The current answer must be an object or null."
        );
    }

    return updateState((currentState) => ({
        ...currentState,
        quiz: {
            ...currentState.quiz,
            currentAnswer: answerRecord
                ? { ...answerRecord }
                : null,
        },
    }));
}

export function recordFirstRoundAnswer({
    question,
    selectedAnswer,
    isCorrect,
}) {
    if (!question || typeof question !== "object") {
        throw new TypeError(
            "A valid question is required."
        );
    }

    return updateState((currentState) => {
        const mistakeRecord = {
            question,
            selectedAnswer,
        };

        return {
            ...currentState,
            quiz: {
                ...currentState.quiz,
                firstRoundCorrect:
                    currentState.quiz.firstRoundCorrect +
                    (isCorrect ? 1 : 0),
                firstRoundMistakes: isCorrect
                    ? currentState.quiz.firstRoundMistakes
                    : [
                        ...currentState.quiz.firstRoundMistakes,
                        mistakeRecord,
                    ],
            },
        };
    });
}

export function advanceQuizQuestion() {
    return updateState((currentState) => ({
        ...currentState,
        quiz: {
            ...currentState.quiz,
            currentIndex:
                currentState.quiz.currentIndex + 1,
            currentAnswer: null,
        },
    }));
}

export function startReview() {
    return updateState((currentState) => ({
        ...currentState,
        quiz: {
            ...currentState.quiz,
            mode: "review",
            currentIndex: 0,
            currentAnswer: null,
            reviewQueue:
                currentState.quiz.firstRoundMistakes.map(
                    (mistake) => mistake.question
                ),
            reviewCompleted: false,
        },
    }));
}

export function resolveReviewAnswer({
    question,
    isCorrect,
}) {
    if (!question || typeof question !== "object") {
        throw new TypeError(
            "A valid review question is required."
        );
    }

    return updateState((currentState) => {
        const remainingQueue =
            currentState.quiz.reviewQueue.slice(1);

        if (!isCorrect) {
            remainingQueue.push(question);
        }

        return {
            ...currentState,
            quiz: {
                ...currentState.quiz,
                reviewQueue: remainingQueue,
                currentIndex:
                    currentState.quiz.currentIndex + 1,
                currentAnswer: null,
                reviewCompleted:
                    remainingQueue.length === 0,
            },
        };
    });
}

export function resetQuiz() {
    return updateState((currentState) => ({
        ...currentState,
        quiz: createInitialQuizState(),
    }));
}

export function resetForAnotherUnit() {
    return updateState((currentState) => ({
        ...currentState,
        currentScreen: "unit",
        selectedUnitId: "",
        selectedGroupId: "",
        selectedGroup: null,
        quiz: createInitialQuizState(),
    }));
}

export function resetSession() {
    state = createInitialState();
    notifyListeners();

    return getState();
}