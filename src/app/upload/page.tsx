"use client";

import { Suspense, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Upload, X, FileText, Loader2 } from "lucide-react";
import Disclaimer from "@/components/Disclaimer";

const DOCUMENT_TYPES = [
  "I-797 (Notice of Action)",
  "I-485 (Adjustment of Status)",
  "I-130 (Petition for Alien Relative)",
  "I-765 (Employment Authorization)",
  "I-589 (Asylum Application)",
  "N-400 (Naturalization)",
  "I-94 (Arrival/Departure Record)",
  "Visa Page / Stamp",
  "EAD Card",
  "RFE (Request for Evidence)",
  "NOID (Notice of Intent to Deny)",
  "Marriage Certificate",
  "Divorce Decree",
  "DS-160 / DS-260",
  "Attorney Correspondence",
  "Other USCIS Notice",
];

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  text: string;
  size: number;
}

function UploadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  async function extractTextFromFile(file: File): Promise<string> {
    // In production this would use OCR (e.g. AWS Textract, Google Vision)
    // For MVP we read text-based PDFs or plain text files
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string ?? "";
        // Basic text extraction — remove binary garbage
        const cleaned = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
        resolve(cleaned.slice(0, 5000));
      };
      reader.onerror = () => resolve(`[Could not read file: ${file.name}]`);
      reader.readAsText(file);
    });
  }

  const MAX_FILES = 25;

  const handleFiles = useCallback(async (fileList: FileList) => {
    setProcessing(true);
    const incoming = Array.from(fileList);
    const newFiles: UploadedFile[] = [];
    for (const file of incoming) {
      const text = await extractTextFromFile(file);
      newFiles.push({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        text,
        size: file.size,
      });
    }
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const deduped = newFiles.filter((f) => !existingNames.has(f.name));
      const combined = [...prev, ...deduped];
      if (combined.length > MAX_FILES) {
        alert(`Maximum ${MAX_FILES} files allowed. Some files were not added.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
    setProcessing(false);
  }, []);

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const stored = sessionStorage.getItem("caseInput");
      const activeCaseId =
        searchParams.get("caseId") ?? sessionStorage.getItem("activeCaseId");
      if (!stored) {
        router.push("/onboarding");
        return;
      }
      const caseInput = JSON.parse(stored);
      const documents = files.map((f) => ({ name: f.name, text: f.text }));

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: activeCaseId, ...caseInput, documents }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Analysis failed. Please try again.");
        setAnalyzing(false);
        return;
      }

      const payload = await res.json();
      if (payload.caseId) {
        sessionStorage.setItem("activeCaseId", payload.caseId);
      }
      sessionStorage.setItem("caseAnalysis", JSON.stringify(payload.analysis ?? payload));
      router.push(
        payload.caseId ? `/dashboard?caseId=${payload.caseId}` : "/dashboard"
      );
    } catch {
      alert("An error occurred. Please try again.");
      setAnalyzing(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-orange-700">MyImmigration</Link>
          <span className="text-sm text-slate-500">Step 3 of 3</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        {/* Progress */}
        <div className="mb-8 flex gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= 3 ? "bg-orange-600" : "bg-slate-200"}`} />
          ))}
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Upload your documents</h1>
            <p className="mt-2 text-slate-600">
              Upload any immigration documents you have. The more you provide, the more accurate
              our analysis will be. Documents are optional — you can analyze your narrative alone.
            </p>
          </div>

          {/* Document types reference */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Documents we can analyze:</p>
            <div className="flex flex-wrap gap-1.5">
              {DOCUMENT_TYPES.map((t) => (
                <span key={t} className="rounded-full bg-orange-50 border border-orange-100 px-2.5 py-0.5 text-xs text-orange-700">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
            }}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
              dragging ? "border-orange-400 bg-orange-50" : "border-slate-300 bg-white hover:bg-slate-50"
            }`}
          >
            <Upload className="h-8 w-8 text-slate-400 mb-3" />
            <p className="text-sm font-medium text-slate-700">
              Drag and drop files here, or{" "}
              <label className="cursor-pointer text-orange-600 hover:underline">
                browse
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.jpg,.jpeg,.png,.doc,.docx"
                  className="sr-only"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </label>
            </p>
            <p className="mt-1 text-xs text-slate-500">PDF, TXT, JPG, PNG, DOC — up to 25 files</p>
            {processing && (
              <div className="mt-3 flex items-center gap-2 text-sm text-orange-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing files...
              </div>
            )}
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">{files.length} file{files.length !== 1 ? "s" : ""} ready</p>
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <FileText className="h-4 w-4 text-orange-500 shrink-0" />
                  <span className="flex-1 text-sm text-slate-700 truncate">{f.name}</span>
                  <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeFile(f.id)} aria-label={`Remove ${f.name}`} className="text-slate-400 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Disclaimer compact />
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <Link href="/onboarding" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-2 rounded-lg bg-orange-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing your case...
              </>
            ) : (
              <>
                Analyze My Case
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
        {analyzing && (
          <p className="mt-3 text-center text-xs text-slate-500">
            This takes about 30–60 seconds. Please don&apos;t close this page.
          </p>
        )}
      </main>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <p className="text-slate-500">Loading upload flow...</p>
        </div>
      }
    >
      <UploadPageContent />
    </Suspense>
  );
}
