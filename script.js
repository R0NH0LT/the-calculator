const matrixContainer = document.querySelector("#matrixWallpaper");
const maxCharacters = 1500; // Set a maximum number of characters on the screen
let characterCount = 0;

const calculatorInput = document.getElementById("calculatorInput");

function createFallingCharacter() {
    if (characterCount <= maxCharacters) {
        const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"; // Define the character set
        const randomChar = characters[Math.floor(Math.random() * characters.length)]; // Random character from the set

        const characterElement = document.createElement("span");
        characterElement.innerText = randomChar; // Display the random character
        characterElement.style.left = `${Math.random() * 100}%`; // Random horizontal position
        characterElement.style.animationDuration = `${Math.random() * 3 + 1}s`; // Random falling speed

        matrixContainer.appendChild(characterElement);

        // Add opacity animation to create a trail effect
        setTimeout(() => {
            characterElement.style.opacity = 0;
        }, 4000); // Adjust the delay as needed

        // Remove the number element after animation completes
        characterElement.addEventListener("animationiteration", () => {
            matrixContainer.removeChild(characterElement);
            characterCount--; // Decrease the character count when a character is removed
        });

        characterCount++; // Increase the character count when a new character is created
    } else {
        // Reset the character count to prevent excessive characters
        characterCount = 0;
        // You can also clear the container if needed: matrixContainer.innerHTML = "";
    }
    
}

setInterval(createFallingCharacter, 1); // Create new falling numbers periodically

console.log("Script loaded");

// SCRIPT FOR THE WALL PAPER ABOVE



// Add an event listener to the input element to listen for the animationend event
const inputElement = document.getElementById("calculatorInput");
inputElement.addEventListener("animationend", () => {
    // This callback function runs after the animation is complete
    typePlaceholder(inputElement, "Wake Up. . . .Time for some calculations."); // Replace with your desired placeholder text
}, { once: true }); // { once: true } ensures the event listener is only triggered once

// Start the animation for the input element
inputElement.classList.add("yourAnimationClass"); // Replace with your animation class

// Function to simulate typing of the placeholder text
function typePlaceholder(element, text) {
    let index = 0;

    function typeCharacter() {
        if (index < text.length) {
            element.setAttribute("placeholder", text.substring(0, index + 1));
            index++;
            setTimeout(typeCharacter, 100); // Adjust typing speed (in milliseconds)
        }
    }

    typeCharacter();
}






// SCRIPT FOR THE CALCULATOR

const stack = [];
const operators = {
    "+": (a, b) => a + b,
    "-": (a, b) => a - b,
    "*": (a, b) => a * b,
    "/": (a, b) => a / b,
};


// Listen for user input and evaluate expressions
calculatorInput.addEventListener("keyup", function (event) {
    if (event.key === "Enter") {
        evaluateExpression();
    }
});



