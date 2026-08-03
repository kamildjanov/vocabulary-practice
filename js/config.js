export const LEVELS = Object.freeze([
    Object.freeze({
        id: "beginner",
        name: "Beginner",
        dataPath: "./data/beginner.json",
    }),
    Object.freeze({
        id: "elementary",
        name: "Elementary",
        dataPath: "./data/elementary.json",
    }),
    Object.freeze({
        id: "pre-intermediate",
        name: "Pre-Intermediate",
        dataPath: "./data/pre-intermediate.json",
    }),
    Object.freeze({
        id: "intermediate",
        name: "Intermediate",
        dataPath: "./data/intermediate.json",
    }),
    Object.freeze({
        id: "upper-intermediate",
        name: "Upper-Intermediate",
        dataPath: "./data/upper-intermediate.json",
    }),
    Object.freeze({
        id: "advanced",
        name: "Advanced",
        dataPath: "./data/advanced.json",
    }),
]);

export const LANGUAGES = Object.freeze({
    uzbek: Object.freeze({
        id: "uzbek",
        name: "Uzbek",
        field: "uzbek",
    }),
    russian: Object.freeze({
        id: "russian",
        name: "Russian",
        field: "russian",
    }),
});

export const SCREENS = Object.freeze({
    welcome: "welcome",
    name: "name",
    language: "language",
    level: "level",
    unit: "unit",
    confirmation: "confirmation",
    quiz: "quiz",
    summary: "summary",
    results: "results",
});

export const QUIZ_DIRECTIONS = Object.freeze({
    englishToTranslation: "english-to-translation",
    translationToEnglish: "translation-to-english",
});

export const QUIZ_SETTINGS = Object.freeze({
    answerChoiceCount: 4,
    minimumNameLength: 2,
    maximumNameLength: 60,
    keyboardAnswerKeys: Object.freeze(["1", "2", "3", "4"]),
});

export const RESULT_BANDS = Object.freeze([
    Object.freeze({
        minimum: 90,
        message: "Excellent!",
        icon: "🏆",
        effect: "confetti",
    }),
    Object.freeze({
        minimum: 75,
        message: "Great!",
        icon: "✨",
        effect: "sparkle",
    }),
    Object.freeze({
        minimum: 60,
        message: "Good progress!",
        icon: "✓",
        effect: "standard",
    }),
    Object.freeze({
        minimum: 0,
        message: "Keep practicing — you’re making progress!",
        icon: "↗",
        effect: "pulse",
    }),
]);

export function getLevelById(levelId) {
    return LEVELS.find((level) => level.id === levelId) ?? null;
}

export function getLanguageById(languageId) {
    return LANGUAGES[languageId] ?? null;
}