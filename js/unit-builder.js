import {
    clearLessonGroup,
    getState,
    setLessonGroup,
} from "./state.js";
import {
    announce,
    createElement,
    getRequiredElement,
    setButtonEnabled,
} from "./utils.js";

let accordionElement = null;
let continueButton = null;
let openUnitId = "";
let initialized = false;

function getElements() {
    accordionElement ??= getRequiredElement(
        "#unit-accordion"
    );
    continueButton ??= getRequiredElement(
        "#unit-continue"
    );
}

function getPanelId(unitId) {
    return `panel-${unitId}`;
}

function getTriggerId(unitId) {
    return `trigger-${unitId}`;
}

function closeAccordionItem(item) {
    const trigger = item.querySelector(
        ".accordion-trigger"
    );
    const panel = item.querySelector(
        ".accordion-panel"
    );

    item.classList.remove("is-open");
    trigger?.setAttribute(
        "aria-expanded",
        "false"
    );

    if (panel) {
        panel.hidden = true;
    }
}

function openAccordionItem(item) {
    const trigger = item.querySelector(
        ".accordion-trigger"
    );
    const panel = item.querySelector(
        ".accordion-panel"
    );

    item.classList.add("is-open");
    trigger?.setAttribute(
        "aria-expanded",
        "true"
    );

    if (panel) {
        panel.hidden = false;
    }
}

function setOpenUnit(unitId) {
    getElements();

    const unitItems = [
        ...accordionElement.querySelectorAll(
            ".accordion-item"
        ),
    ];

    unitItems.forEach((item) => {
        const isRequestedUnit =
            item.dataset.unitId === unitId;

        if (isRequestedUnit) {
            openAccordionItem(item);
        } else {
            closeAccordionItem(item);
        }
    });

    openUnitId = unitId;
}

function toggleUnit(unitId) {
    const nextOpenUnitId =
        openUnitId === unitId ? "" : unitId;

    setOpenUnit(nextOpenUnitId);
}

function updateLessonGroupSelection() {
    getElements();

    const { selectedGroupId } = getState();
    const groupButtons = [
        ...accordionElement.querySelectorAll(
            ".lesson-group-card"
        ),
    ];

    groupButtons.forEach((button) => {
        const isSelected =
            button.dataset.groupId ===
            selectedGroupId;

        button.setAttribute(
            "aria-checked",
            String(isSelected)
        );
        button.classList.toggle(
            "is-selected",
            isSelected
        );
    });

    setButtonEnabled(
        continueButton,
        Boolean(selectedGroupId)
    );
}

function selectLessonGroup(
    unit,
    lessonGroup
) {
    const currentState = getState();

    if (
        currentState.selectedGroupId ===
        lessonGroup.id
    ) {
        clearLessonGroup();
        updateLessonGroupSelection();
        announce(
            `${lessonGroup.name} selection cleared.`
        );
        return;
    }

    setLessonGroup({
        unitId: unit.id,
        groupId: lessonGroup.id,
        group: lessonGroup,
    });

    updateLessonGroupSelection();

    announce(
        `${lessonGroup.name} selected. ${lessonGroup.questionCount} questions.`
    );
}

function createLessonGroupButton(
    unit,
    lessonGroup
) {
    const button = createElement("button", {
        className: "lesson-group-card",
        attributes: {
            type: "button",
            role: "radio",
            "aria-checked": "false",
            "data-unit-id": unit.id,
            "data-group-id": lessonGroup.id,
        },
    });

    const name = createElement("span", {
        className: "lesson-group-name",
        text: lessonGroup.name,
    });

    const count = createElement("span", {
        className: "lesson-group-count",
        text: `${lessonGroup.questionCount} ${lessonGroup.questionCount === 1
                ? "question"
                : "questions"
            }`,
    });

    button.append(name, count);

    button.addEventListener("click", () => {
        selectLessonGroup(
            unit,
            lessonGroup
        );
    });

    return button;
}

function createAccordionItem(unit) {
    const item = createElement("section", {
        className: "accordion-item",
        attributes: {
            "data-unit-id": unit.id,
        },
    });

    const trigger = createElement("button", {
        className: "accordion-trigger",
        text: unit.name,
        attributes: {
            id: getTriggerId(unit.id),
            type: "button",
            "aria-expanded": "false",
            "aria-controls": getPanelId(
                unit.id
            ),
        },
    });

    const panel = createElement("div", {
        className: "accordion-panel",
        attributes: {
            id: getPanelId(unit.id),
            role: "region",
            "aria-labelledby": getTriggerId(
                unit.id
            ),
            hidden: true,
        },
    });

    const lessonGroupList = createElement(
        "div",
        {
            className: "lesson-group-list",
            attributes: {
                role: "radiogroup",
                "aria-label": `${unit.name} lesson groups`,
            },
        }
    );

    unit.lessonGroups.forEach(
        (lessonGroup) => {
            lessonGroupList.append(
                createLessonGroupButton(
                    unit,
                    lessonGroup
                )
            );
        }
    );

    panel.append(lessonGroupList);
    item.append(trigger, panel);

    trigger.addEventListener("click", () => {
        toggleUnit(unit.id);
    });

    return item;
}

function restoreOpenUnit() {
    const { selectedUnitId } = getState();

    if (selectedUnitId) {
        setOpenUnit(selectedUnitId);
        return;
    }

    setOpenUnit("");
}

export function renderUnitAccordion(
    levelData
) {
    getElements();

    if (
        !levelData ||
        !Array.isArray(levelData.units)
    ) {
        throw new TypeError(
            "Valid level data is required to build the unit accordion."
        );
    }

    const fragment =
        document.createDocumentFragment();

    levelData.units.forEach((unit) => {
        fragment.append(
            createAccordionItem(unit)
        );
    });

    accordionElement.replaceChildren(
        fragment
    );

    restoreOpenUnit();
    updateLessonGroupSelection();
}

export function clearUnitAccordion() {
    getElements();

    accordionElement.replaceChildren();
    openUnitId = "";
    setButtonEnabled(
        continueButton,
        false
    );
}

export function refreshUnitSelection() {
    updateLessonGroupSelection();
    restoreOpenUnit();
}

export function initializeUnitBuilder() {
    if (initialized) {
        return;
    }

    getElements();
    initialized = true;
}