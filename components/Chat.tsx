"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarIcon, ChatIcon, CloseIcon, EditIcon, MailIcon, SendIcon, TrashIcon } from "./Icons";
import { api, describeChanges, formatDateLong, RSVP_LABEL } from "@/lib/client";
import type { NewEvent, Proposal } from "@/lib/types";

type Status = "pending" | "saving" | "saved" | "cancelled";

type Item =
  | { kind: "msg"; role: "user" | "assistant"; content: string }
  | { kind: "error"; content: string }
  | { kind: "proposal"; proposal: Proposal; status: Status };

const SUGGESTIONS = [
  "Hari ini ada jadwal apa?",
  "Besok padat nggak?",
  "Minggu ini kosong hari apa?",
  "Tambahkan olahraga besok jam 6 sore",
  "Ada undangan yang belum aku jawab?",
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

function formatNew(p: NewEvent) {
  const date = formatDateLong(p.date);
  if (p.allDay || !p.startTime) return `${date} · seharian`;
  return `${date} · ${p.startTime.replace(":", ".")}${p.endTime ? `–${p.endTime.replace(":", ".")}` : ""}`;
}

const CARD = {
  create: { icon: <CalendarIcon />, tone: "", confirm: "Simpan", done: "Tersimpan di Google Calendar" },
  update: { icon: <EditIcon />, tone: "", confirm: "Simpan perubahan", done: "Jadwal diperbarui" },
  delete: { icon: <TrashIcon />, tone: "danger", confirm: "Hapus", done: "Jadwal dihapus" },
  rsvp: { icon: <MailIcon />, tone: "", confirm: "Kirim jawaban", done: "Jawaban terkirim" },
} as const;

function ProposalCard({
  p,
  status,
  onConfirm,
  onCancel,
}: {
  p: Proposal;
  status: Status;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cfg = CARD[p.type];
  let title: string;
  let lines: string[] = [];
  let label: string;
  if (p.type === "create") {
    label = "Jadwal baru";
    title = p.event.title;
    lines.push(formatNew(p.event));
    if (p.event.location) lines.push(`Lokasi: ${p.event.location}`);
    if (p.event.attendees?.length) lines.push(`Undang: ${p.event.attendees.join(", ")}`);
  } else if (p.type === "update") {
    label = "Ubah jadwal";
    title = p.title;
    lines = [p.when, ...describeChanges(p.changes)];
  } else if (p.type === "delete") {
    label = p.isOrganizer ? "Hapus jadwal" : "Hapus dari kalenderku";
    title = p.title;
    lines.push(p.when);
    if (p.isOrganizer && p.attendeeCount > 0) lines.push(`${p.attendeeCount} tamu akan diberi tahu`);
    if (!p.isOrganizer) lines.push("Kamu hanya tamu; jadwal hanya hilang dari kalendermu");
  } else {
    label = "Jawab undangan";
    title = p.title;
    lines = [p.when, `Jawaban: ${RSVP_LABEL[p.response]}`];
  }

  return (
    <div className={`proposal ${cfg.tone}`}>
      <div className="p-head">
        <div className="p-icon">{cfg.icon}</div>
        <div>
          <div className="p-label">{label}</div>
          <div className="p-title">{title}</div>
          {lines.map((l, i) => (
            <div key={i} className={`p-meta ${i > 0 && p.type === "update" ? "p-change" : ""}`}>
              {l}
            </div>
          ))}
        </div>
      </div>
      {status === "saved" ? (
        <div className="p-status">{cfg.done}</div>
      ) : status === "cancelled" ? (
        <div className="p-status muted">Dibatalkan</div>
      ) : (
        <div className="row">
          <button className="btn" disabled={status === "saving"} onClick={onCancel}>
            Batal
          </button>
          <button
            className={`btn ${cfg.tone === "danger" ? "btn-danger" : "btn-primary"}`}
            disabled={status === "saving"}
            onClick={onConfirm}
          >
            {status === "saving" ? "Memproses…" : cfg.confirm}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Chat({
  timeZone,
  onChanged,
  open,
  onClose,
}: {
  timeZone: string;
  onChanged: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Item[]>([
    {
      kind: "msg",
      role: "assistant",
      content: "Halo! Tanyakan jadwalmu, atau minta saya menambah, mengubah, dan menghapus kegiatan.",
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
    const p = item.proposal;
    setStatus(index, "saving");
    try {
      if (p.type === "create") await api.create(p.event, timeZone);
      else if (p.type === "update") await api.update(p.calendarId, p.eventId, p.changes, timeZone);
      else if (p.type === "delete") await api.remove(p.calendarId, p.eventId);
      else await api.rsvp(p.eventId, p.response);
      setStatus(index, "saved");
      onChanged();
    } catch (e: any) {
      setStatus(index, "pending");
      setItems((prev) => [...prev, { kind: "error", content: e.message }]);
    }
  }

  function setStatus(index: number, status: Status) {
    setItems((prev) => prev.map((it, i) => (i === index && it.kind === "proposal" ? { ...it, status } : it)));
  }

  return (
    <aside className={`card chat ${open ? "open" : ""}`} aria-label="Asisten jadwal">
      <div className="chat-head">
        <div className="bot-avatar">
          <ChatIcon size={19} />
        </div>
        <div className="titles">
          <strong>Tanya jadwal</strong>
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
          return (
            <ProposalCard
              key={i}
              p={it.proposal}
              status={it.status}
              onConfirm={() => confirm(i)}
              onCancel={() => setStatus(i, "cancelled")}
            />
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
