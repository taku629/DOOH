export function logPlayback(videoPath) {
    const time = new Date().toLocaleString();
    console.log(`[${time}] playing: ${videoPath}`);
}

export function logError(error) {
    console.error("[DOOH Player]", error);
}
