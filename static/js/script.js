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
    const instructionsModal = document.getElementById('instructions-modal');
    const modalText = document.getElementById('modal-text');
    const modalCloseBtn = document.querySelector('.modal-close-btn');
    const deconstructRantBtn = document.getElementById('deconstruct-rant-btn');
    const mindMapContainer = document.getElementById('mind-map-container');
    const featureButtonsContainer = document.getElementById('feature-buttons-container');
    const fitViewBtn = document.getElementById('fit-view-btn');

    let currentPersona = 'empathetic';
    let isListening = false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let mindMapNetwork = null;

    const mainInstructions = `
        <h3>Welcome to RANT.AI</h3>
        <p>This is a private, ephemeral space to speak or type freely. Nothing is saved.</p>
        <p><strong>Text Mode:</strong> Simply type your thoughts below and press enter on your keyboard or press the <span class="highlight">"SEND"</span> button.</p>
        <p>Use the menu icon on the top left of the screen to select a different AI persona at any time.</p>
    `;

    const voiceInstructions = `
        <h3>Welcome to RANT.AI</h3>
        <p><strong>Voice Mode:</strong> Click <span class="highlight">"START RANTING!"</span> to start a continuous, hands-free conversation.</p>
        <p>The AI will listen, respond, and then listen again automatically. Press <span class="highlight">"STOP RANTING!"</span> to stop the session.</p>
    `;

    const deconstructInstructions = `
        <h3>RANT HIGHLIGHT!</h3>
        <p>You can now visually explore your thoughts.</p>
        <p><strong>Deconstruct:</strong> Click <span class="highlight">"DECONSTRUCT"</span> to turn your conversation into an interactive mind map.</p>
        <p><strong>Center Map:</strong> Use <span class="highlight">"CENTER MAP"</span> to perfectly fit the entire mind map into view at any time.</p>
    `;

    function showModal(content) {
        modalText.innerHTML = content;
        instructionsModal.classList.add('open');
        overlay.classList.add('active');
    }

    function closeModal() {
        instructionsModal.classList.remove('open');
        if (!sideMenu.classList.contains('open')) {
            overlay.classList.remove('active');
        }
    }

    modalCloseBtn.addEventListener('click', closeModal);
    updateWelcomeMessage(currentPersona);

    if (!sessionStorage.getItem('hasVisited')) {
        showModal(mainInstructions);
        sessionStorage.setItem('hasVisited', 'true');
    } else {
        updateWelcomeMessage(currentPersona);
    }

    function closeMenu() {
        sideMenu.classList.remove('open');
        if (!instructionsModal.classList.contains('open')) {
            overlay.classList.remove('active');
        }
    }

    menuIcon.addEventListener('click', () => {
        sideMenu.classList.toggle('open');
        overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
        closeMenu();
        closeModal();
    });

    personaButtons.forEach(button => {
        button.addEventListener('click', () => {
            personaButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentPersona = button.getAttribute('data-persona');
            updateWelcomeMessage(currentPersona);
            closeMenu();
        });
    });

    function updateWelcomeMessage(persona) {
        let message = "Welcome to RANT.AI! This is a private space to speak or type freely. I'm here to listen.";
        if (persona === 'stoic') {
            message = "Greetings. This is a space for reflection. The path to tranquility is open. I am here to listen.";
        } else if (persona === 'motivator') {
            message = "Let's go! This is your space to unload and power up. I'm here to help you crush it!";
        } else if (persona === 'curious') {
            message = "Hello. What's on your mind? This is a safe space to explore your thoughts. I'm here to listen.";
        }
        responseArea.textContent = message;
    }

    document.querySelector('.persona-btn[data-persona="empathetic"]').classList.add('active');

    promptInput.addEventListener('input', () => {
        promptInput.style.height = 'auto';
        promptInput.style.height = `${promptInput.scrollHeight}px`;
    });

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendButton.click();
        }
    });

    function setupRecognition() {
        if (!SpeechRecognition || recognition) return;

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            const aiResponse = await sendToServer(transcript);
            featureButtonsContainer.classList.remove('hidden');
            if (!sessionStorage.getItem('hasSeenDeconstructIntro')) {
                showModal(deconstructInstructions);
                sessionStorage.setItem('hasSeenDeconstructIntro', 'true');
            }
            speak(aiResponse);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
        };
    }

    textModeBtn.addEventListener('click', () => {
        textModeBtn.classList.add('active');
        voiceModeBtn.classList.remove('active');
        textInputContainer.classList.remove('hidden');
        voiceInputContainer.classList.add('hidden');
        stopVoice();
    });

    voiceModeBtn.addEventListener('click', () => {
        if (!SpeechRecognition) {
            responseArea.textContent = "Sorry, your browser doesn't support voice recognition.";
            return;
        }
        if (!sessionStorage.getItem('hasSeenVoiceIntro')) {
            showModal(voiceInstructions);
            sessionStorage.setItem('hasSeenVoiceIntro', 'true');
        }
        setupRecognition();
        voiceModeBtn.classList.add('active');
        textModeBtn.classList.remove('active');
        voiceInputContainer.classList.remove('hidden');
        textInputContainer.classList.add('hidden');
    });

    async function sendToServer(prompt) {
        try {
            const response = await fetch('/process_rant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    persona: currentPersona
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Server error');
            return data.response;
        } catch (error) {
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
        featureButtonsContainer.classList.remove('hidden');
        if (!sessionStorage.getItem('hasSeenDeconstructIntro')) {
            showModal(deconstructInstructions);
            sessionStorage.setItem('hasSeenDeconstructIntro', 'true');
        }
    });

    function speak(text) {
        if (recognition && isListening) recognition.stop();
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        responseArea.textContent = text;

        utterance.onend = () => {
            if (isListening && recognition) {
                recognition.start();
            }
        };
        window.speechSynthesis.speak(utterance);
    }

    function stopVoice() {
        isListening = false;
        if (recognition) recognition.stop();
        window.speechSynthesis.cancel();
        stopButton.classList.add('hidden');
        voiceButton.classList.remove('hidden');
    }

    voiceButton.addEventListener('click', () => {
        isListening = true;
        voiceButton.classList.add('hidden');
        stopButton.classList.remove('hidden');
        recognition.start();
    });

    stopButton.addEventListener('click', stopVoice);

    responseArea.addEventListener('animationend', () => {
        responseArea.classList.remove('fade-in');
    });

    function drawMindMap(data) {
        const container = mindMapContainer;
        let lastResponseAreaText = ''
        const options = {
            physics: {
                solver: 'forceAtlas2Based',
                forceAtlas2Based: {
                    gravitationalConstant: -100,
                    centralGravity: 0.015,
                    springLength: 150,
                    springConstant: 0.1,
                    avoidOverlap: 0.6
                },
                stabilization: {
                    iterations: 150
                }
            },
            interaction: {
                hover: true,
                dragNodes: true,
                dragView: true,
                zoomView: true,
                minZoom: 0.5,
                maxZoom: 1.0
            },
            nodes: {
                borderWidth: 3,
                shape: "box",
                scaling: { label: { enabled: true, min: 14, max: 30 } },
                font: {
                    size: 16,
                    face: "Poppins",
                    color: "#e0e0e0"
                },
                shadow: {
                    enabled: true,
                    color: 'rgba(0,0,0,0.5)',
                    size: 10,
                    x: 5,
                    y: 5
                },
                color: {
                    border: '#007bff',
                    background: '#1e1e1e',
                    highlight: {
                        border: '#8A2BE2',
                        background: '#1e1e1e'
                    },
                    hover: {
                        border: '#8A2BE2',
                        background: '#1e1e1e'
                    }
                }
            },
            edges: {
                width: 2,
                color: {
                    color: '#555',
                    highlight: '#8A2BE2',
                    hover: '#8A2Be2'
                },
                arrows: {
                    to: {
                        enabled: true,
                        scaleFactor: 0.8
                    }
                },
                font: {
                    align: 'middle',
                    size: 12,
                    color: '#e0e0e0',
                    strokeWidth: 0,
                    background: '#1e1e1e'
                },
                smooth: {
                    type: 'dynamic'
                },
                shadow: {
                    enabled: true,
                    color: 'rgba(0,0,0,0.3)'
                }
            }
        };

        container.style.display = 'block';
        mindMapNetwork = new vis.Network(container, data, options);

        mindMapNetwork.on("stabilizationIterationsDone", function() {
            mindMapNetwork.setOptions({
                physics: false
            });
        });

        mindMapNetwork.on("hoverNode", function(params) {
            const node = this.body.data.nodes.get(params.node);
            lastResponseAreaText = responseArea.textContent;
            responseArea.textContent = node.hoverQuestion;
        });

        mindMapNetwork.on("blurNode", function() {
            responseArea.textContent = lastResponseAreaText;
        });
    }

    deconstructRantBtn.addEventListener('click', async () => {
        const originalButtonText = deconstructRantBtn.innerHTML;
        deconstructRantBtn.innerHTML = 'Analyzing...';
        deconstructRantBtn.disabled = true;
        fitViewBtn.classList.add('hidden');
        mindMapContainer.style.display = 'block';
        mindMapContainer.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--secondary-text-color);">Untangling your thoughts...</p>';

        try {
            const response = await fetch('/generate_mind_map', {
                method: 'POST'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to generate mind map.');
            drawMindMap(data);
            fitViewBtn.classList.remove('hidden');
        } catch (error) {
            console.error('Mind map generation failed:', error);
            mindMapContainer.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--danger-color);">${error.message}</p>`;
        } finally {
            deconstructRantBtn.innerHTML = originalButtonText;
            deconstructRantBtn.disabled = false;
        }
    });

    fitViewBtn.addEventListener('click', () => {
        if (mindMapNetwork) {
            mindMapNetwork.fit();
        }
    });
});
