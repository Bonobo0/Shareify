import RateLimitMonitor from "@/app/components/rateLimitMonitor";

export default function RateLimitAdminPage() {
  return (
    <div className="min-h-screen bg-base-100">
      <RateLimitMonitor />
    </div>
  );
}
