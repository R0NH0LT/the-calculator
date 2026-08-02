const matrixContainer = document.querySelector("#matrixWallpaper");
const transcript = document.querySelector("#transcript");
const promptForm = document.querySelector("#promptForm");
const calculatorInput = document.querySelector("#calculatorInput");
const maxCharacters = 260;
let characterCount = 0;

const bootMessages = [
    "Wake up, Neo...",
    "The Matrix has you...",
    "Follow the equation.",
    "Type a calculation, then press =",
];

function createFallingCharacter() {
    if (!matrixContainer || characterCount >= maxCharacters) {
        return;
    }

    const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randomChar = characters[Math.floor(Math.random() * characters.length)];
    const characterElement = document.createElement("span");

    characterElement.innerText = randomChar;
    characterElement.style.left = `${Math.random() * 100}%`;
    characterElement.style.animationDuration = `${Math.random() * 3 + 2}s`;
    characterElement.style.opacity = `${Math.random() * 0.55 + 0.3}`;

    matrixContainer.appendChild(characterElement);
    characterCount++;

    characterElement.addEventListener("animationend", () => {
        characterElement.remove();
        characterCount--;
    }, { once: true });
}

setInterval(createFallingCharacter, 35);

function typeBootMessages() {
    let messageIndex = 0;

    function typeNextMessage() {
        if (messageIndex >= bootMessages.length) {
            calculatorInput.focus();
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

    let index = 0;

    function typeCharacter() {
        if (index < text.length) {
            line.textContent = text.slice(0, index + 1);
            index++;
            transcript.scrollTop = transcript.scrollHeight;
            setTimeout(typeCharacter, 55);
            return;
        }

        onComplete();
    }

    typeCharacter();
}

function addTranscriptLine(text, className = "") {
    const line = document.createElement("p");
    line.className = `line ${className}`.trim();
    line.textContent = text;
    transcript.appendChild(line);
    transcript.scrollTop = transcript.scrollHeight;
}

promptForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runCalculation();
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
    calculatorInput.focus();
});

function runCalculation() {
    const typedText = calculatorInput.value.trim();

    if (!typedText) {
        return;
    }

    calculatorInput.value = "";

    try {
        const expression = extractMathExpression(typedText);
        const result = evaluateMathExpression(expression);
        addTranscriptLine(`> ${typedText} = ${formatResult(result)}`, "calculation");
    } catch (error) {
        addTranscriptLine(`> ${typedText} = ${error.message}`, "error");
    }
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

typeBootMessages();

window.theCalculator = {
    evaluateMathExpression,
    extractMathExpression,
};
