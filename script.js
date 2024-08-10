let midiAccess = null;
let midiOutput = null;
let midiInput = null;
let gamepadIndex = null;
let pitchBendValue = 8192; 
let modValue = 0;
let sustainPedalValue = 0;

const xboxConnect = document.querySelectorAll("input")[1];
const midiConnect = document.querySelectorAll("input")[0];

async function connectMIDI() {
    try {
        midiAccess = await navigator.requestMIDIAccess();
        const outputs = Array.from(midiAccess.outputs.values());
        const inputs = Array.from(midiAccess.inputs.values());

        if (outputs.length > 0) {
            midiOutput = outputs[0];
            midiConnect.checked = true;

            // Listen for MIDI messages
            if (inputs.length > 0) {
                midiInput = inputs[0];
                midiInput.onmidimessage = handleMIDIMessage;

            } else {
                console.warn('No MIDI inputs available');
            }
        } else {
            console.warn('No MIDI outputs available');
        }
    } catch (error) {
        console.error('Failed to connect to MIDI:', error);
    }
}

function connectController() {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].id.includes('Xbox')) {
            gamepadIndex = i;
            xboxConnect.checked = true;
            //console.log('Connected to Xbox controller:', gamepads[i]);
            return;
        }
    }
    console.warn('No Xbox controller found');
}

function updateGamepad() {
    const gamepads = navigator.getGamepads();
    if (gamepadIndex !== null && gamepads[gamepadIndex]) {
        const joystickY = gamepads[gamepadIndex].axes[3]; // Left stick vertical axis
        const joystickX = gamepads[gamepadIndex].axes[2]; // Left stick horizontal axis
        const rightTrigger = gamepads[gamepadIndex].buttons[7].value; // Right trigger value

        let newPitchBendValue = Math.floor((1 - joystickY) * 8192); // Convert range [-1, 1] to [0, 16383]
        let newModValue = Math.floor(rightTrigger * 127); // Convert range [0, 1] to [0, 127]

        newPitchBendValue = Math.max(0, Math.min(16383, newPitchBendValue));
        newModValue = Math.max(0, Math.min(127, newModValue));

        if (pitchBendValue !== newPitchBendValue) {
            pitchBendValue = newPitchBendValue;
            if (midiOutput) {
                const lsb = pitchBendValue & 0x7F;
                const msb = (pitchBendValue >> 7) & 0x7F;
                midiOutput.send([0xE0, lsb, msb]);
            }

            // Update pointer position in the pitch grid
            const pointer = document.getElementById('pointer');
            const pitchGrid = document.getElementById('pitchGrid');
            const yPos = (joystickY + 1) * (pitchGrid.clientHeight / 2); 
            const xPos = (joystickX + 1) * (pitchGrid.clientWidth / 2); // Calculate X position
            pointer.style.top = `${yPos}px`;
            pointer.style.left = `${xPos}px`; // Update pointer's X position
        }

        if (modValue !== newModValue) {
            modValue = newModValue;
            if (midiOutput) {
                const controlChangeMessage = [0xB0, 1, modValue];
                midiOutput.send(controlChangeMessage);
            }

            // Update modulation slider
            const modSlider = document.getElementById('modSlider');
            modSlider.value = modValue;
        }
    }
}

function handleMIDIMessage(message) {
    const [status, note, velocity] = message.data;
    //console.log(`MIDI Message Received: ${message.data}`);

    if (status === 0x90 && velocity > 0) {
        if (midiOutput) {
            midiOutput.send([status, note, velocity]);
            //console.log('Sent Note On:', [status, note, velocity]);
        }
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
        if (midiOutput) {
            midiOutput.send([status, note, 0]);
            //console.log('Sent Note Off:', [status, note, 0]);
        }
    } else if (status === 0xB0 && note === 0x40) { // Sustain pedal
        sustainPedalValue = velocity;
        if (midiOutput) {
            midiOutput.send([status, note, sustainPedalValue]);
            //console.log('Sent Sustain Pedal:', [status, note, sustainPedalValue]);
        }
    }
}

function gameLoop() {
    updateGamepad();
    requestAnimationFrame(gameLoop);
}

document.getElementById('connect').addEventListener('click', async () => {
    await connectMIDI();
    connectController();
    gameLoop();
});
