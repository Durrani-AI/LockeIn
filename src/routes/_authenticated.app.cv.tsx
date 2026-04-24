import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { extractCvText } from "@/lib/server/ai.functions";

export const Route = createFileRoute("/_authenticated/app/cv")({
  component: CvPage,
});

interface CvRow {
  id: string;
  original_filename: string;
  storage_path: string;
  extracted_text: string | null;
  created_at: string;
}

function CvPage() {
  const { user } = useAuth();
  const [cv, setCv] = useState<CvRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractCvText);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("cvs")
      .select("id, original_filename, storage_path, extracted_text, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setCv(data ?? null);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const upload = async (file: File) => {
    if (!user) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max 10 MB");
      return;
    }
    setUploading(true);
    try {
      // Replace existing CV (delete previous storage object + row)
      if (cv) {
        await supabase.storage.from("cvs").remove([cv.storage_path]);
        await supabase.from("cvs").delete().eq("id", cv.id);
      }

      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("cvs").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase
        .from("cvs")
        .insert({
          user_id: user.id,
          original_filename: file.name,
          storage_path: path,
        })
        .select("id, original_filename, storage_path, extracted_text, created_at")
        .single();
      if (insErr) throw insErr;
      setCv(row);
      toast.success("CV uploaded — extracting text…");

      setParsing(true);
      const { length } = await extract({ data: { cvId: row.id } });
      toast.success(`Parsed ${length.toLocaleString()} characters`);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const remove = async () => {
    if (!cv) return;
    if (!confirm("Delete this CV?")) return;
    await supabase.storage.from("cvs").remove([cv.storage_path]);
    await supabase.from("cvs").delete().eq("id", cv.id);
    setCv(null);
    toast.success("CV removed");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Your CV</h1>
        <p className="mt-1 text-muted-foreground">
          Upload your CV once. We extract the text and reuse it for every letter.
        </p>
      </div>

      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : cv ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{cv.original_filename}</CardTitle>
                  <CardDescription>
                    Uploaded {new Date(cv.created_at).toLocaleDateString()}
                    {cv.extracted_text ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-success">
                        <CheckCircle2 className="h-3 w-3" /> Parsed
                      </span>
                    ) : null}
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={remove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          {cv.extracted_text && (
            <CardContent>
              <details className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <summary className="cursor-pointer font-medium">Preview extracted text</summary>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-xs text-muted-foreground">
                  {cv.extracted_text.slice(0, 2000)}
                  {cv.extracted_text.length > 2000 ? "\n…" : ""}
                </pre>
              </details>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                Replace with new PDF
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-strong bg-surface/30 px-6 py-16 text-center transition-colors hover:border-primary hover:bg-primary-soft/40 disabled:opacity-50"
        >
          {uploading || parsing ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="font-medium">{parsing ? "Extracting text…" : "Uploading…"}</div>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Upload className="h-5 w-5" />
              </div>
              <div className="font-medium">Click to upload a PDF</div>
              <div className="text-xs text-muted-foreground">Max 10 MB</div>
            </>
          )}
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
