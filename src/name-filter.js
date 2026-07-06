const UNSAFE_WORDS = [
    // Violence, threats, and self-harm.
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
    "自殺",
    "fuck",
    "fck",
    "kill",
    "murder",
    "rape",
    "suicide",
    "kys",

    // Sexual, abusive, discriminatory, or degrading language.
    "うんこ",
    "うんち",
    "ちんこ",
    "ちんぽ",
    "まんこ",
    "セックス",
    "せっくす",
    "エロ",
    "アダルト",
    "バカ",
    "ばか",
    "クソ",
    "くそ",
    "ガイジ",
    "キチガイ",
    "池沼",
    "死ね",
    "援交",
    "売春",
    "買春",
    "パパ活",
    "デリヘル",
    "ソープ",
    "風俗",
    "裸",
    "ヌード",
    "レイプ",
    "ブス",
    "デブ",
    "ゴミ",
    "カス",
    "しこしこ",
    "オナニー",
    "陰茎",
    "陰部",
    "性器",
    "shit",
    "bitch",
    "asshole",
    "cunt",
    "dick",
    "pussy",
    "porn",
    "sex",
    "slut",
    "whore",
    "nazi",
    "hitler",
    "nigger",
    "nigga",
    "faggot",
];

const IMPERSONATION_WORDS = [
    "新宿区公式",
    "新宿公式",
    "新宿区役所",
    "新宿区職員",
    "警視庁公式",
    "警察公式",
    "運営公式",
    "管理者",
    "管理部公式",
    "京王公式",
    "京王エージェンシー公式",
    "大学公式",
    "学校公式",
    "officialadmin",
    "administrator",
];

const URL_PATTERNS = [
    /https?:\/\//i,
    /www\./i,
    /\.(com|net|org|jp|co|io|biz|info|me|tv|tk|ml|ga|cf|xyz|link)\b/i,
    /(t\.co|bit\.ly|tinyurl|lin\.ee|forms\.gle|x\.gd|is\.gd)/i,
];

const CONTACT_PATTERNS = [
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i,
    /(?:\+?81[-ー\s]?)?0\d{1,4}[-ー\s]?\d{1,4}[-ー\s]?\d{3,4}/,
    /(?:line|instagram|insta|twitter|discord|telegram|tiktok|snapchat)[\s:：@_-]+[\w.-]{3,}/i,
    /\b(?:x|旧twitter)[\s:：@_-]+[\w.-]{3,}/i,
];

const PERSONAL_INFO_PATTERNS = [
    /\b\d{3}[-\s]?\d{4}\b/,
    /(?:住所|本名|実名|学籍番号|学生番号|電話番号|携帯番号|マイナンバー)/u,
];

const OFFICIAL_ROLE_PATTERN = /(?:公式|official|admin|administrator|管理者|運営|職員|教員|先生|警察|役所)/iu;
const PUBLIC_ENTITY_PATTERN = /(?:新宿|区|京王|大学|学校|警察|運営|管理)/u;

const SPAM_PATTERNS = [
    /(.)\1{4,}/u,
    /[A-Za-z0-9]{18,}/,
    /[!?！？wｗ笑]{6,}/u,
    /(?:無料|副業|稼げる|投資|出会い|登録|プレゼント).*(?:http|www|\.com|\.jp)/iu,
];

const INVISIBLE_OR_CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;
const SEPARATOR_PATTERN = /[\s\u3000\-‐‑‒–—―ーｰ_~〜～・･.,，、。/\\|:：;；'’"“”`´^ˆ¨!！?？()[\]{}<>＜＞「」『』【】★☆◇◆○●◎♪♫#＃@＠+＋=*＝￥$＄%％&＆]+/gu;

function katakanaToHiragana(value) {
    return value.replace(/[\u30a1-\u30f6]/g, (char) =>
        String.fromCharCode(char.charCodeAt(0) - 0x60),
    );
}

function normalizeLeetspeak(value) {
    return value
        .replace(/[0ｏοо○〇]/g, "o")
        .replace(/[1!！ｌｉ|｜]/g, "i")
        .replace(/[3ｅ]/g, "e")
        .replace(/[4@＠ａ]/g, "a")
        .replace(/[5$＄ｓ]/g, "s")
        .replace(/[7＋+ｔ]/g, "t")
        .replace(/[8ｂ]/g, "b");
}

function normalizeForModeration(value) {
    return normalizeLeetspeak(katakanaToHiragana(String(value).normalize("NFKC").toLowerCase()))
        .replace(SEPARATOR_PATTERN, "");
}

function includesUnsafeWord(normalizedText) {
    for (const word of UNSAFE_WORDS) {
        const normalizedWord = normalizeForModeration(word);
        if (normalizedWord && normalizedText.includes(normalizedWord)) {
            return true;
        }
    }
    return false;
}

function includesImpersonationWord(normalizedText) {
    for (const word of IMPERSONATION_WORDS) {
        const normalizedWord = normalizeForModeration(word);
        if (normalizedWord && normalizedText.includes(normalizedWord)) {
            return true;
        }
    }
    return false;
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

    if (includesUnsafeWord(normalized)) {
        return "unsafe_word";
    }

    if (includesImpersonationWord(normalized)) {
        return "impersonation";
    }

    if (OFFICIAL_ROLE_PATTERN.test(raw) && PUBLIC_ENTITY_PATTERN.test(raw)) {
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
