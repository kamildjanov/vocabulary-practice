import { initializeNavigation } from "./navigation.js";
import { initializeQuizEngine } from "./quiz-engine.js";
import { initializeResults } from "./results.js";
import { initializeReviewEngine } from "./review-engine.js";
import { initializeSetup } from "./setup.js";
import { initializeUnitBuilder } from "./unit-builder.js";
import {
    announce,
    getRequiredElement,
} from "./utils.js";

function showStartupError(error) {
    const message =
        error instanceof Error
            ? error.message
            : "Vocabulary Practice could not be started.";

    console.error(error);

    const app = getRequiredElement("#app");
    const errorPanel = document.createElement("section");

    errorPanel.className =
        "screen screen--centered is-active";
    errorPanel.setAttribute("role", "alert");

    errorPanel.innerHTML = `
        <div class="summary-card">
            <p class="screen-kicker">Application error</p>
            <h1 class="screen-title">
                Vocabulary Practice could not start
            </h1>
            <p class="summary-message"></p>
            <button
                class="button button--primary button--wide"
                type="button"
            >
                Reload Page
            </button>
        </div>
    `;

    const messageElement =
        errorPanel.querySelector(
            ".summary-message"
        );
    const reloadButton =
        errorPanel.querySelector("button");

    if (messageElement) {
        messageElement.textContent = message;
    }

    reloadButton?.addEventListener(
        "click",
        () => {
            window.location.reload();
        }
    );

    app.replaceChildren(errorPanel);
}

function initializeApplication() {
    initializeNavigation();
    initializeUnitBuilder();
    initializeQuizEngine();
    initializeReviewEngine();
    initializeResults();
    initializeSetup();

    announce(
        "Vocabulary Practice is ready."
    );
}

function startApplication() {
    try {
        initializeApplication();
    } catch (error) {
        showStartupError(error);
    }
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        startApplication,
        { once: true }
    );
} else {
    startApplication();
}