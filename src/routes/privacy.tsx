import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy & Disclaimer — MessHub" },
      { name: "description", content: "MessHub platform terms of use and privacy disclaimer." },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FFF8F5] text-[#221510] px-5 py-8 max-w-2xl mx-auto font-sans select-none">
      
      {/* Header Navigation */}
      <header className="flex items-center justify-between pb-6 border-b border-[#FFEDD5]">
        <Link to="/" className="text-xs font-bold uppercase tracking-wider text-[#F97316] hover:opacity-80 transition flex items-center gap-1">
          <span>&larr;</span> Back to MessHub
        </Link>
        <span className="text-xs font-bold text-[#C2410C] bg-[#FFEDD5] px-3 py-1 rounded-full">
          Legal & Privacy
        </span>
      </header>

      {/* Main Content Area */}
      <main className="mt-8 space-y-6 text-sm leading-relaxed">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#221510]">
            Privacy Policy & Terms of Use
          </h1>
          <p className="text-[#C2410C]/80 text-xs mt-1 font-medium">
            MessHub Student Utility Infrastructure
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#FFEDD5] shadow-sm space-y-5">
          
          {/* Section 1: Independent App Disclaimer */}
          <div>
            <h2 className="font-bold text-[#C2410C] uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5">
              <span>⚠️</span> 1. Independent Student Utility
            </h2>
            <p className="text-[#221510]/90 text-xs sm:text-sm">
              MessHub is an independent, community-built platform created solely for student convenience. It does <strong>not</strong> represent, manage, or hold official ownership of any mess facility or catering service.
            </p>
          </div>

          <div className="h-[1px] w-full bg-[#FFEDD5]" />

          {/* Section 2: Data Privacy */}
          <div>
            <h2 className="font-bold text-[#C2410C] uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5">
              <span>🔒</span> 2. Data Privacy Notice
            </h2>
            <p className="text-[#221510]/90 text-xs sm:text-sm">
              We value your privacy. MessHub <strong>does not collect or store any personal email address or phone number</strong> during onboarding. Enabling push notifications is <strong>solely voluntary</strong> and used exclusively so you can receive timely updates regarding meal schedules and broadcasts sent by the mess admin.
            </p>
          </div>

          <div className="h-[1px] w-full bg-[#FFEDD5]" />

          {/* Section 3: Menu Updates & Feedback Form */}
          <div>
            <h2 className="font-bold text-[#C2410C] uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5">
              <span>📝</span> 3. Menu Updates & Feedback
            </h2>
            <p className="text-[#221510]/90 text-xs sm:text-sm">
              For any mess menu updates, corrections, or suggestions, please fill out the feedback form available in the app dashboard. Kindly include your <strong>email address and phone number</strong> in the description if you require further follow-up or contact from the admin.
            </p>
          </div>

          <div className="h-[1px] w-full bg-[#FFEDD5]" />

          {/* Section 4: Food Quality & Operational Disclaimer */}
          <div>
            <h2 className="font-bold text-[#C2410C] uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5">
              <span>🍲</span> 4. Food & Service Disclaimer
            </h2>
            <p className="text-[#221510]/90 text-xs sm:text-sm">
              MessHub is strictly a digital schedule provider. We are <strong>not responsible for food quality, taste, hygiene, menu changes, or service availability</strong>. For any food-related issues, complaints, or inquiries, please contact your respective mess owners or catering management directly.
            </p>
          </div>

        </div>
      </main>

      <footer className="mt-10 text-center text-[11px] text-[#C2410C]/60 font-medium">
        &copy; {new Date().getFullYear()} MessHub. Built by students, for students.
      </footer>
    </div>
  );
}