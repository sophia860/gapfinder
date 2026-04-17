import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import {
  useVibeProject,
  useCreateVibeProject,
  useUpdateVibeProject,
  useVibeVersions,
  useVibeMessages,
  useVibeFiles,
  useProject,
  useOpportunityBrief,
  useIdentity,
  type VibeProjectKind,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Wand2, Monitor, Tablet, Smartphone, Eye, FileCode, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Props {
  projectId: string;
}

export function VibeStudio({ projectId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: project } = useProject(projectId);
  const { data: vibeProject, isLoading: vibeLoading } = useVibeProject(projectId);
  const { data: brief } = useOpportunityBrief(projectId);
  const { data: identity } = useIdentity(projectId);
  const createVibeProject = useCreateVibeProject();
  const updateVibeProject = useUpdateVibeProject();
  const { data: versions } = useVibeVersions(vibeProject?.id);
  const { data: messages } = useVibeMessages(vibeProject?.id);
  const currentVersion = versions?.find((v) => v.id === vibeProject?.current_version_id);
  const { data: files } = useVibeFiles(currentVersion?.id);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [kind, setKind] = useState<VibeProjectKind>("website");
  const [previewWidth, setPreviewWidth] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length, sending]);

  // Auto-create vibe project if it doesn't exist
  useEffect(() => {
    if (!vibeLoading && !vibeProject && !createVibeProject.isPending) {
      createVibeProject.mutate({ project_id: projectId, kind });
    }
  }, [vibeLoading, vibeProject, projectId, kind]);

  async function generate(e: React.FormEvent, seedFromProject = false) {
    e.preventDefault();
    if ((!input.trim() && !seedFromProject) || sending) return;
    
    let prompt = input.trim();
    if (seedFromProject && brief && identity) {
      prompt = `Create a ${kind} for "${identity.chosen_name || project?.working_name}" - ${identity.tagline}. Target persona: ${brief.persona}. Problem: ${brief.problem}. Angle: ${brief.angle}.`;
    }
    
    if (!prompt) return;
    
    setInput("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("vibe-generate", {
        body: {
          vibe_project_id: vibeProject?.id,
          project_id: projectId,
          prompt,
          kind,
          seed_from_project: seedFromProject,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);

      qc.invalidateQueries({ queryKey: ["vibe-project", projectId] });
      qc.invalidateQueries({ queryKey: ["vibe-versions", vibeProject?.id] });
      qc.invalidateQueries({ queryKey: ["vibe-messages", vibeProject?.id] });
      qc.invalidateQueries({ queryKey: ["vibe-files"] });
      toast.success("Generated new version");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setSending(false);
    }
  }

  const hasMessages = (messages?.length ?? 0) > 0;

  // Generate preview HTML from files
  const previewHtml = files?.find((f) => f.path === "index.html")?.content || "<p>No preview available</p>";

  const widthClass =
    previewWidth === "mobile"
      ? "w-[375px]"
      : previewWidth === "tablet"
        ? "w-[768px]"
        : "w-full";

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Left pane: Prompt + history */}
      <div className="w-96 border-r border-border flex flex-col bg-background">
        <div className="p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Wand2 className="size-5 text-terracotta" />
            <h2 className="font-serif font-medium">Vibe Coding</h2>
          </div>
          <div className="flex gap-1.5 text-xs">
            {(["website", "webapp", "landing"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-3 py-1.5 rounded-full capitalize transition-colors ${
                  kind === k
                    ? "bg-terracotta text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {!hasMessages && (
            <>
              <div className="bg-muted/60 rounded-xl p-3 text-sm leading-relaxed">
                Describe the {kind} you want to build. I'll generate it from your project's brief and identity.
              </div>
              <div className="space-y-2">
                {[
                  `Marketing site for ${identity?.chosen_name || project?.working_name || "your project"}`,
                  "Waitlist + email capture",
                  "Simple SaaS dashboard",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    disabled={sending}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
                <Button
                  onClick={(e) => generate(e, true)}
                  disabled={sending || !brief || !identity}
                  variant="outline"
                  className="w-full"
                >
                  <Wand2 className="size-4 mr-2" />
                  Seed from project
                </Button>
              </div>
            </>
          )}
          {messages?.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] bg-terracotta text-primary-foreground rounded-xl p-3 text-sm"
                  : "max-w-[90%] bg-muted/60 rounded-xl p-3 text-sm"
              }
            >
              {m.content}
            </div>
          ))}
          {sending && (
            <div className="max-w-[90%] bg-muted/60 rounded-xl p-3 text-sm flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Generating…
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border shrink-0">
          <form onSubmit={(e) => generate(e, false)} className="relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you want to build…"
              disabled={sending}
              className="w-full bg-muted/40 border border-border rounded-full pl-4 pr-11 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/40 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 rounded-full bg-terracotta text-primary-foreground flex items-center justify-center hover:bg-terracotta/90 transition-colors disabled:opacity-40"
            >
              {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            </button>
          </form>
        </div>
      </div>

      {/* Right pane: Preview */}
      <div className="flex-1 flex flex-col bg-muted/20">
        <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-background">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Preview</span>
            {currentVersion && (
              <span className="text-xs text-muted-foreground">v{versions?.indexOf(currentVersion)! + 1}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPreviewWidth("mobile")}
              className={`p-2 rounded-md transition-colors ${
                previewWidth === "mobile" ? "bg-muted" : "hover:bg-muted/50"
              }`}
            >
              <Smartphone className="size-4" />
            </button>
            <button
              onClick={() => setPreviewWidth("tablet")}
              className={`p-2 rounded-md transition-colors ${
                previewWidth === "tablet" ? "bg-muted" : "hover:bg-muted/50"
              }`}
            >
              <Tablet className="size-4" />
            </button>
            <button
              onClick={() => setPreviewWidth("desktop")}
              className={`p-2 rounded-md transition-colors ${
                previewWidth === "desktop" ? "bg-muted" : "hover:bg-muted/50"
              }`}
            >
              <Monitor className="size-4" />
            </button>
          </div>
        </div>

        <Tabs defaultValue="preview" className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-3 w-fit">
            <TabsTrigger value="preview">
              <Eye className="size-3.5 mr-1.5" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="files">
              <FileCode className="size-3.5 mr-1.5" />
              Files
            </TabsTrigger>
            <TabsTrigger value="assets">
              <Image className="size-3.5 mr-1.5" />
              Assets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="flex-1 p-4 m-0">
            <div className="h-full flex justify-center">
              <div className={`${widthClass} h-full transition-all duration-300`}>
                <iframe
                  srcDoc={previewHtml}
                  sandbox="allow-scripts"
                  className="w-full h-full border border-border rounded-lg bg-white"
                  title="Preview"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="files" className="flex-1 p-4 m-0 overflow-auto">
            <div className="space-y-2">
              {files?.map((f) => (
                <div key={f.id} className="p-3 bg-background border border-border rounded-lg">
                  <div className="text-sm font-medium font-mono">{f.path}</div>
                  <div className="text-xs text-muted-foreground mt-1">{f.mime}</div>
                </div>
              ))}
              {!files?.length && <p className="text-sm text-muted-foreground">No files yet</p>}
            </div>
          </TabsContent>

          <TabsContent value="assets" className="flex-1 p-4 m-0">
            <p className="text-sm text-muted-foreground">Assets view coming soon</p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
