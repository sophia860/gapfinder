import { useState } from "react";
import { useVibeProject, useVibeFiles, useUpdateVibeFile, type VibeFile } from "@/lib/queries";
import Editor from "@monaco-editor/react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  File,
  FolderPlus,
  FilePlus,
  Play,
  Square,
  Share2,
  Monitor,
  Terminal as TerminalIcon,
  Link as LinkIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface Props {
  projectId: string;
}

export function CodingSpace({ projectId }: Props) {
  const { data: vibeProject } = useVibeProject(projectId);
  const currentVersion = vibeProject?.current_version_id;
  const { data: files } = useVibeFiles(currentVersion);
  const updateFile = useUpdateVibeFile();

  const [selectedFile, setSelectedFile] = useState<VibeFile | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const handleFileSelect = (file: VibeFile) => {
    setSelectedFile(file);
    setEditedContent(file.content);
  };

  const handleSave = async () => {
    if (!selectedFile || !currentVersion) return;

    try {
      await updateFile.mutateAsync({
        id: selectedFile.id,
        version_id: currentVersion,
        content: editedContent,
      });
      toast.success(`Saved ${selectedFile.path}`);
    } catch (err) {
      toast.error("Failed to save file");
    }
  };

  const handleRun = () => {
    setIsRunning(true);
    toast.success("Running preview");
  };

  const handleStop = () => {
    setIsRunning(false);
    toast.success("Stopped");
  };

  // Generate preview HTML from files
  const previewHtml = files?.find((f) => f.path === "index.html")?.content || "<p>No preview available</p>";

  // Determine language from file extension
  const getLanguage = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      html: "html",
      css: "css",
      json: "json",
      md: "markdown",
    };
    return langMap[ext || ""] || "plaintext";
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Top bar */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-background">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isRunning ? "secondary" : "default"}
            onClick={isRunning ? handleStop : handleRun}
            className="h-8"
          >
            {isRunning ? (
              <>
                <Square className="size-3.5 mr-1.5" />
                Stop
              </>
            ) : (
              <>
                <Play className="size-3.5 mr-1.5" />
                Run
              </>
            )}
          </Button>
          <Button size="sm" variant="ghost" className="h-8">
            <Share2 className="size-3.5 mr-1.5" />
            Share
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/app/${projectId}/vibe`}>
            <Button size="sm" variant="ghost" className="h-8">
              <LinkIcon className="size-3.5 mr-1.5" />
              Open in Vibe
            </Button>
          </Link>
        </div>
      </div>

      {/* Main layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left: File explorer */}
        <ResizablePanel defaultSize={20} minSize={15}>
          <div className="h-full flex flex-col bg-background border-r border-border">
            <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
              <span className="text-sm font-medium">Files</span>
              <div className="flex gap-1">
                <button className="p-1 hover:bg-muted rounded" title="New file">
                  <FilePlus className="size-4" />
                </button>
                <button className="p-1 hover:bg-muted rounded" title="New folder">
                  <FolderPlus className="size-4" />
                </button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {files?.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => handleFileSelect(file)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-muted transition-colors ${
                      selectedFile?.id === file.id ? "bg-muted" : ""
                    }`}
                  >
                    <File className="size-3.5 shrink-0" />
                    <span className="truncate font-mono text-xs">{file.path}</span>
                  </button>
                ))}
                {!files?.length && (
                  <p className="text-xs text-muted-foreground p-2">
                    No files. Generate a site in Vibe Coding first.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center: Editor */}
        <ResizablePanel defaultSize={50}>
          <div className="h-full flex flex-col bg-background">
            {selectedFile ? (
              <>
                <div className="h-10 border-b border-border flex items-center justify-between px-3 shrink-0">
                  <span className="text-sm font-mono truncate">{selectedFile.path}</span>
                  <Button size="sm" variant="ghost" onClick={handleSave} className="h-7 text-xs">
                    Save
                  </Button>
                </div>
                <div className="flex-1">
                  <Editor
                    height="100%"
                    language={getLanguage(selectedFile.path)}
                    value={editedContent}
                    onChange={(value) => setEditedContent(value || "")}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Select a file to edit
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Preview / Terminal */}
        <ResizablePanel defaultSize={30}>
          <Tabs defaultValue="preview" className="h-full flex flex-col">
            <TabsList className="mx-3 mt-2 w-fit">
              <TabsTrigger value="preview">
                <Monitor className="size-3.5 mr-1.5" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="terminal">
                <TerminalIcon className="size-3.5 mr-1.5" />
                Terminal
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="flex-1 p-3 m-0">
              <iframe
                srcDoc={previewHtml}
                sandbox="allow-scripts"
                className="w-full h-full border border-border rounded-lg bg-white"
                title="Preview"
              />
            </TabsContent>

            <TabsContent value="terminal" className="flex-1 m-0">
              <ScrollArea className="h-full">
                <div className="p-3 font-mono text-xs">
                  <div className="text-muted-foreground">
                    {isRunning ? (
                      <>
                        <div>$ npm run dev</div>
                        <div className="text-green-500 mt-1">✓ Server running on port 3000</div>
                        <div className="mt-1">Ready to accept connections</div>
                      </>
                    ) : (
                      <div>Terminal ready. Click Run to start.</div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
