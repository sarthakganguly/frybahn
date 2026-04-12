import { globalKeysDown } from './globals';
import { lerpGameState, newGameState, tickGameState } from "./state";
import { initRender, loadLevel, renderState } from "./render";
import { tickSprite } from './sprite';
import { setAudioFade, startAudio } from './synth';
let accTime = 0;
let prevNow = NaN;
let curState;
let prevState;
let curLevel = DEBUG ? 5 : 0;
let saveState = [];
let saveStateLen;
let frame = () => {
    requestAnimationFrame(frame);
    let newNow = performance.now();
    if (isNaN(prevNow))
        prevNow = newNow;
    let dt = Math.min(newNow - prevNow, 1000);
    accTime += dt;
    prevNow = newNow;
    while (accTime > k_tickMillis) {
        accTime -= k_tickMillis;
        prevState = curState;
        curState = tickGameState(curState, curLevel, saveState, saveStateLen);
        tickSprite(curState.spriteState);
        globalKeysDown[38 /* Up */] = 0 /* False */;
        if (!curLevel && curState.playerEndState != 2 /* Won */) {
            globalKeysDown[40 /* Down */] =
                globalKeysDown[37 /* Left */] =
                    globalKeysDown[39 /* Right */] = 0 /* False */;
        }
    }
    renderState(curLevel, saveState, lerpGameState(prevState, curState, accTime / k_tickMillis));
    setAudioFade(curState.fade);
    if (curState.fade < 0) {
        let selectedLevel = Math.min(17, saveState.length);
        saveStateLen = saveState.length;
        if (curState.playerEndState == 3 /* Quit */) {
            selectedLevel = curLevel - 1;
            curLevel = 0;
        }
        else if (!curLevel) {
            curLevel = curState.selectedLevel + 1;
        }
        else {
            if (curState.playerEndState == 2 /* Won */) {
                try {
                    window.localStorage.setItem('galaxyrider', JSON.stringify(saveState));
                }
                catch (_) { }
                curLevel++;
            }
            curLevel %= 19;
            if (curLevel === 0)
                alert('Congrats!');
        }
        curState = prevState = newGameState(curLevel, selectedLevel);
        prevNow = NaN;
        loadLevel(curLevel);
    }
};
try {
    let got = window.localStorage.getItem('galaxyrider');
    if (got) {
        saveState.length = 0;
        saveState.push(...JSON.parse(got));
    }
}
catch (_) { }
initRender();
curState = prevState = newGameState(curLevel, Math.min(17, saveStateLen = saveState.length));
loadLevel(curLevel);
frame();
C0.onmousedown = () => { startAudio(); globalKeysDown[0] = 1 /* True */; };
