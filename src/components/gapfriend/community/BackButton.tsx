import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useCreatePledge, type Campaign } from "@/lib/queries";
import { toast } from "sonner";
import { HandCoins } from "lucide-react";
import { formatMoney } from "./format";

interface Props {
  campaign: Campaign;
}

const PRESET_AMOUNTS = [10, 25, 50, 100, 250];

export function BackButton({ campaign }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createPledge = useCreatePledge();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(25);
  const [message, setMessage] = useState("");

  const isOwner = user?.id === campaign.created_by;
  const isLive = campaign.status === "live" || campaign.status === "funded";

  async function submit() {
    if (!user) {
      toast.error("Sign in to back this campaign");
      navigate({ to: "/auth" });
      return;
    }
    if (amount <= 0 || Number.isNaN(amount)) {
      toast.error("Enter an amount greater than 0");
      return;
    }
    try {
      await createPledge.mutateAsync({
        campaign_id: campaign.id,
        backer_user_id: user.id,
        amount,
        message: message.trim() || null,
      });
      toast.success(`Pledge of ${formatMoney(amount, campaign.currency)} recorded`);
      setOpen(false);
      setMessage("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not record pledge";
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full" disabled={!isLive || isOwner}>
          <HandCoins className="size-4 mr-2" />
          {isOwner ? "Your campaign" : isLive ? "Back this venture" : "Not accepting pledges"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Back {campaign.title}</DialogTitle>
          <DialogDescription>
            Pledges are recorded as non-binding intents — no money moves. Real payments will be
            added in a future update.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest">Amount</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {PRESET_AMOUNTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(p)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    amount === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {formatMoney(p, campaign.currency)}
                </button>
              ))}
            </div>
            <Input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-3"
            />
          </div>
          <div>
            <Label htmlFor="pledge-message" className="text-xs font-mono uppercase tracking-widest">
              Message (optional)
            </Label>
            <Textarea
              id="pledge-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Say something to the founder…"
              maxLength={500}
              className="mt-2"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={createPledge.isPending}>
            {createPledge.isPending ? "Recording…" : "Record pledge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
