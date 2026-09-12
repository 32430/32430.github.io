"use strict";

/*
 * =========================================================
 * MIDI
 * =========================================================
 *
 * @tonejs/midi をES Moduleとして読み込む
 *
 */

import { Midi } from "https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.28/+esm";


/*
 * =========================================================
 * CONFIGURATION
 * =========================================================
 */

const MIN_MIDI = 21;   // A0
const MAX_MIDI = 108;  // C8

/*
 * ノートが画面上部から鍵盤まで
 * 落下する時間
 */
const FALL_TIME = 3.0;


/*
 * =========================================================
 * DOM
 * =========================================================
 */

const midiFileInput =
    document.getElementById("midiFile");

const fileNameElement =
    document.getElementById("fileName");

const songNameElement =
    document.getElementById("songName");

const notesElement =
    document.getElementById("notes");

const pianoElement =
    document.getElementById("piano");

const playButton =
    document.getElementById("playButton");

const pauseButton =
    document.getElementById("pauseButton");

const stopButton =
    document.getElementById("stopButton");

const progressElement =
    document.getElementById("progress");

const currentTimeElement =
    document.getElementById("currentTime");

const totalTimeElement =
    document.getElementById("totalTime");

const volumeElement =
    document.getElementById("volume");


/*
 * =========================================================
 * STATE
 * =========================================================
 */

let midi = null;

let notes = [];

let noteElements = [];

let isPlaying = false;

let startTime = 0;

let pausedTime = 0;

let animationFrame = null;

let lastPlayedNotes = new Set();

let manuallyPressedKeys = new Set();


/*
 * =========================================================
 * AUDIO
 * =========================================================
 */

let synth = null;

let volumeNode = null;


/*
 * =========================================================
 * PIANO
 * =========================================================
 */

const blackNotes = [
    1,  // C#
    3,  // D#
    6,  // F#
    8,  // G#
    10  // A#
];


const keyElements = new Map();


/*
 * =========================================================
 * UTILITY
 * =========================================================
 */

function formatTime(seconds) {

    if (!Number.isFinite(seconds)) {

        return "00:00";

    }


    seconds =
        Math.max(0, seconds);


    const minutes =
        Math.floor(seconds / 60);


    const secs =
        Math.floor(seconds % 60);


    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(secs).padStart(2, "0")
    );
}


function midiToNoteName(midiNumber) {

    const names = [

        "C",
        "C#",
        "D",
        "D#",
        "E",
        "F",
        "F#",
        "G",
        "G#",
        "A",
        "A#",
        "B"

    ];


    const octave =
        Math.floor(midiNumber / 12) - 1;


    return (
        names[midiNumber % 12] +
        octave
    );
}


function isBlackKey(midiNumber) {

    return blackNotes.includes(
        midiNumber % 12
    );

}


/*
 * =========================================================
 * PIANO CREATION
 * =========================================================
 */

function createPiano() {

    pianoElement.innerHTML = "";

    keyElements.clear();


    const whiteMidiNumbers = [];


    for (
        let midiNumber = MIN_MIDI;
        midiNumber <= MAX_MIDI;
        midiNumber++
    ) {

        if (!isBlackKey(midiNumber)) {

            whiteMidiNumbers.push(
                midiNumber
            );

        }

    }


    /*
     * WHITE KEYS
     */

    whiteMidiNumbers.forEach(
        (midiNumber) => {

            const key =
                document.createElement("div");


            key.className =
                "white-key";


            key.dataset.midi =
                midiNumber;


            key.title =
                midiToNoteName(midiNumber);


            pianoElement.appendChild(key);


            keyElements.set(
                midiNumber,
                key
            );


            setupKeyEvents(
                key,
                midiNumber
            );

        }
    );


    /*
     * BLACK KEYS
     */

    const whiteKeyCount =
        whiteMidiNumbers.length;


    const whiteKeyWidth =
        100 / whiteKeyCount;


    for (
        let midiNumber = MIN_MIDI;
        midiNumber <= MAX_MIDI;
        midiNumber++
    ) {

        if (
            !isBlackKey(midiNumber)
        ) {

            continue;

        }


        let previousWhiteCount = 0;


        for (
            let m = MIN_MIDI;
            m < midiNumber;
            m++
        ) {

            if (!isBlackKey(m)) {

                previousWhiteCount++;

            }

        }


        const key =
            document.createElement("div");


        key.className =
            "black-key";


        key.dataset.midi =
            midiNumber;


        key.title =
            midiToNoteName(midiNumber);


        const left =
            previousWhiteCount *
                whiteKeyWidth -
            whiteKeyWidth * 0.30;


        key.style.left =
            `${left}%`;


        pianoElement.appendChild(key);


        keyElements.set(
            midiNumber,
            key
        );


        setupKeyEvents(
            key,
            midiNumber
        );

    }

}


/*
 * =========================================================
 * MANUAL KEY
 * =========================================================
 */

function setupKeyEvents(
    element,
    midiNumber
) {


    element.addEventListener(
        "pointerdown",
        async (event) => {

            event.preventDefault();

            await startAudio();

            pressKey(midiNumber);

        }
    );


    element.addEventListener(
        "pointerup",
        (event) => {

            event.preventDefault();

            releaseKey(midiNumber);

        }
    );


    element.addEventListener(
        "pointercancel",
        () => {

            releaseKey(midiNumber);

        }
    );


    element.addEventListener(
        "pointerleave",
        () => {

            if (
                manuallyPressedKeys.has(
                    midiNumber
                )
            ) {

                releaseKey(
                    midiNumber
                );

            }

        }
    );

}


async function pressKey(
    midiNumber
) {

    if (
        manuallyPressedKeys.has(
            midiNumber
        )
    ) {

        return;

    }


    manuallyPressedKeys.add(
        midiNumber
    );


    const element =
        keyElements.get(
            midiNumber
        );


    if (element) {

        element.classList.add(
            "active"
        );

    }


    if (!synth) {

        await startAudio();

    }


    const noteName =
        midiToNoteName(
            midiNumber
        );


    synth.triggerAttack(
        noteName
    );

}


function releaseKey(
    midiNumber
) {

    if (
        !manuallyPressedKeys.has(
            midiNumber
        )
    ) {

        return;

    }


    manuallyPressedKeys.delete(
        midiNumber
    );


    const element =
        keyElements.get(
            midiNumber
        );


    if (element) {

        element.classList.remove(
            "active"
        );

    }


    if (synth) {

        const noteName =
            midiToNoteName(
                midiNumber
            );


        synth.triggerRelease(
            noteName
        );

    }

}


/*
 * =========================================================
 * AUDIO
 * =========================================================
 */

async function startAudio() {

    /*
     * Safari / iPadOSなどでは
     * ユーザー操作からAudioContextを開始する
     */

    await Tone.start();


    if (synth) {

        return;

    }


    volumeNode =
        new Tone.Volume(
            Tone.gainToDb(
                Number(
                    volumeElement.value
                )
            )
        ).toDestination();


    synth =
        new Tone.PolySynth(
            Tone.Synth,
            {

                oscillator: {

                    type: "triangle"

                },

                envelope: {

                    attack: 0.005,

                    decay: 0.15,

                    sustain: 0.5,

                    release: 0.8

                }

            }
        ).connect(
            volumeNode
        );

}


volumeElement.addEventListener(
    "input",
    () => {

        if (!volumeNode) {

            return;

        }


        volumeNode.volume.value =
            Tone.gainToDb(
                Number(
                    volumeElement.value
                )
            );

    }
);


/*
 * =========================================================
 * MIDI FILE LOADING
 * =========================================================
 */

midiFileInput.addEventListener(
    "change",
    async (event) => {

        const file =
            event.target.files[0];


        if (!file) {

            return;

        }


        try {

            await loadMidi(file);

        } catch (error) {

            console.error(
                "MIDI loading error:",
                error
            );


            alert(
                "MIDIファイルの読み込みに失敗しました。\n\n" +
                error.message
            );

        }

    }
);


/*
 * =========================================================
 * LOAD MIDI
 * =========================================================
 */

async function loadMidi(file) {

    stopPlayback();


    notesElement.innerHTML = "";

    noteElements = [];

    notes = [];


    fileNameElement.textContent =
        file.name;


    /*
     * ArrayBuffer
     */

    const arrayBuffer =
        await file.arrayBuffer();


    /*
     * IMPORTANT
     *
     * ここが前回と違います。
     *
     * new Midi(arrayBuffer)
     */

    midi =
        new Midi(arrayBuffer);


    /*
     * 曲名
     */

    const title =
        midi.name ||
        file.name.replace(
            /\.(mid|midi)$/i,
            ""
        );


    songNameElement.textContent =
        title;


    /*
     * 全トラック
     */

    midi.tracks.forEach(
        (track) => {

            track.notes.forEach(
                (note) => {

                    /*
                     * ピアノ範囲外を除外
                     */

                    if (
                        note.midi < MIN_MIDI ||
                        note.midi > MAX_MIDI
                    ) {

                        return;

                    }


                    notes.push({

                        midi: note.midi,

                        name:
                            note.name ||
                            midiToNoteName(
                                note.midi
                            ),

                        time: note.time,

                        duration:
                            note.duration,

                        velocity:
                            note.velocity ??
                            0.8

                    });

                }
            );

        }
    );


    /*
     * 時間順
     */

    notes.sort(
        (a, b) => {

            if (
                a.time !== b.time
            ) {

                return (
                    a.time -
                    b.time
                );

            }


            return (
                a.midi -
                b.midi
            );

        }
    );


    /*
     * MIDI duration
     */

    let duration =
        midi.duration;


    /*
     * 念のため
     */

    if (
        !Number.isFinite(duration) ||
        duration <= 0
    ) {

        duration = 0;


        notes.forEach(
            (note) => {

                duration =
                    Math.max(
                        duration,
                        note.time +
                        note.duration
                    );

            }
        );

    }


    totalTimeElement.textContent =
        formatTime(duration);


    currentTimeElement.textContent =
        "00:00";


    progressElement.value =
        0;


    pausedTime = 0;


    /*
     * ノートを作成
     */

    createNoteElements();


    console.log(
        "MIDI loaded:",
        midi
    );


    console.log(
        "Tracks:",
        midi.tracks.length
    );


    console.log(
        "Notes:",
        notes.length
    );

}


/*
 * =========================================================
 * NOTE VISUALS
 * =========================================================
 */

function createNoteElements() {

    notesElement.innerHTML = "";

    noteElements = [];


    notes.forEach(
        (note) => {

            const element =
                document.createElement("div");


            element.className =
                "note";


            if (
                isBlackKey(
                    note.midi
                )
            ) {

                element.classList.add(
                    "black"
                );

            }


            /*
             * X座標
             */

            const whiteNotesBefore =
                countWhiteKeysBefore(
                    note.midi
                );


            const totalWhiteKeys =
                countWhiteKeysInRange();


            let left =
                (
                    whiteNotesBefore /
                    totalWhiteKeys
                ) * 100;


            let width =
                100 /
                totalWhiteKeys;


            /*
             * 黒鍵
             */

            if (
                isBlackKey(
                    note.midi
                )
            ) {

                width *= 0.62;

                left -=
                    width * 0.15;

            }


            element.style.left =
                `${left}%`;


            element.style.width =
                `${width}%`;


            noteElements.push({

                note,

                element

            });


            notesElement.appendChild(
                element
            );

        }
    );

}


function countWhiteKeysBefore(
    midiNumber
) {

    let count = 0;


    for (
        let number = MIN_MIDI;
        number < midiNumber;
        number++
    ) {

        if (
            !isBlackKey(number)
        ) {

            count++;

        }

    }


    return count;

}


function countWhiteKeysInRange() {

    let count = 0;


    for (
        let number = MIN_MIDI;
        number <= MAX_MIDI;
        number++
    ) {

        if (
            !isBlackKey(number)
        ) {

            count++;

        }

    }


    return count;

}


/*
 * =========================================================
 * PLAY
 * =========================================================
 */

playButton.addEventListener(
    "click",
    async () => {

        if (
            !midi ||
            notes.length === 0
        ) {

            alert(
                "先にMIDIファイルを読み込んでください。"
            );

            return;

        }


        await startAudio();


        if (isPlaying) {

            return;

        }


        isPlaying = true;


        startTime =
            performance.now() / 1000 -
            pausedTime;


        /*
         * 再生位置より前のノートは
         * 再生済みにする
         */

        lastPlayedNotes.clear();


        notes.forEach(
            (note, index) => {

                if (
                    note.time <
                    pausedTime
                ) {

                    lastPlayedNotes.add(
                        `${index}_${note.time}`
                    );

                }

            }
        );


        if (
            animationFrame === null
        ) {

            animationFrame =
                requestAnimationFrame(
                    update
                );

        }

    }
);


/*
 * =========================================================
 * PAUSE
 * =========================================================
 */

pauseButton.addEventListener(
    "click",
    () => {

        pausePlayback();

    }
);


function pausePlayback() {

    if (!isPlaying) {

        return;

    }


    const now =
        performance.now() / 1000;


    pausedTime =
        now - startTime;


    isPlaying = false;

}


/*
 * =========================================================
 * STOP
 * =========================================================
 */

stopButton.addEventListener(
    "click",
    () => {

        stopPlayback();

    }
);


function stopPlayback() {

    isPlaying = false;

    pausedTime = 0;

    lastPlayedNotes.clear();


    /*
     * 音を停止
     */

    if (synth) {

        try {

            synth.releaseAll();

        } catch (error) {

            console.warn(error);

        }

    }


    /*
     * 鍵盤を解除
     */

    keyElements.forEach(
        (element) => {

            element.classList.remove(
                "active"
            );

        }
    );


    progressElement.value =
        0;


    currentTimeElement.textContent =
        "00:00";

}


/*
 * =========================================================
 * ANIMATION
 * =========================================================
 */

function update() {

    animationFrame =
        requestAnimationFrame(
            update
        );


    if (!midi) {

        return;

    }


    const currentTime =
        isPlaying
            ? (
                performance.now() /
                1000 -
                startTime
            )
            : pausedTime;


    const duration =
        midi.duration;


    /*
     * TIME
     */

    currentTimeElement.textContent =
        formatTime(
            currentTime
        );


    totalTimeElement.textContent =
        formatTime(
            duration
        );


    /*
     * PROGRESS
     */

    if (duration > 0) {

        progressElement.value =
            Math.min(
                100,
                Math.max(
                    0,
                    (
                        currentTime /
                        duration
                    ) * 100
                )
            );

    }


    /*
     * NOTES
     */

    renderNotes(
        currentTime
    );


    /*
     * AUDIO
     */

    playNotes(
        currentTime
    );


    /*
     * END
     */

    if (
        isPlaying &&
        currentTime >= duration
    ) {

        stopPlayback();

    }

}


/*
 * =========================================================
 * RENDER FALLING NOTES
 * =========================================================
 */

function renderNotes(
    currentTime
) {

    const areaHeight =
        notesElement.clientHeight;


    if (
        areaHeight <= 0
    ) {

        return;

    }


    const pixelsPerSecond =
        areaHeight /
        FALL_TIME;


    noteElements.forEach(
        (item) => {

            const note =
                item.note;


            const element =
                item.element;


            const appearTime =
                note.time -
                FALL_TIME;


            /*
             * まだ出現していない
             */

            if (
                currentTime <
                appearTime
            ) {

                element.style.display =
                    "none";

                return;

            }


            /*
             * 完全に通過
             */

            const endTime =
                note.time +
                note.duration;


            if (
                currentTime >
                endTime
            ) {

                element.style.display =
                    "none";

                return;

            }


            element.style.display =
                "block";


            /*
             * ノートの高さ
             */

            const height =
                Math.max(
                    8,
                    note.duration *
                    pixelsPerSecond
                );


            element.style.height =
                `${height}px`;


            /*
             * 鍵盤までの距離
             */

            const distance =
                (
                    note.time -
                    currentTime
                ) *
                pixelsPerSecond;


            const y =
                areaHeight -
                distance -
                height;


            element.style.transform =
                `translateY(${y}px)`;


            /*
             * Velocity
             */

            const velocity =
                Math.max(
                    0.35,
                    Math.min(
                        1,
                        note.velocity
                    )
                );


            element.style.opacity =
                velocity;

        }
    );

}


/*
 * =========================================================
 * PLAY MIDI NOTES
 * =========================================================
 */

function playNotes(
    currentTime
) {

    if (
        !isPlaying ||
        !synth
    ) {

        return;

    }


    const lookAhead =
        0.04;


    notes.forEach(
        (note, index) => {

            const key =
                `${index}_${note.time}`;


            /*
             * 再生済み
             */

            if (
                lastPlayedNotes.has(
                    key
                )
            ) {

                return;

            }


            /*
             * 再生タイミング
             */

            if (
                currentTime >=
                    note.time &&
                currentTime <
                    note.time +
                    lookAhead
            ) {

                lastPlayedNotes.add(
                    key
                );


                try {

                    synth.triggerAttackRelease(

                        note.name,

                        Math.max(
                            0.03,
                            note.duration
                        ),

                        undefined,

                        note.velocity

                    );


                    flashKey(
                        note.midi
                    );


                } catch (error) {

                    console.warn(
                        "Note playback error:",
                        error
                    );

                }

            }

        }
    );

}


/*
 * =========================================================
 * KEY FLASH
 * =========================================================
 */

function flashKey(
    midiNumber
) {

    const element =
        keyElements.get(
            midiNumber
        );


    if (!element) {

        return;

    }


    element.classList.add(
        "active"
    );


    setTimeout(
        () => {

            /*
             * 手動演奏中なら解除しない
             */

            if (
                !manuallyPressedKeys.has(
                    midiNumber
                )
            ) {

                element.classList.remove(
                    "active"
                );

            }

        },
        100
    );

}


/*
 * =========================================================
 * SEEK
 * =========================================================
 */

progressElement.addEventListener(
    "input",
    () => {

        if (!midi) {

            return;

        }


        const duration =
            midi.duration;


        const newTime =
            (
                Number(
                    progressElement.value
                ) / 100
            ) *
            duration;


        pausedTime =
            newTime;


        /*
         * ノートの再生状態を
         * 現在位置に合わせる
         */

        lastPlayedNotes.clear();


        notes.forEach(
            (note, index) => {

                if (
                    note.time <
                    newTime
                ) {

                    lastPlayedNotes.add(
                        `${index}_${note.time}`
                    );

                }

            }
        );


        if (isPlaying) {

            startTime =
                performance.now() /
                1000 -
                newTime;

        }


        currentTimeElement.textContent =
            formatTime(
                newTime
            );

    }
);


/*
 * =========================================================
 * COMPUTER KEYBOARD
 * =========================================================
 */

const keyboardMap = {

    "z": 48,

    "s": 49,

    "x": 50,

    "d": 51,

    "c": 52,

    "v": 53,

    "g": 54,

    "b": 55,

    "h": 56,

    "n": 57,

    "j": 58,

    "m": 59,

    ",": 60,

    "l": 61,

    ".": 62,

    ";": 63,

    "/": 64

};


document.addEventListener(
    "keydown",
    async (event) => {

        if (event.repeat) {

            return;

        }


        const midiNumber =
            keyboardMap[
                event.key
            ];


        if (
            midiNumber === undefined
        ) {

            return;

        }


        event.preventDefault();


        await startAudio();


        pressKey(
            midiNumber
        );

    }
);


document.addEventListener(
    "keyup",
    (event) => {

        const midiNumber =
            keyboardMap[
                event.key
            ];


        if (
            midiNumber === undefined
        ) {

            return;

        }


        event.preventDefault();


        releaseKey(
            midiNumber
        );

    }
);


/*
 * =========================================================
 * INITIALIZE
 * =========================================================
 */

createPiano();


animationFrame =
    requestAnimationFrame(
        update
    );
