import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useProjects, useCreateProject, useProfile } from "@/lib/queries";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Compass,
  Target,
  Rocket,
  Coins,
  Map as MapIcon,
  KanbanSquare,
  Pencil,
  Beaker,
  ChevronDown,
  Plus,
  LogOut,
  Sparkles,
  LayoutGrid,
  Lightbulb,
  Users,
  Globe,
} from "lucide-react";

interface Props {
  projectId: string;
}

export function AppSidebar({ projectId }: Props) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: profile } = useProfile(user?.id);
  const { data: projects } = useProjects(user?.id);
  const createProject = useCreateProject();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const activeProject = projects?.find((p) => p.id === projectId);

  const isActive = (path: string) => location.pathname === path;

  const groups: {
    label: string;
    items: { title: string; to: string; icon: React.ComponentType<{ className?: string }> }[];
  }[] = [
    {
      label: "Discover",
      items: [
        { title: "Overview", to: `/app/${projectId}`, icon: LayoutGrid },
        { title: "Market gaps", to: `/app/${projectId}/gaps`, icon: Lightbulb },
        { title: "Simulator", to: `/app/${projectId}/simulator`, icon: Beaker },
      ],
    },
    {
      label: "Decide",
      items: [
        { title: "Opportunity brief", to: `/app/${projectId}/brief`, icon: Compass },
        { title: "Identity & naming", to: `/app/${projectId}/identity`, icon: Target },
        { title: "Channels", to: `/app/${projectId}/channels`, icon: Globe },
      ],
    },
    {
      label: "Execute",
      items: [
        { title: "Roadmap", to: `/app/${projectId}/roadmap`, icon: MapIcon },
        { title: "Board", to: `/app/${projectId}/board`, icon: KanbanSquare },
        { title: "Money", to: `/app/${projectId}/money`, icon: Coins },
        { title: "Capital", to: `/app/${projectId}/capital`, icon: Rocket },
        { title: "Crowdfund", to: `/app/${projectId}/crowdfund`, icon: HandCoins },
      ],
    },
    {
      label: "Library",
      items: [{ title: "Content", to: `/app/${projectId}/content`, icon: Pencil }],
    },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <Link
            to="/app"
            className="size-8 rounded-lg bg-terracotta-soft text-terracotta flex items-center justify-center shrink-0"
          >
            <Sparkles className="size-4" />
          </Link>
          {!collapsed && (
            <Link to="/app" className="font-serif text-base font-medium tracking-tight truncate">
              GapFriend
            </Link>
          )}
        </div>

        {!collapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="mx-2 mb-1 flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sm w-[calc(100%-1rem)]">
                <span className="size-6 rounded-md bg-terracotta-soft text-terracotta flex items-center justify-center font-serif text-xs font-medium shrink-0">
                  {(activeProject?.working_name ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="font-medium truncate flex-1 text-left">
                  {activeProject?.working_name ?? "Loading…"}
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                Your projects
              </div>
              {projects?.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onSelect={() => navigate({ to: "/app/$projectId", params: { projectId: p.id } })}
                  className="cursor-pointer"
                >
                  <span className="size-5 rounded-md bg-terracotta-soft text-terracotta flex items-center justify-center font-serif text-[10px] font-medium mr-2">
                    {p.working_name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate">{p.working_name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/app" })}
                className="cursor-pointer"
              >
                <Users className="size-4 mr-2" /> All projects
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  if (!user) return;
                  try {
                    const proj = await createProject.mutateAsync({
                      user_id: user.id,
                      working_name: "New venture",
                    });
                    navigate({ to: "/app/$projectId", params: { projectId: proj.id } });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Couldn't create project");
                  }
                }}
                className="cursor-pointer"
              >
                <Plus className="size-4 mr-2" /> New project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] font-mono uppercase tracking-widest">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.title}>
                      <Link to={item.to}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sm w-full">
              <span className="size-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium uppercase shrink-0">
                {(profile?.display_name ?? user?.email ?? "?").slice(0, 1)}
              </span>
              {!collapsed && (
                <span className="truncate flex-1 text-left">
                  {profile?.display_name ?? user?.email}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <div className="text-sm font-medium truncate">
                {profile?.display_name ?? user?.email}
              </div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => navigate({ to: "/app/onboarding" })}
              className="cursor-pointer"
            >
              <Sparkles className="size-4 mr-2" /> Re-do onboarding
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="size-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
