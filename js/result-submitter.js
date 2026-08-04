const SUPABASE_URL =
    "https://ftivndudrsxwatomgvvh.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_KU8s9i5a7iNo2yBoQQs79g_jIFTTH1T";

const RESULTS_ENDPOINT =
    `${SUPABASE_URL}/rest/v1/quiz_results`;

const submittedResultIds = new Set();

function normalizeText(value) {
    return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function createSubmissionId() {
    if (
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID ===
            "function"
    ) {
        return globalThis.crypto.randomUUID();
    }

    const randomBytes =
        new Uint8Array(16);

    globalThis.crypto.getRandomValues(
        randomBytes
    );

    randomBytes[6] =
        (randomBytes[6] & 0x0f) | 0x40;
    randomBytes[8] =
        (randomBytes[8] & 0x3f) | 0x80;

    const hexadecimal = [
        ...randomBytes,
    ].map((byte) =>
        byte.toString(16).padStart(2, "0")
    );

    return [
        hexadecimal.slice(0, 4).join(""),
        hexadecimal.slice(4, 6).join(""),
        hexadecimal.slice(6, 8).join(""),
        hexadecimal.slice(8, 10).join(""),
        hexadecimal.slice(10, 16).join(""),
    ].join("-");
}

function normalizeInteger(
    value,
    fieldName,
    minimum = 0
) {
    const number = Number(value);

    if (
        !Number.isInteger(number) ||
        number < minimum
    ) {
        throw new TypeError(
            `${fieldName} is invalid.`
        );
    }

    return number;
}

function normalizeLanguage(value) {
    const language = normalizeText(value);

    if (
        language !== "Uzbek" &&
        language !== "Russian"
    ) {
        throw new TypeError(
            "Language is invalid."
        );
    }

    return language;
}

function normalizeResult(result) {
    if (
        !result ||
        typeof result !== "object" ||
        Array.isArray(result)
    ) {
        throw new TypeError(
            "A valid quiz result is required."
        );
    }

    const studentName = normalizeText(
        result.studentName
    );
    const level = normalizeText(
        result.level
    );
    const unitName = normalizeText(
        result.unitName
    );
    const lessonGroup = normalizeText(
        result.lessonGroup
    );
    const language = normalizeLanguage(
        result.language
    );

    if (
        studentName.length < 2 ||
        studentName.length > 60
    ) {
        throw new TypeError(
            "Student name is invalid."
        );
    }

    if (!level) {
        throw new TypeError(
            "Level is required."
        );
    }

    if (
        !unitName ||
        unitName.length > 80
    ) {
        throw new TypeError(
            "Unit is invalid."
        );
    }

    if (
        !lessonGroup ||
        lessonGroup.length > 120
    ) {
        throw new TypeError(
            "Lesson group is invalid."
        );
    }

    const score = normalizeInteger(
        result.score,
        "Score"
    );

    const totalQuestions =
        normalizeInteger(
            result.totalQuestions,
            "Total questions",
            1
        );

    if (score > totalQuestions) {
        throw new TypeError(
            "Score cannot exceed total questions."
        );
    }

    return {
        submission_id:
            normalizeText(
                result.submissionId
            ) || createSubmissionId(),
        student_name: studentName,
        score,
        total_questions: totalQuestions,
        language,
        level,
        unit_name: unitName,
        lesson_group: lessonGroup,
    };
}

async function readErrorMessage(response) {
    try {
        const errorData =
            await response.json();

        return (
            normalizeText(
                errorData.message
            ) ||
            normalizeText(
                errorData.details
            ) ||
            `Request failed with status ${response.status}.`
        );
    } catch {
        return `Request failed with status ${response.status}.`;
    }
}

export async function submitQuizResult(
    result
) {
    const payload =
        normalizeResult(result);

    if (
        submittedResultIds.has(
            payload.submission_id
        )
    ) {
        return {
            success: true,
            duplicate: true,
            submissionId:
                payload.submission_id,
        };
    }

    const response = await fetch(
        RESULTS_ENDPOINT,
        {
            method: "POST",
            mode: "cors",
            cache: "no-store",
            headers: {
                apikey:
                    SUPABASE_PUBLISHABLE_KEY,
                Authorization:
                    `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
                "Content-Type":
                    "application/json",
                Prefer: "return=minimal",
            },
            body: JSON.stringify(payload),
        }
    );

    if (!response.ok) {
        throw new Error(
            await readErrorMessage(response)
        );
    }

    submittedResultIds.add(
        payload.submission_id
    );

    return {
        success: true,
        duplicate: false,
        submissionId:
            payload.submission_id,
    };
}
