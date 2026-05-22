import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { getDonationMilestoneVideo, getDonationTotalYen } from "../../src/condition-manager.js";
import {
  publishDisplayPlaylist,
  resetParticipantCount,
  signInAdmin,
  signOutAdmin,
  subscribeToAdminAuth,
  subscribeToDisplayConfig,
  subscribeToParticipantCount,
} from "../../src/admin-bridge.js";
import { getCurrentVideo } from "../../src/scheduler.js";

const h = React.createElement;
const DEMO_DONATION_YEN = 100;
const PLAYLIST_PATH = "/config/playlist.json";
const CHANNEL_OPTIONS = [
  { id: "default", label: "v1" },
  { id: "v2", label: "v2" },
  { id: "morning", label: "v3" },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatYen(value) {
  return `¥${Math.max(0, Number(value) || 0).toLocaleString("ja-JP")}`;
}

function formatDate(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) {
    return "未公開";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getChannelLabel(channel) {
  return CHANNEL_OPTIONS.find((option) => option.id === channel)?.label || "v1";
}

function normalizePlaylist(playlist = {}) {
  const milestones = Array.isArray(playlist.donationMilestones)
    ? playlist.donationMilestones
    : [];
  const rules = Array.isArray(playlist.rules) ? playlist.rules : [];

  return {
    fallback: playlist.fallback || "",
    participationVideo: playlist.participationVideo || "",
    participationReturnSeconds: Math.max(1, Math.round(Number(playlist.participationReturnSeconds) || 8)),
    donationMilestones: milestones
      .map((milestone) => ({
        name: milestone.name || `total-${milestone.thresholdYen}`,
        thresholdYen: Math.round(Number(milestone.thresholdYen) || 0),
        video: milestone.video || "",
      }))
      .filter((milestone) => milestone.thresholdYen > 0 || milestone.video)
      .sort((current, next) => current.thresholdYen - next.thresholdYen),
    rules: rules.map((rule) => ({
      name: rule.name || "",
      audience: rule.audience || "",
      start: rule.start || "",
      end: rule.end || "",
      video: rule.video || "",
    })),
  };
}

function validatePlaylist(playlist) {
  const errors = [];
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (!playlist.fallback) {
    errors.push("代替動画を入力してください。");
  }

  playlist.donationMilestones.forEach((milestone, index) => {
    if (!milestone.thresholdYen || milestone.thresholdYen < 1) {
      errors.push(`金額条件 ${index + 1} のしきい値を確認してください。`);
    }
    if (!milestone.video) {
      errors.push(`金額条件 ${index + 1} の動画パスを入力してください。`);
    }
  });

  playlist.rules.forEach((rule, index) => {
    if (!timePattern.test(rule.start) || !timePattern.test(rule.end)) {
      errors.push(`時間帯ルール ${index + 1} の時刻をHH:MM形式にしてください。`);
    }
    if (!rule.video) {
      errors.push(`時間帯ルール ${index + 1} の動画パスを入力してください。`);
    }
  });

  return errors;
}

function StatusMessage({ status }) {
  return h("p", {
    className: [
      "status-message",
      status.type === "error" ? "is-error" : "",
      status.type === "success" ? "is-success" : "",
    ].filter(Boolean).join(" "),
    role: "status",
  }, status.message);
}

function TextField({ label, type = "text", value, onChange, placeholder = "" }) {
  return h("label", null,
    h("span", null, label),
    h("input", {
      type,
      value,
      placeholder,
      min: type === "number" ? "0" : undefined,
      step: type === "number" ? "1" : undefined,
      onChange: (event) => onChange(event.target.value),
    }),
  );
}

function MetricCard({ label, value, wide = false }) {
  return h("article", { className: `metric-card${wide ? " wide" : ""}` },
    h("span", null, label),
    h("strong", null, value),
  );
}

function AdminApp() {
  const [channel, setChannel] = useState("default");
  const [count, setCount] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState(null);
  const [email, setEmail] = useState("");
  const [exportOutput, setExportOutput] = useState("");
  const [password, setPassword] = useState("");
  const [remoteConfig, setRemoteConfig] = useState(null);
  const [staticPlaylist, setStaticPlaylist] = useState(null);
  const [status, setStatus] = useState({ message: "", type: "" });
  const [user, setUser] = useState(null);

  const dirtyRef = useRef(dirty);
  const staticPlaylistRef = useRef(staticPlaylist);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    staticPlaylistRef.current = staticPlaylist;
  }, [staticPlaylist]);

  const setDraftClean = useCallback((playlist) => {
    setDraft(clone(normalizePlaylist(playlist)));
    setDirty(false);
  }, []);

  const showStatus = useCallback((message, type = "") => {
    setStatus({ message, type });
  }, []);

  useEffect(() => {
    let disposed = false;

    fetch(PLAYLIST_PATH, { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`playlist load failed: ${response.status}`);
        }
        return response.json();
      })
      .then((playlist) => {
        if (disposed) {
          return;
        }
        const normalized = normalizePlaylist(playlist);
        setStaticPlaylist(normalized);
        setDraftClean(normalized);
      })
      .catch((error) => showStatus(error.message || "初期設定の読み込みに失敗しました。", "error"));

    return () => {
      disposed = true;
    };
  }, [setDraftClean, showStatus]);

  useEffect(() => {
    let unsubscribe = () => {};
    let disposed = false;

    subscribeToAdminAuth((nextUser) => {
      if (!disposed) {
        setUser(nextUser);
      }
    })
      .then((nextUnsubscribe) => {
        unsubscribe = nextUnsubscribe;
      })
      .catch((error) => showStatus(error.message || "認証状態を取得できません。", "error"));

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [showStatus]);

  useEffect(() => {
    if (!staticPlaylist) {
      return undefined;
    }

    let disposed = false;
    let unsubscribeConfig = () => {};
    let unsubscribeCount = () => {};

    setRemoteConfig(null);
    setCount(0);

    subscribeToParticipantCount((nextCount) => {
      if (!disposed) {
        setCount(nextCount);
      }
    }, { channel })
      .then((nextUnsubscribe) => {
        if (disposed) {
          nextUnsubscribe();
          return;
        }
        unsubscribeCount = nextUnsubscribe;
      })
      .catch((error) => showStatus(error.message || "参加数を取得できません。", "error"));

    subscribeToDisplayConfig((config) => {
      if (disposed) {
        return;
      }

      setRemoteConfig(config);
      if (!dirtyRef.current) {
        setDraftClean(config?.playlist || staticPlaylistRef.current);
      }
    }, { channel })
      .then((nextUnsubscribe) => {
        if (disposed) {
          nextUnsubscribe();
          return;
        }
        unsubscribeConfig = nextUnsubscribe;
      })
      .catch((error) => showStatus(error.message || "公開設定を取得できません。", "error"));

    return () => {
      disposed = true;
      unsubscribeConfig();
      unsubscribeCount();
    };
  }, [channel, setDraftClean, showStatus, staticPlaylist]);

  const currentVideo = useMemo(() => {
    if (!draft) {
      return "-";
    }

    const total = getDonationTotalYen(count, DEMO_DONATION_YEN);
    return getDonationMilestoneVideo(draft, total) || getCurrentVideo(draft) || "-";
  }, [count, draft]);

  const donationTotal = useMemo(() => {
    return getDonationTotalYen(count, DEMO_DONATION_YEN);
  }, [count]);

  const updateDraft = useCallback((updater) => {
    setDraft((currentDraft) => {
      const nextDraft = typeof updater === "function"
        ? updater(clone(currentDraft || normalizePlaylist()))
        : updater;
      return normalizePlaylist(nextDraft);
    });
    setDirty(true);
  }, []);

  const selectChannel = useCallback((nextChannel) => {
    if (nextChannel === channel) {
      return;
    }
    if (dirty && !window.confirm("未公開の変更を破棄してチャンネルを切り替えますか？")) {
      return;
    }

    setDirty(false);
    setChannel(nextChannel);
  }, [channel, dirty]);

  const publishDraft = useCallback(async () => {
    const playlist = normalizePlaylist(draft);
    const errors = validatePlaylist(playlist);

    if (errors.length > 0) {
      showStatus(errors[0], "error");
      return;
    }

    try {
      await publishDisplayPlaylist(playlist, { channel });
      setDraft(clone(playlist));
      setDirty(false);
      showStatus("公開しました。", "success");
    } catch (error) {
      showStatus(error.message || "公開に失敗しました。", "error");
    }
  }, [channel, draft, showStatus]);

  const resetCount = useCallback(async () => {
    const label = getChannelLabel(channel);
    if (!window.confirm(`${label} の参加数を0にしますか？`)) {
      return;
    }

    try {
      await resetParticipantCount({ channel });
      showStatus("参加数を0にしました。", "success");
    } catch (error) {
      showStatus(error.message || "参加数のリセットに失敗しました。", "error");
    }
  }, [channel, showStatus]);

  const signIn = useCallback(async (event) => {
    event.preventDefault();
    try {
      await signInAdmin(email, password);
      setPassword("");
      showStatus("ログインしました。", "success");
    } catch (error) {
      showStatus(error.message || "ログインに失敗しました。", "error");
    }
  }, [email, password, showStatus]);

  const signOut = useCallback(async () => {
    await signOutAdmin();
    showStatus("ログアウトしました。");
  }, [showStatus]);

  const addMilestone = useCallback(() => {
    updateDraft((currentDraft) => {
      const nextThreshold = ((currentDraft.donationMilestones?.length || 0) + 1) * 5000;
      return {
        ...currentDraft,
        donationMilestones: [
          ...(currentDraft.donationMilestones || []),
          {
            name: `total-${nextThreshold}`,
            thresholdYen: nextThreshold,
            video: `videos/milestone-${nextThreshold}.mp4`,
          },
        ],
      };
    });
  }, [updateDraft]);

  const addRule = useCallback(() => {
    updateDraft((currentDraft) => {
      return {
        ...currentDraft,
        rules: [
          ...(currentDraft.rules || []),
          {
            name: `rule-${(currentDraft.rules?.length || 0) + 1}`,
            audience: "",
            start: "00:00",
            end: "23:59",
            video: "videos/default.mp4",
          },
        ],
      };
    });
  }, [updateDraft]);

  const updateMilestone = useCallback((index, field, value) => {
    updateDraft((currentDraft) => {
      const milestones = [...(currentDraft.donationMilestones || [])];
      milestones[index] = {
        ...milestones[index],
        [field]: field === "thresholdYen" ? Number(value) : value,
      };
      return { ...currentDraft, donationMilestones: milestones };
    });
  }, [updateDraft]);

  const removeMilestone = useCallback((index) => {
    updateDraft((currentDraft) => {
      return {
        ...currentDraft,
        donationMilestones: currentDraft.donationMilestones.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }, [updateDraft]);

  const updateRule = useCallback((index, field, value) => {
    updateDraft((currentDraft) => {
      const rules = [...(currentDraft.rules || [])];
      rules[index] = { ...rules[index], [field]: value };
      return { ...currentDraft, rules };
    });
  }, [updateDraft]);

  const removeRule = useCallback((index) => {
    updateDraft((currentDraft) => {
      return {
        ...currentDraft,
        rules: currentDraft.rules.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }, [updateDraft]);

  if (!draft) {
    return h("main", { className: "admin-shell" },
      h(StatusMessage, { status: status.message ? status : { message: "読み込み中...", type: "" } }),
    );
  }

  return h(React.Fragment, null,
    h("header", { className: "admin-topbar" },
      h("div", { className: "brand-lockup" },
        h("img", { src: "/assets/shinjuku-relight.svg", alt: "", className: "brand-mark" }),
        h("div", null,
          h("strong", null, "DOOH Admin"),
          h("span", null, "Shinjuku Relight"),
        ),
      ),
      h("div", { className: "auth-chip" },
        h("span", null, user ? user.email || "ログイン中" : "未ログイン"),
        user ? h("button", { type: "button", className: "ghost-button", onClick: signOut }, "ログアウト") : null,
      ),
    ),
    h("main", { className: "admin-shell" },
      !user ? h("section", { className: "login-panel" },
        h("form", { className: "login-form", onSubmit: signIn },
          h(TextField, {
            label: "メールアドレス",
            type: "email",
            value: email,
            onChange: setEmail,
          }),
          h(TextField, {
            label: "パスワード",
            type: "password",
            value: password,
            onChange: setPassword,
          }),
          h("button", { type: "submit", className: "primary-button" }, "ログイン"),
        ),
      ) : null,
      h("section", { className: "workspace" },
        h("div", { className: "workspace-toolbar" },
          h("div", null,
            h("span", { className: "eyebrow" }, "Channel"),
            h("div", { className: "segmented-control", "aria-label": "管理チャンネル" },
              CHANNEL_OPTIONS.map((option) => h("button", {
                key: option.id,
                type: "button",
                className: channel === option.id ? "is-active" : "",
                onClick: () => selectChannel(option.id),
              }, option.label)),
            ),
          ),
          h("div", { className: "toolbar-actions" },
            h("button", {
              type: "button",
              className: "ghost-button",
              onClick: () => {
                setDraftClean(remoteConfig?.playlist || staticPlaylist);
                showStatus("公開中の設定を読み込みました。");
              },
            }, "公開中を読込"),
            h("button", {
              type: "button",
              className: "ghost-button",
              onClick: () => {
                setDraft(clone(staticPlaylist));
                setDirty(true);
                showStatus("初期設定を読み込みました。");
              },
            }, "初期設定を読込"),
            h("button", {
              type: "button",
              className: "primary-button",
              disabled: !user || !dirty,
              onClick: publishDraft,
            }, "公開"),
          ),
        ),
        h("section", { className: "metrics-grid", "aria-label": "ライブ状態" },
          h(MetricCard, { label: "参加数", value: count.toLocaleString("ja-JP") }),
          h(MetricCard, { label: "総額", value: formatYen(donationTotal) }),
          h(MetricCard, { label: "現在の通常動画", value: currentVideo, wide: true }),
          h(MetricCard, { label: "公開状態", value: remoteConfig ? formatDate(remoteConfig.updatedAt) : "初期設定" }),
        ),
        h("section", { className: "editor-grid" },
          h("section", { className: "admin-panel" },
            h("div", { className: "panel-heading" }, h("h1", null, "再生設定")),
            h("div", { className: "field-grid" },
              h(TextField, {
                label: "代替動画",
                value: draft.fallback,
                placeholder: "videos/default.mp4",
                onChange: (value) => updateDraft((currentDraft) => ({ ...currentDraft, fallback: value })),
              }),
              h(TextField, {
                label: "参加演出動画",
                value: draft.participationVideo,
                placeholder: "videos/participation.mp4",
                onChange: (value) => updateDraft((currentDraft) => ({ ...currentDraft, participationVideo: value })),
              }),
              h(TextField, {
                label: "戻り秒数",
                type: "number",
                value: draft.participationReturnSeconds,
                onChange: (value) => updateDraft((currentDraft) => ({ ...currentDraft, participationReturnSeconds: Number(value) })),
              }),
            ),
          ),
          h("section", { className: "admin-panel" },
            h("div", { className: "panel-heading" },
              h("h2", null, "金額条件"),
              h("button", { type: "button", className: "ghost-button", onClick: addMilestone }, "追加"),
            ),
            h("div", { className: "row-list" },
              draft.donationMilestones.map((milestone, index) => h("div", { className: "config-row", key: `${milestone.name}-${index}` },
                h(TextField, {
                  label: "名称",
                  value: milestone.name,
                  onChange: (value) => updateMilestone(index, "name", value),
                }),
                h(TextField, {
                  label: "しきい値",
                  type: "number",
                  value: milestone.thresholdYen,
                  onChange: (value) => updateMilestone(index, "thresholdYen", value),
                }),
                h(TextField, {
                  label: "動画パス",
                  value: milestone.video,
                  onChange: (value) => updateMilestone(index, "video", value),
                }),
                h("button", {
                  type: "button",
                  className: "remove-button",
                  "aria-label": "金額条件を削除",
                  onClick: () => removeMilestone(index),
                }, "x"),
              )),
            ),
          ),
          h("section", { className: "admin-panel" },
            h("div", { className: "panel-heading" },
              h("h2", null, "時間帯ルール"),
              h("button", { type: "button", className: "ghost-button", onClick: addRule }, "追加"),
            ),
            h("div", { className: "row-list" },
              draft.rules.map((rule, index) => h("div", { className: "config-row rule-row", key: `${rule.name}-${index}` },
                h(TextField, {
                  label: "名称",
                  value: rule.name,
                  onChange: (value) => updateRule(index, "name", value),
                }),
                h(TextField, {
                  label: "区分",
                  value: rule.audience,
                  onChange: (value) => updateRule(index, "audience", value),
                }),
                h(TextField, {
                  label: "開始",
                  value: rule.start,
                  onChange: (value) => updateRule(index, "start", value),
                }),
                h(TextField, {
                  label: "終了",
                  value: rule.end,
                  onChange: (value) => updateRule(index, "end", value),
                }),
                h(TextField, {
                  label: "動画パス",
                  value: rule.video,
                  onChange: (value) => updateRule(index, "video", value),
                }),
                h("button", {
                  type: "button",
                  className: "remove-button",
                  "aria-label": "時間帯ルールを削除",
                  onClick: () => removeRule(index),
                }, "x"),
              )),
            ),
          ),
          h("section", { className: "admin-panel operations-panel" },
            h("div", { className: "panel-heading" }, h("h2", null, "運用")),
            h("div", { className: "operation-row" },
              h("button", {
                type: "button",
                className: "ghost-button",
                onClick: () => {
                  setExportOutput(JSON.stringify(normalizePlaylist(draft), null, 2));
                  showStatus("JSONを出力しました。");
                },
              }, "JSON出力"),
              h("button", {
                type: "button",
                className: "danger-button",
                disabled: !user,
                onClick: resetCount,
              }, "参加数を0にする"),
            ),
            h("textarea", { rows: 8, readOnly: true, value: exportOutput }),
            h(StatusMessage, { status }),
          ),
        ),
      ),
    ),
  );
}

createRoot(document.querySelector("#adminRoot")).render(h(AdminApp));
