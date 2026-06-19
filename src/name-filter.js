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

const EXTRA_NG_WORDS = [
    "\u63f4\u4ea4",
    "\u58f2\u6625",
    "\u8cb7\u6625",
    "\u30d1\u30d1\u6d3b",
    "\u30c7\u30ea\u30d8\u30eb",
    "\u30bd\u30fc\u30d7",
    "\u98a8\u4fd7",
    "\u88f8",
    "\u30cc\u30fc\u30c9",
    "\u30ec\u30a4\u30d7",
    "\u30d6\u30b9",
    "\u30c7\u30d6",
    "\u30b4\u30df",
    "\u30ab\u30b9",
    "\u3057\u3053\u3057\u3053",
    "\u30aa\u30ca\u30cb\u30fc",
    "\u9670\u830e",
    "\u9670\u90e8",
    "\u6027\u5668",
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
    "\u65b0\u5bbf\u533a\u5f79\u6240",
    "\u65b0\u5bbf\u533a\u8077\u54e1",
    "\u8b66\u8996\u5e81",
    "\u8b66\u5bdf",
    "\u4eac\u738b\u516c\u5f0f",
    "\u4eac\u738b\u30a8\u30fc\u30b8\u30a7\u30f3\u30b7\u30fc\u516c\u5f0f",
    "\u5927\u5b66\u516c\u5f0f",
    "\u5b66\u6821\u516c\u5f0f",
    "\u7ba1\u7406\u90e8\u516c\u5f0f",
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

const PERSONAL_INFO_PATTERNS = [
    /\b\d{3}[-\s]?\d{4}\b/,
    /(?:\u4f4f\u6240|\u672c\u540d|\u5b66\u7c4d\u756a\u53f7|\u5b66\u751f\u756a\u53f7|\u30de\u30a4\u30ca\u30f3\u30d0\u30fc)/u,
];

const OFFICIAL_ROLE_PATTERN = /(?:\u516c\u5f0f|official|admin|administrator|\u7ba1\u7406\u8005|\u904b\u55b6|\u8077\u54e1|\u6559\u54e1|\u5148\u751f|\u8b66\u5bdf|\u5f79\u6240)/iu;

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

export function getNameModerationReason(name) {
    if (!name) {
        return null;
    }
    const raw = String(name);
    const trimmed = raw.trim();
    const normalized = normalizeForModeration(raw);

    if (!trimmed) {
        return null;
    }

    if (INVISIBLE_OR_CONTROL_PATTERN.test(raw)) {
        return "control_character";
    }

    for (const word of [...NG_WORDS, ...EXTRA_NG_WORDS]) {
        if (normalized.includes(normalizeForModeration(word))) {
            return "unsafe_word";
        }
    }

    for (const word of IMPERSONATION_WORDS) {
        if (normalized.includes(normalizeForModeration(word))) {
            return "impersonation";
        }
    }

    if (OFFICIAL_ROLE_PATTERN.test(raw) && /(?:\u65b0\u5bbf|\u533a|\u4eac\u738b|\u5927\u5b66|\u5b66\u6821|\u8b66\u5bdf|\u904b\u55b6|\u7ba1\u7406)/u.test(raw)) {
        return "impersonation";
    }

    for (const pattern of URL_PATTERNS) {
        if (pattern.test(raw) || pattern.test(normalized)) {
            return "link";
        }
    }
    for (const pattern of CONTACT_PATTERNS) {
        if (pattern.test(raw)) {
            return "contact";
        }
    }
    for (const pattern of PERSONAL_INFO_PATTERNS) {
        if (pattern.test(raw)) {
            return "personal_info";
        }
    }
    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(raw) || pattern.test(normalized)) {
            return "spam";
        }
    }
    return null;
}

export function isInappropriateName(name) {
    return Boolean(getNameModerationReason(name));
}
