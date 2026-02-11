import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, RefreshCw, Link2, Phone, Database, Settings, Search, FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { hasRoutePermission } from "@/lib/route-permissions";
import { redirect } from "next/navigation";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  
  if (!session) {
    redirect("/login");
  }

  const permissions = (session.user as any)?.permissions || [];
  const role = (session.user as any)?.role || null;

  const hasAccess = (route: string) => hasRoutePermission(permissions, role, route);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-2">
          Welcome to the Telecom Operations Control Plane
        </p>
      </div>

      {params.error === "unauthorized" && (
        <div className="rounded-lg border border-red-800/50 bg-red-950/20 p-4">
          <p className="text-red-400 font-medium">
            ⚠️ You do not have permission to access that page.
          </p>
        </div>
      )}

      {/* Provision Section */}
      {hasAccess("/provision/check-sync") && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold bg-gradient-to-r from-violet-400 to-purple-500 bg-clip-text text-transparent">
            Provision
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-violet-800/50 hover:border-violet-500/80 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/20 hover:scale-[1.02] bg-gradient-to-br from-slate-900 to-slate-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-600/20">
                    <RefreshCw className="h-5 w-5 text-violet-400" />
                  </div>
                  Check Sync
                </CardTitle>
                <CardDescription>
                  Check synchronization status for entities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/provision/check-sync">
                  <Button className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/30 transition-all duration-200">
                    Open Check Sync
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Common Utilities Section */}
      {(hasAccess("/common-utilities/rabbitmq") || 
        hasAccess("/common-utilities/generate-signed-url") || 
        hasAccess("/call-details")) && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
            Common Utilities
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {hasAccess("/common-utilities/rabbitmq") && (
              <Card className="border-emerald-800/50 hover:border-emerald-500/80 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02] bg-gradient-to-br from-slate-900 to-slate-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-600/20">
                      <MessageSquare className="h-5 w-5 text-emerald-400" />
                    </div>
                    RabbitMQ
                  </CardTitle>
                  <CardDescription>
                    Push messages to RabbitMQ queues
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/common-utilities/rabbitmq">
                    <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30 transition-all duration-200">
                      Open RabbitMQ
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {hasAccess("/common-utilities/generate-signed-url") && (
              <Card className="border-sky-800/50 hover:border-sky-500/80 transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/20 hover:scale-[1.02] bg-gradient-to-br from-slate-900 to-slate-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-sky-500/20 to-cyan-600/20">
                      <Link2 className="h-5 w-5 text-sky-400" />
                    </div>
                    Generate Signed URL
                  </CardTitle>
                  <CardDescription>
                    Generate signed URLs for S3 recording URLs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/common-utilities/generate-signed-url">
                    <Button className="w-full bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-600 hover:to-cyan-700 text-white shadow-lg shadow-sky-500/30 transition-all duration-200">
                      Open Signed URL
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {hasAccess("/call-details") && (
              <Card className="border-indigo-800/50 hover:border-indigo-500/80 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.02] bg-gradient-to-br from-slate-900 to-slate-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-600/20">
                      <Search className="h-5 w-5 text-indigo-400" />
                    </div>
                    Call Details
                  </CardTitle>
                  <CardDescription>
                    Search and view call details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/call-details">
                    <Button className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 transition-all duration-200">
                      Open Call Details
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Numbers Section */}
      {(hasAccess("/numbers") || hasAccess("/numbers-not-in-number-cache")) && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            Numbers
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {hasAccess("/numbers") && (
              <Card className="border-amber-800/50 hover:border-amber-500/80 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20 hover:scale-[1.02] bg-gradient-to-br from-slate-900 to-slate-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20">
                      <Phone className="h-5 w-5 text-amber-400" />
                    </div>
                    Numbers Lookup
                  </CardTitle>
                  <CardDescription>
                    Find numbers not in Bifrost for a specific trunk SID
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/numbers">
                    <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30 transition-all duration-200">
                      Open Numbers Lookup
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {hasAccess("/numbers-not-in-number-cache") && (
              <Card className="border-rose-800/50 hover:border-rose-500/80 transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/20 hover:scale-[1.02] bg-gradient-to-br from-slate-900 to-slate-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500/20 to-pink-600/20">
                      <Database className="h-5 w-5 text-rose-400" />
                    </div>
                    Numbers Not in Cache
                  </CardTitle>
                  <CardDescription>
                    Check numbers not in number cache
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/numbers-not-in-number-cache">
                    <Button className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg shadow-rose-500/30 transition-all duration-200">
                      Open Cache Check
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Twilio Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
          Twilio
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-yellow-800/50 hover:border-yellow-500/80 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/20 hover:scale-[1.02] bg-gradient-to-br from-slate-900 to-slate-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-600/20">
                  <Settings className="h-5 w-5 text-yellow-400" />
                </div>
                Twilio Operations
              </CardTitle>
              <CardDescription>
                Twilio-specific operations (Coming Soon)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/twilio">
                <Button className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white shadow-lg shadow-yellow-500/30 transition-all duration-200">
                  View Twilio
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Admin Section */}
      {hasAccess("/audit-logs") && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent">
            Admin
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-red-800/50 hover:border-red-500/80 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/20 hover:scale-[1.02] bg-gradient-to-br from-slate-900 to-slate-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-rose-600/20">
                    <FileText className="h-5 w-5 text-red-400" />
                  </div>
                  Audit Logs
                </CardTitle>
                <CardDescription>
                  View system audit logs and user activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/audit-logs">
                  <Button className="w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg shadow-red-500/30 transition-all duration-200">
                    View Audit Logs
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
