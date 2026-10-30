import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Shield,
  Users,
  UserCheck,
  UserX,
  Ban,
  Trash2,
  ArrowLeft,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Bot,
  MessageSquare,
  KeyRound,
} from "lucide-react";
import AIUsageAnalytics from "@/components/AIUsageAnalytics";
import AIKeyManager from "@/components/AIKeyManager";
import { fetchIssues, updateIssueStatus, updateIssueReply, fetchIssueMessages, addIssueMessage, DbIssue, DbIssueMessage } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/lib/user-context";
import { supabase } from "@/integrations/supabase/client";

interface UserRow {
  id: string;
  username: string;
  status: string;
  ban_until: string | null;
  created_at: string;
  email: string | null;
  role: string;
  requested_role: string | null;
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
  }
> = {
  pending: {
    label: "Pending",
    variant: "secondary",
    icon: <Clock className="h-3 w-3" />,
  },
  approved: {
    label: "Approved",
    variant: "default",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  blocked: {
    label: "Blocked",
    variant: "destructive",
    icon: <XCircle className="h-3 w-3" />,
  },
  temporarily_banned: {
    label: "Temp Banned",
    variant: "outline",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { authUser, isAdmin, isModerator, loading: authLoading } = useUser();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<"users" | "issues" | "ai_keys" | "ai_usage">("users");
  const [issues, setIssues] = useState<DbIssue[]>([]);
  const [issueMessages, setIssueMessages] = useState<DbIssueMessage[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [adminReply, setAdminReply] = useState("");
  const [actionDialog, setActionDialog] = useState<{
    type: string;
    user?: UserRow | null;
    issue?: DbIssue | null;
  }>({ type: "", user: null });
  const [banDays, setBanDays] = useState("7");
  const [actionLoading, setActionLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    username: "",
    role: "user",
    status: "approved",
  });
  const [newPassword, setNewPassword] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, username, status, ban_until, created_at, email, requested_role")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const rolesMap = new Map<string, string>();
      roles?.forEach((r) => rolesMap.set(r.user_id, r.role));

      const enriched: UserRow[] = (profiles || [])
        .map((p: any) => ({
          ...p,
          status: p.status || "pending",
          role: rolesMap.get(p.id) || "user",
          requested_role: p.requested_role || "user",
        }))
        .filter((u) => u.status !== "deleted");

      setUsers(enriched);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      toast.error("Failed to load users");
    }
    setLoading(false);
  }, []);

  const fetchIssuesList = useCallback(async () => {
    setIssuesLoading(true);
    try {
      const data = await fetchIssues();
      setIssues(data);
    } catch (err: any) {
      toast.error("Failed to load issues");
    }
    setIssuesLoading(false);
  }, []);

  // Use UserContext to verify admin access — no external API needed
  useEffect(() => {
    if (authLoading) return;
    if (!authUser || (!isAdmin && !isModerator)) {
      navigate("/admin-login");
      return;
    }
    fetchUsers();
    if (activeView === "issues") fetchIssuesList();
  }, [
    authUser,
    isAdmin,
    isModerator,
    authLoading,
    navigate,
    fetchUsers,
    fetchIssuesList,
    activeView,
  ]);

  const updateUserStatus = async (
    userId: string,
    status: string,
    banUntil?: string | null,
  ) => {
    setActionLoading(true);
    try {
      const updates: any = { status };
      if (banUntil !== undefined) updates.ban_until = banUntil;

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (error) throw error;
      toast.success(`User status updated to ${status}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(
        `Failed to update status: ${err?.message || "Unknown database error"}`,
      );
    }
    setActionLoading(false);
    setActionDialog({ type: "", user: null });
  };

  const handleEditSave = async () => {
    if (!actionDialog.user) return;
    setActionLoading(true);
    try {
      // Update profile using RPC for robustness
      const { error: profileError } = await supabase.rpc("admin_reset_username", {
        target_user_id: actionDialog.user.id,
        new_username: editForm.username
      });
      if (profileError) throw profileError;

      // Also update status directly as it is a profile field
      const { error: profileUpdateError } = await supabase.from("profiles").update({ 
        status: editForm.status
      }).eq("id", actionDialog.user.id);

      if (profileUpdateError) throw profileUpdateError;

      // Only update role if it has actually changed and requester is admin
      const currentRole = actionDialog.user.role || "user";
      if (editForm.role !== currentRole) {
        if (!isAdmin) {
          toast.error("Moderators cannot change user roles");
          return;
        }
        const { error: roleError } = await supabase.rpc("admin_update_user_role", {
          target_user_id: actionDialog.user.id,
          new_role: editForm.role as any
        });
        if (roleError) throw roleError;
      }

      // Update password if provided
      if (newPassword.trim()) {
        const { error: pwdError } = await supabase.rpc("admin_reset_password", {
          target_user_id: actionDialog.user.id,
          new_password: newPassword
        });
        if (pwdError) throw pwdError;
      }

      toast.success("User details updated");
      setNewPassword("");
      fetchUsers();
    } catch (err: any) {
      toast.error(
        "Failed to update user details: " + (err.message || "Unknown error"),
      );
    }
    setActionLoading(false);
    setActionDialog({ type: "", user: null });
  };


  const handleUpdateIssueStatus = async (id: string, status: DbIssue['status']) => {
    setActionLoading(true);
    try {
      await updateIssueStatus(id, status);
      toast.success(`Issue marked as ${status}`);
      fetchIssuesList();
    } catch (err: any) {
      toast.error("Failed to update issue status");
    }
    setActionLoading(false);
    setActionDialog({ type: "", issue: null });
  };

  const handleSendReply = async () => {
    if (!actionDialog.issue || !adminReply.trim() || !authUser) return;
    setActionLoading(true);
    try {
      // Add the message to the thread
      await addIssueMessage(actionDialog.issue.id, authUser.id, 'admin', adminReply);
      
      // Optionally resolve the issue if it was open
      if (actionDialog.issue.status === 'open') {
        await updateIssueStatus(actionDialog.issue.id, 'resolved');
      }

      toast.success("Reply sent");
      setAdminReply("");
      fetchIssuesList();
    } catch (err: any) {
      toast.error("Failed to send reply");
    }
    setActionLoading(false);
    setActionDialog({ type: "", issue: null });
  };

  const openEditDialog = (user: UserRow) => {
    setEditForm({
      username: user.username,
      role: user.role || "user",
      status: user.status,
    });
    setActionDialog({ type: "edit", user });
  };

  const handleApprove = (user: UserRow) =>
    updateUserStatus(user.id, "approved", null);
  const handleBlock = (user: UserRow) =>
    updateUserStatus(user.id, "blocked", null);

  const handleTempBan = (user: UserRow) => {
    const days = parseInt(banDays) || 7;
    const banUntil = new Date(Date.now() + days * 86400000).toISOString();
    updateUserStatus(user.id, "temporarily_banned", banUntil);
  };

  const handleRemove = async (user: UserRow) => {
    setActionLoading(true);
    try {
      // First attempt to delete via RPC (which removes auth.users and cascades everything perfectly)
      const { error: rpcError } = await supabase.rpc("admin_delete_user", {
        target_user_id: user.id,
      });

      if (rpcError) {
        console.error(
          "RPC Delete failed, falling back to soft delete",
          rpcError,
        );
        // Fallback: Delete profiles and user_roles directly if RPC doesn't exist
        const { error: roleDelErr } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", user.id);
        if (roleDelErr) console.warn("Failed to delete user role:", roleDelErr);

        const { error: deleteError } = await supabase
          .from("profiles")
          .delete()
          .eq("id", user.id);

        if (deleteError) {
          // Soft Delete via status update if actual delete is blocked by RLS
          const { error: softDeleteError } = await supabase
            .from("profiles")
            .update({ status: "deleted" })
            .eq("id", user.id);
          if (softDeleteError) {
            toast.error(
              `Delete failed: ${deleteError.message}. Soft-delete also failed: ${softDeleteError.message}`,
            );
          } else {
            toast.success("User permanently removed (Soft Deleted)");
            fetchUsers();
          }
        } else {
          toast.success("User profile removed successfully");
          fetchUsers();
        }
      } else {
        toast.success("User permanently deleted");
        fetchUsers();
      }
    } catch (err: any) {
      toast.error(`Failed to remove user: ${err.message || "Unknown error"}`);
    }
    setActionLoading(false);
    setActionDialog({ type: "", user: null });
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.includes(searchQuery),
  );

  const stats = {
    total: users.length,
    pending: users.filter((u) => u.status === "pending").length,
    approved: users.filter((u) => u.status === "approved").length,
    blocked: users.filter((u) => u.status === "blocked").length,
    banned: users.filter((u) => u.status === "temporarily_banned").length,
    adminRequests: users.filter((u) => u.status === "pending" && u.requested_role === "admin").length,
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              <h1 className="text-lg font-semibold text-foreground">
                Admin Dashboard
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate("/admin/agent")}
              variant="default"
              size="sm"
              className="gap-1.5"
            >
              <Bot className="h-3.5 w-3.5" /> AI Agent
            </Button>
            <Button
              onClick={fetchUsers}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            {
              label: "Total Users",
              value: stats.total,
              icon: <Users className="h-4 w-4" />,
              color: "text-foreground",
            },
            {
              label: "Pending",
              value: stats.pending,
              icon: <Clock className="h-4 w-4" />,
              color: "text-warning",
            },
            {
              label: "Approved",
              value: stats.approved,
              icon: <UserCheck className="h-4 w-4" />,
              color: "text-success",
            },
            {
              label: "Blocked",
              value: stats.blocked,
              icon: <UserX className="h-4 w-4" />,
              color: "text-destructive",
            },
            {
              label: "Temp Banned",
              value: stats.banned,
              icon: <Ban className="h-4 w-4" />,
              color: "text-warning",
            },
            {
              label: "Admin Requests",
              value: stats.adminRequests,
              icon: <Shield className="h-4 w-4" />,
              color: "text-destructive",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className={`flex items-center gap-2 mb-1 ${stat.color}`}>
                {stat.icon}
                <span className="text-2xl font-bold">{stat.value}</span>
              </div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* View Toggler */}
        <div className="flex items-center gap-1 p-1 bg-card border border-border rounded-xl w-fit">
          <button
            onClick={() => setActiveView("users")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === "users" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveView("issues")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === "issues" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
          >
            User Issues
          </button>
          <button
            onClick={() => setActiveView("ai_keys")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === "ai_keys" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
          >
            <KeyRound className="h-3 w-3" /> AI API Keys
          </button>
          <button
            onClick={() => setActiveView("ai_usage")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === "ai_usage" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
          >
            AI Usage
          </button>
        </div>

        {activeView === "ai_keys" ? (
          <AIKeyManager />
        ) : activeView === "ai_usage" ? (
          <AIUsageAnalytics />
        ) : activeView === "users" ? (
          <>
            {/* Search */}
            <div className="flex items-center gap-3">
              <Input
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm h-9 rounded-lg text-sm"
              />
            </div>

            {/* Users Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">User / Email</TableHead>
                    <TableHead className="text-xs">Role / Request</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Ban Until</TableHead>
                    <TableHead className="text-xs">Joined</TableHead>
                    <TableHead className="text-xs text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-sm text-muted-foreground py-8"
                      >
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const statusConf =
                        STATUS_CONFIG[user.status] || STATUS_CONFIG.pending;
                      const isCurrentUser = user.id === authUser?.id;
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium text-sm">
                            <div className="flex flex-col">
                              <span>{user.username} {isCurrentUser && <span className="text-[10px] text-muted-foreground">(you)</span>}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{user.email || "No Email"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge
                                variant={
                                  user.role === "admin"
                                    ? "destructive"
                                    : user.role === "moderator"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-[10px] w-fit"
                              >
                                {user.role === "admin" ? "Admin" : user.role === "moderator" ? "Moderator" : "User"}
                              </Badge>
                              {user.status === "pending" && user.requested_role && user.requested_role !== user.role && (
                                <Badge variant="outline" className="text-[9px] border-warning text-warning w-fit bg-warning/5 animate-pulse">
                                  Requesting {user.requested_role}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant={statusConf.variant}
                              className="gap-1 text-[10px]"
                            >
                              {statusConf.icon} {statusConf.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {user.ban_until
                              ? new Date(user.ban_until).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                                {user.status === "pending" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className={`h-7 text-[11px] gap-1 ${user.requested_role === 'admin' ? 'bg-destructive hover:bg-destructive/90' : ''}`}
                                    onClick={async () => {
                                      // If requesting admin, also grant the role
                                      if (user.requested_role === 'admin') {
                                         await supabase.from("user_roles").insert({ user_id: user.id, role: 'admin' });
                                      }
                                      handleApprove(user);
                                    }}
                                  >
                                    <CheckCircle className="h-3 w-3" /> 
                                    {user.requested_role === 'admin' ? 'Approve Admin' : 'Approve'}
                                  </Button>
                                )}
                                {user.status !== "approved" &&
                                  user.status !== "pending" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-[11px] gap-1"
                                      onClick={() => handleApprove(user)}
                                    >
                                      <CheckCircle className="h-3 w-3" />{" "}
                                      Unblock
                                    </Button>
                                  )}
                                {user.status === "approved" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] gap-1"
                                    onClick={() =>
                                      setActionDialog({ type: "block", user })
                                    }
                                  >
                                    <UserX className="h-3 w-3" /> Block
                                  </Button>
                                )}
                                {user.status !== "temporarily_banned" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] gap-1"
                                    onClick={() =>
                                      setActionDialog({ type: "ban", user })
                                    }
                                  >
                                    <Ban className="h-3 w-3" /> Ban
                                  </Button>
                                )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] px-2"
                                    onClick={() => openEditDialog(user)}
                                  >
                                    Edit
                                  </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive"
                                  disabled={!isAdmin && user.role === 'admin'}
                                  onClick={() =>
                                    setActionDialog({ type: "remove", user })
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : activeView === "issues" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">User Reported Issues</h3>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                {issues.length} Total Reports
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Page</TableHead>
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Comment</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issuesLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground/30" />
                      </TableCell>
                    </TableRow>
                  ) : issues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground">
                        No issues reported yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    issues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell className="max-w-[200px]">
                          <div className="text-sm font-bold truncate">{issue.page_title}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{issue.page_url}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {issue.user_email || 'Unknown'}
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <p className="text-xs line-clamp-2">{issue.comment}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={issue.status === 'open' ? 'destructive' : 'default'} className="text-[10px]">
                            {issue.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(issue.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {issue.status === 'open' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px]"
                                onClick={() => handleUpdateIssueStatus(issue.id, 'resolved')}
                                disabled={actionLoading}
                              >
                                Mark Resolved
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px]"
                              onClick={async () => {
                                setActionDialog({ type: "view_issue", issue });
                                setActionLoading(true);
                                try {
                                  const msgs = await fetchIssueMessages(issue.id);
                                  setIssueMessages(msgs);
                                } catch (e) {
                                  toast.error("Failed to load conversation");
                                }
                                setActionLoading(false);
                              }}
                            >
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </div>

      {/* Action Dialogs */}
      <Dialog
        open={actionDialog.type === "block"}
        onOpenChange={() => setActionDialog({ type: "", user: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block User</DialogTitle>
            <DialogDescription>
              Are you sure you want to block{" "}
              <strong>{actionDialog.user?.username}</strong>? They won't be able
              to log in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ type: "", user: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                actionDialog.user && handleBlock(actionDialog.user)
              }
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Block User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={actionDialog.type === "ban"}
        onOpenChange={() => setActionDialog({ type: "", user: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporarily Ban User</DialogTitle>
            <DialogDescription>
              Set ban duration for{" "}
              <strong>{actionDialog.user?.username}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Input
              type="number"
              value={banDays}
              onChange={(e) => setBanDays(e.target.value)}
              className="w-24 h-9"
              min="1"
              max="365"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ type: "", user: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                actionDialog.user && handleTempBan(actionDialog.user)
              }
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={actionDialog.type === "remove"}
        onOpenChange={() => setActionDialog({ type: "", user: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently remove{" "}
              <strong>{actionDialog.user?.username}</strong>? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ type: "", user: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                actionDialog.user && handleRemove(actionDialog.user)
              }
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Remove Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={actionDialog.type === "edit"}
        onOpenChange={() => setActionDialog({ type: "", user: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>
              Update the details for{" "}
              <strong>{actionDialog.user?.username}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={editForm.username}
                onChange={(e) =>
                  setEditForm({ ...editForm, username: e.target.value })
                }
                placeholder="Username"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(val) => setEditForm({ ...editForm, role: val })}
                disabled={!isAdmin}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {!isAdmin && <p className="text-[10px] text-muted-foreground">Only administrators can change roles.</p>}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm({ ...editForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="temporarily_banned">
                    Temporarily Banned
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label className="text-destructive">Reset Password (Optional)</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password to reset"
                className="border-destructive/20 focus-visible:ring-destructive"
              />
              <p className="text-[10px] text-muted-foreground italic">
                Leave blank to keep the current password.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ type: "", user: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={actionDialog.type === "view_issue"}
        onOpenChange={() => setActionDialog({ type: "", issue: null })}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Issue Details
            </DialogTitle>
          </DialogHeader>
          {actionDialog.issue && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Status</Label>
                  <div>
                    <Badge variant={actionDialog.issue.status === 'open' ? 'destructive' : 'default'}>
                      {actionDialog.issue.status}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <Label className="text-[10px] uppercase text-muted-foreground">Reported On</Label>
                  <div className="text-sm">{new Date(actionDialog.issue.created_at).toLocaleString()}</div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Reporter</Label>
                <div className="text-sm font-medium">{actionDialog.issue.user_email}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{actionDialog.issue.user_id}</div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Page</Label>
                <div className="text-sm font-bold">{actionDialog.issue.page_title}</div>
                <div className="p-2 bg-secondary/50 rounded text-xs font-mono break-all">
                  {actionDialog.issue.page_url}
                </div>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto p-4 bg-muted/30 rounded-lg border border-border">
                {actionLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : issueMessages.length === 0 ? (
                  <div className="text-center py-4 text-xs text-muted-foreground">No messages found</div>
                ) : (
                  issueMessages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender_role === 'admin' ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold">{msg.sender_role === 'admin' ? 'Admin' : 'User'}</span>
                        <span className="text-[9px] text-muted-foreground">{new Date(msg.created_at).toLocaleString()}</span>
                      </div>
                      <div className={`p-3 rounded-lg text-xs max-w-[80%] ${
                        msg.sender_role === 'admin' 
                          ? 'bg-primary text-primary-foreground rounded-tr-none' 
                          : 'bg-muted border border-border rounded-tl-none'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-1 pt-2">
                <Label className="text-[10px] uppercase text-muted-foreground">Send Reply</Label>
                <div className="space-y-3">
                  <Textarea
                    placeholder="Write your response to the user..."
                    value={adminReply}
                    onChange={(e) => setAdminReply(e.target.value)}
                    className="min-h-[100px] resize-none"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setActionDialog({ type: "", issue: null });
              setAdminReply("");
            }}>
              Close
            </Button>
            {actionDialog.issue?.status === 'open' && (
              <Button 
                onClick={handleSendReply}
                disabled={actionLoading || !adminReply.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reply & Resolve
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
