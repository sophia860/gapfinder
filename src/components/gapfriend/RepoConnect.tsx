import { useState } from "react";
import { toast } from "sonner";
import { Github, ExternalLink, Loader2, Rocket, Unplug, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useConnectPat,
  useDisconnectRepo,
  useListRepos,
  useRepoConnection,
  useSetRepo,
  useShipFeature,
  useShipments,
} from "@/lib/repo";

interface Props {
  projectId: string;
}

export function RepoConnect({ projectId }: Props) {
  const { data: conn, isLoading } = useRepoConnection();
  const connectPat = useConnectPat();
  const disconnect = useDisconnectRepo();
  const setRepo = useSetRepo();
  const ship = useShipFeature();
  const { data: shipments } = useShipments(projectId);
  const repos = useListRepos(!!conn?.connected && !conn?.repo_full_name);

  const [token, setToken] = useState("");
  const [prompt, setPrompt] = useState("");

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-10">
      <header className="space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Repo
        </p>
        <h1 className="font-serif text-4xl tracking-tight">Ship to your GitHub</h1>
        <p className="text-muted-foreground max-w-xl">
          Connect a repository and Truara can open small, calm pull requests for the work
          you&rsquo;re doing here. Tokens are stored privately and never sent to your browser.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking connection&hellip;
        </div>
      ) : !conn?.connected ? (
        <ConnectCard
          token={token}
          setToken={setToken}
          submitting={connectPat.isPending}
          onSubmit={async () => {
            try {
              await connectPat.mutateAsync(token.trim());
              setToken("");
              toast.success("GitHub connected");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Couldn't connect");
            }
          }}
        />
      ) : (
        <>
          <Card className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Github className="size-4 text-terracotta" />
                  <span className="font-medium">{conn.github_login}</span>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                    {conn.auth_kind}
                  </Badge>
                </div>
                {conn.repo_full_name ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <GitBranch className="size-3.5" />
                    <span className="font-mono">{conn.repo_full_name}</span>
                    <span>· base&nbsp;<code>{conn.default_branch}</code></span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No repo selected yet.</div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await disconnect.mutateAsync();
                  toast.success("Disconnected");
                }}
              >
                <Unplug className="size-3.5 mr-1.5" /> Disconnect
              </Button>
            </div>

            {!conn.repo_full_name && (
              <div className="space-y-2">
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Pick a repository
                </p>
                {repos.isLoading ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" /> Loading repos&hellip;
                  </div>
                ) : (
                  <div className="max-h-72 overflow-auto rounded-md border divide-y">
                    {repos.data?.map((r) => (
                      <button
                        key={r.full_name}
                        className="w-full text-left px-3 py-2 hover:bg-secondary text-sm flex items-center justify-between"
                        onClick={async () => {
                          try {
                            await setRepo.mutateAsync(r.full_name);
                            toast.success(`Connected to ${r.full_name}`);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Couldn't set repo");
                          }
                        }}
                      >
                        <span className="font-mono truncate">{r.full_name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          {r.private && <Badge variant="outline" className="text-[10px]">private</Badge>}
                          <code className="text-[10px] text-muted-foreground">{r.default_branch}</code>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {conn.repo_full_name && (
            <Card className="p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="font-serif text-xl">Ship current feature</h2>
                <p className="text-sm text-muted-foreground">
                  Truara plans a small, safe pull request and opens it on{" "}
                  <code className="font-mono">{conn.repo_full_name}</code>. Tinted by your Founder
                  Mirror &amp; this project&rsquo;s context.
                </p>
              </div>
              <Textarea
                rows={3}
                placeholder="Optional: describe what to ship (e.g. 'add a docs/founder-mirror.md explaining the feature')"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <Button
                  onClick={async () => {
                    try {
                      const r = await ship.mutateAsync({ projectId, prompt });
                      toast.success(`PR #${r.pr_number} opened`);
                      setPrompt("");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Ship failed");
                    }
                  }}
                  disabled={ship.isPending}
                  className="bg-terracotta text-terracotta-foreground hover:bg-terracotta/90"
                >
                  {ship.isPending ? (
                    <><Loader2 className="size-4 mr-2 animate-spin" /> Shipping&hellip;</>
                  ) : (
                    <><Rocket className="size-4 mr-2" /> Ship to repo</>
                  )}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Opens a real PR — small, reviewable, never overwrites lockfiles or secrets.
                </span>
              </div>
            </Card>
          )}

          <section className="space-y-3">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Recent shipments
            </h3>
            {!shipments?.length ? (
              <p className="text-sm text-muted-foreground">No PRs shipped from this project yet.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {shipments.map((s) => (
                  <li key={s.id} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{s.title}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {s.repo_full_name} · {s.branch_name} · {s.files_changed} file
                        {s.files_changed === 1 ? "" : "s"}
                      </div>
                    </div>
                    {s.pr_url && (
                      <a
                        href={s.pr_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-terracotta inline-flex items-center gap-1 shrink-0"
                      >
                        PR #{s.pr_number} <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-xs text-muted-foreground">
            Want a polished &ldquo;Install GitHub App&rdquo; button instead of a token? That&rsquo;s
            the upgrade path — same UI, swap the auth flow once the App is registered.
          </p>
        </>
      )}
    </div>
  );
}

function ConnectCard({
  token, setToken, submitting, onSubmit,
}: { token: string; setToken: (s: string) => void; submitting: boolean; onSubmit: () => void }) {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Github className="size-4 text-terracotta" />
        <h2 className="font-serif text-xl">Connect with a personal access token</h2>
      </div>
      <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-5">
        <li>
          Open{" "}
          <a
            href="https://github.com/settings/tokens?type=beta"
            target="_blank"
            rel="noreferrer"
            className="text-terracotta inline-flex items-center gap-1"
          >
            github.com/settings/tokens <ExternalLink className="size-3" />
          </a>{" "}
          and create a fine-grained token.
        </li>
        <li>
          Grant repository access to the repo you want Truara to ship to. Permissions:{" "}
          <span className="font-mono">Contents: Read &amp; write</span>,{" "}
          <span className="font-mono">Pull requests: Read &amp; write</span>,{" "}
          <span className="font-mono">Metadata: Read</span>.
        </li>
        <li>Paste the token below. We store it privately and never expose it client-side.</li>
      </ol>
      <Input
        type="password"
        placeholder="github_pat_…"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <Button
        onClick={onSubmit}
        disabled={submitting || token.trim().length < 20}
        className="bg-terracotta text-terracotta-foreground hover:bg-terracotta/90"
      >
        {submitting ? <><Loader2 className="size-4 mr-2 animate-spin" /> Connecting&hellip;</> : "Connect repo"}
      </Button>
    </Card>
  );
}
