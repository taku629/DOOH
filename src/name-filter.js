const NG_WORDS = [
    "死ね",
    "殺す",
    "ころす",
    "しね",
    "うんこ",
    "ちんこ",
    "まんこ",
    "セックス",
    "エロ",
    "アホ",
    "バカ",
    "クソ",
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "porn",
    "sex",
    "nazi",
];

const URL_PATTERNS = [
    /https?:\/\//i,
    /www\./i,
    /\.(com|net|org|jp|co|io|biz|info|me|tv|tk|ml|ga|cf|xyz|link)\b/i,
    /(t\.co|bit\.ly|tinyurl|lin\.ee)/i,
];

const SPAM_PATTERNS = [
    /(.)\1{4,}/u,
    /[A-Za-z0-9]{12,}/,
    /[!?！？]{5,}/,
];

export function isInappropriateName(name) {
    if (!name) {
        return false;
    }
    const normalized = String(name).toLowerCase();

    for (const word of NG_WORDS) {
        if (normalized.includes(word.toLowerCase())) {
            return true;
        }
    }
    for (const pattern of URL_PATTERNS) {
        if (pattern.test(name)) {
            return true;
        }
    }
    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(name)) {
            return true;
        }
    }
    return false;
}
