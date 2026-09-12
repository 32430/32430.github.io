"use strict";


/* =========================================================
   Configuration
========================================================= */

const MIN_MIDI = 21;   // A0
const MAX_MIDI = 108;  // C8

const NOTE_COUNT = MAX_MIDI - MIN_MIDI + 1;

/*
 * ノートが画面上部に出てから鍵盤まで到達するまでの秒数
 */
const FALL_TIME = 3.0;


/* =========================================================
   DOM
========================================================= */

const midiFileInput = document.getElementById("midiFile");
const fileNameElement = document.getElementById("fileName");

const songNameElement = document.getElementById("songName");

const notesElement = document.getElementById("notes");
const pianoElement = document.getElementById("piano");

const playButton = document.getElementById("playButton");
const pauseButton = document.getElementById("pauseButton");
const stopButton = document.getElementById("stopButton");

const progressElement = document.getElementById("progress");

const currentTimeElement = document.getElementById("currentTime");
const totalTimeElement = document.getElementById("totalTime");

const volumeElement = document.getElementById("volume");


/* =========================================================
   State
========================================================= */

let midi = null;

let notes = [];

let noteElements = [];

let isPlaying = false;

let startTime = 0;

let pausedTime = 0;

let animationFrame = null;

let lastPlayedNotes = new Set();

let manuallyPressedKeys = new Set();


/* =========================================================
   Tone.js
========================================================= */

let synth = null;

let volumeNode = null;


/* =========================================================
   Piano Layout
========================================================= */

const whiteNotes = [
    0,  // C
    2,  // D
    4,  // E
    5,  // F
    7,  // G
    9,  // A
    11  // B
];

const blackNotes = [
    1,  // C#
    3,  // D#
    6,  // F#
    8,  // G#
    10  // A#
];


const keyElements = new Map();


/* =========================================================
   Utility
========================================================= */

function formatTime(seconds) {

    if (!Number.isFinite(seconds)) {
        return "00:00";
    }

    seconds = Math.max(0, seconds);

    const minutes = Math.floor(seconds / 60);

    const secs = Math.floor(seconds % 60);

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

    const octave = Math.floor(midiNumber / 12) - 1;

    return names[midiNumber % 12] + octave;
}


function isBlackKey(midiNumber) {

    return blackNotes.includes(midiNumber % 12);
}


/* =========================================================
   Create Piano
========================================================= */

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
            whiteMidiNumbers.push(midiNumber);
        }
    }


    /*
     * 白鍵
     */

    whiteMidiNumbers.forEach((midiNumber) => {

        const key = document.createElement("div");

        key.className = "white-key";

        key.dataset.midi = midiNumber;

        key.title = midiToNoteName(midiNumber);

        pianoElement.appendChild(key);

        keyElements.set(midiNumber, key);

        setupKeyEvents(key, midiNumber);
    });


    /*
     * 黒鍵
     */

    const whiteKeyCount = whiteMidiNumbers.length;

    const whiteKeyWidth = 100 / whiteKeyCount;


    for (
        let midiNumber = MIN_MIDI;
        midiNumber <= MAX_MIDI;
        midiNumber++
    ) {

        if (!isBlackKey(midiNumber)) {
            continue;
        }


        /*
         * 黒鍵の左側にある白鍵を探す
         */

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


        const key = document.createElement("div");

        key.className = "black-key";

        key.dataset.midi = midiNumber;

        key.title = midiToNoteName(midiNumber);

        /*
         * 白鍵と白鍵の境界に配置
         */

        const left =
            previousWhiteCount * whiteKeyWidth -
            whiteKeyWidth * 0.30;


        key.style.left = `${left}%`;

        pianoElement.appendChild(key);

        keyElements.set(midiNumber, key);

        setupKeyEvents(key, midiNumber);
    }
}


/* =========================================================
   Piano Key Events
========================================================= */

function setupKeyEvents(element, midiNumber) {

    element.addEventListener("pointerdown", async (event) => {

        event.preventDefault();

        await startAudio();

        pressKey(midiNumber);
    });


    element.addEventListener("pointerup", (event) => {

        event.preventDefault();

        releaseKey(midiNumber);
    });


    element.addEventListener("pointercancel", () => {

        releaseKey(midiNumber);
    });


    element.addEventListener("pointerleave", () => {

        /*
         * マウスで押したまま外へ出た場合
         */

        if (manuallyPressedKeys.has(midiNumber)) {
            releaseKey(midiNumber);
        }
    });
}


async function pressKey(midiNumber) {

    if (manuallyPressedKeys.has(midiNumber)) {
        return;
    }

    manuallyPressedKeys.add(midiNumber);

    const element = keyElements.get(midiNumber);

    if (element) {
        element.classList.add("active");
    }

    if (!synth) {
        await startAudio();
    }

    const noteName = midiToNoteName(midiNumber);

    synth.triggerAttack(noteName);
}


function releaseKey(midiNumber) {

    if (!manuallyPressedKeys.has(midiNumber)) {
        return;
    }

    manuallyPressedKeys.delete(midiNumber);

    const element = keyElements.get(midiNumber);

    if (element) {
        element.classList.remove("active");
    }

    if (synth) {

        const noteName = midiToNoteName(midiNumber);

        synth.triggerRelease(noteName);
    }
}


/* =========================================================
   Audio
========================================================= */

async function startAudio() {

    await Tone.start();

    if (synth) {
        return;
    }


    volumeNode = new Tone.Volume(
        Tone.gainToDb(Number(volumeElement.value))
    ).toDestination();


    synth = new Tone.PolySynth(Tone.Synth, {

        oscillator: {
            type: "triangle"
        },

        envelope: {
            attack: 0.005,
            decay: 0.15,
            sustain: 0.5,
            release: 0.8
        }

    }).connect(volumeNode);
}


volumeElement.addEventListener("input", () => {

    if (!volumeNode) {
        return;
    }

    volumeNode.volume.value =
        Tone.gainToDb(Number(volumeElement.value));
});


/* =========================================================
   MIDI Loading
========================================================= */

midiFileInput.addEventListener("change", async (event) => {

    const file = event.target.files[0];

    if (!file) {
        return;
    }

    try {

        await loadMidi(file);

    } catch (error) {

        console.error(error);

        alert(
            "MIDIファイルの読み込みに失敗しました。\n\n" +
            error.message
        );
    }
});


async function loadMidi(file) {

    stopPlayback();

    notesElement.innerHTML = "";

    noteElements = [];

    notes = [];

    fileNameElement.textContent = file.name;

    const arrayBuffer = await file.arrayBuffer();

    midi = new Midi.Midi(arrayBuffer);


    /*
     * 曲名
     */

    const title =
        midi.name ||
        file.name.replace(/\.(mid|midi)$/i, "");

    songNameElement.textContent = title;


    /*
     * MIDIの全トラックからノートを取得
     */

    midi.tracks.forEach(track => {

        track.notes.forEach(note => {

            /*
             * ピアノ範囲だけに制限
             */

            if (
                note.midi < MIN_MIDI ||
                note.midi > MAX_MIDI
            ) {
                return;
            }


            notes.push({

                midi: note.midi,

                name: note.name,

                time: note.time,

                duration: note.duration,

                velocity: note.velocity ?? 0.8

            });
        });
    });


    /*
     * 時間順に並べる
     */

    notes.sort((a, b) => {

        if (a.time !== b.time) {
            return a.time - b.time;
        }

        return a.midi - b.midi;
    });


    /*
     * 曲の長さ
     */

    let duration = midi.duration;

    if (!Number.isFinite(duration)) {

        duration = 0;

        notes.forEach(note => {

            duration = Math.max(
                duration,
                note.time + note.duration
            );
        });
    }


    totalTimeElement.textContent = formatTime(duration);

    progressElement.value = 0;

    pausedTime = 0;


    createNoteElements();

    console.log("MIDI loaded:", midi);

    console.log("Notes:", notes.length);
}


/* =========================================================
   Note Visuals
========================================================= */

function createNoteElements() {

    notesElement.innerHTML = "";

    noteElements = [];


    notes.forEach((note) => {

        const element = document.createElement("div");

        element.className = "note";

        if (isBlackKey(note.midi)) {
            element.classList.add("black");
        }


        /*
         * X座標
         */

        const whiteNotesBefore = countWhiteKeysBefore(
            note.midi
        );

        const totalWhiteKeys =
            countWhiteKeysInRange();


        let left =
            (whiteNotesBefore / totalWhiteKeys) * 100;


        let width =
            100 / totalWhiteKeys;


        /*
         * 黒鍵は少し細くする
         */

        if (isBlackKey(note.midi)) {

            width *= 0.62;

            left -= width * 0.15;
        }


        element.style.left = `${left}%`;

        element.style.width = `${width}%`;


        /*
         * ノートの長さ
         *
         * 後で画面高さに合わせて設定
         */

        noteElements.push({
            note,
            element
        });

        notesElement.appendChild(element);
    });
}


function countWhiteKeysBefore(midiNumber) {

    let count = 0;

    for (
        let midiNumber2 = MIN_MIDI;
        midiNumber2 < midiNumber;
        midiNumber2++
    ) {

        if (!isBlackKey(midiNumber2)) {
            count++;
        }
    }

    return count;
}


function countWhiteKeysInRange() {

    let count = 0;

    for (
        let midiNumber = MIN_MIDI;
        midiNumber <= MAX_MIDI;
        midiNumber++
    ) {

        if (!isBlackKey(midiNumber)) {
            count++;
        }
    }

    return count;
}


/* =========================================================
   Playback
========================================================= */

playButton.addEventListener("click", async () => {

    if (!midi || notes.length === 0) {

        alert("先にMIDIファイルを読み込んでください。");

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


    lastPlayedNotes.clear();


    if (animationFrame === null) {
        animationFrame = requestAnimationFrame(update);
    }
});


pauseButton.addEventListener("click", () => {

    pausePlayback();
});


stopButton.addEventListener("click", () => {

    stopPlayback();
});


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


function stopPlayback() {

    isPlaying = false;

    pausedTime = 0;

    lastPlayedNotes.clear();


    /*
     * 発音中のノートを停止
     */

    if (synth) {

        try {
            synth.releaseAll();
        } catch (error) {
            console.warn(error);
        }
    }


    /*
     * 鍵盤の状態を解除
     */

    keyElements.forEach(element => {
        element.classList.remove("active");
    });


    progressElement.value = 0;

    currentTimeElement.textContent = "00:00";
}


/* =========================================================
   Animation
========================================================= */

function update() {

    animationFrame = requestAnimationFrame(update);


    if (!midi) {
        return;
    }


    const currentTime =
        isPlaying
            ? performance.now() / 1000 - startTime
            : pausedTime;


    const duration = midi.duration;


    /*
     * UI
     */

    currentTimeElement.textContent =
        formatTime(currentTime);


    totalTimeElement.textContent =
        formatTime(duration);


    progressElement.value =
        duration > 0
            ? Math.min(
                100,
                Math.max(
                    0,
                    currentTime / duration * 100
                )
            )
            : 0;


    /*
     * ノート描画
     */

    renderNotes(currentTime);


    /*
     * MIDI音声
     */

    playNotes(currentTime);


    /*
     * 終了
     */

    if (
        isPlaying &&
        currentTime >= duration
    ) {

        stopPlayback();
    }
}


/* =========================================================
   Render Falling Notes
========================================================= */

function renderNotes(currentTime) {

    const areaHeight =
        notesElement.clientHeight;


    if (areaHeight <= 0) {
        return;
    }


    /*
     * FALL_TIME秒前から画面上部に出現
     *
     * currentTime:
     *
     * note.time - FALL_TIME
     *          ↓
     *     画面上端
     *
     * note.time
     *          ↓
     *      鍵盤
     */


    noteElements.forEach(item => {

        const note = item.note;

        const element = item.element;


        const appearTime =
            note.time - FALL_TIME;


        /*
         * まだ出現していない
         */

        if (currentTime < appearTime) {

            element.style.display = "none";

            return;
        }


        /*
         * すでに通過したノート
         */

        const endTime =
            note.time + note.duration;


        if (
            currentTime >
            endTime
        ) {

            element.style.display = "none";

            return;
        }


        element.style.display = "block";


        /*
         * ノートの高さ
         *
         * durationに比例
         */

        const pixelsPerSecond =
            areaHeight / FALL_TIME;


        const height =
            Math.max(
                8,
                note.duration * pixelsPerSecond
            );


        element.style.height =
            `${height}px`;


        /*
         * 現在の位置
         *
         * note.time が鍵盤ライン
         */

        const distance =
            (note.time - currentTime) *
            pixelsPerSecond;


        const y =
            areaHeight -
            distance -
            height;


        element.style.transform =
            `translateY(${y}px)`;


        /*
         * velocityを透明度に反映
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
    });
}


/* =========================================================
   MIDI Audio Playback
========================================================= */

function playNotes(currentTime) {

    if (!isPlaying || !synth) {
        return;
    }


    /*
     * 少し先まで検索
     */

    const lookAhead = 0.03;


    notes.forEach((note, index) => {

        const key =
            `${index}_${note.time}`;


        /*
         * すでに再生済み
         */

        if (lastPlayedNotes.has(key)) {
            return;
        }


        /*
         * 再生タイミング
         */

        if (
            currentTime >= note.time &&
            currentTime < note.time + lookAhead
        ) {

            lastPlayedNotes.add(key);


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


                flashKey(note.midi);

            } catch (error) {

                console.warn(
                    "Note playback error:",
                    error
                );
            }
        }
    });
}


/* =========================================================
   Keyboard Flash
========================================================= */

function flashKey(midiNumber) {

    const element =
        keyElements.get(midiNumber);


    if (!element) {
        return;
    }


    element.classList.add("active");


    setTimeout(() => {

        /*
         * 手動演奏中なら解除しない
         */

        if (
            !manuallyPressedKeys.has(
                midiNumber
            )
        ) {

            element.classList.remove("active");
        }

    }, 100);
}


/* =========================================================
   Progress Seek
========================================================= */

progressElement.addEventListener("input", () => {

    if (!midi) {
        return;
    }


    const duration = midi.duration;


    const newTime =
        Number(progressElement.value) /
        100 *
        duration;


    pausedTime = newTime;


    /*
     * その位置より前のノートを
     * 再生済み扱いにする
     */

    lastPlayedNotes.clear();


    notes.forEach((note, index) => {

        if (note.time < newTime) {

            lastPlayedNotes.add(
                `${index}_${note.time}`
            );
        }
    });


    if (isPlaying) {

        startTime =
            performance.now() / 1000 -
            newTime;
    }


    currentTimeElement.textContent =
        formatTime(newTime);
});


/* =========================================================
   Keyboard Support
========================================================= */

const keyboardMap = {

    "z": 48,   // C3
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

    ",": 60,   // C4
    "l": 61,
    ".": 62,
    ";": 63,
    "/": 64

};


document.addEventListener("keydown", async (event) => {

    if (event.repeat) {
        return;
    }


    const midiNumber =
        keyboardMap[event.key];


    if (
        midiNumber === undefined
    ) {
        return;
    }


    event.preventDefault();


    await startAudio();

    pressKey(midiNumber);
});


document.addEventListener("keyup", (event) => {

    const midiNumber =
        keyboardMap[event.key];


    if (
        midiNumber === undefined
    ) {
        return;
    }


    event.preventDefault();

    releaseKey(midiNumber);
});


/* =========================================================
   Resize
========================================================= */

window.addEventListener("resize", () => {

    /*
     * 描画は次のanimation frameで
     * 自動的に再計算される
     */

});


/* =========================================================
   Initial
========================================================= */

createPiano();

animationFrame =
    requestAnimationFrame(update);
