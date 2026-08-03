import { getLevelById } from "./config.js";
import {
    isNonEmptyString,
    normalizeWhitespace,
} from "./utils.js";

const levelDataCache = new Map();

function assertPlainObject(value, message) {
    if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        throw new TypeError(message);
    }
}

function requireText(value, fieldName) {
    const normalizedValue =
        normalizeWhitespace(value);

    if (!isNonEmptyString(normalizedValue)) {
        throw new Error(
            `Vocabulary data is missing ${fieldName}.`
        );
    }

    return normalizedValue;
}

function normalizeEntry(
    entry,
    {
        levelName,
        unitName,
        groupName,
        seenEntryIds,
    }
) {
    assertPlainObject(
        entry,
        `Invalid vocabulary entry in ${levelName}, ${unitName}, ${groupName}.`
    );

    const normalizedEntry = {
        id: requireText(entry.id, "an entry ID"),
        english: requireText(
            entry.english,
            "an English value"
        ),
        uzbek: requireText(
            entry.uzbek,
            "an Uzbek value"
        ),
        russian: requireText(
            entry.russian,
            "a Russian value"
        ),
    };

    if (seenEntryIds.has(normalizedEntry.id)) {
        throw new Error(
            `Duplicate vocabulary entry ID: ${normalizedEntry.id}`
        );
    }

    seenEntryIds.add(normalizedEntry.id);

    return Object.freeze(normalizedEntry);
}

function normalizeLessonGroup(
    group,
    {
        levelName,
        unitName,
        seenGroupIds,
        seenEntryIds,
    }
) {
    assertPlainObject(
        group,
        `Invalid lesson group in ${levelName}, ${unitName}.`
    );

    const groupId = requireText(
        group.id,
        "a lesson-group ID"
    );
    const groupName = requireText(
        group.name,
        "a lesson-group name"
    );

    if (seenGroupIds.has(groupId)) {
        throw new Error(
            `Duplicate lesson-group ID: ${groupId}`
        );
    }

    seenGroupIds.add(groupId);

    if (!Array.isArray(group.entries)) {
        throw new Error(
            `Lesson group "${groupName}" does not contain an entries array.`
        );
    }

    const entries = group.entries.map((entry) =>
        normalizeEntry(entry, {
            levelName,
            unitName,
            groupName,
            seenEntryIds,
        })
    );

    if (entries.length === 0) {
        throw new Error(
            `Lesson group "${groupName}" does not contain valid vocabulary entries.`
        );
    }

    return Object.freeze({
        id: groupId,
        name: groupName,
        sourceSheet: normalizeWhitespace(
            group.sourceSheet
        ),
        questionCount: entries.length,
        entries: Object.freeze(entries),
    });
}

function normalizeUnit(
    unit,
    {
        levelName,
        seenUnitIds,
        seenGroupIds,
        seenEntryIds,
    }
) {
    assertPlainObject(
        unit,
        `Invalid unit in ${levelName}.`
    );

    const unitId = requireText(
        unit.id,
        "a unit ID"
    );
    const unitName = requireText(
        unit.name,
        "a unit name"
    );
    const unitNumber = Number(unit.number);

    if (seenUnitIds.has(unitId)) {
        throw new Error(
            `Duplicate unit ID: ${unitId}`
        );
    }

    seenUnitIds.add(unitId);

    if (
        !Number.isInteger(unitNumber) ||
        unitNumber < 1
    ) {
        throw new Error(
            `Unit "${unitName}" has an invalid unit number.`
        );
    }

    if (!Array.isArray(unit.lessonGroups)) {
        throw new Error(
            `Unit "${unitName}" does not contain lesson groups.`
        );
    }

    const lessonGroups = unit.lessonGroups.map(
        (group) =>
            normalizeLessonGroup(group, {
                levelName,
                unitName,
                seenGroupIds,
                seenEntryIds,
            })
    );

    if (lessonGroups.length === 0) {
        throw new Error(
            `Unit "${unitName}" does not contain any lesson groups.`
        );
    }

    return Object.freeze({
        id: unitId,
        number: unitNumber,
        name: unitName,
        lessonGroups:
            Object.freeze(lessonGroups),
    });
}

function normalizeLevelData(
    rawData,
    expectedLevel
) {
    assertPlainObject(
        rawData,
        `The ${expectedLevel.name} vocabulary file is invalid.`
    );
    assertPlainObject(
        rawData.level,
        `The ${expectedLevel.name} vocabulary file is missing level information.`
    );

    const levelId = requireText(
        rawData.level.id,
        "a level ID"
    );
    const levelName = requireText(
        rawData.level.name,
        "a level name"
    );

    if (levelId !== expectedLevel.id) {
        throw new Error(
            `Expected level "${expectedLevel.id}" but received "${levelId}".`
        );
    }

    if (!Array.isArray(rawData.units)) {
        throw new Error(
            `The ${expectedLevel.name} vocabulary file does not contain a units array.`
        );
    }

    const seenUnitIds = new Set();
    const seenGroupIds = new Set();
    const seenEntryIds = new Set();

    const units = rawData.units.map((unit) =>
        normalizeUnit(unit, {
            levelName,
            seenUnitIds,
            seenGroupIds,
            seenEntryIds,
        })
    );

    if (units.length === 0) {
        throw new Error(
            `The ${expectedLevel.name} vocabulary file contains no units.`
        );
    }

    const totalEntries = units.reduce(
        (levelTotal, unit) =>
            levelTotal +
            unit.lessonGroups.reduce(
                (unitTotal, group) =>
                    unitTotal +
                    group.entries.length,
                0
            ),
        0
    );

    return Object.freeze({
        schemaVersion:
            Number(rawData.schemaVersion) || 1,
        level: Object.freeze({
            id: levelId,
            name: levelName,
        }),
        sourceWorkbook: normalizeWhitespace(
            rawData.sourceWorkbook
        ),
        totalEntries,
        units: Object.freeze(units),
    });
}

async function fetchLevelData(level) {
    let response;

    try {
        response = await fetch(level.dataPath, {
            cache: "no-store",
            headers: {
                Accept: "application/json",
            },
        });
    } catch (error) {
        throw new Error(
            `Could not connect to the ${level.name} vocabulary file. Make sure the website is running through Live Server.`,
            { cause: error }
        );
    }

    if (!response.ok) {
        throw new Error(
            `Could not load ${level.dataPath} (${response.status} ${response.statusText}).`
        );
    }

    let rawData;

    try {
        rawData = await response.json();
    } catch (error) {
        throw new Error(
            `The ${level.name} vocabulary file does not contain valid JSON.`,
            { cause: error }
        );
    }

    return normalizeLevelData(
        rawData,
        level
    );
}

export function loadLevelData(levelId) {
    const level = getLevelById(levelId);

    if (!level) {
        return Promise.reject(
            new Error(
                `Unknown vocabulary level: ${levelId}`
            )
        );
    }

    if (!levelDataCache.has(level.id)) {
        const loadingPromise =
            fetchLevelData(level).catch(
                (error) => {
                    levelDataCache.delete(
                        level.id
                    );
                    throw error;
                }
            );

        levelDataCache.set(
            level.id,
            loadingPromise
        );
    }

    return levelDataCache.get(level.id);
}

export function clearLevelDataCache(
    levelId = ""
) {
    if (levelId) {
        levelDataCache.delete(levelId);
        return;
    }

    levelDataCache.clear();
}