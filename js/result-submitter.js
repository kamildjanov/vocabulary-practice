const RESULT_RECEIVER_URL =
    "https://script.google.com/macros/s/AKfycbzihrrWLnMLfSjBGtXO2KGWGxtMtNKLW2R2vYM4g8DplGH8ywH6sv1dT_Yy5baJY7qI/exec";

const submittedResultIds = new Set();

function normalizeText(value) {
    return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function createSubmissionId() {
    if (
        window.crypto &&
        typeof window.crypto.randomUUID ===
            "function"
    ) {
        return window.crypto.randomUUID();
    }

    return [
        Date.now().toString(36),
        Math.random()
            .toString(36)
            .slice(2, 12),
        Math.random()
            .toString(36)
            .slice(2, 12),
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
    const unit = normalizeText(
        result.unit
    );
    const lessonGroup = normalizeText(
        result.lessonGroup
    );

    if (!studentName) {
        throw new TypeError(
            "Student name is required."
        );
    }

    if (!level) {
        throw new TypeError(
            "Level is required."
        );
    }

    if (!unit) {
        throw new TypeError(
            "Unit is required."
        );
    }

    if (!lessonGroup) {
        throw new TypeError(
            "Lesson group is required."
        );
    }

    const score = normalizeInteger(
        result.score,
        "Score"
    );

    const totalQuestions = normalizeInteger(
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
        studentName,
        score,
        totalQuestions,
        level,
        unit,
        lessonGroup,
        submissionId:
            normalizeText(
                result.submissionId
            ) || createSubmissionId(),
    };
}

export async function submitQuizResult(
    result
) {
    const payload = normalizeResult(result);

    if (
        submittedResultIds.has(
            payload.submissionId
        )
    ) {
        return {
            success: true,
            duplicate: true,
            submissionId:
                payload.submissionId,
        };
    }

    await fetch(RESULT_RECEIVER_URL, {
        method: "POST",
        mode: "no-cors",
        cache: "no-store",
        redirect: "follow",
        headers: {
            "Content-Type":
                "text/plain;charset=UTF-8",
        },
        body: JSON.stringify(payload),
    });

    submittedResultIds.add(
        payload.submissionId
    );

    return {
        success: true,
        duplicate: false,
        submissionId:
            payload.submissionId,
    };
}
