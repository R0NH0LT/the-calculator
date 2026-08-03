// DOM references: these connect the JavaScript to elements in index.html.
const matrixCanvas = document.querySelector("#matrixWallpaper");
const introScreen = document.querySelector("#introScreen");
const nameForm = document.querySelector("#nameForm");
const firstNameInput = document.querySelector("#firstNameInput");
const skipSequenceButton = document.querySelector("#skipSequenceButton");
const redPillButton = document.querySelector("#redPillButton");
const bluePillButton = document.querySelector("#bluePillButton");
const computerContainer = document.querySelector("#computerContainer");
const computerScreen = document.querySelector("#computerScreen");
const transcript = document.querySelector("#transcript");
const promptForm = document.querySelector("#promptForm");
const calculatorInput = document.querySelector("#calculatorInput");
const matrixGame = document.querySelector("#matrixGame");
const matrixGameCanvas = document.querySelector("#matrixGameCanvas");
const gameOverlay = document.querySelector("#gameOverlay");
const gameMessage = document.querySelector("#gameMessage");
const playAgainButton = document.querySelector("#playAgainButton");
const calculatorButton = document.querySelector("#calculatorButton");
const quitGameButton = document.querySelector("#quitGameButton");
const gameMusic = document.querySelector("#gameMusic");
const matrixContext = matrixCanvas.getContext("2d");
const gameContext = matrixGameCanvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Matrix intro copy and timing knobs. Smaller typing delays make terminal text appear faster.
const bootMessages = [
    "Wake up, {firstName}...",
    "The Matrix has you...",
    "Follow the...... calculations.",
    "Type an equation, then press =",
];
const incomingTypingDelay = 0.0000001;
const answerTypingDelay = 10;
const bootMessagePause = 1150;
const nameFlickerDelay = 1350;
const rainOnlyDelay = 1700;
const terminalStartDelay = 900;
const savedFirstNameKey = "theCalculatorFirstName";
const inactivityReminderDelay = 5 * 60 * 1000;
const gameGravity = 2400;
const agentBulletSpeed = 560;
const obstacleStuntTypes = ["flip", "hurdle", "vault", "dive"];
const phoneBoothOffset = 118;
const phoneExitWalkDuration = 1.4;
const phoneExitDoorDuration = 0.65;
const phoneExitEnterDuration = 0.85;
const phoneExitAnswerDuration = 1.1;

// Shared app state: these flags tell the app which mode is currently active.
let isPromptReady = false;
let firstName = "";
let transcriptBottomSpacer = null;

// Boot sequence state. The token lets us cancel old delayed callbacks after skipping/resetting.
let bootSequenceToken = 0;
let sequenceTimers = [];

// Idle reminder state. The reminder should appear once and be removable without affecting history.
let inactivityReminderTimer;
let hasShownInactivityReminder = false;
let inactivityReminderLine = null;

// Red-pill game state.
let isGameActive = false;
let gameAnimationFrame;
let gameLastFrameTime = 0;
let gameState = null;
const gameKeys = new Set();

// Character sets used by the Matrix rain. These ranges include kana, digits, and Latin letters.
const matrixGlyphGroups = [
    { start: 0x30A0, end: 0x30FF },
    { start: 0xFF66, end: 0xFF9D },
    { start: 0x0030, end: 0x0039 },
    { start: 0x0041, end: 0x005A },
];
let matrixStreams = [];
let matrixAnimationFrame;
let lastMatrixFrameTime = 0;
let isMatrixRainRunning = false;
const targetFrameRate = 60;
const baseFadeAlpha = 0.43;

// Pick a random glyph from one of the configured Unicode ranges.
function randomMatrixGlyph() {
    const group = matrixGlyphGroups[Math.floor(Math.random() * matrixGlyphGroups.length)];
    const codePoint = group.start + Math.floor(Math.random() * (group.end - group.start + 1));

    return String.fromCharCode(codePoint);
}

// A stream is one vertical trail of characters falling down the screen.
function createMatrixStream(x, width, height) {
    const fontSize = randomBetween(9, 19);
    const trailLength = randomTrailLength();
    const glyphStep = fontSize * randomBetween(1.28, 1.85);
    const gapChance = randomBetween(0.04, 0.2);

    return {
        x,
        y: randomBetween(-height * 1.25, -fontSize),
        fontSize,
        speed: randomBetween(260, 920),
        trailLength,
        glyphStep,
        opacity: randomBetween(0.32, 1),
        blur: randomBetween(0.4, 4.5),
        glyphs: Array.from({ length: trailLength }, randomMatrixGlyph),
        visibleSlots: Array.from({ length: trailLength }, (_, index) => index < 4 || Math.random() > gapChance),
        mutateRate: randomBetween(0.025, 0.12),
    };
}

// Mix short, medium, and long trails so the rain feels less uniform.
function randomTrailLength() {
    const roll = Math.random();

    if (roll < 0.45) {
        return Math.floor(randomBetween(8, 22));
    }

    if (roll < 0.84) {
        return Math.floor(randomBetween(24, 54));
    }

    return Math.floor(randomBetween(58, 104));
}

function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

// Canvas dimensions are scaled for retina displays, while CSS size stays in normal pixels.
function resizeMatrixCanvas() {
    const pixelRatio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    matrixCanvas.width = Math.floor(width * pixelRatio);
    matrixCanvas.height = Math.floor(height * pixelRatio);
    matrixCanvas.style.width = `${width}px`;
    matrixCanvas.style.height = `${height}px`;
    matrixContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    seedMatrixStreams(width, height);
}

// Create enough closely-spaced streams to fill the whole viewport.
function seedMatrixStreams(width, height) {
    const streamCount = Math.ceil(width / 4.15);
    const columnWidth = width / streamCount;

    matrixStreams = Array.from({ length: streamCount }, (_, index) => {
        const x = index * columnWidth + randomBetween(-5, 8);

        return createMatrixStream(x, width, height);
    });
}

// Main Matrix rain loop. Delta time keeps speed consistent across refresh rates.
function drawMatrixRain(timestamp = performance.now()) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const deltaSeconds = getMatrixDeltaSeconds(timestamp);
    const fadeAlpha = 1 - Math.pow(1 - baseFadeAlpha, deltaSeconds * targetFrameRate);

    matrixContext.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
    matrixContext.fillRect(0, 0, width, height);
    matrixContext.textAlign = "center";
    matrixContext.textBaseline = "top";

    matrixStreams.forEach((stream) => {
        drawMatrixStream(stream, height);
        stream.y += stream.speed * deltaSeconds;

        if (stream.y - stream.trailLength * stream.glyphStep > height + stream.fontSize) {
            Object.assign(stream, createMatrixStream(stream.x, width, height));
            stream.y = randomBetween(-height * 0.45, -stream.fontSize);
        }
    });

    matrixAnimationFrame = requestAnimationFrame(drawMatrixRain);
}

// Clamp frame time so tab throttling or refresh-rate spikes do not launch the rain too far.
function getMatrixDeltaSeconds(timestamp) {
    if (!lastMatrixFrameTime) {
        lastMatrixFrameTime = timestamp;
        return 1 / targetFrameRate;
    }

    const deltaSeconds = (timestamp - lastMatrixFrameTime) / 1000;
    lastMatrixFrameTime = timestamp;

    return Math.min(Math.max(deltaSeconds, 1 / 144), 0.05);
}

// Draw one stream from bright white leading glyph to green trailing glyphs.
function drawMatrixStream(stream, height) {
    matrixContext.font = `${stream.fontSize}px "MS Gothic", "Hiragino Kaku Gothic ProN", "Courier New", monospace`;

    for (let index = 0; index < stream.trailLength; index++) {
        const y = stream.y - index * stream.glyphStep;

        if (y < -stream.fontSize || y > height + stream.fontSize) {
            continue;
        }

        if (!stream.visibleSlots[index]) {
            continue;
        }

        if (Math.random() < stream.mutateRate) {
            stream.glyphs[index] = randomMatrixGlyph();
        }

        const fade = 1 - index / stream.trailLength;
        const alpha = Math.min(1, stream.opacity * (0.72 + fade * 0.28));

        if (index === 0) {
            matrixContext.fillStyle = `rgba(238, 255, 238, ${Math.min(1, alpha + 0.18)})`;
            matrixContext.shadowColor = "rgba(195, 255, 195, 0.95)";
            matrixContext.shadowBlur = stream.blur + 2;
        } else {
            matrixContext.fillStyle = `rgba(42, 255, 88, ${alpha})`;
            matrixContext.shadowColor = "rgba(0, 235, 65, 0.78)";
            matrixContext.shadowBlur = stream.blur + 0.7;
        }

        matrixContext.fillText(stream.glyphs[index], stream.x, y);
    }
}

// Start or restart the background rain from freshly seeded streams above the viewport.
function startMatrixRain() {
    if (isMatrixRainRunning) {
        return;
    }

    isMatrixRainRunning = true;
    resizeMatrixCanvas();
    lastMatrixFrameTime = performance.now();

    if (prefersReducedMotion) {
        drawMatrixRain(lastMatrixFrameTime);
        cancelAnimationFrame(matrixAnimationFrame);
        return;
    }

    matrixAnimationFrame = requestAnimationFrame(drawMatrixRain);
}

// Used by the blue pill reset so the next Matrix run starts falling from the top again.
function stopMatrixRain({ clearCanvas = false } = {}) {
    cancelAnimationFrame(matrixAnimationFrame);
    matrixAnimationFrame = null;
    matrixStreams = [];
    lastMatrixFrameTime = 0;
    isMatrixRainRunning = false;

    if (clearCanvas) {
        matrixContext.setTransform(1, 0, 0, 1, 0, 0);
        matrixContext.clearRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    }
}

window.addEventListener("resize", () => {
    resizeMatrixCanvas();
    resizeGameCanvas();
});
startSavedSession();

// Form and button wiring. Most actions call small named functions below.
nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    enterMatrix();
});

skipSequenceButton.addEventListener("click", skipMatrixSequence);
redPillButton.addEventListener("click", startRedPillGame);
bluePillButton.addEventListener("click", resetToFirstNameScreen);
playAgainButton.addEventListener("click", startRedPillGame);
calculatorButton.addEventListener("click", returnToCalculator);
quitGameButton.addEventListener("click", returnToCalculator);

firstNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        enterMatrix();
    }

    if (event.key === "=") {
        event.preventDefault();
    }
});

window.addEventListener("keydown", handleGameKeyDown);
window.addEventListener("keyup", handleGameKeyUp);

// First-name entry point for a fresh user or blue-pill reset.
function enterMatrix() {
    const typedName = firstNameInput.value.trim();

    if (!typedName) {
        firstNameInput.focus();
        return;
    }

    firstName = typedName.split(/\s+/)[0];
    saveFirstName(firstName);
    firstNameInput.disabled = true;
    firstNameInput.classList.add("is-flickering-out");

    setTimeout(() => {
        startMatrixExperience();
    }, nameFlickerDelay);
}

// Returning users skip the first-name screen because their name is stored in localStorage.
function startSavedSession() {
    const savedFirstName = getSavedFirstName();

    if (!savedFirstName) {
        firstNameInput.focus();
        return;
    }

    firstName = savedFirstName;
    startMatrixExperience();
}

// Starts the post-name experience: hide intro, start rain, open terminal, type boot lines.
function startMatrixExperience() {
    const sequenceToken = ++bootSequenceToken;

    introScreen.classList.add("is-hidden");
    document.body.classList.add("matrix-awake");
    computerContainer.classList.remove("is-opening");
    showSkipSequence();
    startMatrixRain();

    scheduleSequenceTimeout(() => {
        if (sequenceToken !== bootSequenceToken) {
            return;
        }

        computerContainer.classList.remove("is-hidden");
        computerContainer.classList.add("is-opening");
        scheduleSequenceTimeout(() => {
            if (sequenceToken === bootSequenceToken) {
                typeBootMessages(sequenceToken);
            }
        }, terminalStartDelay);
    }, rainOnlyDelay);
}

// Skip cancels pending boot timers and jumps straight to a usable calculator.
function skipMatrixSequence() {
    if (isPromptReady) {
        return;
    }

    bootSequenceToken++;
    clearSequenceTimers();
    transcript.textContent = "";
    transcriptBottomSpacer = null;
    introScreen.classList.add("is-hidden");
    document.body.classList.add("matrix-awake");
    computerContainer.classList.remove("is-hidden");
    computerContainer.classList.remove("is-opening");
    startMatrixRain();
    revealPrompt();
}

function showSkipSequence() {
    skipSequenceButton.classList.remove("is-hidden");
}

function hideSkipSequence() {
    skipSequenceButton.classList.add("is-hidden");
}

// Store timeout IDs so a reset/skip can cancel delayed boot callbacks cleanly.
function scheduleSequenceTimeout(callback, delay) {
    const timeoutId = setTimeout(() => {
        sequenceTimers = sequenceTimers.filter((timerId) => timerId !== timeoutId);
        callback();
    }, delay);

    sequenceTimers.push(timeoutId);
}

function clearSequenceTimers() {
    sequenceTimers.forEach((timerId) => clearTimeout(timerId));
    sequenceTimers = [];
}

// localStorage is wrapped in try/catch so private browsing or blocked storage does not break the app.
function saveFirstName(name) {
    try {
        localStorage.setItem(savedFirstNameKey, name);
    } catch {
        // Persistence is a convenience; the app still works when storage is unavailable.
    }
}

function getSavedFirstName() {
    try {
        return localStorage.getItem(savedFirstNameKey);
    } catch {
        return "";
    }
}

// Boot messages type one at a time, disappear, then allow the next message to start.
function typeBootMessages(sequenceToken = bootSequenceToken) {
    let messageIndex = 0;

    function typeNextMessage() {
        if (sequenceToken !== bootSequenceToken) {
            return;
        }

        if (messageIndex >= bootMessages.length) {
            revealPrompt();
            return;
        }

        const line = typeTranscriptLine(formatBootMessage(bootMessages[messageIndex]), "incoming", () => {
            scheduleSequenceTimeout(() => {
                if (sequenceToken !== bootSequenceToken) {
                    return;
                }

                line.remove();
                messageIndex++;
                typeNextMessage();
            }, bootMessagePause);
        }, sequenceToken);
    }

    typeNextMessage();
}

function formatBootMessage(message) {
    return message.replace("{firstName}", firstName);
}

// Adds a terminal line, types into it, then calls onComplete.
function typeTranscriptLine(text, className = "", onComplete = () => {}, sequenceToken = bootSequenceToken) {
    const line = document.createElement("p");
    line.className = `line ${className}`.trim();
    transcript.appendChild(line);

    typeIntoLine(line, text, incomingTypingDelay, () => {
        if (sequenceToken !== null && sequenceToken !== bootSequenceToken) {
            return;
        }

        transcript.scrollTop = transcript.scrollHeight;
        onComplete();
    }, sequenceToken);

    return line;
}

// Shared typewriter helper for boot messages, answers, and the idle reminder.
function typeIntoLine(line, text, delay, onComplete = () => {}, sequenceToken = null) {
    let index = 0;

    function typeCharacter() {
        if (sequenceToken !== null && sequenceToken !== bootSequenceToken) {
            return;
        }

        if (index < text.length) {
            line.textContent = text.slice(0, index + 1);
            index++;
            scheduleSequenceTimeout(typeCharacter, delay);
            return;
        }

        onComplete();
    }

    typeCharacter();
}

function revealPrompt() {
    isPromptReady = true;
    hideSkipSequence();
    promptForm.classList.remove("is-hidden");
    calculatorInput.disabled = false;
    calculatorInput.focus();
    resetInactivityReminder();
}

// Hiding the prompt pauses user input while an answer is being typed.
function hidePrompt() {
    isPromptReady = false;
    clearInactivityReminder();
    clearInactivityReminderLine();
    promptForm.classList.add("is-hidden");
    calculatorInput.disabled = true;
}

// Starts a one-shot idle timer once the calculator is ready.
function resetInactivityReminder() {
    clearInactivityReminder();

    if (!isPromptReady || hasShownInactivityReminder) {
        return;
    }

    inactivityReminderTimer = setTimeout(showInactivityReminder, inactivityReminderDelay);
}

function clearInactivityReminder() {
    clearTimeout(inactivityReminderTimer);
}

// This reminder appears once per session and is removed as soon as the user returns to input.
function showInactivityReminder() {
    if (!isPromptReady || hasShownInactivityReminder) {
        return;
    }

    hasShownInactivityReminder = true;
    inactivityReminderLine = typeTranscriptLine(`Knock, knock...${firstName}`, "incoming", () => {
        transcript.scrollTop = transcript.scrollHeight;
    }, null);
}

function clearInactivityReminderLine() {
    if (!inactivityReminderLine) {
        return;
    }

    inactivityReminderLine.remove();
    inactivityReminderLine = null;
}

promptForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

// The calculator uses "=" as the submit key and adds spacing around typed operators.
calculatorInput.addEventListener("keydown", (event) => {
    clearInactivityReminderLine();
    resetInactivityReminder();

    if (event.key === "=") {
        event.preventDefault();
        runCalculation();
        return;
    }

    if (isMathOperatorKey(event)) {
        event.preventDefault();
        insertSpacedOperator(event.key);
        return;
    }

    if (event.key === "Escape") {
        calculatorInput.value = "";
    }
});

calculatorInput.addEventListener("click", clearInactivityReminderLine);
calculatorInput.addEventListener("focus", clearInactivityReminderLine);
calculatorInput.addEventListener("input", () => {
    clearInactivityReminderLine();
    resetInactivityReminder();
});

document.addEventListener("click", () => {
    resetInactivityReminder();

    if (isPromptReady) {
        calculatorInput.focus();
    }
});

// Reads the user's sentence, extracts math from it, and displays a typed result.
function runCalculation() {
    if (!isPromptReady) {
        return;
    }

    const typedText = calculatorInput.value.trim();

    if (!typedText) {
        return;
    }

    calculatorInput.value = "";
    hidePrompt();

    try {
        const expression = extractMathExpression(typedText);
        const result = evaluateMathExpression(expression);
        displayCalculationExchange(typedText, formatResult(result), "calculation");
    } catch (error) {
        displayCalculationExchange(typedText, error.message, "error");
    }
}

// Adds a compact history entry above a spacer so the latest answer sits in view.
function displayCalculationExchange(typedText, answerText, answerClass) {
    const exchange = document.createElement("section");
    const equationLine = document.createElement("p");
    const answerLine = document.createElement("p");
    const bottomSpacer = getTranscriptBottomSpacer();

    exchange.className = "exchange";
    equationLine.className = "line equation";
    equationLine.textContent = `> ${typedText} =`;
    answerLine.className = `line answer ${answerClass}`.trim();

    exchange.append(equationLine, answerLine);
    transcript.insertBefore(exchange, bottomSpacer);
    updateTranscriptBottomSpacer(answerLine);
    scrollAnswerIntoView(answerLine);

    typeIntoLine(answerLine, answerText, answerTypingDelay, () => {
        updateTranscriptBottomSpacer(answerLine);
        scrollAnswerIntoView(answerLine);
        revealPrompt();
    });
}

// The spacer keeps the latest answer near the top while older answers remain scrollable.
function getTranscriptBottomSpacer() {
    if (!transcriptBottomSpacer) {
        transcriptBottomSpacer = document.createElement("div");
        transcriptBottomSpacer.className = "transcript-spacer";
        transcript.appendChild(transcriptBottomSpacer);
    }

    return transcriptBottomSpacer;
}

function updateTranscriptBottomSpacer(answerLine) {
    const answerHeight = answerLine.offsetHeight || 0;
    const spacerHeight = Math.max(0, transcript.clientHeight - answerHeight - 8);

    getTranscriptBottomSpacer().style.height = `${spacerHeight}px`;
}

function scrollAnswerIntoView(answerLine) {
    const answerTop = answerLine.offsetTop - transcript.offsetTop;

    transcript.scrollTop = Math.max(0, answerTop - 4);
}

// Only bare math operator keys get auto-spaced. Modifier shortcuts still pass through.
function isMathOperatorKey(event) {
    return ["+", "-", "*", "/"].includes(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey;
}

// Inserts " + " style spacing, but avoids duplicate leading/trailing spaces.
function insertSpacedOperator(operator) {
    const selectionStart = calculatorInput.selectionStart ?? calculatorInput.value.length;
    const selectionEnd = calculatorInput.selectionEnd ?? calculatorInput.value.length;
    const beforeSelection = calculatorInput.value.slice(0, selectionStart);
    const afterSelection = calculatorInput.value.slice(selectionEnd);
    const needsLeadingSpace = beforeSelection.length > 0 && !/\s$/.test(beforeSelection);
    const needsTrailingSpace = !/^\s/.test(afterSelection);
    const insertion = `${needsLeadingSpace ? " " : ""}${operator}${needsTrailingSpace ? " " : ""}`;
    const nextCursorPosition = beforeSelection.length + insertion.length;

    calculatorInput.value = `${beforeSelection}${insertion}${afterSelection}`;
    calculatorInput.setSelectionRange(nextCursorPosition, nextCursorPosition);
}

// Red pill swaps the terminal into game mode and starts a fresh game loop.
function startRedPillGame() {
    firstName = firstName || getSavedFirstName() || "Neo";
    bootSequenceToken++;
    clearSequenceTimers();
    clearInactivityReminder();
    clearInactivityReminderLine();
    hideSkipSequence();
    hidePrompt();
    transcript.textContent = "";
    transcriptBottomSpacer = null;
    introScreen.classList.add("is-hidden");
    document.body.classList.add("matrix-awake");
    computerContainer.classList.remove("is-hidden");
    computerContainer.classList.remove("is-opening");
    computerScreen.classList.add("is-game-active");
    matrixGame.classList.remove("is-hidden");
    gameOverlay.classList.add("is-hidden");
    matrixGame.focus();
    startMatrixRain();
    startGameLoop();
    playGameMusic();
}

// Blue pill returns to the original name prompt and clears saved user/session state.
function resetToFirstNameScreen() {
    stopGameLoop();
    stopGameMusic();
    bootSequenceToken++;
    clearSequenceTimers();
    clearInactivityReminder();
    clearInactivityReminderLine();
    hideSkipSequence();
    hidePrompt();
    transcript.textContent = "";
    transcriptBottomSpacer = null;
    firstName = "";
    firstNameInput.value = "";
    firstNameInput.disabled = false;
    firstNameInput.classList.remove("is-flickering-out");
    matrixGame.classList.add("is-hidden");
    gameOverlay.classList.add("is-hidden");
    computerScreen.classList.remove("is-game-active");
    computerContainer.classList.add("is-hidden");
    computerContainer.classList.remove("is-opening");
    introScreen.classList.remove("is-hidden");
    document.body.classList.remove("matrix-awake");
    stopMatrixRain({ clearCanvas: true });

    try {
        localStorage.removeItem(savedFirstNameKey);
    } catch {
        // If storage is unavailable, returning to the first-name screen still works.
    }

    firstNameInput.focus();
}

// Leaves the game view and restores normal calculator input.
function returnToCalculator() {
    stopGameLoop();
    stopGameMusic();
    matrixGame.classList.add("is-hidden");
    gameOverlay.classList.add("is-hidden");
    computerScreen.classList.remove("is-game-active");
    computerContainer.classList.remove("is-hidden");
    introScreen.classList.add("is-hidden");
    document.body.classList.add("matrix-awake");
    revealPrompt();
}

// A fresh game state is created each time Play Again or the red pill starts the game.
function startGameLoop() {
    stopGameLoop();
    resizeGameCanvas();
    gameState = createGameState();
    isGameActive = true;
    gameLastFrameTime = performance.now();
    gameAnimationFrame = requestAnimationFrame(runGameFrame);
}

function stopGameLoop() {
    isGameActive = false;
    gameKeys.clear();
    cancelAnimationFrame(gameAnimationFrame);
}

// Game music starts from red-pill/play-again clicks and stops when leaving the game.
function playGameMusic() {
    if (!gameMusic) {
        return;
    }

    gameMusic.volume = 0.42;
    gameMusic.currentTime = 0;
    gameMusic.play().catch(() => {
        // Browsers may block audio until a user gesture; the game keeps working silently.
    });
}

function stopGameMusic() {
    if (!gameMusic) {
        return;
    }

    gameMusic.pause();
    gameMusic.currentTime = 0;
}

// The game is drawn at a stable internal resolution, then scaled by CSS.
function resizeGameCanvas() {
    if (matrixGame.classList.contains("is-hidden")) {
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;

    matrixGameCanvas.width = Math.floor(960 * pixelRatio);
    matrixGameCanvas.height = Math.floor(540 * pixelRatio);
    gameContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

// Central data model for a playthrough: player, level bounds, enemies, obstacles, and motif.
function createGameState() {
    const groundY = 445;
    const finishX = 15000;

    return {
        width: 960,
        height: 540,
        groundY,
        finishX,
        worldWidth: finishX + 700,
        cameraX: 0,
        mode: "playing",
        phoneTimer: 0,
        player: {
            x: 80,
            y: groundY - 78,
            previousX: 80,
            previousY: groundY - 78,
            width: 32,
            height: 78,
            velocityX: 0,
            velocityY: 0,
            speed: 430,
            facing: 1,
            dodgeTimer: 0,
            stunt: null,
            onGround: true,
            attack: null,
            runTime: 0,
        },
        obstacles: createGameObstacles(groundY, finishX),
        agents: createGameAgents(groundY, finishX),
        bullets: [],
        redDress: {
            x: finishX * 0.5 + 280,
            y: groundY,
            speed: 46,
            hasPassed: false,
        },
    };
}

// Procedural obstacle pattern for the long 2-3 minute side-scrolling level.
function createGameObstacles(groundY, finishX) {
    const obstacles = [];

    for (let x = 620; x < finishX - 700; x += 740) {
        if ((x / 740) % 3 < 1) {
            obstacles.push({ type: "barrier", x, y: groundY - 44, width: 48, height: 44 });
            obstacles.push({ type: "spike", x: x + 230, y: groundY - 28, width: 64, height: 28 });
            continue;
        }

        obstacles.push({ type: "spike", x, y: groundY - 28, width: 78, height: 28 });
        obstacles.push({ type: "barrier", x: x + 300, y: groundY - 54, width: 62, height: 54 });
    }

    return obstacles;
}

// Places agents at intervals so the player has recurring combat encounters.
function createGameAgents(groundY, finishX) {
    const agents = [];

    for (let x = 900; x < finishX - 900; x += 980) {
        agents.push({
            x,
            y: groundY - 74,
            width: 32,
            height: 74,
            health: 3,
            speed: 64,
            facing: -1,
            attackCooldown: randomBetween(1.8, 3.5),
            shootCooldown: randomBetween(2.2, 5.2),
            hitFlash: 0,
            defeated: false,
        });
    }

    return agents;
}

// requestAnimationFrame calls this repeatedly while the game is active.
function runGameFrame(timestamp) {
    if (!isGameActive || !gameState) {
        return;
    }

    const deltaSeconds = Math.min((timestamp - gameLastFrameTime) / 1000, 0.033);

    gameLastFrameTime = timestamp;
    updateGame(deltaSeconds);
    drawGame();
    gameAnimationFrame = requestAnimationFrame(runGameFrame);
}

// Keydown handles movement state plus actions. Held S/A/D keys can repeat for rapid attacks.
function handleGameKeyDown(event) {
    if (!isGameActive || !gameState) {
        return;
    }

    if (!isGameControlKey(event.key)) {
        return;
    }

    event.preventDefault();
    gameKeys.add(event.key);

    if (gameState.mode !== "playing") {
        return;
    }

    if (event.key === " ") {
        if (event.repeat) {
            return;
        }

        startObstacleStunt();
        return;
    }

    const actionKey = event.key.toLowerCase();

    if (actionKey === "s" || actionKey === "a" || actionKey === "d") {
        performGameAttack(actionKey);
    }
}

function handleGameKeyUp(event) {
    if (!isGameActive) {
        return;
    }

    gameKeys.delete(event.key);
}

function isGameControlKey(key) {
    return ["ArrowLeft", "ArrowRight", " ", "s", "S", "a", "A", "d", "D"].includes(key);
}

// Update chooses which mode-specific logic to run, then moves the camera.
function updateGame(deltaSeconds) {
    if (gameState.mode === "playing") {
        updatePlayer(deltaSeconds);
        updateBullets(deltaSeconds);
        updateAgents(deltaSeconds);
        updateRedDress(deltaSeconds);
        checkFinishLine();
    } else if (gameState.mode === "exiting") {
        updatePhoneExit(deltaSeconds);
    }

    gameState.cameraX = clamp(
        gameState.player.x - gameState.width * 0.32,
        0,
        gameState.worldWidth - gameState.width
    );
}

// Player physics: horizontal input, gravity, animation timing, ground/barrier/spike collisions.
function updatePlayer(deltaSeconds) {
    const player = gameState.player;
    const movingLeft = gameKeys.has("ArrowLeft");
    const movingRight = gameKeys.has("ArrowRight");

    player.previousX = player.x;
    player.previousY = player.y;
    player.velocityX = 0;
    player.dodgeTimer = Math.max(0, player.dodgeTimer - deltaSeconds);

    if (movingLeft) {
        player.velocityX -= player.speed;
        player.facing = -1;
    }

    if (movingRight) {
        player.velocityX += player.speed;
        player.facing = 1;
    }

    if (player.velocityX !== 0 && player.onGround) {
        player.runTime += deltaSeconds * 13;
    }

    if (player.attack) {
        player.attack.timer -= deltaSeconds;

        if (player.attack.timer <= 0) {
            player.attack = null;
        }
    }

    if (player.stunt) {
        updatePlayerStunt(deltaSeconds);
        player.x = clamp(player.x, 0, gameState.finishX + 160);
        return;
    }

    player.x += player.velocityX * deltaSeconds;
    player.velocityY += gameGravity * deltaSeconds;
    player.y += player.velocityY * deltaSeconds;

    if (player.y + player.height >= gameState.groundY) {
        player.y = gameState.groundY - player.height;
        player.velocityY = 0;
        player.onGround = true;
    } else {
        player.onGround = false;
    }

    gameState.obstacles.forEach((obstacle) => {
        if (!rectsOverlap(player, obstacle)) {
            return;
        }

        if (obstacle.type === "spike") {
            staggerPlayerFromObstacle(obstacle);
            return;
        }

        resolvePlayerBarrierCollision(player, obstacle);
    });

    player.x = clamp(player.x, 0, gameState.finishX + 160);
}

// Barriers are solid blocks. This resolves the player out from the side or top they came from.
function resolvePlayerBarrierCollision(player, obstacle) {
    const wasAbove = player.previousY + player.height <= obstacle.y;
    const wasLeft = player.previousX + player.width <= obstacle.x;
    const wasRight = player.previousX >= obstacle.x + obstacle.width;

    if (wasAbove && player.velocityY >= 0) {
        player.y = obstacle.y - player.height;
        player.velocityY = 0;
        player.onGround = true;
        return;
    }

    if (wasLeft) {
        player.x = obstacle.x - player.width;
        return;
    }

    if (wasRight) {
        player.x = obstacle.x + obstacle.width;
        return;
    }

    player.y = obstacle.y + obstacle.height;
    player.velocityY = Math.max(0, player.velocityY);
}

function startObstacleStunt() {
    const player = gameState.player;

    if (!player.onGround || player.stunt || gameState.mode !== "playing") {
        return;
    }

    const obstacle = findNearbyObstacleForStunt();
    const stuntType = obstacle ? pickRandomItem(obstacleStuntTypes) : pickRandomItem(["flip", "hurdle"]);
    const facing = player.facing;
    const stuntConfig = {
        flip: { duration: 0.58, arcHeight: 96, extraDistance: 74 },
        hurdle: { duration: 0.46, arcHeight: 70, extraDistance: 58 },
        vault: { duration: 0.42, arcHeight: 56, extraDistance: 46 },
        dive: { duration: 0.52, arcHeight: 44, extraDistance: 82 },
    }[stuntType];
    const fallbackTarget = player.x + facing * 125;
    const obstacleTarget = obstacle
        ? (facing === 1
            ? obstacle.x + obstacle.width + stuntConfig.extraDistance
            : obstacle.x - player.width - stuntConfig.extraDistance)
        : fallbackTarget;

    player.stunt = {
        type: stuntType,
        timer: 0,
        duration: stuntConfig.duration,
        startX: player.x,
        targetX: obstacleTarget,
        startY: gameState.groundY - player.height,
        arcHeight: stuntConfig.arcHeight,
        spinDirection: Math.random() < 0.5 ? -1 : 1,
    };
    player.onGround = false;
    player.velocityY = 0;
}

function updatePlayerStunt(deltaSeconds) {
    const player = gameState.player;
    const stunt = player.stunt;
    const progress = clamp(stunt.timer / stunt.duration, 0, 1);
    const easedProgress = easeInOut(progress);

    player.x = stunt.startX + (stunt.targetX - stunt.startX) * easedProgress;
    player.y = stunt.startY - Math.sin(progress * Math.PI) * stunt.arcHeight;
    stunt.timer += deltaSeconds;

    if (stunt.timer < stunt.duration) {
        return;
    }

    player.x = stunt.targetX;
    player.y = gameState.groundY - player.height;
    player.stunt = null;
    player.velocityY = 0;
    player.onGround = true;
}

function findNearbyObstacleForStunt() {
    const player = gameState.player;
    const frontX = player.facing === 1 ? player.x + player.width : player.x;

    return gameState.obstacles
        .map((obstacle) => ({
            obstacle,
            distance: player.facing === 1
                ? obstacle.x - frontX
                : frontX - (obstacle.x + obstacle.width),
        }))
        .filter(({ distance }) => distance > -42 && distance < 190)
        .sort((first, second) => first.distance - second.distance)[0]?.obstacle;
}

function staggerPlayerFromObstacle(obstacle) {
    const player = gameState.player;

    player.dodgeTimer = 0.22;

    if (player.facing === 1) {
        player.x = Math.min(player.x, obstacle.x - player.width);
        return;
    }

    player.x = Math.max(player.x, obstacle.x + obstacle.width);
}

function pickRandomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
}

// S shoots, A punches, D kicks. These intentionally have no cooldown for arcade-style speed.
function performGameAttack(actionKey) {
    const player = gameState.player;

    if (actionKey === "s") {
        player.attack = { type: "shoot", timer: 0.1, duration: 0.1 };
        gameState.bullets.push({
            owner: "player",
            x: player.x + player.width / 2 + player.facing * 30,
            y: player.y + 27,
            width: 20,
            height: 4,
            velocityX: player.facing * 1700,
        });
        return;
    }

    if (actionKey === "a") {
        player.attack = { type: "punch", timer: 0.12, duration: 0.12 };
        damageAgentsInRange(58, 1);
        return;
    }

    player.attack = { type: "kick", timer: 0.14, duration: 0.14 };
    damageAgentsInRange(82, 2);
}

// Builds a short rectangle in front of Neo and damages any agent inside it.
function damageAgentsInRange(range, amount) {
    const player = gameState.player;
    const attackBox = {
        x: player.facing === 1 ? player.x + player.width : player.x - range,
        y: player.y + 18,
        width: range,
        height: 48,
    };

    gameState.agents.forEach((agent) => {
        if (agent.defeated || !rectsOverlap(attackBox, agent)) {
            return;
        }

        damageAgent(agent, amount);
    });
}

// Bullets move independently. Player bullets hit agents; agent bullets trigger Neo's dodge.
function updateBullets(deltaSeconds) {
    gameState.bullets = gameState.bullets.filter((bullet) => {
        bullet.x += bullet.velocityX * deltaSeconds;

        if (bullet.owner === "player") {
            for (const agent of gameState.agents) {
                if (!agent.defeated && rectsOverlap(bullet, agent)) {
                    damageAgent(agent, 1);
                    return false;
                }
            }
        }

        if (bullet.owner === "agent") {
            triggerNeoDodgeFromBullet(bullet);
        }

        return bullet.x > gameState.cameraX - 80 && bullet.x < gameState.cameraX + gameState.width + 80;
    });
}

function triggerNeoDodgeFromBullet(bullet) {
    const player = gameState.player;
    const dodgeZone = {
        x: player.x - 42,
        y: player.y + 8,
        width: player.width + 84,
        height: player.height - 18,
    };

    if (bullet.hasTriggeredDodge || player.stunt || !rectsOverlap(dodgeZone, bullet)) {
        return;
    }

    bullet.hasTriggeredDodge = true;
    player.dodgeTimer = 0.52;
}

// Agents wake up near the player, chase horizontally, and damage Neo on contact.
function updateAgents(deltaSeconds) {
    const player = gameState.player;

    gameState.agents.forEach((agent) => {
        if (agent.defeated) {
            return;
        }

        const distance = player.x - agent.x;

        agent.hitFlash = Math.max(0, agent.hitFlash - deltaSeconds);
        agent.attackCooldown = Math.max(0, agent.attackCooldown - deltaSeconds);
        agent.shootCooldown = Math.max(0, agent.shootCooldown - deltaSeconds);

        if (Math.abs(distance) < 520) {
            agent.facing = distance >= 0 ? 1 : -1;

            if (Math.abs(distance) > 42) {
                agent.x += agent.facing * agent.speed * deltaSeconds;
            }
        }

        if (Math.abs(distance) < 700 && agent.shootCooldown <= 0) {
            shootAgentBullet(agent);
            agent.shootCooldown = randomBetween(2.4, 5.4);
        }

        if (rectsOverlap(player, agent) && agent.attackCooldown <= 0) {
            player.dodgeTimer = 0.28;
            player.x += player.x >= agent.x ? 18 : -18;
            agent.attackCooldown = 1.2;
        }
    });
}

function shootAgentBullet(agent) {
    const direction = agent.facing;

    gameState.bullets.push({
        owner: "agent",
        x: agent.x + agent.width / 2 + direction * 22,
        y: agent.y + 28,
        width: 18,
        height: 4,
        velocityX: direction * agentBulletSpeed,
        hasTriggeredDodge: false,
    });
}

// The woman in the red dress is only a passing visual motif, not a game object to fight.
function updateRedDress(deltaSeconds) {
    const redDress = gameState.redDress;
    const playerNear = Math.abs(gameState.player.x - gameState.finishX * 0.5) < 640;

    if (playerNear) {
        redDress.hasPassed = true;
    }

    if (redDress.hasPassed) {
        redDress.x -= redDress.speed * deltaSeconds;
    }
}

function damageAgent(agent, amount) {
    agent.health -= amount;
    agent.hitFlash = 0.16;

    if (agent.health <= 0) {
        agent.defeated = true;
    }
}

function checkFinishLine() {
    if (gameState.player.x >= gameState.finishX) {
        const boothX = getPhoneBoothX();

        gameState.mode = "exiting";
        gameState.phoneTimer = 0;
        gameState.player.x = boothX - 150;
        gameState.player.y = gameState.groundY - gameState.player.height;
        gameState.player.facing = 1;
        gameState.player.onGround = true;
        gameState.player.stunt = null;
        gameState.player.attack = null;
        gameState.player.dodgeTimer = 0;
        gameState.player.velocityX = 0;
        gameState.player.velocityY = 0;
    }
}

function getPhoneBoothX() {
    return gameState.finishX + phoneBoothOffset;
}

// Finish animation mode: Neo walks into the phone booth, answers, and exits the Matrix.
function updatePhoneExit(deltaSeconds) {
    const player = gameState.player;
    const boothX = getPhoneBoothX();
    const boothDoorX = boothX + 18;
    const walkStartX = boothX - 150;
    const walkEndX = boothDoorX - player.width / 2;
    const enterEndX = boothX + 22;
    const timer = gameState.phoneTimer;

    gameState.phoneTimer += deltaSeconds;
    player.facing = 1;
    player.y = gameState.groundY - player.height;
    player.velocityX = 0;
    player.velocityY = 0;
    player.onGround = true;

    if (timer < phoneExitWalkDuration) {
        const progress = easeInOut(timer / phoneExitWalkDuration);

        player.x = walkStartX + (walkEndX - walkStartX) * progress;
        player.runTime += deltaSeconds * 9;
        return;
    }

    if (timer < phoneExitWalkDuration + phoneExitDoorDuration) {
        player.x = walkEndX;
        return;
    }

    if (timer < phoneExitWalkDuration + phoneExitDoorDuration + phoneExitEnterDuration) {
        const enterProgress = easeInOut((timer - phoneExitWalkDuration - phoneExitDoorDuration) / phoneExitEnterDuration);

        player.x = walkEndX + (enterEndX - walkEndX) * enterProgress;
        player.runTime += deltaSeconds * 6;
        return;
    }

    player.x = enterEndX;

    if (gameState.phoneTimer >= phoneExitWalkDuration + phoneExitDoorDuration + phoneExitEnterDuration + phoneExitAnswerDuration) {
        endGame("Signal found.");
    }
}

// Final overlay appears after Neo completes the phone booth exit.
function endGame(message) {
    gameState.mode = "ended";
    isGameActive = false;
    cancelAnimationFrame(gameAnimationFrame);
    stopGameMusic();
    drawGame();
    gameMessage.textContent = message;
    gameOverlay.classList.remove("is-hidden");
    playAgainButton.focus();
}

// Draw order matters: background first, world objects, then characters/HUD on top.
function drawGame() {
    const width = gameState.width;
    const height = gameState.height;
    const cameraX = gameState.cameraX;

    gameContext.clearRect(0, 0, width, height);
    drawGameBackdrop(width, height, cameraX);
    drawWorldLine(gameState.groundY, cameraX, width);
    drawObstacles(cameraX);
    drawFinishLine(cameraX);
    drawRedDress(cameraX);
    drawAgents(cameraX);
    drawBullets(cameraX);

    if (gameState.mode === "exiting") {
        drawPhoneExit(cameraX);
    } else {
        drawPlayer(cameraX);
    }

    drawGameHud();
}

// Parallax city backdrop: line-art buildings and street marks behind the game objects.
function drawGameBackdrop(width, height, cameraX) {
    gameContext.fillStyle = "black";
    gameContext.fillRect(0, 0, width, height);

    drawCitySkyline(width, height, cameraX);
    drawStreetPerspective(width, height, cameraX);

    gameContext.strokeStyle = "rgba(0, 255, 0, 0.06)";
    gameContext.lineWidth = 1;

    for (let y = 24; y < height; y += 28) {
        gameContext.beginPath();
        gameContext.moveTo(0, y);
        gameContext.lineTo(width, y);
        gameContext.stroke();
    }
}

function drawCitySkyline(width, height, cameraX) {
    const horizonY = height * 0.18;
    const baseY = gameState.groundY;
    const parallaxX = cameraX * 0.28;
    const buildingPatternWidth = 1400;

    for (let x = -(parallaxX % buildingPatternWidth) - 240; x < width + 240; x += buildingPatternWidth) {
        drawBuilding(x + 0, baseY, 118, 245, "rgba(0, 255, 0, 0.24)", 0);
        drawBuilding(x + 138, baseY, 82, 318, "rgba(0, 255, 0, 0.32)", 1);
        drawBuilding(x + 240, baseY, 146, 274, "rgba(0, 255, 0, 0.26)", 2);
        drawBuilding(x + 410, baseY, 96, 356, "rgba(0, 255, 0, 0.35)", 3);
        drawBuilding(x + 528, baseY, 170, 232, "rgba(0, 255, 0, 0.2)", 4);
        drawBuilding(x + 720, baseY, 110, 305, "rgba(0, 255, 0, 0.3)", 5);
        drawBuilding(x + 852, baseY, 132, 390, "rgba(0, 255, 0, 0.38)", 6);
        drawBuilding(x + 1010, baseY, 92, 252, "rgba(0, 255, 0, 0.22)", 7);
        drawBuilding(x + 1124, baseY, 152, 332, "rgba(0, 255, 0, 0.28)", 8);
    }

    gameContext.strokeStyle = "rgba(0, 255, 0, 0.14)";
    gameContext.lineWidth = 1;
    gameContext.beginPath();
    gameContext.moveTo(0, horizonY);
    gameContext.lineTo(width, horizonY + 10);
    gameContext.stroke();
}

function drawBuilding(x, baseY, buildingWidth, buildingHeight, color, variant) {
    const topY = baseY - buildingHeight;

    gameContext.strokeStyle = color;
    gameContext.lineWidth = 1.5;
    gameContext.strokeRect(x, topY, buildingWidth, buildingHeight);

    if (variant % 3 === 0) {
        drawWaterTower(x + buildingWidth * 0.55, topY - 34);
    }

    if (variant % 2 === 1) {
        drawFireEscape(x + buildingWidth - 22, topY + 42, buildingHeight - 78);
    }

    drawBuildingWindows(x, topY, buildingWidth, buildingHeight, variant);

    gameContext.beginPath();
    gameContext.moveTo(x, topY + 24);
    gameContext.lineTo(x + buildingWidth, topY + 18);
    gameContext.moveTo(x + 12, topY);
    gameContext.lineTo(x + 12, baseY);
    gameContext.moveTo(x + buildingWidth - 12, topY);
    gameContext.lineTo(x + buildingWidth - 12, baseY);
    gameContext.stroke();
}

function drawBuildingWindows(x, topY, buildingWidth, buildingHeight, variant) {
    const windowWidth = 7;
    const windowHeight = 9;
    const columnGap = 18;
    const rowGap = 24;

    gameContext.strokeStyle = "rgba(125, 255, 135, 0.22)";
    gameContext.lineWidth = 1;

    for (let windowX = x + 18; windowX < x + buildingWidth - 18; windowX += columnGap) {
        for (let windowY = topY + 34; windowY < topY + buildingHeight - 24; windowY += rowGap) {
            if ((Math.floor(windowX + windowY + variant * 13) % 5) === 0) {
                continue;
            }

            gameContext.strokeRect(windowX, windowY, windowWidth, windowHeight);
        }
    }
}

function drawWaterTower(x, y) {
    gameContext.strokeStyle = "rgba(125, 255, 135, 0.28)";
    gameContext.lineWidth = 1;
    gameContext.beginPath();
    gameContext.ellipse(x, y, 20, 6, 0, 0, Math.PI * 2);
    gameContext.moveTo(x - 20, y);
    gameContext.lineTo(x - 16, y + 28);
    gameContext.moveTo(x + 20, y);
    gameContext.lineTo(x + 16, y + 28);
    gameContext.moveTo(x - 16, y + 28);
    gameContext.lineTo(x + 16, y + 28);
    gameContext.moveTo(x - 10, y + 28);
    gameContext.lineTo(x - 18, y + 50);
    gameContext.moveTo(x + 10, y + 28);
    gameContext.lineTo(x + 18, y + 50);
    gameContext.stroke();
}

function drawFireEscape(x, y, height) {
    gameContext.strokeStyle = "rgba(125, 255, 135, 0.24)";
    gameContext.lineWidth = 1;

    for (let levelY = y; levelY < y + height; levelY += 44) {
        gameContext.strokeRect(x - 30, levelY, 30, 10);
        gameContext.beginPath();
        gameContext.moveTo(x - 30, levelY + 10);
        gameContext.lineTo(x, levelY + 32);
        gameContext.moveTo(x, levelY + 10);
        gameContext.lineTo(x - 30, levelY + 32);
        gameContext.stroke();
    }
}

function drawStreetPerspective(width, height, cameraX) {
    const groundY = gameState.groundY;
    const laneOffset = cameraX * 0.9;

    gameContext.strokeStyle = "rgba(0, 255, 0, 0.18)";
    gameContext.lineWidth = 1;
    gameContext.beginPath();
    gameContext.moveTo(width * 0.12, groundY);
    gameContext.lineTo(width * 0.02, height);
    gameContext.moveTo(width * 0.88, groundY);
    gameContext.lineTo(width * 0.98, height);
    gameContext.stroke();

    gameContext.strokeStyle = "rgba(125, 255, 135, 0.25)";

    for (let x = -(laneOffset % 160); x < width + 160; x += 160) {
        gameContext.beginPath();
        gameContext.moveTo(x, groundY + 38);
        gameContext.lineTo(x + 68, groundY + 38);
        gameContext.stroke();
    }
}

// Ground line plus diagonal ticks creates the side-scroller floor.
function drawWorldLine(groundY, cameraX, width) {
    gameContext.strokeStyle = "rgba(0, 255, 0, 0.9)";
    gameContext.lineWidth = 2;
    gameContext.beginPath();
    gameContext.moveTo(0, groundY);
    gameContext.lineTo(width, groundY);
    gameContext.stroke();

    gameContext.strokeStyle = "rgba(0, 255, 0, 0.18)";

    for (let x = -cameraX % 120; x < width; x += 120) {
        gameContext.beginPath();
        gameContext.moveTo(x, groundY);
        gameContext.lineTo(x + 42, groundY + 46);
        gameContext.stroke();
    }
}

function drawObstacles(cameraX) {
    gameState.obstacles.forEach((obstacle) => {
        const x = obstacle.x - cameraX;

        if (x + obstacle.width < -40 || x > gameState.width + 40) {
            return;
        }

        gameContext.strokeStyle = obstacle.type === "spike" ? "rgba(125, 255, 135, 0.95)" : "rgba(0, 255, 0, 0.72)";
        gameContext.lineWidth = 2;
        gameContext.beginPath();

        if (obstacle.type === "spike") {
            gameContext.moveTo(x, obstacle.y + obstacle.height);
            gameContext.lineTo(x + obstacle.width * 0.25, obstacle.y);
            gameContext.lineTo(x + obstacle.width * 0.5, obstacle.y + obstacle.height);
            gameContext.lineTo(x + obstacle.width * 0.75, obstacle.y);
            gameContext.lineTo(x + obstacle.width, obstacle.y + obstacle.height);
        } else {
            gameContext.rect(x, obstacle.y, obstacle.width, obstacle.height);
            gameContext.moveTo(x, obstacle.y);
            gameContext.lineTo(x + obstacle.width, obstacle.y + obstacle.height);
            gameContext.moveTo(x + obstacle.width, obstacle.y);
            gameContext.lineTo(x, obstacle.y + obstacle.height);
        }

        gameContext.stroke();
    });
}

// The level destination is a phone booth, which sets up the final Matrix exit scene.
function drawFinishLine(cameraX) {
    if (gameState.mode === "exiting") {
        return;
    }

    const x = getPhoneBoothX() - cameraX;

    if (x < -140 || x > gameState.width + 140) {
        return;
    }

    drawPhoneBooth(x, gameState.groundY, 0);
}

function drawAgents(cameraX) {
    gameState.agents.forEach((agent) => {
        if (agent.defeated) {
            return;
        }

        const x = agent.x - cameraX;

        if (x + agent.width < -60 || x > gameState.width + 60) {
            return;
        }

        drawStickFigure(x + agent.width / 2, agent.y + agent.height, {
            color: agent.hitFlash > 0 ? "rgb(238, 255, 238)" : "rgba(0, 255, 0, 0.82)",
            facing: agent.facing,
            agent: true,
        });
    });
}

function drawPlayer(cameraX) {
    const player = gameState.player;

    drawStickFigure(player.x - cameraX + player.width / 2, player.y + player.height, {
        color: "rgb(125, 255, 135)",
        facing: player.facing,
        attack: player.attack?.type,
        attackProgress: player.attack ? 1 - player.attack.timer / player.attack.duration : 0,
        airborne: !player.onGround,
        running: player.velocityX !== 0 && player.onGround,
        runPhase: player.runTime,
        dodgeAmount: player.dodgeTimer > 0 ? easeInOut(clamp(player.dodgeTimer / 0.52, 0, 1)) : 0,
        stunt: player.stunt,
    });
}

function drawBullets(cameraX) {
    gameContext.lineWidth = 3;

    gameState.bullets.forEach((bullet) => {
        const direction = Math.sign(bullet.velocityX);

        gameContext.strokeStyle = bullet.owner === "agent" ? "rgba(125, 255, 135, 0.72)" : "rgb(238, 255, 238)";
        gameContext.beginPath();
        gameContext.moveTo(bullet.x - cameraX, bullet.y);
        gameContext.lineTo(bullet.x - cameraX - direction * 34, bullet.y);
        gameContext.moveTo(bullet.x - cameraX + direction * 5, bullet.y);
        gameContext.lineTo(bullet.x - cameraX + direction * 16, bullet.y);
        gameContext.stroke();
    });
}

function drawRedDress(cameraX) {
    const redDress = gameState.redDress;
    const x = redDress.x - cameraX;

    if (x < -80 || x > gameState.width + 80) {
        return;
    }

    drawStickFigure(x, redDress.y, {
        color: "rgba(0, 255, 0, 0.72)",
        dressColor: "rgb(255, 45, 65)",
        facing: -1,
        redDress: true,
    });
}

function drawPhoneExit(cameraX) {
    const timer = gameState.phoneTimer;
    const boothX = getPhoneBoothX() - cameraX;
    const player = gameState.player;
    const doorProgress = getPhoneBoothDoorProgress(timer);
    const isAnsweringPhone = timer >= phoneExitWalkDuration + phoneExitDoorDuration + phoneExitEnterDuration;

    drawPhoneBooth(boothX, gameState.groundY, doorProgress);

    gameContext.save();
    gameContext.globalAlpha = isAnsweringPhone ? 0.8 : 1;
    drawStickFigure(player.x - cameraX + player.width / 2, player.y + player.height, {
        color: "rgb(125, 255, 135)",
        facing: 1,
        phone: isAnsweringPhone,
        running: timer < phoneExitWalkDuration || (
            timer >= phoneExitWalkDuration + phoneExitDoorDuration
            && timer < phoneExitWalkDuration + phoneExitDoorDuration + phoneExitEnterDuration
        ),
        runPhase: player.runTime,
    });
    gameContext.restore();

    drawPhoneBoothDoor(boothX, gameState.groundY, doorProgress);
}

function getPhoneBoothDoorProgress(timer) {
    if (timer < phoneExitWalkDuration) {
        return 0;
    }

    if (timer < phoneExitWalkDuration + phoneExitDoorDuration) {
        return easeInOut((timer - phoneExitWalkDuration) / phoneExitDoorDuration);
    }

    return 1;
}

function drawPhoneBooth(x, groundY, doorProgress) {
    const topY = groundY - 154;
    const width = 78;
    const height = 154;

    gameContext.strokeStyle = "rgba(125, 255, 135, 0.95)";
    gameContext.lineWidth = 2;
    gameContext.shadowColor = "rgba(0, 255, 0, 0.8)";
    gameContext.shadowBlur = 7;

    gameContext.beginPath();
    gameContext.rect(x, topY, width, height);
    gameContext.moveTo(x - 6, topY);
    gameContext.lineTo(x + width + 6, topY);
    gameContext.moveTo(x + 8, topY + 24);
    gameContext.lineTo(x + width - 8, topY + 24);
    gameContext.moveTo(x + 8, groundY - 22);
    gameContext.lineTo(x + width - 8, groundY - 22);
    gameContext.stroke();

    gameContext.font = '11px "Orbitron", monospace';
    gameContext.fillStyle = "rgba(125, 255, 135, 0.88)";
    gameContext.fillText("PHONE", x + 16, topY + 17);

    drawPhoneBoothWindows(x, topY, width, groundY, doorProgress);
    drawBoothPhone(x + width - 22, groundY - 84);
}

function drawPhoneBoothWindows(x, topY, width, groundY, doorProgress) {
    const windowTop = topY + 35;
    const windowWidth = 19;
    const windowHeight = 30;

    gameContext.strokeStyle = "rgba(125, 255, 135, 0.42)";
    gameContext.lineWidth = 1;

    for (let column = 0; column < 2; column++) {
        for (let row = 0; row < 3; row++) {
            const windowX = x + 10 + column * 28;
            const windowY = windowTop + row * 35;

            if (doorProgress > 0.72 && column === 0) {
                continue;
            }

            gameContext.strokeRect(windowX, windowY, windowWidth, windowHeight);
        }
    }

    gameContext.beginPath();
    gameContext.moveTo(x + width / 2, topY + 24);
    gameContext.lineTo(x + width / 2, groundY);
    gameContext.stroke();
}

function drawPhoneBoothDoor(x, groundY, doorProgress) {
    const topY = groundY - 130;
    const hingeX = x + 8;
    const doorWidth = 31;
    const openOffset = doorProgress * 24;

    gameContext.strokeStyle = "rgba(125, 255, 135, 0.98)";
    gameContext.lineWidth = 2;
    gameContext.shadowColor = "rgba(0, 255, 0, 0.82)";
    gameContext.shadowBlur = 8;
    gameContext.beginPath();
    gameContext.moveTo(hingeX, topY);
    gameContext.lineTo(hingeX + doorWidth + openOffset, topY + doorProgress * 8);
    gameContext.lineTo(hingeX + doorWidth + openOffset, groundY - 2);
    gameContext.lineTo(hingeX, groundY);
    gameContext.closePath();
    gameContext.stroke();

    gameContext.beginPath();
    gameContext.arc(hingeX + doorWidth + openOffset - 6, groundY - 70, 2.2, 0, Math.PI * 2);
    gameContext.stroke();
}

function drawBoothPhone(x, y) {
    gameContext.strokeStyle = "rgba(238, 255, 238, 0.8)";
    gameContext.lineWidth = 1.5;
    gameContext.beginPath();
    gameContext.rect(x - 7, y - 14, 14, 24);
    gameContext.arc(x, y - 19, 8, 0.2, Math.PI - 0.2);
    gameContext.moveTo(x - 8, y - 17);
    gameContext.quadraticCurveTo(x - 18, y - 3, x - 7, y + 10);
    gameContext.stroke();
}

// Stick figure poses are stored as named body points relative to the feet/ground.
function makeStickPose(overrides = {}) {
    const pose = {
        head: { x: 0, y: -66 },
        bodyTop: { x: 0, y: -52 },
        hipCenter: { x: 0, y: -28 },
        leftShoulder: { x: -7, y: -47 },
        rightShoulder: { x: 7, y: -47 },
        leftHip: { x: -4, y: -28 },
        rightHip: { x: 4, y: -28 },
        leftElbow: { x: -14, y: -35 },
        leftHand: { x: -18, y: -23 },
        rightElbow: { x: 14, y: -35 },
        rightHand: { x: 19, y: -23 },
        leftKnee: { x: -7, y: -14 },
        leftFoot: { x: -13, y: 0 },
        rightKnee: { x: 8, y: -14 },
        rightFoot: { x: 14, y: 0 },
    };

    Object.entries(overrides).forEach(([partName, point]) => {
        pose[partName] = { ...pose[partName], ...point };
    });

    return pose;
}

const stickIdlePose = makeStickPose();

// Four run poses make a looping stride: contact, lift, opposite contact, lift.
const stickRunPoses = [
    makeStickPose({
        bodyTop: { x: 1, y: -53 },
        hipCenter: { x: -1, y: -29 },
        leftElbow: { x: 17, y: -42 },
        leftHand: { x: 23, y: -31 },
        rightElbow: { x: -17, y: -33 },
        rightHand: { x: -22, y: -20 },
        leftKnee: { x: -15, y: -15 },
        leftFoot: { x: -27, y: 0 },
        rightKnee: { x: 19, y: -18 },
        rightFoot: { x: 31, y: -1 },
    }),
    makeStickPose({
        bodyTop: { x: 0, y: -55 },
        hipCenter: { x: 1, y: -31 },
        leftElbow: { x: 6, y: -38 },
        leftHand: { x: 1, y: -24 },
        rightElbow: { x: 12, y: -39 },
        rightHand: { x: 23, y: -30 },
        leftKnee: { x: 7, y: -24 },
        leftFoot: { x: 4, y: -10 },
        rightKnee: { x: 2, y: -13 },
        rightFoot: { x: 8, y: 0 },
    }),
    makeStickPose({
        bodyTop: { x: -1, y: -53 },
        hipCenter: { x: 1, y: -29 },
        leftElbow: { x: -17, y: -33 },
        leftHand: { x: -22, y: -20 },
        rightElbow: { x: 17, y: -42 },
        rightHand: { x: 23, y: -31 },
        leftKnee: { x: -19, y: -18 },
        leftFoot: { x: -31, y: -1 },
        rightKnee: { x: 15, y: -15 },
        rightFoot: { x: 27, y: 0 },
    }),
    makeStickPose({
        bodyTop: { x: 0, y: -55 },
        hipCenter: { x: -1, y: -31 },
        leftElbow: { x: -12, y: -39 },
        leftHand: { x: -23, y: -30 },
        rightElbow: { x: -6, y: -38 },
        rightHand: { x: -1, y: -24 },
        leftKnee: { x: -2, y: -13 },
        leftFoot: { x: -8, y: 0 },
        rightKnee: { x: -7, y: -24 },
        rightFoot: { x: -4, y: -10 },
    }),
];

const stickJumpPose = makeStickPose({
    bodyTop: { x: 2, y: -54 },
    hipCenter: { x: -1, y: -30 },
    leftElbow: { x: -18, y: -50 },
    leftHand: { x: -24, y: -42 },
    rightElbow: { x: 20, y: -49 },
    rightHand: { x: 28, y: -39 },
    leftKnee: { x: -18, y: -18 },
    leftFoot: { x: -27, y: -11 },
    rightKnee: { x: 18, y: -21 },
    rightFoot: { x: 28, y: -9 },
});

const stickShootPose = makeStickPose({
    bodyTop: { x: -1, y: -53 },
    hipCenter: { x: -4, y: -29 },
    leftElbow: { x: 11, y: -45 },
    leftHand: { x: 25, y: -47 },
    rightElbow: { x: 17, y: -50 },
    rightHand: { x: 34, y: -50 },
    leftKnee: { x: -13, y: -14 },
    leftFoot: { x: -24, y: 0 },
    rightKnee: { x: 15, y: -15 },
    rightFoot: { x: 25, y: 0 },
});

const stickPunchPose = makeStickPose({
    bodyTop: { x: 5, y: -53 },
    hipCenter: { x: -3, y: -29 },
    leftElbow: { x: -16, y: -36 },
    leftHand: { x: -19, y: -24 },
    rightElbow: { x: 22, y: -50 },
    rightHand: { x: 38, y: -51 },
    leftKnee: { x: -13, y: -14 },
    leftFoot: { x: -23, y: 0 },
    rightKnee: { x: 15, y: -16 },
    rightFoot: { x: 28, y: -1 },
});

const stickKickPose = makeStickPose({
    bodyTop: { x: -4, y: -53 },
    hipCenter: { x: -6, y: -29 },
    leftElbow: { x: -18, y: -41 },
    leftHand: { x: -20, y: -30 },
    rightElbow: { x: 11, y: -38 },
    rightHand: { x: 20, y: -25 },
    leftKnee: { x: -10, y: -12 },
    leftFoot: { x: -20, y: 0 },
    rightKnee: { x: 17, y: -27 },
    rightFoot: { x: 40, y: -31 },
});

const stickDodgePose = makeStickPose({
    head: { x: -22, y: -59 },
    bodyTop: { x: -15, y: -49 },
    hipCenter: { x: 2, y: -28 },
    leftShoulder: { x: -20, y: -45 },
    rightShoulder: { x: -9, y: -49 },
    leftElbow: { x: -31, y: -35 },
    leftHand: { x: -34, y: -24 },
    rightElbow: { x: -1, y: -41 },
    rightHand: { x: 7, y: -29 },
    leftKnee: { x: -11, y: -13 },
    leftFoot: { x: -25, y: 0 },
    rightKnee: { x: 16, y: -15 },
    rightFoot: { x: 28, y: 0 },
});

const stickHurdlePose = makeStickPose({
    bodyTop: { x: 8, y: -54 },
    hipCenter: { x: 0, y: -30 },
    leftElbow: { x: -15, y: -49 },
    leftHand: { x: -25, y: -40 },
    rightElbow: { x: 20, y: -50 },
    rightHand: { x: 29, y: -40 },
    leftKnee: { x: -15, y: -23 },
    leftFoot: { x: -31, y: -17 },
    rightKnee: { x: 20, y: -35 },
    rightFoot: { x: 43, y: -36 },
});

const stickVaultPose = makeStickPose({
    bodyTop: { x: 14, y: -49 },
    hipCenter: { x: -1, y: -31 },
    leftElbow: { x: 22, y: -47 },
    leftHand: { x: 39, y: -45 },
    rightElbow: { x: 21, y: -40 },
    rightHand: { x: 36, y: -36 },
    leftKnee: { x: -16, y: -31 },
    leftFoot: { x: -27, y: -21 },
    rightKnee: { x: 12, y: -32 },
    rightFoot: { x: 26, y: -18 },
});

const stickDivePose = makeStickPose({
    head: { x: 20, y: -58 },
    bodyTop: { x: 10, y: -50 },
    hipCenter: { x: -11, y: -34 },
    leftElbow: { x: 29, y: -55 },
    leftHand: { x: 44, y: -52 },
    rightElbow: { x: 27, y: -47 },
    rightHand: { x: 42, y: -44 },
    leftKnee: { x: -24, y: -28 },
    leftFoot: { x: -38, y: -20 },
    rightKnee: { x: -14, y: -22 },
    rightFoot: { x: -27, y: -12 },
});

const stickFlipPose = makeStickPose({
    head: { x: 0, y: -52 },
    bodyTop: { x: 0, y: -44 },
    hipCenter: { x: 0, y: -31 },
    leftElbow: { x: -20, y: -43 },
    leftHand: { x: -23, y: -34 },
    rightElbow: { x: 20, y: -43 },
    rightHand: { x: 23, y: -34 },
    leftKnee: { x: -17, y: -35 },
    leftFoot: { x: -22, y: -24 },
    rightKnee: { x: 17, y: -35 },
    rightFoot: { x: 22, y: -24 },
});

const stickPhonePose = makeStickPose({
    bodyTop: { x: 0, y: -52 },
    rightElbow: { x: 12, y: -56 },
    rightHand: { x: 9, y: -67 },
    leftElbow: { x: -13, y: -34 },
    leftHand: { x: -18, y: -22 },
});

const stickAgentPose = makeStickPose({
    bodyTop: { x: 0, y: -51 },
    hipCenter: { x: 0, y: -27 },
    leftElbow: { x: -16, y: -34 },
    leftHand: { x: -21, y: -22 },
    rightElbow: { x: 16, y: -34 },
    rightHand: { x: 21, y: -22 },
    leftKnee: { x: -7, y: -13 },
    rightKnee: { x: 7, y: -13 },
});

const stickRedDressPose = makeStickPose({
    leftElbow: { x: -16, y: -33 },
    leftHand: { x: -22, y: -21 },
    rightElbow: { x: 12, y: -36 },
    rightHand: { x: 18, y: -25 },
    leftKnee: { x: -7, y: -13 },
    rightKnee: { x: 9, y: -13 },
});

// Blending turns hard pose switches into animated movement between keyframes.
function blendStickPoses(firstPose, secondPose, amount) {
    const blendedPose = {};

    Object.keys(firstPose).forEach((partName) => {
        blendedPose[partName] = blendPoints(firstPose[partName], secondPose[partName], amount);
    });

    return blendedPose;
}

function blendPoints(firstPoint, secondPoint, amount) {
    return {
        x: firstPoint.x + (secondPoint.x - firstPoint.x) * amount,
        y: firstPoint.y + (secondPoint.y - firstPoint.y) * amount,
    };
}

function getLoopingPose(poses, phase) {
    const loopProgress = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const posePosition = (loopProgress / (Math.PI * 2)) * poses.length;
    const poseIndex = Math.floor(posePosition);
    const nextPoseIndex = (poseIndex + 1) % poses.length;
    const blendAmount = easeInOut(posePosition - poseIndex);

    return blendStickPoses(poses[poseIndex], poses[nextPoseIndex], blendAmount);
}

function getStickFigurePose(options) {
    if (options.phone) {
        return stickPhonePose;
    }

    if (options.agent) {
        return stickAgentPose;
    }

    if (options.redDress) {
        return stickRedDressPose;
    }

    let pose = options.running
        ? getLoopingPose(stickRunPoses, options.runPhase || 0)
        : stickIdlePose;

    if (options.airborne) {
        pose = blendStickPoses(pose, stickJumpPose, 0.9);
    }

    if (options.stunt) {
        pose = getStuntPose(pose, options.stunt);
    }

    if (options.attack) {
        const targetPose = {
            shoot: stickShootPose,
            punch: stickPunchPose,
            kick: stickKickPose,
        }[options.attack];
        const attackProgress = clamp(options.attackProgress || 0, 0, 1);
        const attackAmount = options.attack === "shoot"
            ? 1
            : Math.sin(attackProgress * Math.PI);

        pose = blendStickPoses(pose, targetPose, attackAmount);
    }

    if (options.dodgeAmount) {
        pose = blendStickPoses(pose, stickDodgePose, options.dodgeAmount);
    }

    return pose;
}

function getStuntPose(basePose, stunt) {
    const progress = clamp(stunt.timer / stunt.duration, 0, 1);
    const peakAmount = Math.sin(progress * Math.PI);
    const targetPose = {
        flip: stickFlipPose,
        hurdle: stickHurdlePose,
        vault: stickVaultPose,
        dive: stickDivePose,
    }[stunt.type] || stickHurdlePose;

    return blendStickPoses(basePose, targetPose, peakAmount);
}

function getStuntRotation(stunt) {
    if (!stunt || stunt.type !== "flip") {
        return 0;
    }

    const progress = clamp(stunt.timer / stunt.duration, 0, 1);

    return progress * Math.PI * 2 * stunt.spinDirection;
}

function easeInOut(amount) {
    return 0.5 - Math.cos(amount * Math.PI) / 2;
}

function posePoint(pose, partName, groundY) {
    const point = pose[partName];

    return {
        x: point.x,
        y: groundY + point.y,
    };
}

// Draws a bent limb from point to point. Splitting limbs at a middle point creates elbows/knees.
function drawJointedLine(points) {
    gameContext.beginPath();
    gameContext.moveTo(points[0].x, points[0].y);

    points.slice(1).forEach((point) => {
        gameContext.lineTo(point.x, point.y);
    });

    gameContext.stroke();
}

// Small glowing joint circles make the stick figure read as a moving body instead of loose lines.
function drawJoint(point, radius = 2.25) {
    gameContext.beginPath();
    gameContext.arc(point.x, point.y, radius, 0, Math.PI * 2);
    gameContext.stroke();
}

// Shared line-art character drawer. Options change pose/details for Neo, agents, phone, red dress.
function drawStickFigure(x, groundY, options = {}) {
    const color = options.color || "rgb(125, 255, 135)";
    const facing = options.facing || 1;
    const isNeo = !options.agent && !options.redDress;
    const pose = getStickFigurePose(options);
    const head = posePoint(pose, "head", groundY);
    const bodyTop = posePoint(pose, "bodyTop", groundY);
    const hipCenter = posePoint(pose, "hipCenter", groundY);
    const leftShoulder = posePoint(pose, "leftShoulder", groundY);
    const rightShoulder = posePoint(pose, "rightShoulder", groundY);
    const leftHip = posePoint(pose, "leftHip", groundY);
    const rightHip = posePoint(pose, "rightHip", groundY);
    const leftElbow = posePoint(pose, "leftElbow", groundY);
    const leftHand = posePoint(pose, "leftHand", groundY);
    const rightElbow = posePoint(pose, "rightElbow", groundY);
    const rightHand = posePoint(pose, "rightHand", groundY);
    const leftKnee = posePoint(pose, "leftKnee", groundY);
    const leftFoot = posePoint(pose, "leftFoot", groundY);
    const rightKnee = posePoint(pose, "rightKnee", groundY);
    const rightFoot = posePoint(pose, "rightFoot", groundY);

    gameContext.save();
    gameContext.translate(x, 0);
    gameContext.scale(facing, 1);

    const stuntRotation = getStuntRotation(options.stunt);

    if (stuntRotation) {
        const pivotY = groundY - 34;

        gameContext.translate(0, pivotY);
        gameContext.rotate(stuntRotation);
        gameContext.translate(0, -pivotY);
    }

    gameContext.strokeStyle = color;
    gameContext.lineWidth = isNeo ? 2.25 : 2;
    gameContext.lineCap = "round";
    gameContext.lineJoin = "round";
    gameContext.shadowColor = color;
    gameContext.shadowBlur = 6;

    gameContext.beginPath();
    gameContext.arc(head.x, head.y, 8, 0, Math.PI * 2);
    gameContext.moveTo(bodyTop.x, bodyTop.y);
    gameContext.lineTo(hipCenter.x, hipCenter.y);
    gameContext.moveTo(leftShoulder.x, leftShoulder.y);
    gameContext.lineTo(rightShoulder.x, rightShoulder.y);
    gameContext.moveTo(leftHip.x, leftHip.y);
    gameContext.lineTo(rightHip.x, rightHip.y);
    gameContext.stroke();

    drawJointedLine([leftShoulder, leftElbow, leftHand]);
    drawJointedLine([rightShoulder, rightElbow, rightHand]);
    drawJointedLine([leftHip, leftKnee, leftFoot]);
    drawJointedLine([rightHip, rightKnee, rightFoot]);

    if (isNeo || options.agent) {
        [leftElbow, rightElbow, leftKnee, rightKnee].forEach((joint) => drawJoint(joint));
    }

    if (isNeo && !options.phone) {
        drawNeoGun(rightHand, options.attack === "shoot");
    }

    if (options.phone) {
        drawPhoneHandset(rightHand);
    }

    if (options.agent) {
        gameContext.beginPath();
        gameContext.moveTo(-7, head.y - 2);
        gameContext.lineTo(7, head.y - 2);
        gameContext.moveTo(-11, bodyTop.y + 3);
        gameContext.lineTo(11, bodyTop.y + 3);
        gameContext.stroke();
    }

    if (options.redDress) {
        gameContext.strokeStyle = options.dressColor;
        gameContext.shadowColor = options.dressColor;
        gameContext.beginPath();
        gameContext.moveTo(bodyTop.x, bodyTop.y + 1);
        gameContext.lineTo(-14, hipCenter.y + 18);
        gameContext.lineTo(14, hipCenter.y + 18);
        gameContext.closePath();
        gameContext.stroke();
    }

    gameContext.restore();
}

function drawNeoGun(hand, isShooting) {
    const gunLength = isShooting ? 18 : 13;
    const muzzleX = hand.x + gunLength;

    gameContext.beginPath();
    gameContext.moveTo(hand.x - 2, hand.y);
    gameContext.lineTo(muzzleX, hand.y);
    gameContext.moveTo(hand.x + 2, hand.y);
    gameContext.lineTo(hand.x + 2, hand.y + 7);
    gameContext.moveTo(muzzleX - 3, hand.y);
    gameContext.lineTo(muzzleX + 3, hand.y - 2);
    gameContext.stroke();

    if (!isShooting) {
        return;
    }

    gameContext.beginPath();
    gameContext.moveTo(muzzleX + 4, hand.y);
    gameContext.lineTo(muzzleX + 12, hand.y);
    gameContext.moveTo(muzzleX + 6, hand.y - 4);
    gameContext.lineTo(muzzleX + 11, hand.y - 8);
    gameContext.moveTo(muzzleX + 6, hand.y + 4);
    gameContext.lineTo(muzzleX + 11, hand.y + 8);
    gameContext.stroke();
}

function drawPhoneHandset(hand) {
    gameContext.beginPath();
    gameContext.arc(hand.x, hand.y, 5, -0.8, 2.2);
    gameContext.moveTo(hand.x - 4, hand.y + 3);
    gameContext.lineTo(hand.x + 3, hand.y - 4);
    gameContext.stroke();
}

function drawGameHud() {
    const player = gameState.player;
    const progress = Math.min(100, Math.floor((player.x / gameState.finishX) * 100));

    gameContext.shadowBlur = 0;
    gameContext.fillStyle = "rgba(125, 255, 135, 0.92)";
    gameContext.font = '16px "Orbitron", monospace';
    gameContext.fillText(`${progress}%`, gameState.width - 72, 34);
}

// Axis-aligned bounding-box collision: true when two rectangles overlap.
function rectsOverlap(first, second) {
    return (
        first.x < second.x + second.width
        && first.x + first.width > second.x
        && first.y < second.y + second.height
        && first.y + first.height > second.y
    );
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Pull the most math-looking substring out of a sentence before evaluating it.
function extractMathExpression(text) {
    const normalizedText = text
        .replace(/[xX]/g, "*")
        .replace(/÷/g, "/")
        .replace(/×/g, "*")
        .replace(/−/g, "-");

    const candidates = normalizedText
        .split(/[^0-9+\-*/().%\s]/)
        .map((candidate) => candidate.trim())
        .filter(Boolean)
        .filter((candidate) => /\d/.test(candidate));

    const validCandidates = candidates
        .map((candidate) => {
            try {
                const result = evaluateMathExpression(candidate);

                return {
                    expression: candidate,
                    result,
                    score: scoreExpression(candidate),
                };
            } catch {
                return null;
            }
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);

    if (!validCandidates.length) {
        throw new Error("I cannot read that equation yet");
    }

    return validCandidates[0].expression;
}

// Longer expressions with more math operators win when multiple candidates are found.
function scoreExpression(expression) {
    const operatorCount = (expression.match(/[+\-*/%]/g) || []).length;
    const groupingCount = (expression.match(/[()]/g) || []).length;

    return expression.length + operatorCount * 10 + groupingCount * 4;
}

// Operator table keeps precedence and behavior in one place for the parser/evaluator.
const operators = {
    "+": { precedence: 1, calculate: (a, b) => a + b },
    "-": { precedence: 1, calculate: (a, b) => a - b },
    "*": { precedence: 2, calculate: (a, b) => a * b },
    "/": {
        precedence: 2,
        calculate: (a, b) => {
            if (b === 0) {
                throw new Error("Division by zero");
            }
            return a / b;
        },
    },
};

function evaluateMathExpression(expression) {
    // Pipeline: raw expression -> tokens -> postfix notation -> numeric result.
    const tokens = tokenize(expression);
    const postfix = toPostfix(tokens);
    const result = evaluatePostfix(postfix);

    if (!Number.isFinite(result)) {
        throw new Error("Result is not a finite number");
    }

    return result;
}

// Converts a string like "-2 * (3 + 4)" into numbers/operators/parentheses.
function tokenize(expression) {
    const tokens = [];
    let index = 0;
    let expectingNumber = true;

    while (index < expression.length) {
        const char = expression[index];

        if (/\s/.test(char)) {
            index++;
            continue;
        }

        if (char === "(") {
            tokens.push(char);
            index++;
            expectingNumber = true;
            continue;
        }

        if (char === ")") {
            tokens.push(char);
            index++;
            expectingNumber = false;
            continue;
        }

        if (char === "-" && expectingNumber && expression[index + 1] === "(") {
            tokens.push(0, "-");
            index++;
            continue;
        }

        if (isNumberStart(expression, index, expectingNumber)) {
            const { value, nextIndex } = readNumber(expression, index);
            tokens.push(value);
            index = nextIndex;
            expectingNumber = false;
            continue;
        }

        if (char === "%") {
            if (expectingNumber || typeof tokens[tokens.length - 1] !== "number") {
                throw new Error("Percent must follow a number");
            }

            tokens[tokens.length - 1] = tokens[tokens.length - 1] / 100;
            index++;
            expectingNumber = false;
            continue;
        }

        if (operators[char]) {
            if (expectingNumber) {
                throw new Error(`Unexpected operator "${char}"`);
            }

            tokens.push(char);
            index++;
            expectingNumber = true;
            continue;
        }

        throw new Error(`Unexpected character "${char}"`);
    }

    if (!tokens.length) {
        throw new Error("No equation found");
    }

    if (expectingNumber) {
        throw new Error("Expression cannot end with an operator");
    }

    return tokens;
}

// Determines whether the current character can begin a number, including unary minus.
function isNumberStart(expression, index, expectingNumber) {
    const char = expression[index];
    const nextChar = expression[index + 1];

    return /[0-9.]/.test(char) || (char === "-" && expectingNumber && /[0-9.]/.test(nextChar));
}

// Reads a full number from the expression and returns both the value and next string index.
function readNumber(expression, startIndex) {
    let index = startIndex;
    let numberText = "";

    if (expression[index] === "-") {
        numberText += "-";
        index++;
    }

    while (index < expression.length && /[0-9.]/.test(expression[index])) {
        numberText += expression[index];
        index++;
    }

    if ((numberText.match(/\./g) || []).length > 1 || numberText === "." || numberText === "-.") {
        throw new Error("Invalid decimal number");
    }

    return {
        value: Number(numberText),
        nextIndex: index,
    };
}

// Shunting-yard algorithm: changes infix math into postfix so evaluation is simple.
function toPostfix(tokens) {
    const output = [];
    const stack = [];

    tokens.forEach((token) => {
        if (typeof token === "number") {
            output.push(token);
            return;
        }

        if (operators[token]) {
            while (
                operators[stack[stack.length - 1]]
                && operators[stack[stack.length - 1]].precedence >= operators[token].precedence
            ) {
                output.push(stack.pop());
            }

            stack.push(token);
            return;
        }

        if (token === "(") {
            stack.push(token);
            return;
        }

        if (token === ")") {
            while (stack.length && stack[stack.length - 1] !== "(") {
                output.push(stack.pop());
            }

            if (stack.pop() !== "(") {
                throw new Error("Mismatched parentheses");
            }
        }
    });

    while (stack.length) {
        const token = stack.pop();

        if (token === "(" || token === ")") {
            throw new Error("Mismatched parentheses");
        }

        output.push(token);
    }

    return output;
}

// Evaluates postfix notation with a stack. Each operator consumes the last two numbers.
function evaluatePostfix(postfixTokens) {
    const stack = [];

    postfixTokens.forEach((token) => {
        if (typeof token === "number") {
            stack.push(token);
            return;
        }

        const right = stack.pop();
        const left = stack.pop();

        if (left === undefined || right === undefined) {
            throw new Error("Invalid expression");
        }

        stack.push(operators[token].calculate(left, right));
    });

    if (stack.length !== 1) {
        throw new Error("Invalid expression");
    }

    return stack[0];
}

// Keep output readable by trimming floating-point noise.
function formatResult(result) {
    return Number.parseFloat(result.toFixed(12)).toString();
}

// Small test hook so browser/devtools tests can exercise the calculator parser directly.
window.theCalculator = {
    evaluateMathExpression,
    extractMathExpression,
};
