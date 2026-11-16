import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clapperboard,
  House,
  Play,
  Radio,
  Settings,
} from "lucide-react";
import {
  CHANNEL_URL,
  PARISH_ONLINE,
  RUTUBE_URL,
  STREAM_EMBED,
  agendaFor,
  fallbackSchedule,
  formatWhen,
  type Recording,
  type RecordingsPayload,
  type SchedulePayload,
  type StreamPayload,
} from "@/lib/schedule";
import {
  DEFAULT_SETTINGS,
  applyProxy,
  liveSource,
  loadSettings,
  recordingEmbed,
  saveSettings,
  type AppSettings,
} from "@/lib/settings";
import { APP_AUTHOR, APP_EMAIL, APP_VERSION } from "@/lib/version";

type Screen = "home" | "live" | "schedule" | "archive" | "settings" | "watch";

type WatchItem = { id: string; title: string; host?: "youtube" | "rutube" };

const NAV: { id: Screen; label: string; key: string }[] = [
  { id: "home", label: "Главная", key: "0" },
  { id: "live", label: "Эфир", key: "1" },
  { id: "schedule", label: "Расписание", key: "2" },
  { id: "archive", label: "Записи", key: "3" },
  { id: "settings", label: "Настройки", key: "4" },
];

function focusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-tv]")).filter((el) => {
    if (el.getAttribute("aria-hidden") === "true") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function moveFocus(direction: "left" | "right" | "up" | "down") {
  const items = focusables();
  const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const origin = current?.getBoundingClientRect();
  if (!items.length) return;
  if (!origin || !current?.hasAttribute("data-tv")) {
    items[0].focus();
    return;
  }
  const cx = origin.left + origin.width / 2;
  const cy = origin.top + origin.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === current) continue;
    const rect = el.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - cx;
    const dy = rect.top + rect.height / 2 - cy;
    if (direction === "left" && dx >= -4) continue;
    if (direction === "right" && dx <= 4) continue;
    if (direction === "up" && dy >= -4) continue;
    if (direction === "down" && dy <= 4) continue;
    const primary = direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy);
    const secondary = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 2.4;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) {
    best.focus();
    best.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function Mark({ className }: { className?: string }) {
  return <img src="/icon-192.png" alt="" className={className} />;
}

function BootScreen({ leaving }: { leaving: boolean }) {
  return (
    <div
      className={
        "fixed inset-0 z-50 flex items-center justify-center bg-wine-deep text-center transition-opacity duration-700 " +
        (leaving ? "pointer-events-none opacity-0" : "opacity-100")
      }
      role="status"
      aria-label="Кафедра"
    >
      <img src="/splash.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-wine-deep/60" />
      <div className="relative flex max-w-xl flex-col items-center px-6">
        <img src="/icon-512.png" alt="" className="size-32 rounded-[1.75rem] sm:size-40" />
        <p className="mt-6 font-display text-5xl leading-none tracking-wide text-gold-2 sm:text-6xl">Кафедра</p>
        <p className="mt-3 text-xs leading-snug tracking-wide text-ivory/90 sm:text-sm">
          Римско-католический кафедральный собор Непорочного Зачатия Пресвятой Девы Марии в Москве
        </p>
        <p className="mt-4 text-xs tabular-nums tracking-widest text-gold">{APP_VERSION}</p>
      </div>
    </div>
  );
}

function clockText(seconds: number) {
  const t = Math.floor(seconds || 0);
  const m = Math.floor(t / 60);
  const h = Math.floor(m / 60);
  const sec = t % 60;
  const z = (n: number) => (n < 10 ? "0" : "") + n;
  return h ? `${h}:${z(m % 60)}:${z(sec)}` : `${m % 60}:${z(sec)}`;
}

function HlsVideo({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [live, setLive] = useState(true);
  const [pct, setPct] = useState(100);
  const [label, setLabel] = useState("прямой эфир");

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let cancelled = false;
    let hls: { destroy: () => void } | null = null;
    setError("");
    (async () => {
      try {
        const mod = await import("hls.js");
        if (cancelled) return;
        const Hls = mod.default;
        if (Hls.isSupported()) {
          const player = new Hls({ enableWorker: true });
          hls = player;
          player.loadSource(src);
          player.attachMedia(video);
          player.on(Hls.Events.ERROR, (_evt, data) => {
            if (data.fatal) setError("Поток HLS не открылся. Проверьте ссылку и прокси.");
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
        } else {
          setError("Этот браузер не играет HLS. На телевизоре поток откроет встроенный плеер.");
        }
      } catch {
        if (!cancelled) setError("Не удалось загрузить плеер потока.");
      }
    })();
    const paint = () => {
      const d = video.duration;
      const isLive = !(d > 0) || !Number.isFinite(d);
      setLive(isLive);
      if (isLive) {
        setPct(100);
        setLabel("прямой эфир");
        return;
      }
      setPct(Math.round((video.currentTime / d) * 100));
      setLabel(`${clockText(video.currentTime)} / ${clockText(d)}`);
    };
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    video.addEventListener("timeupdate", paint);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      cancelled = true;
      video.removeEventListener("timeupdate", paint);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      hls?.destroy();
    };
  }, [src]);

  return (
    <div className="relative h-full min-h-80 w-full overflow-hidden bg-wine-deep shadow-[inset_0_0_0_1px_#c4a46a]">
      <video ref={ref} className="h-full w-full bg-wine-deep object-contain" autoPlay playsInline />
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-wine-deep/80 to-transparent px-4 pt-3 pr-40 pb-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold px-3 py-1 text-xs tracking-widest text-gold-2">
          <span className="size-2 rounded-full bg-gold-2" />
          {live ? "В эфире" : "Запись"}
        </span>
        <p className="mt-2 font-display text-2xl text-ivory">{title}</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-wine-deep/90 to-transparent px-4 pt-8 pb-3">
        <button
          type="button"
          aria-label={paused ? "Смотреть" : "Пауза"}
          className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-gold-2 bg-wine-deep/75"
          onClick={() => {
            const video = ref.current;
            if (!video) return;
            if (video.paused) void video.play();
            else video.pause();
          }}
        >
          {paused ? (
            <span className="ml-0.5 border-y-[8px] border-l-[14px] border-y-transparent border-l-gold-2" />
          ) : (
            <span className="flex gap-1">
              <span className="h-4 w-1 bg-gold-2" />
              <span className="h-4 w-1 bg-gold-2" />
            </span>
          )}
        </button>
        <div
          ref={track}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-ivory/30"
          onClick={(event) => {
            const video = ref.current;
            const bar = track.current;
            if (!video || !bar) return;
            const d = video.duration;
            if (!(d > 0) || !Number.isFinite(d)) return;
            const rect = bar.getBoundingClientRect();
            const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / (rect.width || 1)));
            video.currentTime = x * d;
          }}
        >
          <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
        </div>
        <span className="min-w-24 text-right text-sm text-gold-2">{label}</span>
      </div>
      {error ? <p className="absolute inset-x-0 bottom-16 bg-wine/90 px-4 py-3 text-sm text-gold-2">{error}</p> : null}
    </div>
  );
}

export function TvApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [backTo, setBackTo] = useState<Screen>("home");
  const [schedule, setSchedule] = useState<SchedulePayload>(() => fallbackSchedule());
  const [recordings, setRecordings] = useState<RecordingsPayload | null>(null);
  const [recordingsError, setRecordingsError] = useState("");
  const [stream, setStream] = useState<StreamPayload | null>(null);
  const [forceLive, setForceLive] = useState(false);
  const [holdLive, setHoldLive] = useState(false);
  const [full, setFull] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);
  const [watch, setWatch] = useState<WatchItem | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const [boot, setBoot] = useState<"show" | "leave" | "gone">("show");

  useEffect(() => {
    const leave = window.setTimeout(() => setBoot("leave"), 1600);
    const gone = window.setTimeout(() => setBoot("gone"), 2300);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(gone);
    };
  }, []);

  useEffect(() => {
    setSettings(loadSettings());
    setReady(true);
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((data: SchedulePayload) => setSchedule(data))
      .catch(() => undefined);
    fetch("/api/stream")
      .then((r) => r.json())
      .then((data: StreamPayload) => setStream(data))
      .catch(() => undefined);
    const streamTimer = window.setInterval(() => {
      fetch("/api/stream")
        .then((r) => r.json())
        .then((data: StreamPayload) => {
          setStream(data);
          if (data.onAir) setForceLive(false);
        })
        .catch(() => undefined);
    }, 60000);
    return () => window.clearInterval(streamTimer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const source = settings.archiveSource || "auto";
    const query = "/api/recordings?source=" + encodeURIComponent(source) + "&rutube=" + encodeURIComponent(settings.rutubeId || "");
    fetch(query)
      .then((r) => r.json())
      .then((data: RecordingsPayload) => {
        setRecordings(data);
        setRecordingsError(data.notice && !data.items.length ? data.notice : "");
      })
      .catch(() => setRecordingsError("Не удалось загрузить записи."));
  }, [ready, settings.archiveSource, settings.rutubeId]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((n) => n + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const agenda = useMemo(() => agendaFor(schedule.sections), [schedule, clockTick]);

  const goBack = useCallback(() => {
    if (full && (screen === "live" || screen === "watch")) {
      setFull(false);
      return;
    }
    if (screen === "home") return;
    if (screen === "watch") {
      setScreen(backTo === "watch" ? "archive" : backTo);
      return;
    }
    setScreen("home");
  }, [backTo, full, screen]);

  useEffect(() => {
    if (screen !== "live") setHoldLive(false);
    if (screen !== "live" && screen !== "watch") setFull(false);
  }, [screen]);

  useEffect(() => {
    if (screen === "live" && (stream?.onAir || forceLive)) setHoldLive(true);
  }, [screen, stream?.onAir, forceLive]);

  useEffect(() => {
    const watching = screen === "watch" || (screen === "live" && (holdLive || forceLive || stream?.onAir === true));
    let released = false;
    let sentinel: { release: () => Promise<void> } | null = null;
    if (watching && "wakeLock" in navigator) {
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          if (released) void lock.release();
          else sentinel = lock;
        })
        .catch(() => undefined);
    }
    const native = (window as unknown as { CatedraNative?: { setAwake?: (on: string) => void } }).CatedraNative;
    try {
      native?.setAwake?.(watching ? "1" : "0");
    } catch {
      /* preview */
    }
    return () => {
      released = true;
      void sentinel?.release();
    };
  }, [screen, holdLive, forceLive, stream?.onAir]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (typing) {
        if (event.key === "Escape") target.blur();
        return;
      }
      const map: Record<string, Screen> = {
        Digit0: "home",
        Digit1: "live",
        Digit2: "schedule",
        Digit3: "archive",
        Digit4: "settings",
        F1: "live",
        F2: "schedule",
        F3: "archive",
        F4: "settings",
      };
      if (event.keyCode === 403 || event.key === "F14") {
        setScreen("live");
        return;
      }
      if (map[event.code]) {
        event.preventDefault();
        setScreen(map[event.code]);
        return;
      }
      if (event.code === "Digit5" || event.key === "5") {
        if (screen === "live" || screen === "watch") {
          event.preventDefault();
          setFull((value) => !value);
        }
        return;
      }
      if (event.key === "Escape" || event.key === "Backspace" || event.keyCode === 10009 || event.keyCode === 461) {
        event.preventDefault();
        goBack();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveFocus("left");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveFocus("right");
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFocus("up");
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFocus("down");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const preferred = document.querySelector<HTMLElement>("[data-fs]");
      (preferred || focusables()[0])?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [screen, sectionIndex, dayIndex, full]);

  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (ready) saveSettings(next);
      return next;
    });
  }

  const source = liveSource(settings, stream?.embedUrl || STREAM_EMBED);
  const section = schedule.sections[sectionIndex] || schedule.sections[0];
  const day = section?.days[dayIndex] || section?.days[0];
  const proxySample = applyProxy(
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCv_ztXSXtfmUW_fSF08kFIA",
    settings,
  );

  return (
    <div className={"flex min-h-dvh flex-col bg-wine-deep text-ivory" + (full ? " h-dvh overflow-hidden" : "")}>
      {boot !== "gone" ? <BootScreen leaving={boot === "leave"} /> : null}
      <header className={"flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line/50 px-4 py-3 sm:px-6" + (full ? " hidden" : "")}>
        <button
          data-tv=""
          className="tv-focus flex min-w-0 items-center gap-3 rounded-card text-left sm:flex-1"
          onClick={() => setScreen("home")}
        >
          <Mark className="size-11 shrink-0 rounded-xl" />
          <span className="min-w-0 text-left">
            <span className="flex items-baseline gap-2">
              <span className="font-display text-2xl leading-none tracking-wide text-gold-2">Кафедра</span>
              <span className="text-xs tabular-nums text-muted">{APP_VERSION}</span>
            </span>
            <span className="mt-1 hidden text-xs leading-snug tracking-wide text-muted sm:block">
              Римско-католический кафедральный собор Непорочного Зачатия Пресвятой Девы Марии в Москве
            </span>
          </span>
        </button>
        <div className="ml-auto shrink-0 text-right">
          <p className="font-display text-3xl leading-none text-ivory tabular-nums">{agenda.clock.label}</p>
          <p className="text-xs uppercase tracking-widest text-muted">МСК · {agenda.clock.dayName.toLowerCase()}</p>
        </div>
        <p className="w-full text-[11px] leading-snug tracking-wide text-muted sm:hidden">
          Римско-католический кафедральный собор Непорочного Зачатия Пресвятой Девы Марии в Москве
        </p>
      </header>

      <main className={"flex-1 overflow-y-auto " + (full ? "p-0" : "px-4 py-4 sm:px-6 sm:py-5")}>
        {screen === "home" ? (
          <Home
            agenda={agenda}
            schedule={schedule}
            poster={stream?.poster || ""}
            recordings={recordings?.items.slice(0, 4) || []}
            onLive={() => setScreen("live")}
            onSchedule={() => setScreen("schedule")}
            onRite={(index) => {
              setSectionIndex(index);
              setDayIndex(0);
              setScreen("schedule");
            }}
            onArchive={() => setScreen("archive")}
            onWatch={(item) => {
              setWatch(item);
              setBackTo("home");
              setScreen("watch");
            }}
            onSettings={() => setScreen("settings")}
          />
        ) : null}
        {screen === "live" ? (
          <PlayerChrome
            title={stream?.title || "Св. Месса"}
            kicker="Прямой эфир"
            onBack={goBack}
            full={full}
            onFull={() => setFull((value) => !value)}
          >
            {!settings.streamOverride.trim() && !forceLive && !holdLive && (stream == null || stream.onAir === false) ? (
              stream?.onAir === false ? (
                <OfflineNotice agenda={agenda} onForce={() => setForceLive(true)} />
              ) : (
                <div className="relative flex h-full min-h-80 items-center justify-center overflow-hidden bg-wine-deep text-center">
                  <img src="/splash.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                  <div className="absolute inset-0 bg-wine-deep/65" />
                  <p className="relative font-display text-4xl text-gold-2">Проверяем эфир</p>
                </div>
              )
            ) : source.mode === "hls" ? (
              <HlsVideo src={source.src} title={stream?.title || "Св. Месса"} />
            ) : (
              <iframe
                title="Прямая трансляция мессы"
                src={source.src}
                className="h-full w-full bg-wine-deep shadow-[inset_0_0_0_1px_#c4a46a]"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
              />
            )}
          </PlayerChrome>
        ) : null}
        {screen === "schedule" && section && day ? (
          <ScheduleView
            sections={schedule.sections}
            sectionIndex={sectionIndex}
            dayIndex={dayIndex}
            source={schedule.source}
            notice={schedule.notice}
            onSection={(index) => {
              setSectionIndex(index);
              setDayIndex(0);
            }}
            onDay={setDayIndex}
            onLive={() => setScreen("live")}
          />
        ) : null}
        {screen === "archive" ? (
          <ArchiveView
            data={recordings}
            error={recordingsError}
            onOpen={(item) => {
              setWatch(item);
              setBackTo("archive");
              setScreen("watch");
            }}
            onRetry={() => {
              setRecordingsError("");
              const source = settings.archiveSource || "auto";
              fetch("/api/recordings?source=" + encodeURIComponent(source) + "&rutube=" + encodeURIComponent(settings.rutubeId || ""))
                .then((r) => r.json())
                .then((data: RecordingsPayload) => setRecordings(data))
                .catch(() => setRecordingsError("Не удалось загрузить записи."));
            }}
          />
        ) : null}
        {screen === "watch" && watch ? (
          <PlayerChrome
            title={watch.title}
            kicker="Запись"
            onBack={goBack}
            full={full}
            onFull={() => setFull((value) => !value)}
          >
            <iframe
              title={watch.title}
              src={recordingEmbed(watch, settings)}
              className="h-full w-full bg-wine-deep"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
            />
          </PlayerChrome>
        ) : null}
        {screen === "settings" ? (
          <SettingsView
            settings={settings}
            sample={proxySample}
            onChange={updateSettings}
            onReset={() => {
              saveSettings(DEFAULT_SETTINGS);
              setSettings(DEFAULT_SETTINGS);
            }}
          />
        ) : null}
      </main>

      <nav className={"grid grid-cols-5 gap-1 border-t border-line/50 bg-wine px-2 py-2 sm:px-4" + (full ? " hidden" : "")}>
        {NAV.map((item) => {
          const active = screen === item.id || (screen === "watch" && item.id === "archive");
          const Icon =
            item.id === "home"
              ? House
              : item.id === "live"
              ? Radio
              : item.id === "schedule"
                ? CalendarDays
                : item.id === "archive"
                  ? Clapperboard
                  : Settings;
          return (
            <button
              key={item.id}
              data-tv=""
              className={
                "tv-focus flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-xs sm:text-sm " +
                (active ? "bg-panel-2 text-gold-2" : "text-muted")
              }
              onClick={() => setScreen(item.id)}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{item.label}</span>
              <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-gold/80 bg-wine-deep px-1 text-[11px] leading-none text-gold-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                {item.key}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

type GithubRelease = {
  version: string;
  phone?: string;
  tv?: string;
  wgt?: string;
  newer: boolean;
};

function versionNewer(remote: string, local: string) {
  const a = remote.replace(/^v/, "").split(".");
  const b = local.split(".");
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = Number(a[i] || 0);
    const y = Number(b[i] || 0);
    if (x !== y) return x > y;
  }
  return false;
}

let releasePromise: Promise<GithubRelease | null> | null = null;

function loadGithubRelease() {
  if (!releasePromise) {
    releasePromise = fetch("https://api.github.com/repos/GrafAtRuss/catedra-tv/releases/latest")
      .then((response) => response.json())
      .then((data) => {
        const version = String(data.tag_name || "").replace(/^v/, "");
        const assets: { name?: string; browser_download_url?: string }[] = data.assets || [];
        const find = (pred: (name: string) => boolean) =>
          assets.find((asset) => pred(asset.name || ""))?.browser_download_url;
        return {
          version,
          phone: find((name) => name.startsWith("Catedra-Phone-") && name.endsWith(".apk")),
          tv: find((name) => name.startsWith("Catedra-TV-") && name.endsWith(".apk"))
            || find((name) => name.startsWith("Catedra-") && !name.includes("Phone") && name.endsWith(".apk")),
          wgt: find((name) => name.startsWith("Catedra-TV-") && name.endsWith(".wgt"))
            || find((name) => name.endsWith(".wgt")),
          newer: versionNewer(version, APP_VERSION),
        };
      })
      .catch(() => null);
  }
  return releasePromise;
}

function useGithubRelease() {
  const [release, setRelease] = useState<GithubRelease | null>(null);
  useEffect(() => {
    let gone = false;
    loadGithubRelease().then((value) => {
      if (!gone) setRelease(value);
    });
    return () => {
      gone = true;
    };
  }, []);
  return release;
}

function Home({
  agenda,
  schedule,
  poster,
  recordings,
  onLive,
  onSchedule,
  onRite,
  onArchive,
  onWatch,
  onSettings,
}: {
  agenda: ReturnType<typeof agendaFor>;
  schedule: SchedulePayload;
  poster: string;
  recordings: Recording[];
  onLive: () => void;
  onSchedule: () => void;
  onRite: (index: number) => void;
  onArchive: () => void;
  onWatch: (item: { id: string; title: string; host?: "youtube" | "rutube" }) => void;
  onSettings: () => void;
}) {
  const release = useGithubRelease();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      {release?.newer ? (
        <a
          href={release.phone || release.tv || release.wgt || "https://github.com/GrafAtRuss/catedra-tv/releases/latest"}
          className="tv-focus rounded-card border border-gold/50 bg-panel px-4 py-3 text-left"
        >
          <p className="text-xs tracking-widest text-gold uppercase">Обновление</p>
          <p className="mt-1 text-ivory">Доступна версия {release.version}. Скачать с GitHub.</p>
        </a>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <button
          data-tv=""
          onClick={onLive}
          className="tv-focus relative min-h-64 overflow-hidden rounded-card border border-line/60 bg-panel text-left"
        >
          {poster ? (
            <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
          ) : null}
          <span className="absolute inset-0 bg-gradient-to-t from-wine-deep via-wine/70 to-wine/20" />
          <span className="relative flex h-full flex-col justify-between p-5 sm:p-7">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/50 bg-wine/70 px-3 py-1 text-xs tracking-widest text-gold-2 uppercase">
              <span className="size-1.5 rounded-full bg-liturgy" />
              Прямой эфир
            </span>
            <span>
              <span className="block font-display text-4xl text-ivory sm:text-5xl">Святая Месса</span>
              <span className="mt-2 block max-w-md text-sm text-muted">
                Трансляция с catedra.ru/online через Kinescope.
              </span>
              <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-wine-deep">
                <Play className="size-4" aria-hidden="true" />
                Смотреть
              </span>
            </span>
          </span>
        </button>

        <section className="flex flex-col gap-3 rounded-card border border-line/60 bg-panel p-5">
          <p className="text-xs tracking-widest text-gold uppercase">Расписание · МСК</p>
          {agenda.current ? (
            <div>
              <p className="text-xs text-muted">Сейчас</p>
              <h2 className="font-display text-3xl leading-tight text-ivory">
                {agenda.current.time} {agenda.current.title}
              </h2>
              {agenda.current.end ? <p className="text-sm text-muted">до {agenda.current.end}</p> : null}
            </div>
          ) : (
            <h2 className="font-display text-3xl leading-tight text-ivory">Сейчас службы нет</h2>
          )}
          {agenda.next ? (
            <p className="text-sm text-ivory">
              Дальше {agenda.next.time} {agenda.next.title}
              {!agenda.current && agenda.nextDay ? " · " + agenda.nextDay.toLowerCase() : ""}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {schedule.sections.map((section, index) => (
              <button
                key={section.title}
                data-tv=""
                onClick={() => onRite(index)}
                className="tv-focus rounded-full border border-line px-3 py-1.5 text-sm text-ivory"
              >
                {section.title}
              </button>
            ))}
          </div>
          <button data-tv="" onClick={onSchedule} className="tv-focus w-fit text-sm text-gold">
            Всё расписание
          </button>
          <p className="mt-auto pt-1 text-xs text-muted">
            {schedule.source === "live" ? "С catedra.ru/schedule" : schedule.notice || "Сохранённое расписание"}
          </p>
        </section>
      </div>

      <section className="rounded-card border border-line/60 bg-wine p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl text-gold-2">Сегодня</h2>
          <p className="text-sm text-muted">{agenda.clock.dayName.toLowerCase()}</p>
        </div>
        <ul className="grid gap-2 md:grid-cols-2">
          {agenda.today.length === 0 ? (
            <li className="text-sm text-muted">В обычном расписании на этот день служб нет.</li>
          ) : (
            agenda.today.map((service) => {
              const active = agenda.current?.time === service.time && agenda.current.title === service.title;
              return (
                <li
                  key={service.time + service.title}
                  className={
                    "flex gap-3 rounded-xl border px-3 py-2 " +
                    (active ? "border-gold/70 bg-panel" : "border-line/40")
                  }
                >
                  <span className="w-14 shrink-0 font-display text-xl text-gold tabular-nums">{service.time}</span>
                  <span>
                    <span className="block text-sm text-ivory">{service.title}</span>
                    {service.end ? <span className="text-xs text-muted">до {service.end}</span> : null}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="rounded-card border border-line/60 bg-panel p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl text-gold-2">Записи</h2>
          <button data-tv="" onClick={onArchive} className="tv-focus text-sm text-gold">
            Все записи
          </button>
        </div>
        {recordings.length === 0 ? (
          <p className="text-sm text-muted">Последние эфиры канала прихода на YouTube появятся здесь.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recordings.map((item) => (
              <button
                key={item.id}
                data-tv=""
                onClick={() => onWatch({ id: item.id, title: item.title, host: item.host })}
                className="tv-focus overflow-hidden rounded-xl border border-line/50 bg-wine text-left"
              >
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt="" className="h-28 w-full object-cover" />
                ) : (
                  <span className="block h-28 bg-wine-deep" />
                )}
                <span className="block px-3 py-2 text-sm text-ivory">{item.title}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <button
        data-tv=""
        onClick={onSettings}
        className="tv-focus rounded-card border border-line/60 bg-wine px-5 py-4 text-left"
      >
        <span className="block font-display text-2xl text-gold-2">Настройки</span>
        <span className="mt-1 block text-sm text-muted">
          Прокси: префикс http://хост:порт или параметр url. Свой Invidious или Piped для записей и запасная ссылка на эфир, в том числе .m3u8.
        </span>
      </button>
    </div>
  );
}

function OfflineNotice({
  agenda,
  onForce,
}: {
  agenda: ReturnType<typeof agendaFor>;
  onForce: () => void;
}) {
  const current = agenda.current;
  const next = agenda.next;
  const line = current
    ? "По расписанию сейчас " +
      current.time +
      " " +
      current.title +
      (current.end ? ", до " + current.end : "") +
      ". Эфир ещё не включён."
    : next
      ? "Ближайшая служба — " +
        next.time +
        " " +
        next.title +
        (agenda.nextDay ? ", " + agenda.nextDay.toLowerCase() : "") +
        "."
      : "Ближайшая служба появится в расписании.";
  return (
    <div className="relative flex h-full min-h-80 items-center justify-center overflow-hidden bg-wine-deep text-center">
      <img src="/splash.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-wine-deep/50 via-wine/75 to-wine-deep" />
      <div className="relative max-w-lg px-6 py-10">
        <img src="/icon-192.png" alt="" className="mx-auto size-20 rounded-2xl shadow-lg" />
        <p className="mt-5 text-xs tracking-[0.25em] text-gold uppercase">Прямой эфир</p>
        <h2 className="mt-2 font-display text-4xl leading-tight text-gold-2 sm:text-5xl">Сейчас трансляции нет</h2>
        <p className="mt-3 text-sm leading-relaxed text-ivory">{line}</p>
        <p className="mt-4 text-xs text-muted">Плеер откроется здесь сам, когда начнётся трансляция.</p>
        <button data-tv="" onClick={onForce} className="tv-focus mt-4 text-sm text-gold underline-offset-2 hover:underline">
          Открыть плеер всё равно
        </button>
      </div>
    </div>
  );
}

function PlayerChrome({
  title,
  kicker,
  onBack,
  onFull,
  full,
  children,
}: {
  title: string;
  kicker: string;
  onBack: () => void;
  onFull?: () => void;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={
        full
          ? "flex h-full min-h-0 flex-col overflow-hidden bg-wine-deep"
          : "mx-auto flex h-[70vh] min-h-80 max-w-6xl flex-col overflow-hidden rounded-card border border-line/60 bg-wine-deep"
      }
    >
      <div className="flex items-center gap-3 border-b border-line/40 px-3 py-2">
        <button
          data-tv=""
          onClick={onBack}
          className="tv-focus inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm text-ivory"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Назад
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-widest text-gold uppercase">{kicker}</p>
          <p className="truncate text-sm text-ivory">{title}</p>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {children}
        {onFull ? (
          <button
            data-tv=""
            data-fs=""
            onClick={onFull}
            className="tv-focus absolute top-3 right-3 z-10 inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-gold bg-wine-deep/90 px-3 text-sm text-gold-2 shadow-lg"
          >
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-gold/80 bg-wine-deep px-1 text-xs">5</span>
            {full ? "Окно" : "На весь экран"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ScheduleView({
  sections,
  sectionIndex,
  dayIndex,
  source,
  notice,
  onSection,
  onDay,
  onLive,
}: {
  sections: SchedulePayload["sections"];
  sectionIndex: number;
  dayIndex: number;
  source: SchedulePayload["source"];
  notice?: string;
  onSection: (index: number) => void;
  onDay: (index: number) => void;
  onLive: () => void;
}) {
  const section = sections[sectionIndex];
  const day = section.days[Math.min(dayIndex, section.days.length - 1)];
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-4xl text-ivory">Расписание</h2>
          <p className="text-sm text-muted">
            {source === "live" ? "Обновлено с catedra.ru/schedule" : notice}
          </p>
        </div>
        <button data-tv="" onClick={onLive} className="tv-focus inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-4 text-sm font-semibold text-wine-deep">
          <Radio className="size-4" aria-hidden="true" />
          Открыть эфир
        </button>
      </div>
      <div className="flex flex-col gap-2 landscape:flex-row landscape:flex-wrap">
        {sections.map((entry, index) => (
          <button
            key={entry.title}
            data-tv=""
            onClick={() => onSection(index)}
            className={
              "tv-focus w-full rounded-2xl border px-4 py-3 text-left text-sm landscape:w-auto " +
              (index === sectionIndex ? "border-gold bg-panel text-gold-2" : "border-line text-muted")
            }
          >
            {entry.title}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {section.days.map((entry, index) => (
          <button
            key={entry.name}
            data-tv=""
            onClick={() => onDay(index)}
            className={
              "tv-focus shrink-0 rounded-xl border px-3 py-2 text-sm " +
              (entry.name === day.name && index === Math.min(dayIndex, section.days.length - 1)
                ? "border-gold bg-panel-2 text-ivory"
                : "border-line/70 text-muted")
            }
          >
            {entry.name.charAt(0) + entry.name.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <ul className="overflow-hidden rounded-card border border-line/60">
        {day.items.map((service, index) => (
          <li
            key={service.time + service.title}
            className={"flex gap-4 px-4 py-3 " + (index % 2 ? "bg-panel" : "bg-wine")}
          >
            <span className="w-16 shrink-0 font-display text-2xl text-gold tabular-nums">{service.time}</span>
            <span>
              <span className="block text-ivory">{service.title}</span>
              {service.end ? <span className="text-xs text-muted">до {service.end}</span> : null}
              {service.note ? <span className="mt-1 block text-sm text-muted">{service.note}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Изменения публикуют в приходских объявлениях. Время московское. Крипта — византийский обряд.
      </p>
    </div>
  );
}

function ArchiveView({
  data,
  error,
  onOpen,
  onRetry,
}: {
  data: RecordingsPayload | null;
  error: string;
  onOpen: (item: WatchItem) => void;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div>
        <h2 className="font-display text-4xl text-ivory">Записи</h2>
        <p className="text-sm text-muted">
          {data?.notice || (data?.channelTitle || "Канал прихода") + " · последние эфиры на YouTube"}
        </p>
      </div>
      {!data && !error ? <p className="text-muted">Загрузка записей…</p> : null}
      {error ? (
        <div className="rounded-card border border-line bg-panel p-4">
          <p className="text-ivory">{error}</p>
          <button data-tv="" onClick={onRetry} className="tv-focus mt-3 rounded-full border border-line px-4 py-2 text-sm">
            Повторить
          </button>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.items.map((item: Recording) => (
          <button
            key={item.id}
            data-tv=""
            onClick={() => onOpen({ id: item.id, title: item.title, host: item.host })}
            className="tv-focus overflow-hidden rounded-card border border-line/60 bg-panel text-left"
          >
            <span className="relative block aspect-video bg-wine">
              {item.thumbnail ? (
                <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
              ) : null}
              <Play className="absolute right-3 bottom-3 size-8 rounded-full bg-wine/80 p-1.5 text-gold-2" />
            </span>
            <span className="block p-3">
              <span className="line-clamp-2 text-sm text-ivory">{item.title}</span>
              <span className="mt-1 block text-xs text-muted">
                {formatWhen(item.published)}
                {item.views ? " · " + item.views + " просмотров" : ""}
              </span>
            </span>
          </button>
        ))}
      </div>
      <a data-tv="" href={data?.channelUrl || CHANNEL_URL} className="tv-focus w-fit text-sm text-gold-2 underline-offset-4 hover:underline">
        {data?.channelUrl?.includes("rutube") ? "Канал прихода на Рутубе" : "Канал прихода на YouTube"}
      </a>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

const fieldClass =
  "tv-focus min-h-12 rounded-xl border border-line bg-wine px-3 text-base text-ivory";

function SettingsView({
  settings,
  sample,
  onChange,
  onReset,
}: {
  settings: AppSettings;
  sample: string;
  onChange: (patch: Partial<AppSettings>) => void;
  onReset: () => void;
}) {
  const release = useGithubRelease();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h2 className="font-display text-4xl text-ivory">Настройки</h2>
        <p className="text-sm text-muted">
          Прокси и адрес Invidious сохраняются на этом устройстве. В виджете на телевизоре те же поля.
        </p>
      </div>

      <section className="flex flex-col gap-2 rounded-card border border-line/60 bg-panel p-4 sm:p-5">
        <h3 className="text-lg text-ivory">Обновление</h3>
        <p className="text-sm text-muted">
          Сейчас {APP_VERSION}. Телефон и телевизор сами проверяют{" "}
          <a className="text-gold underline-offset-2 hover:underline" href="https://github.com/GrafAtRuss/catedra-tv/releases/latest">
            релизы GitHub
          </a>{" "}
          и предлагают установку. Здесь можно скачать ту же сборку.
        </p>
        <p className="text-sm text-ivory">
          {release?.newer
            ? "Доступна версия " + release.version + "."
            : release
              ? "На GitHub сейчас " + release.version + "."
              : "Проверяю GitHub…"}
        </p>
        {release?.newer ? (
          <a href={release.phone || release.tv || release.wgt} className="w-fit text-sm text-gold underline-offset-2 hover:underline">
            Скачать {release.version}
          </a>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 rounded-card border border-line/60 bg-panel p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg text-ivory">Прокси</h3>
            <p className="text-sm text-muted">Для YouTube и потока, если они не открываются напрямую.</p>
          </div>
          <button
            data-tv=""
            role="switch"
            aria-checked={settings.proxyOn}
            onClick={() => onChange({ proxyOn: !settings.proxyOn })}
            className={
              "tv-focus relative h-8 w-14 shrink-0 rounded-full " +
              (settings.proxyOn ? "bg-gold" : "bg-wine border border-line")
            }
          >
            <span
              className={
                "absolute top-1 size-6 rounded-full bg-ivory transition-transform " +
                (settings.proxyOn ? "left-7" : "left-1")
              }
            />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["prefix", "Префикс хост:порт"],
              ["query", "Параметр url"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              data-tv=""
              onClick={() => onChange({ proxyMode: mode })}
              className={
                "tv-focus rounded-full border px-4 py-2 text-sm " +
                (settings.proxyMode === mode ? "border-gold text-gold-2" : "border-line text-muted")
              }
            >
              {label}
            </button>
          ))}
        </div>
        <Field label={settings.proxyMode === "prefix" ? "Адрес, например http://192.168.1.10:8888" : "База, например https://прокси.example/fetch?url="}>
          <input
            data-tv=""
            value={settings.proxyUrl}
            onChange={(event) => onChange({ proxyUrl: event.target.value })}
            className={fieldClass}
            placeholder={settings.proxyMode === "prefix" ? "http://192.168.1.10:8888" : "https://прокси.example/?url="}
            spellCheck={false}
            autoCapitalize="off"
          />
        </Field>
        <p className="break-all text-xs text-muted">
          {settings.proxyOn && settings.proxyUrl.trim()
            ? "Запрос ленты пойдёт так: " + sample
            : settings.proxyMode === "prefix"
              ? "Виджет запросит http://хост:порт/https://исходная-ссылка — так умеют многие локальные прокси."
              : "К адресу добавится параметр url с исходной ссылкой."}
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-card border border-line/60 bg-panel p-4 sm:p-5">
        <h3 className="text-lg text-ivory">Записи YouTube</h3>
        <Field label="Свой Invidious или Piped (пусто — обычный YouTube)">
          <input
            data-tv=""
            value={settings.youtubeBase}
            onChange={(event) => onChange({ youtubeBase: event.target.value })}
            className={fieldClass}
            placeholder="https://yewtu.be"
            spellCheck={false}
            autoCapitalize="off"
          />
        </Field>
        <p className="text-xs text-muted">
          Плеер откроет адрес вида ваш-инстанс/embed/ID. Нужен, если встроенный YouTube на телевизоре не запускается.
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-card border border-line/60 bg-panel p-4 sm:p-5">
        <h3 className="text-lg text-ivory">Если YouTube недоступен</h3>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["auto", "Авто"],
              ["youtube", "Только YouTube"],
              ["rutube", "Только Рутуб"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              data-tv=""
              onClick={() => onChange({ archiveSource: mode })}
              className={
                "tv-focus rounded-full border px-4 py-2 text-sm " +
                (settings.archiveSource === mode ? "border-gold text-gold-2" : "border-line text-muted")
              }
            >
              {label}
            </button>
          ))}
        </div>
        <Field label="Номер канала Рутуба (пусто — канал прихода)">
          <input
            data-tv=""
            value={settings.rutubeId}
            onChange={(event) => onChange({ rutubeId: event.target.value })}
            className={fieldClass}
            placeholder="40512872"
            spellCheck={false}
            autoCapitalize="off"
          />
        </Field>
        <p className="text-xs text-muted">
          На Рутубе у прихода 366 записей месс, последняя — 13 июля 2025. Яндекс, Дзен и ВК такого архива не ведут. В режиме «Авто» Рутуб открывается, только если лента YouTube не загрузилась. Канал: {RUTUBE_URL}
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-card border border-line/60 bg-panel p-4 sm:p-5">
        <h3 className="text-lg text-ivory">Трансляция</h3>
        <Field label="Своя ссылка: страница Kinescope или файл .m3u8. Пусто — официальный эфир.">
          <input
            data-tv=""
            value={settings.streamOverride}
            onChange={(event) => onChange({ streamOverride: event.target.value })}
            className={fieldClass}
            placeholder="https://kinescope.io/0ctuKXYjVsu6o6C5LUe6Fj"
            spellCheck={false}
            autoCapitalize="off"
          />
        </Field>
        <p className="text-xs text-muted">
          На UE49N5500 надёжнее прямая ссылка .m3u8: телевизор играет её своим плеером, без современного сайта Kinescope.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line/60 bg-panel p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <img src="/icon-192.png" alt="" className="size-16 rounded-2xl" />
          <div>
            <h3 className="font-display text-3xl leading-none text-gold-2">Кафедра</h3>
            <p className="mt-1 text-sm tabular-nums text-muted">Версия {APP_VERSION}</p>
          </div>
        </div>
        <p className="text-sm text-ivory">Автор — {APP_AUTHOR}</p>
        <a href={"mailto:" + APP_EMAIL} className="w-fit text-sm text-gold underline-offset-2 hover:underline">
          {APP_EMAIL}
        </a>
      </section>

      <button data-tv="" onClick={onReset} className="tv-focus w-fit rounded-full border border-line px-4 py-2 text-sm text-muted">
        Сбросить настройки
      </button>
    </div>
  );
}
