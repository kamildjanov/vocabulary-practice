const SUPABASE_URL =
    "https://ftivndudrsxwatomgvvh.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_KU8s9i5a7iNo2yBoQQs79g_jIFTTH1T";

const AUTH_TOKEN_ENDPOINT =
    `${SUPABASE_URL}/auth/v1/token`;

const AUTH_LOGOUT_ENDPOINT =
    `${SUPABASE_URL}/auth/v1/logout`;

const RESULTS_ENDPOINT =
    `${SUPABASE_URL}/rest/v1/quiz_results`;

const RESULTS_QUERY = [
    "select=id,created_at,student_name,score,total_questions,percentage,language,level,unit_name,lesson_group",
    "order=created_at.desc",
    "limit=1000",
].join("&");

const SESSION_STORAGE_KEY =
    "vocabulary_teacher_session";

const TOKEN_REFRESH_MARGIN_MS = 60_000;

const elements = {
    loginScreen: getRequiredElement(
        "#teacher-login-screen"
    ),
    dashboardScreen: getRequiredElement(
        "#teacher-dashboard-screen"
    ),
    loginForm: getRequiredElement(
        "#teacher-login-form"
    ),
    emailInput: getRequiredElement(
        "#teacher-email"
    ),
    passwordInput: getRequiredElement(
        "#teacher-password"
    ),
    passwordToggle: getRequiredElement(
        "#teacher-password-toggle"
    ),
    loginError: getRequiredElement(
        "#teacher-login-error"
    ),
    loginButton: getRequiredElement(
        "#teacher-login-button"
    ),
    accountEmail: getRequiredElement(
        "#teacher-account-email"
    ),
    refreshButton: getRequiredElement(
        "#teacher-refresh-button"
    ),
    logoutButton: getRequiredElement(
        "#teacher-logout-button"
    ),
    totalResults: getRequiredElement(
        "#teacher-total-results"
    ),
    totalStudents: getRequiredElement(
        "#teacher-total-students"
    ),
    averageScore: getRequiredElement(
        "#teacher-average-score"
    ),
    highestScore: getRequiredElement(
        "#teacher-highest-score"
    ),
    searchInput: getRequiredElement(
        "#teacher-search"
    ),
    levelFilter: getRequiredElement(
        "#teacher-level-filter"
    ),
    languageFilter: getRequiredElement(
        "#teacher-language-filter"
    ),
    sortSelect: getRequiredElement(
        "#teacher-sort"
    ),
    clearFiltersButton: getRequiredElement(
        "#teacher-clear-filters"
    ),
    loading: getRequiredElement(
        "#teacher-loading"
    ),
    error: getRequiredElement(
        "#teacher-error"
    ),
    resultsPanel: getRequiredElement(
        "#teacher-results-panel"
    ),
    resultCount: getRequiredElement(
        "#teacher-result-count"
    ),
    resultsBody: getRequiredElement(
        "#teacher-results-body"
    ),
    tableWrapper: getRequiredElement(
        ".teacher-table-wrapper"
    ),
    emptyResults: getRequiredElement(
        "#teacher-empty-results"
    ),
    liveRegion: getRequiredElement(
        "#teacher-live-region"
    ),
};

let authSession = null;
let allResults = [];
let isLoadingResults = false;

const dateTimeFormatter =
    new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });

function getRequiredElement(selector) {
    const element = document.querySelector(
        selector
    );

    if (!element) {
        throw new Error(
            `Required element was not found: ${selector}`
        );
    }

    return element;
}

function normalizeText(value) {
    return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeSearchText(value) {
    return normalizeText(value)
        .normalize("NFC")
        .toLocaleLowerCase();
}

function announce(message) {
    elements.liveRegion.textContent = "";

    window.requestAnimationFrame(() => {
        elements.liveRegion.textContent =
            normalizeText(message);
    });
}

function focusElement(element) {
    if (element instanceof HTMLElement) {
        window.requestAnimationFrame(() => {
            element.focus({
                preventScroll: true,
            });
        });
    }
}

function setButtonBusy(
    button,
    isBusy,
    busyText,
    normalText
) {
    button.disabled = isBusy;
    button.textContent = isBusy
        ? busyText
        : normalText;
}

function saveSession() {
    if (!authSession) {
        return;
    }

    try {
        localStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify(authSession)
        );
    } catch (error) {
        console.warn(
            "The teacher session could not be saved.",
            error
        );
    }
}

function loadSavedSession() {
    try {
        const savedSession =
            localStorage.getItem(
                SESSION_STORAGE_KEY
            );

        if (!savedSession) {
            return null;
        }

        const parsedSession =
            JSON.parse(savedSession);

        const accessToken =
            normalizeText(
                parsedSession?.accessToken
            );

        const refreshToken =
            normalizeText(
                parsedSession?.refreshToken
            );

        const expiresAt = Number(
            parsedSession?.expiresAt
        );

        const user =
            parsedSession?.user;

        if (
            !accessToken ||
            !refreshToken ||
            !Number.isFinite(expiresAt) ||
            !user ||
            typeof user !== "object"
        ) {
            clearSavedSession();
            return null;
        }

        return {
            accessToken,
            refreshToken,
            expiresAt,
            user,
        };
    } catch (error) {
        console.warn(
            "The saved teacher session could not be read.",
            error
        );

        clearSavedSession();
        return null;
    }
}

function clearSavedSession() {
    try {
        localStorage.removeItem(
            SESSION_STORAGE_KEY
        );
    } catch (error) {
        console.warn(
            "The saved teacher session could not be removed.",
            error
        );
    }
}

function clearAuthentication() {
    authSession = null;
    clearSavedSession();
}

function showLoginScreen() {
    elements.dashboardScreen.hidden = true;
    elements.loginScreen.hidden = false;
    elements.loginError.textContent = "";
    elements.accountEmail.textContent = "";

    focusElement(elements.emailInput);
}

function showDashboardScreen() {
    elements.loginScreen.hidden = true;
    elements.dashboardScreen.hidden = false;
    elements.loginError.textContent = "";

    elements.accountEmail.textContent =
        authSession?.user?.email ?? "";
}

function setResultsLoading(isLoading) {
    isLoadingResults = isLoading;
    elements.loading.hidden = !isLoading;

    setButtonBusy(
        elements.refreshButton,
        isLoading,
        "Loading…",
        "Refresh"
    );
}

function showDashboardError(message) {
    elements.error.textContent =
        normalizeText(message) ||
        "The results could not be loaded.";

    elements.error.hidden = false;
}

function clearDashboardError() {
    elements.error.hidden = true;
    elements.error.textContent = "";
}

async function readResponseData(response) {
    const contentType =
        response.headers.get(
            "content-type"
        ) ?? "";

    if (
        contentType.includes(
            "application/json"
        )
    ) {
        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    try {
        const text = await response.text();

        return text
            ? { message: text }
            : null;
    } catch {
        return null;
    }
}

function getErrorMessage(
    response,
    responseData,
    fallbackMessage
) {
    return (
        normalizeText(responseData?.msg) ||
        normalizeText(
            responseData?.message
        ) ||
        normalizeText(
            responseData
                ?.error_description
        ) ||
        normalizeText(
            responseData?.error
        ) ||
        fallbackMessage ||
        `Request failed with status ${response.status}.`
    );
}

function createAuthHeaders(
    accessToken = ""
) {
    const headers = {
        apikey:
            SUPABASE_PUBLISHABLE_KEY,
        "Content-Type":
            "application/json",
    };

    if (accessToken) {
        headers.Authorization =
            `Bearer ${accessToken}`;
    }

    return headers;
}

function updateAuthSession(data) {
    const accessToken =
        normalizeText(
            data?.access_token
        );

    const refreshToken =
        normalizeText(
            data?.refresh_token
        );

    const expiresIn = Number(
        data?.expires_in
    );

    const user = data?.user;

    if (
        !accessToken ||
        !refreshToken ||
        !Number.isFinite(expiresIn) ||
        expiresIn <= 0 ||
        !user ||
        typeof user !== "object"
    ) {
        throw new Error(
            "Supabase did not return a valid session."
        );
    }

    authSession = {
        accessToken,
        refreshToken,
        expiresAt:
            Date.now() +
            expiresIn * 1000,
        user,
    };

    saveSession();

    return authSession;
}

async function signInWithPassword(
    email,
    password
) {
    const response = await fetch(
        `${AUTH_TOKEN_ENDPOINT}?grant_type=password`,
        {
            method: "POST",
            mode: "cors",
            cache: "no-store",
            headers:
                createAuthHeaders(),
            body: JSON.stringify({
                email,
                password,
            }),
        }
    );

    const responseData =
        await readResponseData(
            response
        );

    if (!response.ok) {
        throw new Error(
            getErrorMessage(
                response,
                responseData,
                "The email or password is incorrect."
            )
        );
    }

    return updateAuthSession(
        responseData
    );
}

async function refreshAuthSession() {
    if (
        !authSession?.refreshToken
    ) {
        throw new Error(
            "Your teacher session has expired. Please sign in again."
        );
    }

    const response = await fetch(
        `${AUTH_TOKEN_ENDPOINT}?grant_type=refresh_token`,
        {
            method: "POST",
            mode: "cors",
            cache: "no-store",
            headers:
                createAuthHeaders(),
            body: JSON.stringify({
                refresh_token:
                    authSession
                        .refreshToken,
            }),
        }
    );

    const responseData =
        await readResponseData(
            response
        );

    if (!response.ok) {
        throw new Error(
            getErrorMessage(
                response,
                responseData,
                "Your teacher session has expired. Please sign in again."
            )
        );
    }

    return updateAuthSession(
        responseData
    );
}

async function getValidAccessToken({
    forceRefresh = false,
} = {}) {
    if (!authSession) {
        throw new Error(
            "Please sign in to view results."
        );
    }

    const tokenIsExpiring =
        Date.now() >=
        authSession.expiresAt -
            TOKEN_REFRESH_MARGIN_MS;

    if (
        forceRefresh ||
        tokenIsExpiring
    ) {
        await refreshAuthSession();
    }

    return authSession.accessToken;
}

async function fetchResults(
    accessToken
) {
    return fetch(
        `${RESULTS_ENDPOINT}?${RESULTS_QUERY}`,
        {
            method: "GET",
            mode: "cors",
            cache: "no-store",
            headers: {
                apikey:
                    SUPABASE_PUBLISHABLE_KEY,
                Authorization:
                    `Bearer ${accessToken}`,
                Accept:
                    "application/json",
            },
        }
    );
}

function normalizeResult(row) {
    return {
        id: normalizeText(row?.id),
        createdAt: normalizeText(
            row?.created_at
        ),
        studentName: normalizeText(
            row?.student_name
        ),
        score:
            Number(row?.score) || 0,
        totalQuestions:
            Number(
                row?.total_questions
            ) || 0,
        percentage:
            Number(
                row?.percentage
            ) || 0,
        language: normalizeText(
            row?.language
        ),
        level: normalizeText(
            row?.level
        ),
        unitName: normalizeText(
            row?.unit_name
        ),
        lessonGroup: normalizeText(
            row?.lesson_group
        ),
    };
}

async function requestResults() {
    let accessToken =
        await getValidAccessToken();

    let response =
        await fetchResults(
            accessToken
        );

    if (response.status === 401) {
        accessToken =
            await getValidAccessToken({
                forceRefresh: true,
            });

        response =
            await fetchResults(
                accessToken
            );
    }

    const responseData =
        await readResponseData(
            response
        );

    if (!response.ok) {
        throw new Error(
            getErrorMessage(
                response,
                responseData,
                "The results could not be loaded."
            )
        );
    }

    if (
        !Array.isArray(
            responseData
        )
    ) {
        throw new Error(
            "Supabase returned invalid result data."
        );
    }

    return responseData.map(
        normalizeResult
    );
}

function formatDateTime(value) {
    const date = new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return (
            normalizeText(value) ||
            "—"
        );
    }

    return dateTimeFormatter.format(
        date
    );
}

function createCell(
    value,
    className = ""
) {
    const cell =
        document.createElement("td");

    cell.textContent =
        normalizeText(value) || "—";

    if (className) {
        cell.className = className;
    }

    return cell;
}

function createPercentageCell(
    percentage
) {
    const cell =
        document.createElement("td");

    const badge =
        document.createElement(
            "span"
        );

    badge.className =
        "teacher-percentage";

    if (percentage >= 90) {
        badge.classList.add(
            "teacher-percentage--excellent"
        );
    } else if (percentage < 60) {
        badge.classList.add(
            "teacher-percentage--low"
        );
    }

    badge.textContent =
        `${percentage}%`;

    cell.append(badge);

    return cell;
}

function createResultRow(result) {
    const row =
        document.createElement("tr");

    row.append(
        createCell(
            formatDateTime(
                result.createdAt
            )
        ),
        createCell(
            result.studentName,
            "teacher-student-name"
        ),
        createCell(
            `${result.score}/${result.totalQuestions}`,
            "teacher-score"
        ),
        createPercentageCell(
            result.percentage
        ),
        createCell(
            result.language
        ),
        createCell(
            result.level
        ),
        createCell(
            result.unitName
        ),
        createCell(
            result.lessonGroup
        )
    );

    return row;
}

function updateStatistics(results) {
    const uniqueStudents =
        new Set(
            results
                .map((result) =>
                    normalizeSearchText(
                        result.studentName
                    )
                )
                .filter(Boolean)
        );

    const percentages =
        results.map(
            (result) =>
                result.percentage
        );

    const average =
        percentages.length > 0
            ? Math.round(
                  percentages.reduce(
                      (
                          total,
                          value
                      ) =>
                          total +
                          value,
                      0
                  ) /
                      percentages.length
              )
            : 0;

    const highest =
        percentages.length > 0
            ? Math.max(
                  ...percentages
              )
            : 0;

    elements.totalResults.textContent =
        String(results.length);

    elements.totalStudents.textContent =
        String(uniqueStudents.size);

    elements.averageScore.textContent =
        `${average}%`;

    elements.highestScore.textContent =
        `${highest}%`;
}

function renderLevelFilter(
    results
) {
    const currentValue =
        elements.levelFilter.value;

    const levels = [
        ...new Set(
            results
                .map(
                    (result) =>
                        result.level
                )
                .filter(Boolean)
        ),
    ].sort((first, second) =>
        first.localeCompare(second)
    );

    const fragment =
        document.createDocumentFragment();

    const allLevelsOption =
        document.createElement(
            "option"
        );

    allLevelsOption.value = "";
    allLevelsOption.textContent =
        "All levels";

    fragment.append(
        allLevelsOption
    );

    levels.forEach((level) => {
        const option =
            document.createElement(
                "option"
            );

        option.value = level;
        option.textContent = level;

        fragment.append(option);
    });

    elements.levelFilter.replaceChildren(
        fragment
    );

    if (
        levels.includes(
            currentValue
        )
    ) {
        elements.levelFilter.value =
            currentValue;
    }
}

function getFilteredResults() {
    const searchText =
        normalizeSearchText(
            elements.searchInput.value
        );

    const selectedLevel =
        normalizeSearchText(
            elements.levelFilter.value
        );

    const selectedLanguage =
        normalizeSearchText(
            elements.languageFilter.value
        );

    const filteredResults =
        allResults.filter(
            (result) => {
                if (
                    selectedLevel &&
                    normalizeSearchText(
                        result.level
                    ) !== selectedLevel
                ) {
                    return false;
                }

                if (
                    selectedLanguage &&
                    normalizeSearchText(
                        result.language
                    ) !==
                        selectedLanguage
                ) {
                    return false;
                }

                if (!searchText) {
                    return true;
                }

                const searchableText = [
                    result.studentName,
                    result.level,
                    result.language,
                    result.unitName,
                    result.lessonGroup,
                    formatDateTime(
                        result.createdAt
                    ),
                    `${result.score}/${result.totalQuestions}`,
                    `${result.percentage}%`,
                ]
                    .map(
                        normalizeSearchText
                    )
                    .join(" ");

                return searchableText.includes(
                    searchText
                );
            }
        );

    return sortResults(
        filteredResults,
        elements.sortSelect.value
    );
}

function sortResults(
    results,
    sortMode
) {
    const sortedResults = [
        ...results,
    ];

    const getTime = (result) => {
        const time = new Date(
            result.createdAt
        ).getTime();

        return Number.isNaN(time)
            ? 0
            : time;
    };

    switch (sortMode) {
        case "oldest":
            sortedResults.sort(
                (first, second) =>
                    getTime(first) -
                    getTime(second)
            );
            break;

        case "highest":
            sortedResults.sort(
                (first, second) =>
                    second.percentage -
                        first.percentage ||
                    getTime(second) -
                        getTime(first)
            );
            break;

        case "lowest":
            sortedResults.sort(
                (first, second) =>
                    first.percentage -
                        second.percentage ||
                    getTime(second) -
                        getTime(first)
            );
            break;

        case "student":
            sortedResults.sort(
                (first, second) =>
                    first.studentName.localeCompare(
                        second.studentName,
                        undefined,
                        {
                            sensitivity:
                                "base",
                        }
                    ) ||
                    getTime(second) -
                        getTime(first)
            );
            break;

        case "newest":
        default:
            sortedResults.sort(
                (first, second) =>
                    getTime(second) -
                    getTime(first)
            );
            break;
    }

    return sortedResults;
}

function renderResults() {
    const filteredResults =
        getFilteredResults();

    const fragment =
        document.createDocumentFragment();

    filteredResults.forEach(
        (result) => {
            fragment.append(
                createResultRow(
                    result
                )
            );
        }
    );

    elements.resultsBody.replaceChildren(
        fragment
    );

    const hasResults =
        filteredResults.length > 0;

    elements.tableWrapper.hidden =
        !hasResults;

    elements.emptyResults.hidden =
        hasResults;

    elements.resultCount.textContent =
        `${filteredResults.length} ${
            filteredResults.length === 1
                ? "result"
                : "results"
        }`;
}

function clearFilters() {
    elements.searchInput.value = "";
    elements.levelFilter.value = "";
    elements.languageFilter.value =
        "";
    elements.sortSelect.value =
        "newest";

    renderResults();
    announce("Filters cleared.");
}

async function loadResults() {
    if (isLoadingResults) {
        return;
    }

    setResultsLoading(true);
    clearDashboardError();

    try {
        allResults =
            await requestResults();

        renderLevelFilter(
            allResults
        );

        updateStatistics(
            allResults
        );

        renderResults();

        elements.resultsPanel.hidden =
            false;

        announce(
            `${allResults.length} ${
                allResults.length === 1
                    ? "result"
                    : "results"
            } loaded.`
        );
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "The results could not be loaded.";

        showDashboardError(message);

        const normalizedMessage =
            message.toLocaleLowerCase();

        if (
            normalizedMessage.includes(
                "session"
            ) ||
            normalizedMessage.includes(
                "jwt"
            ) ||
            normalizedMessage.includes(
                "token"
            )
        ) {
            clearAuthentication();
            allResults = [];
            elements.resultsPanel.hidden =
                true;

            showLoginScreen();
        }
    } finally {
        setResultsLoading(false);
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const email = normalizeText(
        elements.emailInput.value
    ).toLocaleLowerCase();

    const password =
        elements.passwordInput.value;

    elements.loginError.textContent =
        "";

    if (!email || !password) {
        elements.loginError.textContent =
            "Enter your email address and password.";

        return;
    }

    setButtonBusy(
        elements.loginButton,
        true,
        "Signing In…",
        "Sign In"
    );

    try {
        await signInWithPassword(
            email,
            password
        );

        elements.passwordInput.value =
            "";

        showDashboardScreen();

        await loadResults();
    } catch (error) {
        elements.loginError.textContent =
            error instanceof Error
                ? error.message
                : "Sign-in failed.";

        focusElement(
            elements.passwordInput
        );
    } finally {
        setButtonBusy(
            elements.loginButton,
            false,
            "Signing In…",
            "Sign In"
        );
    }
}

async function signOut() {
    const accessToken =
        authSession?.accessToken ??
        "";

    setButtonBusy(
        elements.logoutButton,
        true,
        "Signing Out…",
        "Sign Out"
    );

    try {
        if (accessToken) {
            await fetch(
                AUTH_LOGOUT_ENDPOINT,
                {
                    method: "POST",
                    mode: "cors",
                    cache: "no-store",
                    headers:
                        createAuthHeaders(
                            accessToken
                        ),
                }
            );
        }
    } catch (error) {
        console.warn(
            "The remote Supabase session could not be closed.",
            error
        );
    } finally {
        clearAuthentication();
        allResults = [];

        elements.resultsBody.replaceChildren();
        elements.resultsPanel.hidden =
            true;
        elements.error.hidden = true;
        elements.loading.hidden = true;
        elements.emailInput.value = "";
        elements.passwordInput.value =
            "";

        updateStatistics([]);
        showLoginScreen();

        setButtonBusy(
            elements.logoutButton,
            false,
            "Signing Out…",
            "Sign Out"
        );

        announce("Signed out.");
    }
}

function togglePasswordVisibility() {
    const showPassword =
        elements.passwordInput.type ===
        "password";

    elements.passwordInput.type =
        showPassword
            ? "text"
            : "password";

    elements.passwordToggle.textContent =
        showPassword
            ? "Hide"
            : "Show";

    elements.passwordToggle.setAttribute(
        "aria-label",
        showPassword
            ? "Hide password"
            : "Show password"
    );

    elements.passwordToggle.setAttribute(
        "aria-pressed",
        String(showPassword)
    );

    focusElement(
        elements.passwordInput
    );
}

function bindEvents() {
    elements.loginForm.addEventListener(
        "submit",
        (event) => {
            void handleLogin(event);
        }
    );

    elements.passwordToggle.addEventListener(
        "click",
        togglePasswordVisibility
    );

    elements.refreshButton.addEventListener(
        "click",
        () => {
            void loadResults();
        }
    );

    elements.logoutButton.addEventListener(
        "click",
        () => {
            void signOut();
        }
    );

    elements.searchInput.addEventListener(
        "input",
        renderResults
    );

    elements.levelFilter.addEventListener(
        "change",
        renderResults
    );

    elements.languageFilter.addEventListener(
        "change",
        renderResults
    );

    elements.sortSelect.addEventListener(
        "change",
        renderResults
    );

    elements.clearFiltersButton.addEventListener(
        "click",
        clearFilters
    );
}

async function restoreTeacherSession() {
    const savedSession =
        loadSavedSession();

    if (!savedSession) {
        showLoginScreen();
        return;
    }

    authSession = savedSession;
    showDashboardScreen();

    try {
        await getValidAccessToken();
        await loadResults();
    } catch (error) {
        console.warn(
            "The saved teacher session is no longer valid.",
            error
        );

        clearAuthentication();
        showLoginScreen();
    }
}

function initializeTeacherDashboard() {
    bindEvents();
    updateStatistics([]);

    void restoreTeacherSession();
}

initializeTeacherDashboard();
