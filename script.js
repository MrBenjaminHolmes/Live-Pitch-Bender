
let midiAccess = null;
let midiOutput = null;
let gamepadIndex = null;
let pitchBendValue = 8192; 
modValue = 0;
let sustainPedalValue = 0; 
let midiInput = null;

async function connectMIDI() {
    try {
        midiAccess = await navigator.requestMIDIAccess();
        const outputs = Array.from(midiAccess.outputs.values());
        const inputs = Array.from(midiAccess.inputs.values());

        if (outputs.length > 0) {
            midiOutput = outputs[0]; 
            document.getElementById('status').textContent = 'Status: MIDI connected';
        } else {
            document.getElementById('status').textContent = 'Status: No MIDI output devices found';
        }

        if (inputs.length > 0) {
            midiInput = inputs[0]; 
            midiInput.onmidimessage = handleMIDIMessage;
            document.getElementById('status').textContent += ', MIDI input connected';
        } else {
            document.getElementById('status').textContent += ', No MIDI input devices found';
        }
    } catch (error) {
        console.error('Failed to connect MIDI:', error);
        document.getElementById('status').textContent = 'Status: Error connecting MIDI';
    }
}

function connectController() {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].id.includes('Xbox')) {
            gamepadIndex = i;
            document.getElementById('status').textContent += ', Xbox controller connected';
            return;
        }
    }
    document.getElementById('status').textContent += ', No Xbox controller found';
}

function updateGamepad() {
    const gamepads = navigator.getGamepads();
    if (gamepadIndex !== null && gamepads[gamepadIndex]) {
        const joystickY = gamepads[gamepadIndex].axes[3];
        const joystickX = gamepads[gamepadIndex].buttons[7].value;
        
        let newPitchBendValue = Math.floor((1 - joystickY) * 8192); // Swap range [-1, 1] to [0, 16383]
        let newModValue = Math.floor((joystickX) * 127); // Swap range [-1, 1] to [0, 127]

        newPitchBendValue = Math.max(0, Math.min(16383, newPitchBendValue));
        newModValue = Math.max(0, Math.min(127, newModValue)); // Ensure it stays within MIDI range [0, 127]
        console.log(newModValue)
        // Send pitch bend value if it has changed
        if (pitchBendValue !== newPitchBendValue) {
            pitchBendValue = newPitchBendValue;

            if (midiOutput) {
                const lsb = pitchBendValue & 0x7F; 
                const msb = (pitchBendValue >> 7) & 0x7F;
                midiOutput.send([0xE0, lsb, msb]); 
            }
        }

        // Send modulation value if it has changed
        if (modValue !== newModValue) {
            modValue = newModValue;

            if (midiOutput) {
                const controlChangeChannel = 1; // MIDI channel (1-16), adjust as needed
                const controlChangeMessage = [0xB0 + (controlChangeChannel - 1), 1, modValue]; // Control change message, using controller number 1
                midiOutput.send(controlChangeMessage);
            }
        }
    }
}


function handleMIDIMessage(message) {
    const [status, note, velocity] = message.data;
    console.log(`MIDI Message: ${message.data}`);

    if (status === 0x90 && velocity > 0) {

        if (midiOutput) {
            midiOutput.send([status, note, velocity]);
        }
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {

        if (midiOutput) {
            midiOutput.send([status, note, 0]);
        }
    } else if (status === 0xB0) { 

        if (note === 0x40) { 
            sustainPedalValue = velocity;
            console.log(`Sustain Pedal Value: ${sustainPedalValue}`);
            // Send sustain pedal message
            if (midiOutput) {
                midiOutput.send([status, note, sustainPedalValue]);
            }
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
    gameLoop(); // Start the game loop to update gamepad state
});