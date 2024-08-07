
let midiAccess = null;
let midiOutput = null;
let gamepadIndex = null;
let pitchBendValue = 8192; // Center pitch bend
let sustainPedalValue = 0; // Sustain pedal value (0 = off, 127 = on)
let midiInput = null;

async function connectMIDI() {
    try {
        midiAccess = await navigator.requestMIDIAccess();
        const outputs = Array.from(midiAccess.outputs.values());
        const inputs = Array.from(midiAccess.inputs.values());

        if (outputs.length > 0) {
            midiOutput = outputs[0]; // Get the first available output
            document.getElementById('status').textContent = 'Status: MIDI connected';
        } else {
            document.getElementById('status').textContent = 'Status: No MIDI output devices found';
        }

        if (inputs.length > 0) {
            midiInput = inputs[0]; // Get the first available input
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
        const joystickY = gamepads[gamepadIndex].axes[1]; // Y-axis of the left joystick

        // Log joystick Y-axis value
        console.log(`Joystick Y-axis: ${joystickY}`);

        // Invert the joystick Y-axis mapping for pitch bend
        // Joystick value range is typically from -1 to 1
        // Map [-1, 1] to [0, 16383]
        let newPitchBendValue = Math.floor((1 - joystickY) * 8192); // Swap range [-1, 1] to [0, 16383]

        // Cap the pitch bend value to be within the MIDI range
        newPitchBendValue = Math.max(0, Math.min(16383, newPitchBendValue));

        // Only send a pitch bend message if the value has changed
        if (pitchBendValue !== newPitchBendValue) {
            pitchBendValue = newPitchBendValue;

            if (midiOutput) {
                const lsb = pitchBendValue & 0x7F; // Least significant byte
                const msb = (pitchBendValue >> 7) & 0x7F; // Most significant byte
                midiOutput.send([0xE0, lsb, msb]); // Channel 1 Pitch Bend
            }
        }
    }
}

function handleMIDIMessage(message) {
    const [status, note, velocity] = message.data;
    console.log(`MIDI Message: ${message.data}`);

    if (status === 0x90 && velocity > 0) {
        // Note on
        if (midiOutput) {
            midiOutput.send([status, note, velocity]);
        }
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
        // Note off
        if (midiOutput) {
            midiOutput.send([status, note, 0]);
        }
    } else if (status === 0xB0) {
        // Control Change (for sustain pedal or other controls)
        if (note === 0x40) { // Sustain pedal (CC 64)
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