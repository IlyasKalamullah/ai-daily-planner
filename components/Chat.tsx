"use client";

import { useEffect, useRef, useState } from "react";

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
  "Tanggal 12 ada jadwal apa?",
  "Minggu ini kosong hari apa?",
];

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
}: {
  timeZone: string;
  onEventCreated: () => void;
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setInput("");
    const next: Item[] = [...items, { kind: "msg", role: "user", content }];
    setItems(next);
    setLoading(true);

    const history = next
      .filter((i): i is Extract<Item, { kind: "msg" }> => i.kind === "msg")
      .slice(1) // lewati salam pembuka
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
    setItems((prev) =>
      prev.map((it, i) => (i === index && it.kind === "proposal" ? { ...it, status } : it))
    );
  }

  return (
    <aside className="panel chat">
      <div className="chat-head">
        <strong>Asisten Jadwal</strong>
        {remaining !== null && <span>Sisa {remaining} pertanyaan hari ini</span>}
      </div>

      <div className="messages">
        {items.map((it, i) => {
          if (it.kind === "msg") {
            return (
              <div key={i} className={`msg ${it.role}`}>
                {it.content}
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
              <div className="p-title">📅 {p.title}</div>
              <div className="p-meta">
                {formatProposal(p)}
                {p.location ? ` · ${p.location}` : ""}
              </div>
              {it.status === "saved" ? (
                <div className="p-meta">✅ Tersimpan di Google Calendar</div>
              ) : it.status === "cancelled" ? (
                <div className="p-meta">Dibatalkan</div>
              ) : (
                <div className="row">
                  <button className="btn btn-primary" disabled={it.status === "saving"} onClick={() => confirm(i)}>
                    {it.status === "saving" ? "Menyimpan…" : "Simpan ke Calendar"}
                  </button>
                  <button className="btn" disabled={it.status === "saving"} onClick={() => setStatus(i, "cancelled")}>
                    Batal
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
        {loading && <div className="typing">Sedang mengecek jadwal…</div>}
        <div ref={bottomRef} />
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Contoh: tanggal 12 ada jadwal apa?"
          maxLength={1000}
          aria-label="Pesan"
        />
        <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>
          Kirim
        </button>
      </form>
    </aside>
  );
}
