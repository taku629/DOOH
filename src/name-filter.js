const NG_WORDS = [
    // Threats, violence, and self-harm.
    "死ね",
    "しね",
    "シネ",
    "殺す",
    "ころす",
    "コロス",
    "殺害",
    "消えろ",
    "爆破",
    "放火",
    "刺す",
    "犯す",
    "自殺",
    "fuck",
    "fck",
    "kill",
    "murder",
    "rape",
    "suicide",

    // Sexual, abusive, and discriminatory language.
    "うんこ",
    "うんち",
    "ちんこ",
    "ちんぽ",
    "まんこ",
    "セックス",
    "せっくす",
    "エロ",
    "アホ",
    "バカ",
    "クソ",
    "くそ",
    "ガイジ",
    "キチガイ",
    "池沼",
    "死刑",
    "shit",
    "bitch",
    "asshole",
    "cunt",
    "dick",
    "pussy",
    "porn",
    "sex",
    "nazi",
    "hitler",
    "nigger",
    "nigga",
    "faggot",
];

const IMPERSONATION_WORDS = [
    "新宿区公式",
    "新宿公式",
    "警察公式",
    "運営公式",
    "公式運営",
    "管理者",
    "administrator",
    "officialadmin",
];

const URL_PATTERNS = [
    /https?:\/\//i,
    /www\./i,
    /\.(com|net|org|jp|co|io|biz|info|me|tv|tk|ml|ga|cf|xyz|link)\b/i,
    /(t\.co|bit\.ly|tinyurl|lin\.ee)/i,
];

const CONTACT_PATTERNS = [
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i,
    /(?:\+?81[-ー－\s]?)?0\d{1,4}[-ー－\s]?\d{1,4}[-ー－\s]?\d{3,4}/,
    /(?:line|instagram|insta|twitter|discord|telegram|tiktok)[\s:：＠@_-]+[\w.-]{3,}/i,
    /\bx[\s:：＠@_-]+[\w.-]{3,}/i,
];

const SPAM_PATTERNS = [
    /(.)\1{4,}/u,
    /[A-Za-z0-9]{12,}/,
    /[!?！？]{5,}/,
];

const INVISIBLE_OR_CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;

function normalizeForModeration(value) {
    return String(value)
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[0０]/g, "o")
        .replace(/[1１!！|｜]/g, "i")
        .replace(/[3３]/g, "e")
        .replace(/[4４@＠]/g, "a")
        .replace(/[5５$＄]/g, "s")
        .replace(/[7７]/g, "t")
        .replace(/[\s\u3000\-‐‑‒–—―ー_＿・･.。,，、/／\\]+/gu, "");
}

export function isInappropriateName(name) {
    if (!name) {
        return false;
    }
    const raw = String(name);
    const normalized = normalizeForModeration(raw);

    if (INVISIBLE_OR_CONTROL_PATTERN.test(raw)) {
        return true;
    }

    for (const word of [...NG_WORDS, ...IMPERSONATION_WORDS]) {
        if (normalized.includes(normalizeForModeration(word))) {
            return true;
        }
    }
    for (const pattern of URL_PATTERNS) {
        if (pattern.test(raw) || pattern.test(normalized)) {
            return true;
        }
    }
    for (const pattern of CONTACT_PATTERNS) {
        if (pattern.test(raw)) {
            return true;
        }
    }
    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(raw) || pattern.test(normalized)) {
            return true;
        }
    }
    return false;
}
