import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Onboarding } from "@/components/messhub/Onboarding";
import { StudentHome } from "@/components/messhub/StudentHome";
import { getProfile, type StudentProfile } from "@/lib/messhub";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfile(getProfile());
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!profile) {
    return <Onboarding onComplete={(p) => setProfile(p)} />;
  }

  return <StudentHome profile={profile} onSignOut={() => setProfile(null)} />;
}
