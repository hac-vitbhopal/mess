import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase"; 
import { collection, addDoc, serverTimestamp, query, onSnapshot, orderBy, limit, doc, getDoc, updateDoc, deleteDoc, setDoc, getDocs } from "firebase/firestore";
import { 
  getAdminSession, 
  saveAdminSession, 
  clearAdminSession, 
  verifyAdminPasscode,
  MESSES as DEFAULT_STATIC_MESSES,
  MEAL_DEFS,
  deleteBroadcasts,
  toggleFeedbackStatus,
  type MealKey,
  type ItemFeedback
} from "@/lib/messhub";
import { 
  ShieldCheck, Users, Activity, MessageSquare, Megaphone, 
  LogOut, Menu, X, Clock, CheckSquare, Square, Star, 
  CheckCircle2, AlertCircle, Trash2, TrendingUp, Send, CheckCircle,
  PlusCircle, History, Utensils, Download, AlertTriangle, Lock, Unlock, KeyRound, Calendar
} from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy & Terms of Use — VITMess" },
      { name: "description", content: "VITMess platform terms of use and privacy disclaimer under the Hostel Administrative Council." },
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
          <span>&larr;</span> Back to VITMess
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
            VITMess | Hostel Administrative Council
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#FFEDD5] shadow-sm space-y-5">
          
          {/* Section 1: Official Administrative Ownership */}
          <div>
            <h2 className="font-bold text-[#C2410C] uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5">
              <span>🏛️</span> 1. Official Administrative Ownership
            </h2>
            <p className="text-[#221510]/90 text-xs sm:text-sm leading-relaxed">
              VITMess is an official digital utility platform operating under the Hostel Administrative Council to facilitate access to mess schedules, menu updates, announcements, and student feedback. The platform is intended to improve communication and coordination between hostel administration and students.
            </p>
          </div>

          <div className="h-[1px] w-full bg-[#FFEDD5]" />

          {/* Section 2: Data Privacy Notice */}
          <div>
            <h2 className="font-bold text-[#C2410C] uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5">
              <span>🔒</span> 2. Data Privacy Notice
            </h2>
            <p className="text-[#221510]/90 text-xs sm:text-sm leading-relaxed">
              The Hostel Administrative Council respects users' privacy and aims to handle information responsibly. We seek to limit the collection and use of personal information to what is necessary for the platform's functionality. However, absolute confidentiality, security, or privacy cannot be guaranteed. Users are advised not to submit sensitive personal information unless necessary. Any information submitted through feedback forms or enabled notification services may be processed for administrative, communication, or service-improvement purposes.
            </p>
          </div>

          <div className="h-[1px] w-full bg-[#FFEDD5]" />

          {/* Section 3: Feedback, Bug Reports & Technical Support */}
          <div>
            <h2 className="font-bold text-[#C2410C] uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5">
              <span>📝</span> 3. Feedback, Bug Reports & Technical Support
            </h2>
            <p className="text-[#221510]/90 text-xs sm:text-sm leading-relaxed">
              For website-related issues, technical bugs, errors, suggestions, or general feedback about VITMess, please contact the administrator through the official administrative email address provided on the website.
            </p>
            <p className="text-[#221510]/90 text-xs sm:text-sm leading-relaxed mt-2">
              When reporting an issue, please describe the problem clearly and include relevant details to help the administration investigate and resolve it efficiently.
            </p>
          </div>

          <div className="h-[1px] w-full bg-[#FFEDD5]" />

          {/* Section 4: Food & Mess Service Complaints */}
          <div>
            <h2 className="font-bold text-[#C2410C] uppercase tracking-wider text-xs mb-1.5 flex items-center gap-1.5">
              <span>🍲</span> 4. Food & Mess Service Complaints
            </h2>
            <p className="text-[#221510]/90 text-xs sm:text-sm leading-relaxed">
              For complaints or concerns regarding food quality, taste, hygiene, menu discrepancies, meal schedules, or mess services, please use the feedback form available on the VITMess website.
            </p>
            <p className="text-[#221510]/90 text-xs sm:text-sm leading-relaxed mt-2">
              Students are requested to provide accurate details, select the appropriate feedback category, and communicate their concerns in respectful and constructive language. Clear and properly completed feedback helps the administration review complaints and take appropriate action.
            </p>
            <p className="text-[#221510]/90 text-xs sm:text-sm leading-relaxed mt-2">
              VITMess facilitates the submission of feedback but does not guarantee a particular outcome or resolution timeframe.
            </p>
          </div>

        </div>
      </main>

      <footer className="mt-10 text-center text-[11px] text-[#C2410C]/60 font-medium">
        &copy; {new Date().getFullYear()} VITMess. Operated under the Hostel Administrative Council.
      </footer>
    </div>
  );
}