import { SCREENS } from "./config.js";
import {
    getState,
    resetSession,
    setCurrentScreen,
} from "./state.js";
import {
    focusElement,
    getRequiredElement,
} from "./utils.js";

const SCREEN_NAMES = new Set(
    Object.values(SCREENS)
);

const DEFAULT_FOCUS_SELECTORS = Object.freeze({
    [SCREENS.welcome]: "#welcome-start",
    [SCREENS.name]: "#student-name",
    [SCREENS.language]:
        "#language-options [role='radio']",
    [SCREENS.level]:
        "#level-options [role='radio']",
    [SCREENS.unit]: ".accordion-trigger",
    [SCREENS.confirmation]: "#quiz-start",
    [SCREENS.quiz]:
        "#quiz-answers .answer-option",
    [SCREENS.summary]: "#summary-continue",
    [SCREENS.results]: "#result-retake",
});

let screens = [];
let initialized = false;

function validateScreenName(screenName) {
    if (!SCREEN_NAMES.has(screenName)) {
        throw new Error(
            `Unknown screen name: ${screenName}`
        );
    }
}

function getScreens() {
    if (screens.length === 0) {
        screens = [
            ...document.querySelectorAll(
                "[data-screen]"
            ),
        ];
    }

    if (screens.length === 0) {
        throw new Error(
            "No application screens were found."
        );
    }

    return screens;
}

function getScreenElement(screenName) {
    validateScreenName(screenName);

    return getRequiredElement(
        `[data-screen="${screenName}"]`
    );
}

function restartScreenAnimation(screen) {
    screen.classList.remove("is-active");

    window.requestAnimationFrame(() => {
        screen.classList.add("is-active");
    });
}

function focusScreenContent(
    screenName,
    screen,
    customFocusSelector = ""
) {
    const focusSelector =
        customFocusSelector ||
        DEFAULT_FOCUS_SELECTORS[screenName];

    if (focusSelector) {
        const preferredElement =
            screen.querySelector(focusSelector);

        if (preferredElement instanceof HTMLElement) {
            focusElement(preferredElement);
            return;
        }
    }

    const heading = screen.querySelector(
        "h1, h2"
    );

    if (heading instanceof HTMLElement) {
        const hadTabIndex =
            heading.hasAttribute("tabindex");

        if (!hadTabIndex) {
            heading.setAttribute("tabindex", "-1");
        }

        focusElement(heading);

        if (!hadTabIndex) {
            heading.addEventListener(
                "blur",
                () => {
                    heading.removeAttribute("tabindex");
                },
                { once: true }
            );
        }
    }
}

export function showScreen(
    screenName,
    {
        focus = true,
        focusSelector = "",
        scrollToTop = true,
        updateState = true,
    } = {}
) {
    const targetScreen =
        getScreenElement(screenName);

    getScreens().forEach((screen) => {
        const isTarget =
            screen === targetScreen;

        screen.hidden = !isTarget;
        screen.setAttribute(
            "aria-hidden",
            String(!isTarget)
        );

        if (!isTarget) {
            screen.classList.remove(
                "is-active"
            );
        }
    });

    restartScreenAnimation(targetScreen);

    if (updateState) {
        setCurrentScreen(screenName);
    }

    if (scrollToTop) {
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: "auto",
        });
    }

    if (focus) {
        window.requestAnimationFrame(() => {
            focusScreenContent(
                screenName,
                targetScreen,
                focusSelector
            );
        });
    }

    return targetScreen;
}

export function goHome({
    focus = true,
} = {}) {
    resetSession();

    return showScreen(
        SCREENS.welcome,
        {
            focus,
            focusSelector: "#welcome-start",
            updateState: false,
        }
    );
}

export function getActiveScreenName() {
    const activeScreen = getScreens().find(
        (screen) => !screen.hidden
    );

    return (
        activeScreen?.dataset.screen ??
        getState().currentScreen
    );
}

export function initializeNavigation() {
    if (initialized) {
        return;
    }

    const currentScreen =
        getState().currentScreen;

    showScreen(currentScreen, {
        focus: false,
        scrollToTop: false,
        updateState: false,
    });

    initialized = true;
}