import {
    LANGUAGES,
    LEVELS,
    QUIZ_SETTINGS,
    SCREENS,
    getLanguageById,
    getLevelById,
} from "./config.js";
import { loadLevelData } from "./data-loader.js";
import {
    goHome,
    showScreen,
} from "./navigation.js";
import {
    getState,
    setLanguage,
    setLevel,
    setLevelData,
    setStudentName,
} from "./state.js";
import {
    clearUnitAccordion,
    refreshUnitSelection,
    renderUnitAccordion,
} from "./unit-builder.js";
import {
    announce,
    createElement,
    focusElement,
    getRequiredElement,
    getRequiredElements,
    normalizeWhitespace,
    setButtonEnabled,
    setElementText,
    setRadioSelection,
} from "./utils.js";
import { startFirstRoundQuiz } from "./quiz-engine.js";

let initialized = false;
let nameInputHasBeenTouched = false;
let levelLoadRequestId = 0;

const elements = {};

function cacheElements() {
    elements.welcomeStart = getRequiredElement(
        "#welcome-start"
    );

    elements.nameForm = getRequiredElement(
        "#name-form"
    );
    elements.nameInput = getRequiredElement(
        "#student-name"
    );
    elements.nameContinue = getRequiredElement(
        "#name-continue"
    );
    elements.nameError = getRequiredElement(
        "#name-error"
    );

    elements.languageOptions = getRequiredElement(
        "#language-options"
    );
    elements.languageButtons = getRequiredElements(
        "#language-options [data-language]"
    );
    elements.languageContinue =
        getRequiredElement(
            "#language-continue"
        );
    elements.languageBack = getRequiredElement(
        "#language-back"
    );

    elements.levelOptions = getRequiredElement(
        "#level-options"
    );
    elements.levelContinue = getRequiredElement(
        "#level-continue"
    );
    elements.levelBack = getRequiredElement(
        "#level-back"
    );

    elements.unitBack = getRequiredElement(
        "#unit-back"
    );
    elements.unitContinue = getRequiredElement(
        "#unit-continue"
    );
    elements.unitLevelName = getRequiredElement(
        "#unit-level-name"
    );
    elements.unitLoading = getRequiredElement(
        "#unit-loading"
    );
    elements.unitError = getRequiredElement(
        "#unit-error"
    );

    elements.confirmationBack =
        getRequiredElement(
            "#confirmation-back"
        );
    elements.quizStart = getRequiredElement(
        "#quiz-start"
    );
    elements.confirmationName =
        getRequiredElement(
            "#confirmation-name"
        );
    elements.confirmationLanguage =
        getRequiredElement(
            "#confirmation-language"
        );
    elements.confirmationLevel =
        getRequiredElement(
            "#confirmation-level"
        );
    elements.confirmationGroup =
        getRequiredElement(
            "#confirmation-group"
        );
    elements.confirmationCount =
        getRequiredElement(
            "#confirmation-count"
        );

    elements.homeButtons = getRequiredElements(
        [
            "#name-home",
            "#language-home",
            "#level-home",
            "#unit-home",
            "#confirmation-home",
        ].join(", ")
    );
}

function isValidStudentName(value) {
    const normalizedName =
        normalizeWhitespace(value);

    return (
        normalizedName.length >=
        QUIZ_SETTINGS.minimumNameLength &&
        normalizedName.length <=
        QUIZ_SETTINGS.maximumNameLength
    );
}

function getNameValidationMessage(value) {
    const normalizedName =
        normalizeWhitespace(value);

    if (!normalizedName) {
        return "Please enter your name.";
    }

    if (
        normalizedName.length <
        QUIZ_SETTINGS.minimumNameLength
    ) {
        return `Your name must contain at least ${QUIZ_SETTINGS.minimumNameLength} characters.`;
    }

    if (
        normalizedName.length >
        QUIZ_SETTINGS.maximumNameLength
    ) {
        return `Your name must contain no more than ${QUIZ_SETTINGS.maximumNameLength} characters.`;
    }

    return "";
}

function updateNameValidation({
    showError = nameInputHasBeenTouched,
} = {}) {
    const value = elements.nameInput.value;
    const isValid = isValidStudentName(value);
    const message = isValid
        ? ""
        : getNameValidationMessage(value);

    setButtonEnabled(
        elements.nameContinue,
        isValid
    );

    elements.nameInput.setAttribute(
        "aria-invalid",
        String(showError && !isValid)
    );

    elements.nameError.textContent =
        showError ? message : "";

    return isValid;
}

function restoreNameScreen() {
    const { studentName } = getState();

    elements.nameInput.value = studentName;
    nameInputHasBeenTouched = false;

    updateNameValidation({
        showError: false,
    });
}

function openNameScreen() {
    restoreNameScreen();

    showScreen(SCREENS.name, {
        focusSelector: "#student-name",
    });
}

function restoreLanguageSelection() {
    const { languageId } = getState();

    setRadioSelection(
        elements.languageButtons,
        languageId,
        "language"
    );

    setButtonEnabled(
        elements.languageContinue,
        Boolean(getLanguageById(languageId))
    );
}

function openLanguageScreen() {
    restoreLanguageSelection();

    showScreen(SCREENS.language, {
        focusSelector:
            "#language-options [aria-checked='true'], #language-options [role='radio']",
    });
}

function createLevelButton(level) {
    const button = createElement("button", {
        className: "selection-card",
        text: level.name,
        attributes: {
            type: "button",
            role: "radio",
            "aria-checked": "false",
            "data-level": level.id,
        },
    });

    button.addEventListener("click", () => {
        selectLevel(level.id);
    });

    return button;
}

function renderLevelOptions() {
    const fragment =
        document.createDocumentFragment();

    LEVELS.forEach((level) => {
        fragment.append(
            createLevelButton(level)
        );
    });

    elements.levelOptions.replaceChildren(
        fragment
    );
}

function getLevelButtons() {
    return [
        ...elements.levelOptions.querySelectorAll(
            "[data-level]"
        ),
    ];
}

function restoreLevelSelection() {
    const { levelId } = getState();
    const levelButtons = getLevelButtons();

    setRadioSelection(
        levelButtons,
        levelId,
        "level"
    );

    setButtonEnabled(
        elements.levelContinue,
        Boolean(getLevelById(levelId))
    );
}

function selectLevel(levelId) {
    const level = getLevelById(levelId);

    if (!level) {
        return;
    }

    setLevel(level.id);
    restoreLevelSelection();

    announce(`${level.name} selected.`);
}

function openLevelScreen() {
    restoreLevelSelection();

    showScreen(SCREENS.level, {
        focusSelector:
            "#level-options [aria-checked='true'], #level-options [role='radio']",
    });
}

function setUnitLoadingState(isLoading) {
    elements.unitLoading.hidden =
        !isLoading;

    if (isLoading) {
        elements.unitError.hidden = true;
        elements.unitError.textContent = "";
        setButtonEnabled(
            elements.unitContinue,
            false
        );
    }
}

function showUnitError(error) {
    const message =
        error instanceof Error
            ? error.message
            : "The vocabulary data could not be loaded.";

    elements.unitLoading.hidden = true;
    elements.unitError.hidden = false;
    elements.unitError.textContent = message;

    clearUnitAccordion();

    announce(message);
}

async function loadAndRenderSelectedLevel() {
    const { levelId } = getState();
    const level = getLevelById(levelId);

    if (!level) {
        openLevelScreen();
        return;
    }

    const requestId =
        ++levelLoadRequestId;

    setElementText(
        elements.unitLevelName,
        level.name
    );

    setUnitLoadingState(true);
    clearUnitAccordion();

    try {
        const levelData =
            await loadLevelData(level.id);

        if (
            requestId !==
            levelLoadRequestId ||
            getState().levelId !== level.id
        ) {
            return;
        }

        setLevelData(levelData);
        renderUnitAccordion(levelData);

        elements.unitLoading.hidden = true;
        elements.unitError.hidden = true;
        elements.unitError.textContent = "";
    } catch (error) {
        if (
            requestId !==
            levelLoadRequestId
        ) {
            return;
        }

        showUnitError(error);
    }
}

async function openUnitScreen({
    reload = false,
} = {}) {
    const state = getState();
    const level = getLevelById(
        state.levelId
    );

    if (!level) {
        openLevelScreen();
        return;
    }

    setElementText(
        elements.unitLevelName,
        level.name
    );

    showScreen(SCREENS.unit, {
        focusSelector:
            ".accordion-trigger",
    });

    if (
        !reload &&
        state.levelData?.level?.id ===
        state.levelId
    ) {
        elements.unitLoading.hidden = true;
        elements.unitError.hidden = true;
        elements.unitError.textContent = "";

        renderUnitAccordion(
            state.levelData
        );
        refreshUnitSelection();
        return;
    }

    await loadAndRenderSelectedLevel();
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

function renderConfirmation() {
    const state = getState();
    const language = getLanguageById(
        state.languageId
    );
    const level = getLevelById(
        state.levelId
    );
    const unitName =
        getSelectedUnitName(state);
    const groupName =
        state.selectedGroup?.name ?? "";
    const questionCount =
        state.selectedGroup?.questionCount ??
        state.selectedGroup?.entries?.length ??
        0;

    if (
        !state.studentName ||
        !language ||
        !level ||
        !state.selectedGroup ||
        questionCount < 1
    ) {
        return false;
    }

    setElementText(
        elements.confirmationName,
        state.studentName
    );
    setElementText(
        elements.confirmationLanguage,
        language.name
    );
    setElementText(
        elements.confirmationLevel,
        level.name
    );
    setElementText(
        elements.confirmationGroup,
        unitName
            ? `${unitName} — ${groupName}`
            : groupName
    );
    setElementText(
        elements.confirmationCount,
        String(questionCount)
    );

    return true;
}

function openConfirmationScreen() {
    if (!renderConfirmation()) {
        openUnitScreen();
        return;
    }

    showScreen(SCREENS.confirmation, {
        focusSelector: "#quiz-start",
    });
}

function moveRadioFocus(
    buttons,
    currentButton,
    direction
) {
    const currentIndex =
        buttons.indexOf(currentButton);

    if (currentIndex < 0) {
        return;
    }

    let nextIndex = currentIndex;

    if (direction === "next") {
        nextIndex =
            (currentIndex + 1) %
            buttons.length;
    }

    if (direction === "previous") {
        nextIndex =
            (currentIndex - 1 +
                buttons.length) %
            buttons.length;
    }

    if (direction === "first") {
        nextIndex = 0;
    }

    if (direction === "last") {
        nextIndex =
            buttons.length - 1;
    }

    focusElement(buttons[nextIndex]);
}

function handleRadioGroupKeydown(
    event,
    {
        buttonSelector,
        selectAttribute,
        onSelect,
    }
) {
    const currentButton =
        event.target.closest(buttonSelector);

    if (
        !(currentButton instanceof
            HTMLButtonElement)
    ) {
        return;
    }

    const buttons = [
        ...event.currentTarget.querySelectorAll(
            buttonSelector
        ),
    ];

    const keyDirections = {
        ArrowRight: "next",
        ArrowDown: "next",
        ArrowLeft: "previous",
        ArrowUp: "previous",
        Home: "first",
        End: "last",
    };

    const direction =
        keyDirections[event.key];

    if (direction) {
        event.preventDefault();

        moveRadioFocus(
            buttons,
            currentButton,
            direction
        );
        return;
    }

    if (
        event.key === " " ||
        event.key === "Enter"
    ) {
        event.preventDefault();

        const selectedValue =
            currentButton.dataset[
            selectAttribute
            ];

        onSelect(selectedValue);
    }
}

function bindNameScreen() {
    elements.welcomeStart.addEventListener(
        "click",
        openNameScreen
    );

    elements.nameInput.addEventListener(
        "input",
        () => {
            updateNameValidation({
                showError:
                    nameInputHasBeenTouched,
            });
        }
    );

    elements.nameInput.addEventListener(
        "blur",
        () => {
            nameInputHasBeenTouched = true;
            updateNameValidation({
                showError: true,
            });
        }
    );

    elements.nameForm.addEventListener(
        "submit",
        (event) => {
            event.preventDefault();

            nameInputHasBeenTouched = true;

            if (
                !updateNameValidation({
                    showError: true,
                })
            ) {
                focusElement(
                    elements.nameInput
                );
                return;
            }

            setStudentName(
                elements.nameInput.value
            );

            openLanguageScreen();
        }
    );
}

function bindLanguageScreen() {
    elements.languageButtons.forEach(
        (button) => {
            button.addEventListener(
                "click",
                () => {
                    const languageId =
                        button.dataset.language;
                    const language =
                        LANGUAGES[languageId];

                    if (!language) {
                        return;
                    }

                    setLanguage(language.id);
                    restoreLanguageSelection();

                    announce(
                        `${language.name} selected.`
                    );
                }
            );
        }
    );

    elements.languageOptions.addEventListener(
        "keydown",
        (event) => {
            handleRadioGroupKeydown(event, {
                buttonSelector:
                    "[data-language]",
                selectAttribute: "language",
                onSelect: (languageId) => {
                    const language =
                        LANGUAGES[languageId];

                    if (!language) {
                        return;
                    }

                    setLanguage(language.id);
                    restoreLanguageSelection();
                },
            });
        }
    );

    elements.languageBack.addEventListener(
        "click",
        openNameScreen
    );

    elements.languageContinue.addEventListener(
        "click",
        openLevelScreen
    );
}

function bindLevelScreen() {
    elements.levelOptions.addEventListener(
        "keydown",
        (event) => {
            handleRadioGroupKeydown(event, {
                buttonSelector:
                    "[data-level]",
                selectAttribute: "level",
                onSelect: selectLevel,
            });
        }
    );

    elements.levelBack.addEventListener(
        "click",
        openLanguageScreen
    );

    elements.levelContinue.addEventListener(
        "click",
        () => {
            openUnitScreen();
        }
    );
}

function bindUnitScreen() {
    elements.unitBack.addEventListener(
        "click",
        openLevelScreen
    );

    elements.unitContinue.addEventListener(
        "click",
        openConfirmationScreen
    );
}

function bindConfirmationScreen() {
    elements.confirmationBack.addEventListener(
        "click",
        () => {
            openUnitScreen();
        }
    );

    elements.quizStart.addEventListener(
        "click",
        () => {
            startFirstRoundQuiz();
        }
    );
}

function bindHomeButtons() {
    elements.homeButtons.forEach(
        (button) => {
            button.addEventListener(
                "click",
                () => {
                    levelLoadRequestId += 1;
                    goHome();
                }
            );
        }
    );
}

export function refreshSetupScreens() {
    restoreNameScreen();
    restoreLanguageSelection();
    restoreLevelSelection();

    const state = getState();

    if (
        state.levelData &&
        state.levelData.level?.id ===
        state.levelId
    ) {
        renderUnitAccordion(
            state.levelData
        );
    }

    renderConfirmation();
}

export function initializeSetup() {
    if (initialized) {
        return;
    }

    cacheElements();
    renderLevelOptions();

    bindNameScreen();
    bindLanguageScreen();
    bindLevelScreen();
    bindUnitScreen();
    bindConfirmationScreen();
    bindHomeButtons();

    refreshSetupScreens();

    initialized = true;
}