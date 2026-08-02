const matrixCanvas = document.querySelector("#matrixWallpaper");
const transcript = document.querySelector("#transcript");
const promptForm = document.querySelector("#promptForm");
const calculatorInput = document.querySelector("#calculatorInput");
const matrixContext = matrixCanvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const bootMessages = [
    "Wake up, Neo...",
    "The Matrix has you...",
    "Follow the equation.",
    "Type a calculation, then press =",
];
const incomingTypingDelay = 55;
const answerTypingDelay = 42;
let isPromptReady = false;

const matrixGlyphGroups = [
    { start: 0x30A0, end: 0x30FF },
    { start: 0xFF66, end: 0xFF9D },
    { start: 0x0030, end: 0x0039 },
    { start: 0x0041, end: 0x005A },
];
let matrixStreams = [];
let matrixAnimationFrame;
let lastMatrixFrameTime = 0;
const targetFrameRate = 60;
const baseFadeAlpha = 0.43;

function randomMatrixGlyph() {
    const group = matrixGlyphGroups[Math.floor(Math.random() * matrixGlyphGroups.length)];
    const codePoint = group.start + Math.floor(Math.random() * (group.end - group.start + 1));

    return String.fromCharCode(codePoint);
}

function createMatrixStream(x, width, height) {
    const fontSize = randomBetween(9, 19);
    const trailLength = randomTrailLength();
    const glyphStep = fontSize * randomBetween(1.28, 1.85);
    const gapChance = randomBetween(0.04, 0.2);

    return {
        x,
        y: randomBetween(-height, height),
        fontSize,
        speed: randomBetween(190, 750),
        trailLength,
        glyphStep,
        opacity: randomBetween(0.32, 1),
        blur: randomBetween(0.4, 4.5),
        glyphs: Array.from({ length: trailLength }, randomMatrixGlyph),
        visibleSlots: Array.from({ length: trailLength }, (_, index) => index < 4 || Math.random() > gapChance),
        mutateRate: randomBetween(0.025, 0.12),
    };
}

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

function seedMatrixStreams(width, height) {
    const streamCount = Math.ceil(width / 4.15);
    const columnWidth = width / streamCount;

    matrixStreams = Array.from({ length: streamCount }, (_, index) => {
        const x = index * columnWidth + randomBetween(-5, 8);

        return createMatrixStream(x, width, height);
    });
}

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

function getMatrixDeltaSeconds(timestamp) {
    if (!lastMatrixFrameTime) {
        lastMatrixFrameTime = timestamp;
        return 1 / targetFrameRate;
    }

    const deltaSeconds = (timestamp - lastMatrixFrameTime) / 1000;
    lastMatrixFrameTime = timestamp;

    return Math.min(Math.max(deltaSeconds, 1 / 144), 0.05);
}

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

function startMatrixRain() {
    resizeMatrixCanvas();
    lastMatrixFrameTime = performance.now();

    if (prefersReducedMotion) {
        drawMatrixRain(lastMatrixFrameTime);
        cancelAnimationFrame(matrixAnimationFrame);
        return;
    }

    matrixAnimationFrame = requestAnimationFrame(drawMatrixRain);
}

window.addEventListener("resize", resizeMatrixCanvas);

function typeBootMessages() {
    let messageIndex = 0;

    function typeNextMessage() {
        if (messageIndex >= bootMessages.length) {
            revealPrompt();
            return;
        }

        typeTranscriptLine(bootMessages[messageIndex], "incoming", () => {
            messageIndex++;
            setTimeout(typeNextMessage, 420);
        });
    }

    typeNextMessage();
}

function typeTranscriptLine(text, className = "", onComplete = () => {}) {
    const line = document.createElement("p");
    line.className = `line ${className}`.trim();
    transcript.appendChild(line);

    typeIntoLine(line, text, incomingTypingDelay, () => {
        transcript.scrollTop = transcript.scrollHeight;
        onComplete();
    });
}

function typeIntoLine(line, text, delay, onComplete = () => {}) {
    let index = 0;

    function typeCharacter() {
        if (index < text.length) {
            line.textContent = text.slice(0, index + 1);
            index++;
            setTimeout(typeCharacter, delay);
            return;
        }

        onComplete();
    }

    typeCharacter();
}

function revealPrompt() {
    isPromptReady = true;
    promptForm.classList.remove("is-hidden");
    calculatorInput.disabled = false;
    calculatorInput.focus();
}

function hidePrompt() {
    isPromptReady = false;
    promptForm.classList.add("is-hidden");
    calculatorInput.disabled = true;
}

promptForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

calculatorInput.addEventListener("keydown", (event) => {
    if (event.key === "=") {
        event.preventDefault();
        runCalculation();
    }

    if (event.key === "Escape") {
        calculatorInput.value = "";
    }
});

document.addEventListener("click", () => {
    if (isPromptReady) {
        calculatorInput.focus();
    }
});

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

function displayCalculationExchange(typedText, answerText, answerClass) {
    const exchange = document.createElement("section");
    const equationLine = document.createElement("p");
    const answerLine = document.createElement("p");

    exchange.className = "exchange";
    equationLine.className = "line equation";
    equationLine.textContent = `> ${typedText} =`;
    answerLine.className = `line answer ${answerClass}`.trim();

    exchange.append(equationLine, answerLine);
    transcript.appendChild(exchange);
    exchange.style.minHeight = `${transcript.clientHeight + equationLine.offsetHeight + 16}px`;
    scrollAnswerIntoView(answerLine);

    typeIntoLine(answerLine, answerText, answerTypingDelay, () => {
        scrollAnswerIntoView(answerLine);
        revealPrompt();
    });
}

function scrollAnswerIntoView(answerLine) {
    const answerTop = answerLine.offsetTop - transcript.offsetTop;

    transcript.scrollTop = Math.max(0, answerTop - 4);
}

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

function scoreExpression(expression) {
    const operatorCount = (expression.match(/[+\-*/%]/g) || []).length;
    const groupingCount = (expression.match(/[()]/g) || []).length;

    return expression.length + operatorCount * 10 + groupingCount * 4;
}

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
    const tokens = tokenize(expression);
    const postfix = toPostfix(tokens);
    const result = evaluatePostfix(postfix);

    if (!Number.isFinite(result)) {
        throw new Error("Result is not a finite number");
    }

    return result;
}

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

function isNumberStart(expression, index, expectingNumber) {
    const char = expression[index];
    const nextChar = expression[index + 1];

    return /[0-9.]/.test(char) || (char === "-" && expectingNumber && /[0-9.]/.test(nextChar));
}

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

function formatResult(result) {
    return Number.parseFloat(result.toFixed(12)).toString();
}

startMatrixRain();
typeBootMessages();

window.theCalculator = {
    evaluateMathExpression,
    extractMathExpression,
};
