import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  useProject,
  useCampaignByProject,
  useCreateCampaign,
  useUpdateCampaign,
  usePledges,
  type Campaign,
  type CampaignStatus,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignProgress } from "@/components/gapfriend/community/CampaignProgress";
import { PledgeList } from "@/components/gapfriend/community/PledgeList";
import { UpdateFeed } from "@/components/gapfriend/community/UpdateFeed";
import { Rocket, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/crowdfund")({
  component: ProjectCrowdfund,
});

const STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: "draft", label: "Draft (private)" },
  { value: "live", label: "Live (public)" },
  { value: "funded", label: "Funded" },
  { value: "closed", label: "Closed" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

function ProjectCrowdfund() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const { data: project } = useProject(projectId);
  const { data: campaign, isLoading } = useCampaignByProject(projectId);
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const { data: pledges } = usePledges(campaign?.id);

  const raised = (pledges ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  if (isLoading) {
    return (
      <div className="p-8 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!campaign) {
    return (
      <CreateCampaignPanel
        projectId={projectId}
        defaultTitle={project?.working_name ?? "My venture"}
        defaultPitch={project?.tagline ?? ""}
        onCreate={async (input) => {
          if (!user) return;
          try {
            await createCampaign.mutateAsync({
              project_id: projectId,
              created_by: user.id,
              ...input,
            });
            toast.success("Campaign created");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not create campaign");
          }
        }}
        isPending={createCampaign.isPending}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-10 py-10 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Crowdfund
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight">{campaign.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Status:{" "}
            <span className="font-medium text-foreground">
              {STATUS_OPTIONS.find((s) => s.value === campaign.status)?.label}
            </span>
          </p>
        </div>
        <Link to="/community/$campaignId" params={{ campaignId: campaign.id }}>
          <Button variant="outline" className="rounded-full">
            <ExternalLink className="size-4 mr-2" /> View public page
          </Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <CampaignProgress
          raised={raised}
          goal={Number(campaign.goal_amount ?? 0)}
          currency={campaign.currency}
          backers={pledges?.length ?? 0}
        />
      </div>

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="backers">Backers ({pledges?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-6">
          <EditCampaignForm
            campaign={campaign}
            onSave={async (patch) => {
              try {
                await updateCampaign.mutateAsync({ id: campaign.id, ...patch });
                toast.success("Saved");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not save");
              }
            }}
            isPending={updateCampaign.isPending}
          />
        </TabsContent>

        <TabsContent value="updates" className="mt-6">
          <UpdateFeed campaign={campaign} />
        </TabsContent>

        <TabsContent value="backers" className="mt-6">
          <PledgeList pledges={pledges ?? []} currency={campaign.currency} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateCampaignPanel({
  projectId,
  defaultTitle,
  defaultPitch,
  onCreate,
  isPending,
}: {
  projectId: string;
  defaultTitle: string;
  defaultPitch: string;
  onCreate: (input: {
    title: string;
    pitch: string | null;
    story: string | null;
    goal_amount: number;
    currency: string;
    deadline: string | null;
    category: string | null;
    cover_url: string | null;
    status: CampaignStatus;
  }) => Promise<void>;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [pitch, setPitch] = useState(defaultPitch);
  const [story, setStory] = useState("");
  const [goal, setGoal] = useState<number>(5000);
  const [currency, setCurrency] = useState("USD");
  const [deadline, setDeadline] = useState("");
  const [category, setCategory] = useState("");

  return (
    <div className="max-w-2xl mx-auto px-6 lg:px-10 py-10 space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Crowdfund
        </p>
        <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight">
          Publish your venture
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a campaign to share your venture with the GapFriend community. You can keep it as a
          draft until you're ready to go live.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div>
          <Label htmlFor="cf-title">Title</Label>
          <Input
            id="cf-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="cf-pitch">One-line pitch</Label>
          <Input
            id="cf-pitch"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            maxLength={200}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="cf-story">Story</Label>
          <Textarea
            id="cf-story"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={6}
            className="mt-2"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="cf-goal">Goal</Label>
            <Input
              id="cf-goal"
              type="number"
              min={0}
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value))}
              className="mt-2"
            />
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cf-deadline">Deadline (optional)</Label>
            <Input
              id="cf-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="cf-category">Category (optional)</Label>
          <Input
            id="cf-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Productivity, Local food, Crafts…"
            className="mt-2"
          />
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-xl p-3">
        <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
        <span>
          Pledges in this MVP are recorded as non-binding intents. Real payments will be added in a
          future update.
        </span>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          className="rounded-full"
          disabled={isPending || !title.trim()}
          onClick={() =>
            onCreate({
              title: title.trim(),
              pitch: pitch.trim() || null,
              story: story.trim() || null,
              goal_amount: goal || 0,
              currency,
              deadline: deadline ? new Date(deadline).toISOString() : null,
              category: category.trim() || null,
              cover_url: null,
              status: "draft",
            })
          }
        >
          Save as draft
        </Button>
        <Button
          className="rounded-full"
          disabled={isPending || !title.trim()}
          onClick={() =>
            onCreate({
              title: title.trim(),
              pitch: pitch.trim() || null,
              story: story.trim() || null,
              goal_amount: goal || 0,
              currency,
              deadline: deadline ? new Date(deadline).toISOString() : null,
              category: category.trim() || null,
              cover_url: null,
              status: "live",
            })
          }
        >
          <Rocket className="size-4 mr-2" /> Publish to community
        </Button>
      </div>

      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
        Project: {projectId}
      </p>
    </div>
  );
}

function EditCampaignForm({
  campaign,
  onSave,
  isPending,
}: {
  campaign: Campaign;
  onSave: (patch: Partial<Campaign>) => Promise<void>;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(campaign.title);
  const [pitch, setPitch] = useState(campaign.pitch ?? "");
  const [story, setStory] = useState(campaign.story ?? "");
  const [goal, setGoal] = useState<number>(Number(campaign.goal_amount ?? 0));
  const [currency, setCurrency] = useState(campaign.currency);
  const [deadline, setDeadline] = useState(
    campaign.deadline ? new Date(campaign.deadline).toISOString().slice(0, 10) : "",
  );
  const [category, setCategory] = useState(campaign.category ?? "");
  const [coverUrl, setCoverUrl] = useState(campaign.cover_url ?? "");
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);

  // Keep form in sync if campaign reloads (e.g. after save).
  useEffect(() => {
    setTitle(campaign.title);
    setPitch(campaign.pitch ?? "");
    setStory(campaign.story ?? "");
    setGoal(Number(campaign.goal_amount ?? 0));
    setCurrency(campaign.currency);
    setDeadline(campaign.deadline ? new Date(campaign.deadline).toISOString().slice(0, 10) : "");
    setCategory(campaign.category ?? "");
    setCoverUrl(campaign.cover_url ?? "");
    setStatus(campaign.status);
  }, [campaign]);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div>
        <Label htmlFor="ec-title">Title</Label>
        <Input
          id="ec-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="mt-2"
        />
      </div>
      <div>
        <Label htmlFor="ec-pitch">One-line pitch</Label>
        <Input
          id="ec-pitch"
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          maxLength={200}
          className="mt-2"
        />
      </div>
      <div>
        <Label htmlFor="ec-story">Story</Label>
        <Textarea
          id="ec-story"
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={6}
          className="mt-2"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="ec-goal">Goal</Label>
          <Input
            id="ec-goal"
            type="number"
            min={0}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="mt-2"
          />
        </div>
        <div>
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="ec-deadline">Deadline</Label>
          <Input
            id="ec-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="mt-2"
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus)}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="ec-category">Category</Label>
          <Input
            id="ec-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="ec-cover">Cover image URL</Label>
          <Input
            id="ec-cover"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://…"
            className="mt-2"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          className="rounded-full"
          disabled={isPending || !title.trim()}
          onClick={() =>
            onSave({
              title: title.trim(),
              pitch: pitch.trim() || null,
              story: story.trim() || null,
              goal_amount: goal || 0,
              currency,
              deadline: deadline ? new Date(deadline).toISOString() : null,
              category: category.trim() || null,
              cover_url: coverUrl.trim() || null,
              status,
            })
          }
        >
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
