"use client";
import { ArrowRight, Check, CheckCircle2, LoaderCircle, ScanLine, Sparkles } from "lucide-react";
import type { AIReceipt, CapturePlan, EvidenceFrame } from "@/lib/arbor/types";

export function Receipt({ receipt, reused = false }: { receipt: AIReceipt; reused?: boolean }) {
  return <div className="ai-receipt">
    <span><CheckCircle2 size={13}/> {reused ? "Reused verified response · no new request" : "Verified model response"}</span>
    <div>{receipt.model} · {new Date(receipt.createdAt).toLocaleTimeString()} · {receipt.promptVersion}</div>
    <div>{receipt.inputTokens === null ? "Token usage not returned" : `${receipt.inputTokens.toLocaleString()} input / ${(receipt.outputTokens || 0).toLocaleString()} output tokens`}{receipt.estimatedUsd !== null && ` · est. $${receipt.estimatedUsd.toFixed(4)}${reused ? " (original request)" : ""}`}</div>
    {receipt.requestId && <code title={receipt.requestId}>Request {receipt.requestId.slice(0, 42)}</code>}
  </div>;
}

export function AiWorkflow(props: {
  ready: boolean; busy: boolean; planning: boolean; consent: boolean; setConsent: (value: boolean) => void;
  onInspect: () => void; plan: CapturePlan | null; receipt: AIReceipt | null; reused: boolean;
  onApply: () => void; onDismiss: () => void; applied: boolean; hasAnalysis: boolean; onBrief: () => void;
  sessionCalls: number; sessionCost: number; maxRequests: number;
}) {
  const { plan } = props;
  return <section className="ai-workflow no-print" aria-label="Meta guided inspection workflow">
    <div className="workflow-top"><span><Sparkles size={17}/> META GUIDED INSPECTION</span><span className={`connection-badge ${props.ready ? "configured" : ""}`}>{props.ready ? "Server key configured" : "Local evidence mode"}</span></div>
    <div className="workflow-steps">
      <div className={plan ? "complete" : "current"}><span>01</span><strong>Understand the scene</strong><p>Muse Spark proposes trackable regions and checks the capture.</p></div>
      <div className={props.hasAnalysis ? "complete" : props.applied ? "current" : ""}><span>02</span><strong>Confirm & measure</strong><p>You confirm the regions. PhysicsLens measures the motion.</p></div>
      <div className={props.hasAnalysis ? "current" : ""}><span>03</span><strong>Ground the brief</strong><p>Model observations link to frames and measured evidence.</p></div>
    </div>
    {!props.ready ? <div className="workflow-connect"><p>The full AI workflow runs on your computer with a server-side key in an ignored <code>.dev.vars</code> file. Your key never belongs in GitHub or a browser field.</p><a className="button secondary compact" href="/local-setup">Local setup guide <ArrowRight size={14}/></a></div> : <div className="workflow-connect"><label className="consent"><input type="checkbox" checked={props.consent} disabled={props.busy} onChange={e => props.setConsent(e.target.checked)}/> Send six timestamped frames and field notes to Meta when I request scene planning or a grounded brief. The full video stays local.</label><div className="workflow-actions"><button className="button primary compact" onClick={props.onInspect} disabled={props.busy || !props.consent}>{props.planning ? <LoaderCircle className="spin" size={15}/> : <Sparkles size={15}/>} {props.planning ? "Inspecting sampled frames…" : "Inspect scene with Muse Spark"}</button>{props.hasAnalysis && <button className="text-button" onClick={props.onBrief}>Open grounded brief <ArrowRight size={13}/></button>}<span>{props.sessionCalls} new calls this session · est. ${props.sessionCost.toFixed(4)}</span></div><small className="usage-note">Estimates cover this tab’s successful requests, not your account balance. Server limit: {props.maxRequests} requests/hour per running process.</small></div>}
    {plan && <div className="capture-plan"><div className="capture-plan-title"><h3>{props.applied ? <><Check size={16}/> Regions confirmed by you</> : "Proposed capture plan · review the two boxes"}</h3><span>AI assisted</span></div><p>{plan.summary}</p><div className="region-reasons"><p><strong>Tree region</strong>{plan.treeReason}</p><p><strong>Fixed reference</strong>{plan.referenceReason}</p></div>{plan.checks.length > 0 && <ul>{plan.checks.map((check, i) => <li key={i} className={check.severity}><span>{check.severity === "recapture" ? "CAPTURE CONCERN" : "OBSERVATION"}</span>{check.text}<small>{check.frameIds.join(" · ")}</small></li>)}</ul>}{!props.applied && <div className="workflow-actions"><button className="button primary compact" onClick={props.onApply} disabled={props.busy}><ScanLine size={14}/> I reviewed these regions — use them</button><button className="text-button" onClick={props.onDismiss} disabled={props.busy}>Keep manual regions</button></div>}<p className="plan-limit">AI proposals are provisional. A logo, timestamp, or moving foliage is not a stationary world reference.</p>{props.receipt && <Receipt receipt={props.receipt} reused={props.reused}/>}</div>}
  </section>;
}

export function EvidenceFrames({ frames, onFrame, compact = false }: { frames: EvidenceFrame[]; onFrame?: (frame: EvidenceFrame) => void; compact?: boolean }) {
  if (!frames.length) return null;
  return <section className={`evidence-frames ${compact ? "compact" : ""}`} aria-label="Timestamped source frames"><div className="frame-section-title">SOURCE FRAMES <span>Six sampled stills · tap to seek the original recording</span></div><div>{frames.map(frame => <button key={frame.id} onClick={() => onFrame?.(frame)} type="button" disabled={!onFrame}><img src={frame.url} alt={`Evidence ${frame.id} at ${frame.t.toFixed(2)} seconds`}/><span><strong>{frame.id}</strong>{frame.t.toFixed(2)}s</span></button>)}</div></section>;
}
