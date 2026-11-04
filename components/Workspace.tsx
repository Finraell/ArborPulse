"use client";
import { useEffect, useRef, useState } from "react";
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronRight, Clock3, Download, FileText, FolderOpen, Leaf, LoaderCircle, MapPin, Plus, ScanLine, Settings2, ShieldCheck, Sparkles, Sprout, TreePine, Upload, Video, X } from "lucide-react";
import { recordings } from "@/lib/arbor/recordings";
import { scanVideo, sampleClip } from "@/lib/arbor/video";
import { withCaptureWarning } from "@/lib/arbor/signal";
import { createBrief, reportText } from "@/lib/arbor/brief";
import type { Analysis, AIBrief, AIReceipt, Box, CapturePlan, CapturePlanEvidence, EvidenceFrame, FieldContext, Recording } from "@/lib/arbor/types";
import { AiWorkflow, EvidenceFrames, Receipt } from "./AiWorkflow";
import { ValidationPanel } from "./ValidationPanel";
import { illustratedReport } from "@/lib/arbor/report";
import { SignalChart } from "./SignalChart";
type Modal = "guide" | "method" | "saved" | "validation" | null;
type SavedReport = { id: string; name: string; date: string; text: string };
type Point = { x: number; y: number };
const defaultTree: Box = { x: .28, y: .16, width: .4, height: .42 };
const defaultReference: Box = { x: .78, y: .49, width: .16, height: .25 };
function download(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function safeName(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tree"; }

export default function Workspace() {
  const [items, setItems] = useState<Recording[]>(recordings), [selectedId, setSelectedId] = useState(recordings[0].id);
  const selected = items.find(item => item.id === selectedId) || items[0];
  const [context, setContext] = useState<FieldContext>(recordings[0]);
  const [treeBox, setTreeBox] = useState<Box>(recordings[0].treeBox), [referenceBox, setReferenceBox] = useState<Box>(recordings[0].referenceBox);
  const [analysis, setAnalysis] = useState<Analysis | null>(null), [frames, setFrames] = useState<EvidenceFrame[]>([]), [ai, setAi] = useState<AIBrief | null>(null);
  const [aiBusy, setAiBusy] = useState(false), [consent, setConsent] = useState(false), [metaReady, setMetaReady] = useState(false);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"evidence" | "brief">("evidence"), [spectral, setSpectral] = useState(false);
  const [mode, setMode] = useState<"tree" | "reference" | null>(null), [dragStart, setDragStart] = useState<Point | null>(null), [draft, setDraft] = useState<Box | null>(null);
  const [modal, setModal] = useState<Modal>(null), [saved, setSaved] = useState<SavedReport[]>([]);
  const input = useRef<HTMLInputElement>(null), video = useRef<HTMLVideoElement>(null), aborter = useRef<AbortController | null>(null), aiAborter = useRef<AbortController | null>(null), objectUrls = useRef<string[]>([]);
  const [captureEvidence, setCaptureEvidence] = useState<CapturePlanEvidence | null>(null), [planApplied, setPlanApplied] = useState(false);
  const plan = captureEvidence?.plan || null, planReceipt = captureEvidence?.receipt || null;
  const [aiReceipt, setAiReceipt] = useState<AIReceipt | null>(null);
  const [planning, setPlanning] = useState(false), [planReused, setPlanReused] = useState(false), [aiReused, setAiReused] = useState(false);
  const [sessionCalls, setSessionCalls] = useState(0), [sessionCost, setSessionCost] = useState(0), [maxRequests, setMaxRequests] = useState(20);
  const seenReceipts = useRef(new Set<string>());
  const brief = analysis ? createBrief(analysis, context) : null;
  useEffect(() => {
    fetch("/api/health").then(r => r.json() as Promise<{ metaConfigured: boolean; maxRequestsPerHour?: number }>).then(data => { setMetaReady(Boolean(data.metaConfigured)); setMaxRequests(data.maxRequestsPerHour || 20); }).catch(() => {});
    try { const data = JSON.parse(localStorage.getItem("arborpulse-reports-v1") || "[]"); if (Array.isArray(data)) setSaved(data.filter(r => typeof r?.id === "string" && typeof r?.text === "string" && typeof r?.name === "string" && typeof r?.date === "string").slice(0, 30)); } catch {}
    return () => { aborter.current?.abort(); aiAborter.current?.abort(); objectUrls.current.forEach(url => URL.revokeObjectURL(url)); };
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 4000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (!modal) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key !== "Tab") return;
      const controls = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] button, [role="dialog"] a, [role="dialog"] input, [role="dialog"] summary'));
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = priorOverflow; previousFocus?.focus(); };
  }, [modal]);
  useEffect(() => { setAi(null); setAiReceipt(null); }, [context, analysis]);
  function choose(item: Recording) {
    if (busy || aiBusy) return;
    setSelectedId(item.id); setContext(item); setTreeBox(item.treeBox); setReferenceBox(item.referenceBox); setAnalysis(null); setFrames([]); setAi(null); setConsent(false); setError(""); setTab("evidence"); setMode(null); setCaptureEvidence(null); setPlanApplied(false); setAiReceipt(null);
  }
  function upload(file?: File) {
    if (!file || busy || aiBusy) return;
    if (!/\.(mp4|mov|m4v|webm)$/i.test(file.name) && !file.type.startsWith("video/")) { setError("Choose an MP4, MOV, or WebM video."); return; }
    if (file.size > 250 * 1024 * 1024) { setError("Choose a video smaller than 250 MB. A short 20–30 second clip works best."); return; }
    const source = URL.createObjectURL(file); objectUrls.current.push(source);
    const item: Recording = { id: `upload-${Date.now()}`, name: file.name.replace(/\.[^.]+$/, ""), species: "Your recording · local to this browser", location: "", notes: "", target: "none", concern: false, synthetic: false, source, poster: "", treeBox: defaultTree, referenceBox: defaultReference };
    setItems(current => [...current, item]); choose(item); setMode("tree");
  }
  async function runScan() {
    if (busy || aiBusy) return;
    if (plan && !planApplied) { setError("Confirm the proposed regions, or keep your manual regions, before scanning."); return; }
    setError(""); setBusy(true); setProgress(0); setAi(null); setAnalysis(null); video.current?.pause();
    const controller = new AbortController(); aborter.current = controller;
    try { const result = await scanVideo(selected.source, treeBox, referenceBox, controller.signal, setProgress); setAnalysis(withCaptureWarning(result.analysis, context.captureWarning)); setFrames(result.frames); setNotice("Motion scan complete. Your evidence is ready."); }
    catch (e) { if ((e as Error).name !== "AbortError") setError((e as Error).message || "Scan failed. Please try another recording."); }
    finally { setBusy(false); aborter.current = null; }
  }
  function accountReceipt(receipt: AIReceipt, reused: boolean) {
    const id = receipt.requestId || receipt.createdAt;
    if (reused || seenReceipts.current.has(id)) return;
    seenReceipts.current.add(id); setSessionCalls(n => n + 1); setSessionCost(cost => cost + (receipt.estimatedUsd || 0));
  }
  async function inspectScene() {
    if (!consent || !metaReady || busy || aiBusy) return;
    setPlanning(true); setAiBusy(true); setError(""); video.current?.pause();
    const controller = new AbortController(); aiAborter.current = controller;
    try {
      const captured = await sampleClip(selected.source, controller.signal);
      const response = await fetch("/api/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent, context, targetTreeBox: treeBox, targetReferenceBox: referenceBox, frames: captured }), signal: controller.signal });
      const result = await response.json() as { plan: CapturePlan; receipt: AIReceipt; cached: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Scene planning failed.");
      setCaptureEvidence({ plan: result.plan, receipt: result.receipt, frames: captured }); setPlanReused(result.cached); setPlanApplied(false); accountReceipt(result.receipt, result.cached);
      setNotice("Muse Spark proposed two regions. Review them before measuring.");
    } catch (e) { if ((e as Error).name !== "AbortError") setError((e as Error).message); }
    finally { setPlanning(false); setAiBusy(false); aiAborter.current = null; }
  }
  function applyPlan() {
    if (!plan) return;
    setTreeBox(plan.treeBox); setReferenceBox(plan.referenceBox); setAnalysis(null); setAi(null); setPlanApplied(true); setMode(null);
    setNotice("Regions confirmed. Run the local motion scan next.");
  }
  function seekFrame(frame: EvidenceFrame) {
    if (video.current) { video.current.pause(); video.current.currentTime = frame.t; }
    video.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function openEvidence(ref: string) {
    const frame = frames.find(f => f.id === ref);
    if (frame) { seekFrame(frame); return; }
    if (ref.startsWith("M_")) { setTab("evidence"); document.getElementById("evidence-panel")?.scrollIntoView({ behavior: "smooth" }); }
    else document.getElementById("field-context")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  async function generateAI() {
    if (!analysis || !consent || aiBusy) return;
    setAiBusy(true); setError(""); const controller = new AbortController(); aiAborter.current = controller;
    try {
      const { samples, width, height, treeBox, referenceBox } = analysis;
      const response = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent, context, analysis: { samples, width, height, treeBox, referenceBox }, frames }), signal: controller.signal });
      const result = await response.json() as { brief: AIBrief; receipt: AIReceipt; cached: boolean; error?: string }; if (!response.ok) throw new Error(result.error || "The AI brief is unavailable.");
      setAi(result.brief); setAiReceipt(result.receipt); setAiReused(result.cached); accountReceipt(result.receipt, result.cached); setNotice("Grounded Muse Spark findings are ready. Inspect each evidence reference.");
    } catch (e) { if ((e as Error).name !== "AbortError") setError((e as Error).message); }
    finally { setAiBusy(false); aiAborter.current = null; }
  }
  function exportEvidence() { if (analysis && brief) download(JSON.stringify({ application: "ArborPulse", version: "0.2.0", context, analysis, brief, frames, capturePlan: planApplied ? plan : null, capturePlanReceipt: planApplied ? planReceipt : null, capturePlanFrames: planApplied ? captureEvidence?.frames || [] : [], aiBrief: ai, aiReceipt, aiProvider: ai ? "Meta Model API / Muse Spark" : null, createdAt: new Date().toISOString() }, null, 2), "application/json", `${safeName(context.name)}-evidence.json`); }
  function exportCsv() { if (analysis) download(["time_seconds,tree_x_px,tree_y_px,camera_x_px,camera_y_px,corrected_x_px,corrected_y_px,tracking_retention", ...analysis.samples.map(s => [s.t, s.treeX, s.treeY, s.cameraX, s.cameraY, s.x, s.y, s.quality].join(","))].join("\n"), "text/csv", `${safeName(context.name)}-motion.csv`); }
  function saveReport() {
    if (!analysis || !brief) return;
    const report = { id: `${selected.id}-${Date.now()}`, name: context.name, date: new Date().toISOString(), text: reportText(analysis, context, brief, ai) }, next = [report, ...saved].slice(0, 30);
    try { localStorage.setItem("arborpulse-reports-v1", JSON.stringify(next)); setSaved(next); setNotice("Brief saved in this browser."); } catch { setError("Browser storage is full. Download the brief to keep a copy."); }
  }
  function point(e: React.PointerEvent<HTMLDivElement>): Point { const b = e.currentTarget.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) }; }
  function pointerDown(e: React.PointerEvent<HTMLDivElement>) { if (!mode || busy) return; e.currentTarget.setPointerCapture(e.pointerId); setDragStart(point(e)); setDraft(null); }
  function pointerMove(e: React.PointerEvent<HTMLDivElement>) { if (!dragStart || !mode) return; const p = point(e); setDraft({ x: Math.min(p.x, dragStart.x), y: Math.min(p.y, dragStart.y), width: Math.abs(p.x - dragStart.x), height: Math.abs(p.y - dragStart.y) }); }
  function pointerUp() { if (draft && draft.width >= .05 && draft.height >= .05) { if (mode === "tree") setTreeBox(draft); else setReferenceBox(draft); setAnalysis(null); setAi(null); setFrames([]); setMode(null); setCaptureEvidence(null); setPlanApplied(false); } setDragStart(null); setDraft(null); }
  const displayedTree = mode === "tree" && draft ? draft : plan && !planApplied ? plan.treeBox : treeBox, displayedReference = mode === "reference" && draft ? draft : plan && !planApplied ? plan.referenceBox : referenceBox;

  return <div className="app-shell">
    <aside className="sidebar no-print">
      <a className="brand" href="/" aria-label="ArborPulse home"><span className="brand-icon"><Sprout size={23} strokeWidth={1.7}/></span><span>Arbor<span className="brand-light">Pulse</span><small>READ THE LIVING WORLD</small></span></a>
      <div className="workspace-switch"><span className="workspace-avatar">F</span><span>Field workspace<small>Personal project</small></span><ChevronRight size={15}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation"><button className="nav-item active" onClick={() => { setModal(null); document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" }); }}><Activity size={18}/><span>Inspection workspace</span><span className="nav-dot"/></button><button className="nav-item" onClick={() => setModal("saved")} aria-label={`Saved briefs, ${saved.length}`}><FolderOpen size={18}/><span>Saved briefs</span><span className="count">{saved.length}</span></button><button className="nav-item" onClick={() => setModal("guide")} aria-label="Capture guide"><Video size={18}/><span>Capture guide</span><ArrowUpRight size={13}/></button></nav>
      <div className="nav-label second">BEHIND THE EVIDENCE</div><button className="nav-item" onClick={() => setModal("method")} aria-label="The methodology"><BookOpen size={18}/><span>The methodology</span></button>
      <button className="nav-item" onClick={() => setModal("validation")} aria-label="Validation and sources"><ShieldCheck size={18}/><span>Validation & sources</span></button>
      <div className="sidebar-bottom"><div className="meta-card"><Sparkles size={20}/><p>Physics meets<br/><strong>Meta intelligence.</strong></p><span>Measured motion.<br/>More useful questions.</span><button onClick={() => { setTab("brief"); document.getElementById("evidence-panel")?.scrollIntoView({ behavior: "smooth" }); }}>Explore the field brief <ArrowRight size={14}/></button></div><div className="prototype"><span className="status-dot"/> HACKATHON BUILD <span>v0.2</span></div><div className="profile"><span className="profile-avatar">DS</span><span>Dima’s workspace<small>Indie developer / 2026</small></span></div></div>
    </aside>
    <div className="main-shell"><header className="topbar no-print"><div className="breadcrumbs">Workspace <ChevronRight size={13}/><span>Tree motion lab</span></div><div className="topbar-right"><span className="local-badge"><span className="status-dot"/> Video stays on your device</span><button className="icon-button" aria-label="Open capture guide" onClick={() => setModal("guide")}><BookOpen size={18}/></button><span className="mini-avatar">DS</span></div></header>
      <main id="workspace"><section className="page-heading no-print"><div><div className="eyebrow"><span/> FIELD INTELLIGENCE, GROUNDED IN MOTION</div><h1>Every tree has a rhythm.</h1><p>Turn a short video into measurable motion and a clearer next step.</p></div><button className="button primary new-recording" onClick={() => input.current?.click()} disabled={busy || aiBusy}><Plus size={17}/> New recording</button></section>
        <AiWorkflow ready={metaReady} busy={busy || aiBusy} planning={planning} consent={consent} setConsent={setConsent} onInspect={inspectScene} plan={plan} receipt={planReceipt} planFrames={captureEvidence?.frames || []} onFrame={seekFrame} reused={planReused} onApply={applyPlan} onDismiss={() => { setCaptureEvidence(null); setPlanApplied(false); }} applied={planApplied} hasAnalysis={Boolean(analysis)} onBrief={() => { setTab("brief"); document.getElementById("evidence-panel")?.scrollIntoView({ behavior: "smooth" }); }} sessionCalls={sessionCalls} sessionCost={sessionCost} maxRequests={maxRequests}/>
        <div className="workspace-layout">
          <section className="recordings-panel no-print" aria-label="Recordings"><div className="section-label"><h2>Recordings <span>{items.length.toString().padStart(2, "0")}</span></h2><button className="icon-button small" aria-label="Add recording" disabled={busy || aiBusy} onClick={() => input.current?.click()}><Plus size={18}/></button></div><div className="collection-label"><span className="collection-dot"/> FIELD & LAB RECORDINGS</div>
            <div className="recording-list">{items.map((item, index) => <button key={item.id} className={`recording-card ${selectedId === item.id ? "selected" : ""}`} onClick={() => choose(item)} disabled={busy || aiBusy}><div className="recording-thumb">{item.poster ? <img src={item.poster} alt={`${item.synthetic ? "Synthetic" : "Real"} ${item.name} scene`}/> : <Video size={28}/>}<span className="recording-number">{(index + 1).toString().padStart(2, "0")}</span><span className="recording-duration">{item.durationLabel || (item.synthetic ? "00:18" : "LOCAL")}</span>{selectedId === item.id && <span className="selected-mark"><Check size={13}/></span>}</div><div className="recording-info"><strong>{item.name}</strong><span>{item.synthetic ? item.id === "shake" ? "Capture quality study" : "Controlled motion study" : item.sourceUrl ? "Published field recording" : "Your field recording"}</span><div><span className={`tiny-dot ${item.id === "shake" ? "amber" : ""}`}/>{item.synthetic ? "Synthetic fixture" : item.sourceUrl ? "Real video · licensed" : "Ready to scan"}<ArrowUpRight size={12}/></div></div></button>)}</div>
            <button className="upload-card" disabled={busy || aiBusy} onClick={() => input.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}><Upload size={20}/><strong>Bring your own recording</strong><span>Drop a video or browse files</span><small>MP4, MOV, WebM · up to 250 MB</small></button><input ref={input} className="sr-only" type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.m4v,.webm" aria-label="Upload tree video" onChange={e => { upload(e.target.files?.[0]); e.target.value = ""; }}/><div className="capture-tip"><Leaf size={17}/><p>A steady camera.<br/>A little wind. A lot to learn.</p><button onClick={() => setModal("guide")}>How to capture <ArrowRight size={12}/></button></div>
          </section>
          <div className="inspection-column"><section className="video-card no-print"><div className="video-heading"><div><span className="overline">SELECTED RECORDING</span><h2>{context.name}</h2><p><MapPin size={12}/>{context.location || "Add a location in field context"}<span className="separator-dot">·</span>{selected.durationLabel || (selected.synthetic ? "18 sec" : "Your video")}</p></div><span className={`capture-badge ${context.synthetic ? "" : "real"}`}>{context.synthetic ? "SYNTHETIC DEMO" : "FIELD RECORDING"}</span></div>
            <div className={`video-stage ${mode ? "selecting" : ""}`} style={{ aspectRatio: "8 / 5" }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { setDragStart(null); setDraft(null); }}><video ref={video} key={selected.source} src={selected.source} poster={selected.poster || undefined} muted playsInline preload="metadata" controls={!mode && !busy} aria-label={`Video of ${context.name}`} onLoadedMetadata={e => { const v = e.currentTarget; if (v.videoWidth && v.videoHeight) v.parentElement!.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`; }}/><div className="scan-vignette"/><div className="stage-top"><span><span className="status-dot"/>{busy ? "ANALYZING MOTION" : analysis ? "EVIDENCE CAPTURED" : "READY FOR MOTION SCAN"}</span><span><ScanLine size={13}/> PHYSICSLENS</span></div>
              {[{ box: displayedTree, kind: "tree", label: plan && !planApplied && !mode ? "01 / PROPOSED TREE" : "01 / TREE REGION" }, { box: displayedReference, kind: "reference", label: plan && !planApplied && !mode ? "02 / PROPOSED REFERENCE" : "02 / FIXED REFERENCE" }].map(({ box, kind, label }) => <div key={kind} className={`tracking-box ${kind}`} style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}><span>{label}</span><i/><i/><i/><i/>{kind === "tree" && <span className="track-cross">+</span>}</div>)}
              {mode && <div className="selection-instruction">Drag around {mode === "tree" ? "a branch junction or crown" : "a stationary textured background"}<button onClick={e => { e.stopPropagation(); setMode(null); }} aria-label="Cancel region selection"><X size={15}/></button></div>}{busy && <div className="scan-progress"><LoaderCircle className="spin" size={18}/><span>Tracking branches, correcting camera motion…</span><strong>{Math.round(progress * 100)}%</strong><div style={{ width: `${progress * 100}%` }}/></div>}
            </div><div className="video-toolbar"><div className="region-buttons"><button className={mode === "tree" ? "selected" : ""} onClick={() => { video.current?.pause(); setMode(mode === "tree" ? null : "tree"); }} disabled={busy || aiBusy}><span className="region-key tree-key"/>Tree region</button><button className={mode === "reference" ? "selected" : ""} onClick={() => { video.current?.pause(); setMode(mode === "reference" ? null : "reference"); }} disabled={busy || aiBusy}><span className="region-key reference-key"/>Fixed reference</button></div>{busy ? <button className="button compact secondary" onClick={() => aborter.current?.abort()}>Cancel scan</button> : <button className="button compact primary" onClick={runScan} disabled={aiBusy || Boolean(mode) || Boolean(plan && !planApplied)}><ScanLine size={15}/>{analysis ? "Scan again" : "Run motion scan"}<ArrowRight size={15}/></button>}</div>
          </section>
          {selected.attribution && <div className="media-attribution">{selected.attribution} {selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Source & license ↗</a>}</div>}
          <EvidenceFrames frames={frames} onFrame={seekFrame} compact/>
          <section className="evidence-card" id="evidence-panel"><div className="evidence-tabs no-print"><div><button className={tab === "evidence" ? "active" : ""} onClick={() => setTab("evidence")}><Activity size={15}/> Motion evidence</button><button className={tab === "brief" ? "active" : ""} onClick={() => setTab("brief")}><FileText size={15}/> Field brief {brief && <span/>}</button></div><button className="icon-button small" onClick={() => setModal("method")} aria-label="How motion is measured"><Settings2 size={16}/></button></div>
            {tab === "evidence" ? <div className="evidence-content"><div className="evidence-title"><h3>Movement, made measurable.</h3><span>{analysis ? <><CheckCircle2 size={13}/> Scan complete</> : <><Clock3 size={13}/> Awaiting scan</>}</span></div><div className="metric-grid"><div className="metric"><span>Observed frequency <Activity size={12}/></span><strong>{analysis?.frequency?.toFixed(2) || "—"}<small>Hz</small></strong><p>{analysis?.frequency ? "Dominant response peak" : analysis ? "Peak not resolved" : "Frequency of observed motion"}</p></div><div className="metric"><span>Projected sway <ArrowRight size={12}/></span><strong>{analysis ? analysis.amplitude.toFixed(1) : "—"}<small>px</small></strong><p>Peak to peak, camera corrected</p></div><div className="metric"><span>Tracking retention <ScanLine size={12}/></span><strong>{analysis ? (analysis.coverage * 100).toFixed(0) : "—"}<small>%</small></strong><p>{analysis ? analysis.usable ? "Capture supports comparison" : "Recapture recommended" : "Tree + reference features"}</p></div></div><div className="chart-heading"><div><span className="chart-dot"/>{spectral ? "POWER SPECTRUM" : "HORIZONTAL DISPLACEMENT"}</div><div className="chart-toggle"><button className={!spectral ? "active" : ""} onClick={() => setSpectral(false)}>Time</button><button className={spectral ? "active" : ""} onClick={() => setSpectral(true)}>Frequency</button></div></div><SignalChart analysis={analysis} spectral={spectral}/><div className="evidence-footnote"><ShieldCheck size={14}/><span>Evidence for professional review. Motion alone does not establish tree safety.</span>{analysis && <button onClick={exportCsv}><Download size={13}/> CSV</button>}</div>{analysis && analysis.warnings.length > 0 && <div className="quality-notes"><strong>Capture notes</strong>{analysis.warnings.map(w => <p key={w}>{w}</p>)}</div>}</div> : <div className="brief-content">
              {!brief || !analysis ? <div className="empty-brief"><FileText size={32}/><h3>The evidence comes first.</h3><p>Run a motion scan to create an inspection brief with measured evidence, field context, and next steps.</p><button className="button primary compact" onClick={() => { setTab("evidence"); runScan(); }} disabled={busy || Boolean(mode) || Boolean(plan && !planApplied)}><ScanLine size={15}/> Run motion scan</button></div> : <><div className="brief-topline"><span className="overline">INSPECTION EVIDENCE BRIEF</span><span className={`priority ${brief.priority === "Review first" ? "review" : brief.priority === "Recapture" ? "recapture" : ""}`}>{brief.priority}</span></div><h3>{context.name}</h3><p className="brief-summary">{brief.summary}</p><h4>Measured evidence</h4><ul>{brief.evidence.map(text => <li key={text}>{text}</li>)}</ul><h4>Recorder notes</h4><p>{context.notes || "No field notes supplied."}</p><h4>Next steps</h4><ol>{brief.nextSteps.map(text => <li key={text}>{text}</li>)}</ol>
                <div className="ai-section no-print"><div className="ai-heading"><span><Sparkles size={17}/> A second lens, with Muse Spark</span><span className="ai-status">{metaReady ? aiReceipt ? "RESPONSE VERIFIED" : "KEY CONFIGURED" : "NOT CONFIGURED"}</span></div><p>Combine six timestamped frames, measured motion, and field notes into observations and questions for an arborist.</p>{!metaReady ? <p className="muted">The local evidence brief is ready. Muse Spark notes become available when the project’s Meta API access is connected.</p> : <><label className="consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={aiBusy}/> Send 6 timestamped frames, measurements, and these field notes to Meta for this brief.</label><button className="button secondary compact" disabled={!consent || aiBusy} onClick={generateAI}>{aiBusy ? <LoaderCircle size={15} className="spin"/> : <Sparkles size={15}/>} {aiBusy ? "Preparing AI notes…" : "Generate grounded AI brief"}</button></>}</div>
                {ai && <div className="ai-result"><h4>Muse Spark assisted notes · review required</h4><p>{ai.summary}</p><ul>{ai.findings ? ai.findings.map((finding, i) => <li key={i}><span className="finding-source">{finding.source.replace("_", " ")}</span>{finding.text}<div className="evidence-links">{finding.refs.map(ref => <button key={ref} onClick={() => openEvidence(ref)}>{ref} ↗</button>)}</div></li>) : ai.observations.map((text, i) => <li key={i}>{text}</li>)}</ul><h4>Questions for site inspection</h4><ul>{ai.questions.map((text, i) => <li key={i}>{text}</li>)}</ul><h4>Capture advice</h4><ul>{ai.captureAdvice.map((text, i) => <li key={i}>{text}</li>)}</ul>{aiReceipt && <Receipt receipt={aiReceipt} reused={aiReused}/>}<EvidenceFrames frames={frames} onFrame={seekFrame}/></div>}<details className="limitations"><summary>Limits of this evidence</summary><ul>{brief.limitations.map(text => <li key={text}>{text}</li>)}</ul></details><div className="report-actions no-print"><button className="button primary compact" onClick={() => download(reportText(analysis, context, brief, ai), "text/plain", `${safeName(context.name)}-brief.txt`)}><ArrowDownToLine size={15}/> Download brief</button><button className="button secondary compact" onClick={() => download(illustratedReport(analysis, context, brief, frames, ai, aiReceipt, planApplied ? captureEvidence : null), "application/octet-stream", `${safeName(context.name)}-illustrated-brief.html`)}>Illustrated report</button><button className="button secondary compact" onClick={() => window.print()}>Print / PDF</button><button className="text-button" onClick={saveReport}>Save in browser</button></div></>}
            </div>}
          </section></div>
          <aside className="context-column no-print"><section className="context-card" id="field-context"><div className="context-heading"><span className="small-icon"><TreePine size={17}/></span><div><h2>Field context</h2><p>The story around the tree.</p></div></div><label className="field"><span>RECORDING NAME</span><input value={context.name} maxLength={150} disabled={busy || aiBusy} onChange={e => setContext({ ...context, name: e.target.value })}/></label><label className="field"><span>LOCATION / PLOT</span><div className="input-with-icon"><MapPin size={13}/><input value={context.location} maxLength={200} placeholder="e.g. North trail / tree 04" disabled={busy || aiBusy} onChange={e => setContext({ ...context, location: e.target.value })}/></div></label><label className="field"><span>NEARBY TARGET OCCUPANCY</span><select value={context.target} disabled={busy || aiBusy} onChange={e => setContext({ ...context, target: e.target.value as FieldContext["target"] })}><option value="none">No target reported</option><option value="occasional">Occasional use</option><option value="frequent">Frequent use / occupied</option></select><small>People, paths, buildings, or utilities.</small></label><label className="concern-checkbox"><input type="checkbox" checked={context.concern} disabled={busy || aiBusy} onChange={e => setContext({ ...context, concern: e.target.checked })}/><span>Visible concern reported<small>A recorder observation, for review.</small></span></label><label className="field note-field"><span>FIELD NOTES</span><textarea rows={5} maxLength={2000} value={context.notes} disabled={busy || aiBusy} placeholder="Visible defects, nearby targets, and capture conditions." onChange={e => setContext({ ...context, notes: e.target.value })}/></label><div className="context-footer"><ShieldCheck size={14}/><p>Context shapes the review queue.<br/>Sway is evidence, not a risk score.</p></div></section>
            <section className="next-card"><div className="overline">YOUR NEXT STEP</div><h3>{analysis ? brief?.priority === "Recapture" ? "A steadier view." : "From signal to insight." : "Start with a short scan."}</h3><p>{analysis ? "Review measured evidence, add your observations, and take a useful brief into the field." : "We’ll track the tree, subtract camera movement, and trace the rhythm in between."}</p><button onClick={() => analysis ? setTab("brief") : runScan()} disabled={busy || aiBusy || Boolean(mode)}>{analysis ? "Open field brief" : busy ? `Scanning · ${Math.round(progress * 100)}%` : "Measure this recording"}<ArrowRight size={16}/></button><div className="next-card-decoration"><Activity size={68} strokeWidth={.6}/></div></section><button className="export-evidence" disabled={!analysis || busy} onClick={exportEvidence}><Download size={16}/><span>Export full evidence<small>Measurements + context · JSON</small></span><ArrowUpRight size={14}/></button>
          </aside>
        </div>{error && <div className="error-message no-print" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><X size={16}/></button></div>}<footer className="workspace-footer no-print"><span><Sprout size={14}/> A little motion. A deeper understanding.</span><button className="text-button" onClick={() => setModal("validation")}>Validation & sources</button><span>Meta Global AI Developer Hackathon <span>2026</span></span></footer>
      </main>
    </div>{notice && <div className="toast no-print" role="status"><CheckCircle2 size={17}/>{notice}</div>}
    {modal && <div className="modal-backdrop no-print" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button autoFocus className="modal-close icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><X size={20}/></button><span className="modal-icon">{modal === "guide" ? <Video/> : modal === "method" ? <BookOpen/> : <FolderOpen/>}</span><div className="overline">ARBORPULSE FIELD NOTES</div><h2 id="modal-title">{modal === "guide" ? "A good signal starts here." : modal === "method" ? "Evidence you can inspect." : modal === "validation" ? "Measured, tested, attributed." : "Your saved field briefs."}</h2>
      {modal === "validation" ? <ValidationPanel/> : modal === "guide" ? <><p>Capture a single tree in natural, modest wind. Stay at a safe distance.</p><div className="guide-step"><span>01</span><div><h3>Frame the tree and a fixed reference</h3><p>Include a branch junction and a textured wall, post, or ground patch. Keep the reference separate from moving foliage.</p></div></div><div className="guide-step"><span>02</span><div><h3>Hold steady for 20–30 seconds</h3><p>Use a tripod or brace your phone. Record in daylight; avoid panning, zooming, heavy rain, and strong wind.</p></div></div><div className="guide-step"><span>03</span><div><h3>Select, measure, review</h3><p>Upload your clip, draw the two regions, and run a scan. Add notes and target occupancy before exporting your brief.</p></div></div><p className="modal-note">This is an experimental observation tool. A qualified arborist must assess defects and site conditions in person.</p></> : modal === "method" ? <><p>PhysicsLens exposes the measurements behind every brief.</p><div className="method-grid"><div><strong>01 / Track</strong><p>Sample up to 60 seconds at 12 fps and 640 px width. Select textured corners and track 7 × 7 pixel patches with normalized correlation and a forward/backward consistency check.</p></div><div><strong>02 / Stabilize</strong><p>Subtract median stationary-reference translation from median tree-feature translation. Rotation, parallax, rolling shutter, and non-rigid foliage remain limitations.</p></div><div><strong>03 / Measure</strong><p>Detrend the projected motion, apply a Hann window, and compute a discrete Fourier spectrum. Suppress frequency when tracks, cycles, or signal strength are insufficient.</p></div><div><strong>04 / Ground</strong><p>Build the queue from capture quality, recorder-reported concerns, and occupied targets. Muse Spark proposes regions before measurement and cites source frames and metric IDs in its interpretation. You confirm the regions and review the findings.</p></div></div><p className="modal-note">This tool reports observed image motion, not hidden decay or failure probability. Synthetic fixtures, licensed real recordings, and research comparisons have separate provenance. See Validation & sources for measured results and limits.</p></> : saved.length ? <><p>Saved in this browser. Download a copy for a durable field record.</p><div className="saved-list">{saved.map(report => <button key={report.id} onClick={() => download(report.text, "text/plain", `${safeName(report.name)}-brief.txt`)}><FileText size={20}/><span><strong>{report.name}</strong><small>{new Date(report.date).toLocaleDateString()}</small></span><Download size={17}/></button>)}</div></> : <div className="saved-empty"><p>No saved briefs yet. Run a scan, open the field brief, and choose “Save in browser.”</p><button className="button primary compact" onClick={() => setModal(null)}>Back to workspace <ArrowRight size={14}/></button></div>}
    </section></div>}
  </div>;
}
