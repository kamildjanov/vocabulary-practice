export function normalizeWhitespace(value) {
    return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function normalizeComparableText(value) {
    return normalizeWhitespace(value)
        .normalize("NFC")
        .toLocaleLowerCase();
}

export function isNonEmptyString(value) {
    return (
        typeof value === "string" &&
        normalizeWhitespace(value).length > 0
    );
}

export function shuffle(items) {
    if (!Array.isArray(items)) {
        throw new TypeError("shuffle expects an array.");
    }

    const shuffled = [...items];

    for (
        let currentIndex = shuffled.length - 1;
        currentIndex > 0;
        currentIndex -= 1
    ) {
        const randomIndex = Math.floor(
            Math.random() * (currentIndex + 1)
        );

        [
            shuffled[currentIndex],
            shuffled[randomIndex],
        ] = [
                shuffled[randomIndex],
                shuffled[currentIndex],
            ];
    }

    return shuffled;
}

export function randomItem(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return null;
    }

    return items[
        Math.floor(Math.random() * items.length)
    ];
}

export function uniqueBy(items, keySelector) {
    if (!Array.isArray(items)) {
        throw new TypeError("uniqueBy expects an array.");
    }

    if (typeof keySelector !== "function") {
        throw new TypeError(
            "uniqueBy expects a key selector function."
        );
    }

    const seenKeys = new Set();
    const uniqueItems = [];

    items.forEach((item) => {
        const key = keySelector(item);

        if (seenKeys.has(key)) {
            return;
        }

        seenKeys.add(key);
        uniqueItems.push(item);
    });

    return uniqueItems;
}

export function clamp(value, minimum, maximum) {
    return Math.min(
        Math.max(value, minimum),
        maximum
    );
}

export function calculatePercentage(correct, total) {
    const safeCorrect = Number(correct);
    const safeTotal = Number(total);

    if (
        !Number.isFinite(safeCorrect) ||
        !Number.isFinite(safeTotal) ||
        safeTotal <= 0
    ) {
        return 0;
    }

    return Math.round(
        clamp(
            (safeCorrect / safeTotal) * 100,
            0,
            100
        )
    );
}

export function createElement(
    tagName,
    {
        className = "",
        text = "",
        attributes = {},
    } = {}
) {
    const element = document.createElement(tagName);

    if (className) {
        element.className = className;
    }

    if (text !== "") {
        element.textContent = text;
    }

    Object.entries(attributes).forEach(
        ([attributeName, attributeValue]) => {
            if (
                attributeValue === false ||
                attributeValue === null ||
                attributeValue === undefined
            ) {
                return;
            }

            if (attributeValue === true) {
                element.setAttribute(
                    attributeName,
                    ""
                );
                return;
            }

            element.setAttribute(
                attributeName,
                String(attributeValue)
            );
        }
    );

    return element;
}

export function getRequiredElement(
    selector,
    root = document
) {
    const element = root.querySelector(selector);

    if (!element) {
        throw new Error(
            `Required element was not found: ${selector}`
        );
    }

    return element;
}

export function getRequiredElements(
    selector,
    root = document
) {
    const elements = [
        ...root.querySelectorAll(selector),
    ];

    if (elements.length === 0) {
        throw new Error(
            `Required elements were not found: ${selector}`
        );
    }

    return elements;
}

export function setElementText(element, value) {
    if (!(element instanceof Element)) {
        throw new TypeError(
            "setElementText expects a DOM element."
        );
    }

    element.textContent = normalizeWhitespace(value);
}

export function setButtonEnabled(button, isEnabled) {
    if (!(button instanceof HTMLButtonElement)) {
        throw new TypeError(
            "setButtonEnabled expects a button element."
        );
    }

    button.disabled = !isEnabled;
    button.setAttribute(
        "aria-disabled",
        String(!isEnabled)
    );
}

export function setRadioSelection(
    buttons,
    selectedValue,
    dataAttribute
) {
    buttons.forEach((button) => {
        const isSelected =
            button.dataset[dataAttribute] ===
            selectedValue;

        button.setAttribute(
            "aria-checked",
            String(isSelected)
        );
        button.classList.toggle(
            "is-selected",
            isSelected
        );
    });
}

export function announce(message) {
    const liveRegion = document.querySelector(
        "#global-live-region"
    );

    if (!liveRegion) {
        return;
    }

    liveRegion.textContent = "";

    window.requestAnimationFrame(() => {
        liveRegion.textContent =
            normalizeWhitespace(message);
    });
}

export function focusElement(element) {
    if (
        element instanceof HTMLElement &&
        !element.hidden
    ) {
        window.requestAnimationFrame(() => {
            element.focus({
                preventScroll: true,
            });
        });
    }
}

export function scrollElementIntoView(
    element,
    {
        behavior = "smooth",
        block = "nearest",
    } = {}
) {
    if (!(element instanceof Element)) {
        return;
    }

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    element.scrollIntoView({
        behavior: reducedMotion
            ? "auto"
            : behavior,
        block,
    });
}

export function isPhoneLayout() {
    return window.matchMedia(
        "(max-width: 40rem)"
    ).matches;
}

export function nextAnimationFrame() {
    return new Promise((resolve) => {
        window.requestAnimationFrame(() => {
            resolve();
        });
    });
}

export function wait(milliseconds) {
    return new Promise((resolve) => {
        window.setTimeout(
            resolve,
            Math.max(0, milliseconds)
        );
    });
}