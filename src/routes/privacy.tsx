import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy & Terms of Use — VITMESS" },
      { name: "description", content: "VITMESS platform terms of use and privacy disclaimer under the Hostel Administrative Council." },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#E9F7F4] text-[#193A40] px-5 py-8 max-w-2xl mx-auto font-sans select-none">
      
      {/* Header Navigation */}
      <header className="flex items-center justify-between pb-6 border-b border-[#B5DED4]">
        <Link to="/" className="text-xs font-bold uppercase tracking-wider text-[#007F86] hover:opacity-80 transition flex items-center gap-1">
          <span>&larr;</span> Back to VITMESS
        </Link>
        <span className="text-xs font-bold text-[#007F86] bg-[#B5DED4]/40 px-3 py-1 rounded-full border border-[#B5DED4]">
          Legal & Privacy
        </span>
      </header>

      {/* Main Content Area */}
      <main className="mt-8 space-y-6 text-sm leading-relaxed">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#193A40]">
            Privacy Policy & Terms of Use
          </h1>
          <p className="text-[#193A40]/70 text-xs mt-1 font-medium">
            VITMESS | Hostel Administrative Council
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#B5DED4] shadow-sm space-y-5">
          
          {/* Section 1: Official Administrative Ownership */}
          <div>
            <h2 className="font-bold text-[#007F86] uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5">
              <span>🏛️</span> 1. Official Administrative Ownership
            </h2>
            <p className="text-[#193A40]/90 text-xs sm:text-sm leading-relaxed">
              VITMESS is an official digital utility platform operating under the Hostel Administrative Council to facilitate access to mess schedules, menu updates, announcements, and student feedback. The platform is intended to improve communication and coordination between hostel administration and students.
            </p>
          </div>

          <div className="h-[1px] w-full bg-[#B5DED4]/60" />

          {/* Section 2: Data Privacy Notice */}
          <div>
            <h2 className="font-bold text-[#007F86] uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5">
              <span>🔒</span> 2. Data Privacy Notice
            </h2>
            <p className="text-[#193A40]/90 text-xs sm:text-sm leading-relaxed">
              The Hostel Administrative Council respects users' privacy and aims to handle information responsibly. We seek to limit the collection and use of personal information to what is necessary for the platform's functionality. However, absolute confidentiality, security, or privacy cannot be guaranteed. Users are advised not to submit sensitive personal information unless necessary. Any information submitted through feedback forms or enabled notification services may be processed for administrative, communication, or service-improvement purposes.
            </p>
          </div>

          <div className="h-[1px] w-full bg-[#B5DED4]/60" />

          {/* Section 3: Feedback, Bug Reports & Technical Support */}
          <div>
            <h2 className="font-bold text-[#007F86] uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5">
              <span>📝</span> 3. Feedback, Bug Reports & Technical Support
            </h2>
            <p className="text-[#193A40]/90 text-xs sm:text-sm leading-relaxed">
              For website-related issues, technical bugs, errors, suggestions, or general feedback about VITMESS, please contact the administrator through the official administrative email address provided on the website.
            </p>
            <p className="text-[#193A40]/90 text-xs sm:text-sm leading-relaxed mt-2">
              When reporting an issue, please describe the problem clearly and include relevant details to help the administration investigate and resolve it efficiently.
            </p>
          </div>

          <div className="h-[1px] w-full bg-[#B5DED4]/60" />

          {/* Section 4: Food & Mess Service Complaints */}
          <div>
            <h2 className="font-bold text-[#007F86] uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5">
              <span>🍲</span> 4. Food & Mess Service Complaints
            </h2>
            <p className="text-[#193A40]/90 text-xs sm:text-sm leading-relaxed">
              For complaints or concerns regarding food quality, taste, hygiene, menu discrepancies, meal schedules, or mess services, please use the feedback form available on the VITMESS website.
            </p>
            <p className="text-[#193A40]/90 text-xs sm:text-sm leading-relaxed mt-2">
              Students are requested to provide accurate details, select the appropriate feedback category, and communicate their concerns in respectful and constructive language. Clear and properly completed feedback helps the administration review complaints and take appropriate action.
            </p>
            <p className="text-[#193A40]/90 text-xs sm:text-sm leading-relaxed mt-2">
              VITMESS facilitates the submission of feedback but does not guarantee a particular outcome or resolution timeframe.
            </p>
          </div>

        </div>
      </main>

      <footer className="mt-10 text-center text-[11px] text-[#193A40]/60 font-medium">
        &copy; {new Date().getFullYear()} VITMESS. Operated under the Hostel Administrative Council.
      </footer>
    </div>
  );
}