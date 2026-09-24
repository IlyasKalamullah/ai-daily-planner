"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarIcon, CloseIcon, SendIcon, SparkIcon } from "./Icons";

type Proposal = {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  location?: string;
  description?: string;
};

type Item =
  | { kind: "msg"; role: "user" | "assistant"; content: string }
  | { kind: "error"; content: string }
  | { kind: "proposal"; proposal: Proposal; status: "pending" | "saving" | "saved" | "cancelled" };

const SUGGESTIONS = [
  "Hari ini ada jadwal apa?",
  "Besok padat nggak?",
  "Minggu ini kosong hari apa?",
  "Tambahkan olahraga besok jam 6 sore",
];

/* ---------- Markdown ringan: **tebal**, *miring*, dan daftar "- " ---------- */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const m = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (m) {
      list.push(m[1]);
    } else {
      flush();
      if (line.trim()) blocks.push(<p key={`p-${blocks.length}`}>{inline(line.trim())}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

function formatProposal(p: Proposal) {
  const date = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${p.date}T12:00:00Z`));
  if (p.allDay || !p.startTime) return `${date} · seharian`;
  return `${date} · ${p.startTime.replace(":", ".")}${p.endTime ? `–${p.endTime.replace(":", ".")}` : ""}`;
}

export default function Chat({
  timeZone,
  onEventCreated,
  open,
  onClose,
}: {
  timeZone: string;
  onEventCreated: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Item[]>([
    {
      kind: "msg",
      role: "assistant",
      content: "Halo! Tanyakan apa saja tentang jadwalmu, atau minta saya menambahkan jadwal baru.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items, loading]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setInput("");
    const next: Item[] = [...items, { kind: "msg", role: "user", content }];
    setItems(next);
    setLoading(true);

    const history = next
      .filter((i): i is Extract<Item, { kind: "msg" }> => i.kind === "msg")
      .slice(1)
      .map((i) => ({ role: i.role, content: i.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, timeZone }),
      });
      if (res.status === 401) {
        window.location.href = "/";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan");
      setRemaining(data.remaining);
      setItems((prev) => [
        ...prev,
        { kind: "msg", role: "assistant", content: data.reply },
        ...((data.proposals || []) as Proposal[]).map(
          (p): Item => ({ kind: "proposal", proposal: p, status: "pending" })
        ),
      ]);
    } catch (e: any) {
      setItems((prev) => [...prev, { kind: "error", content: e.message }]);
    } finally {
      setLoading(false);
    }
  }

  async function confirm(index: number) {
    const item = items[index];
    if (item.kind !== "proposal") return;
    setStatus(index, "saving");
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: item.proposal, timeZone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setStatus(index, "saved");
      onEventCreated();
    } catch (e: any) {
      setStatus(index, "pending");
      setItems((prev) => [...prev, { kind: "error", content: e.message }]);
    }
  }

  function setStatus(index: number, status: "pending" | "saving" | "saved" | "cancelled") {
    setItems((prev) => prev.map((it, i) => (i === index && it.kind === "proposal" ? { ...it, status } : it)));
  }

  return (
    <aside className={`card chat ${open ? "open" : ""}`} aria-label="Asisten jadwal">
      <div className="chat-head">
        <div className="bot-avatar">
          <SparkIcon size={20} />
        </div>
        <div className="titles">
          <strong>Asisten Jadwal</strong>
          <small>{remaining !== null ? `Sisa ${remaining} pertanyaan hari ini` : "Terhubung ke Google Calendar"}</small>
        </div>
        <button className="btn btn-ghost btn-icon chat-close" onClick={onClose} aria-label="Tutup chat">
          <CloseIcon />
        </button>
      </div>

      <div className="messages">
        {items.map((it, i) => {
          if (it.kind === "msg") {
            return (
              <div key={i} className={`msg ${it.role}`}>
                {it.role === "assistant" ? <Markdown text={it.content} /> : it.content}
              </div>
            );
          }
          if (it.kind === "error") {
            return (
              <div key={i} className="msg error">
                {it.content}
              </div>
            );
          }
          const p = it.proposal;
          return (
            <div key={i} className="proposal">
              <div className="p-head">
                <div className="p-icon">
                  <CalendarIcon />
                </div>
                <div>
                  <div className="p-title">{p.title}</div>
                  <div className="p-meta">
                    {formatProposal(p)}
                    {p.location ? ` · ${p.location}` : ""}
                  </div>
                </div>
              </div>
              {it.status === "saved" ? (
                <div className="p-status">✓ Tersimpan di Google Calendar</div>
              ) : it.status === "cancelled" ? (
                <div className="p-status muted">Dibatalkan</div>
              ) : (
                <div className="row">
                  <button className="btn" disabled={it.status === "saving"} onClick={() => setStatus(i, "cancelled")}>
                    Batal
                  </button>
                  <button className="btn btn-primary" disabled={it.status === "saving"} onClick={() => confirm(i)}>
                    {it.status === "saving" ? "Menyimpan…" : "Simpan"}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {items.length === 1 && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {loading && (
          <div className="typing" aria-label="Sedang mengecek jadwal">
            <i />
            <i />
            <i />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="composer-inner">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanya jadwalmu…"
            maxLength={1000}
            aria-label="Pesan"
            enterKeyHint="send"
          />
          <button className="btn btn-primary btn-icon" type="submit" disabled={loading || !input.trim()} aria-label="Kirim">
            <SendIcon />
          </button>
        </div>
      </form>
    </aside>
  );
}
