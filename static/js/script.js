document.addEventListener('DOMContentLoaded', () => {
    const textModeBtn = document.getElementById('text-mode-btn');
    const voiceModeBtn = document.getElementById('voice-mode-btn');
    const textInputContainer = document.getElementById('text-input-container');
    const voiceInputContainer = document.getElementById('voice-input-container');
    const responseArea = document.getElementById('response-area');
    const promptInput = document.getElementById('prompt-input');
    const sendButton = document.getElementById('send-button');
    const voiceButton = document.getElementById('voice-button');
    const stopButton = document.getElementById('stop-button');
    const menuIcon = document.getElementById('menu-icon');
    const sideMenu = document.getElementById('side-menu');
    const overlay = document.getElementById('overlay');
    const personaButtons = document.querySelectorAll('.persona-btn');
    
    let currentPersona = 'empathetic';
    
    function closeMenu() {
        sideMenu.classList.remove('open');
        overlay.classList.remove('active');
    }

    menuIcon.addEventListener('click', () => {
        sideMenu.classList.toggle('open');
        overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', closeMenu);

    personaButtons.forEach(button => {
        button.addEventListener('click', () => {
            personaButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentPersona = button.getAttribute('data-persona');
            closeMenu();
        });
    });
    document.querySelector('.persona-btn[data-persona="empathetic"]').classList.add('active');

    promptInput.addEventListener('input', () => {
        promptInput.style.height = 'auto';
        promptInput.style.height = `${promptInput.scrollHeight}px`;
    });

    let isListening = false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    function setupRecognition() {
        if (!SpeechRecognition || recognition) return;

        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.speechEndTimeout = 1000,
        recognition.silenceTimeout = 2000;

        recognition.onstart = () => {
            voiceButton.innerHTML = `<span class="mic-icon">🎙️</span> Listening...`;
            voiceButton.classList.add('listening');
        };
        
        recognition.onresult = async (event) => {
            voiceButton.classList.remove('listening');
            const transcript = event.results[0][0].transcript;
            const aiResponse = await sendToServer(transcript);
            speak(aiResponse);
        };

        recognition.onerror = (event) => {
            if (event.error === 'no-speech') {
                responseArea.textContent = "I didn't hear anything, please try speaking again.";
                if (isListening) setTimeout(() => recognition.start(), 500); 
            } else if (event.error === 'not-allowed') {
                responseArea.textContent = "Microphone access was denied. Please allow access in your browser settings to use voice mode.";
                stopVoice();
            } else {
                responseArea.textContent = `Recognition Error: ${event.error}`;
                stopVoice();
            }
        };
    }

    const toggleContainer = document.querySelector('.toggle-container');

    textModeBtn.addEventListener('click', () => {
        textModeBtn.classList.add('active');
        voiceModeBtn.classList.remove('active');
        toggleContainer.classList.remove('voice-active');
        textInputContainer.classList.remove('hidden');
        voiceInputContainer.classList.add('hidden');
        stopVoice();
        responseArea.textContent = 'Type a message to begin.';
    });

    voiceModeBtn.addEventListener('click', () => {
        if (!SpeechRecognition) {
            responseArea.textContent = "Sorry, your browser doesn't support voice recognition.";
            return;
        }
        
        setupRecognition();
        
        voiceModeBtn.classList.add('active');
        textModeBtn.classList.remove('active');
        toggleContainer.classList.add('voice-active');
        voiceInputContainer.classList.remove('hidden');
        textInputContainer.classList.add('hidden');
        responseArea.textContent = 'Click the microphone to start.';
    });

    async function sendToServer(prompt) {
        try {
            const response = await fetch('/process_rant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: prompt,
                    persona: currentPersona
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Server error');
            return data.response;
        } catch (error)
        {
            console.error(error);
            return `Error: ${error.message}`;
        }
    }

    sendButton.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        if (!prompt) return;

        sendButton.disabled = true;
        const aiResponse = await sendToServer(prompt);
        responseArea.textContent = aiResponse;
        responseArea.classList.add('fade-in');
        promptInput.value = '';
        promptInput.style.height = 'auto';
        sendButton.disabled = false;
    });

    function speak(text) {
        if (recognition) recognition.stop();
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        responseArea.textContent = text;
        responseArea.classList.add('fade-in');
        utterance.onend = () => {
            if (isListening) {
                recognition.start();
            }
        };
        window.speechSynthesis.speak(utterance);
    }

    function stopVoice() {
        isListening = false;
        if (recognition) recognition.stop();
        voiceButton.classList.remove('listening');
        window.speechSynthesis.cancel();
        stopButton.classList.add('hidden');
        voiceButton.classList.remove('hidden');
        voiceButton.innerHTML = `<span class="mic-icon">🎙️</span> Start Listening`;
    }

    voiceButton.addEventListener('click', () => {
        isListening = true;
        voiceButton.classList.add('hidden');
        stopButton.classList.remove('hidden');
        recognition.start();
    });

    stopButton.addEventListener('click', () => {
        stopVoice();
        responseArea.textContent = 'Click the microphone to start.';
    });

    responseArea.addEventListener('animationend', () => {
        responseArea.classList.remove('fade-in');
    });
});
