import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Copy, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/history")({
  component: HistoryPage,
});

interface Letter {
  id: string;
  job_title: string;
  company: string;
  content: string;
  created_at: string;
  job_id: string | null;
}

function HistoryPage() {
  const { user } = useAuth();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("cover_letters")
      .select("id, job_title, company, content, created_at, job_id")
      .order("created_at", { ascending: false });
    setLetters(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const remove = async (id: string) => {
    if (!confirm("Delete this letter?")) return;
    await supabase.from("cover_letters").delete().eq("id", id);
    setLetters((l) => l.filter((x) => x.id !== id));
    toast.success("Deleted");
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-1 text-muted-foreground">Cover letters you've generated, linked to the role they were written for.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : letters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="font-medium">No letters yet</div>
            <p className="text-sm text-muted-foreground">Generate your first one.</p>
            <Button asChild className="mt-2"><Link to="/app/jobs">Browse jobs</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {letters.map((l) => {
            const open = openId === l.id;
            return (
              <Card key={l.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : l.id)}
                      className="text-left"
                    >
                      <CardTitle className="text-base">{l.job_title}</CardTitle>
                      <CardDescription>
                        {l.company} · {new Date(l.created_at).toLocaleDateString()}
                      </CardDescription>
                    </button>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => copy(l.content)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(l.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {open && (
                  <CardContent>
                    <article className="whitespace-pre-wrap rounded-lg border border-border bg-surface-elevated p-5 text-sm leading-relaxed">
                      {l.content}
                    </article>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
