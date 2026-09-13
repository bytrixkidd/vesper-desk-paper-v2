import {
  Activity,
  AudioLines,
  Aperture,
  Briefcase,
  ChartCandlestick,
  Crosshair,
  FileStack,
  FlaskConical,
  Globe,
  LayoutDashboard,
  Landmark,
  MessagesSquare,
  Moon,
  Repeat2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { DeskId } from "@/lib/types";

export const NAV: {
  id: DeskId;
  href: string;
  label: string;
  kicker: string;
  action: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "vesper", href: "/", label: "Vesper", kicker: "CEO · Gespräch", action: "nav.vesper", icon: Aperture },
  { id: "command", href: "/kommando", label: "Kommando", kicker: "Autopilot 24/7", action: "nav.command", icon: LayoutDashboard },
  { id: "chat", href: "/chat", label: "Floor-Chat", kicker: "Alle Bots + Sie", action: "nav.floorChat", icon: MessagesSquare },
  { id: "charts", href: "/charts", label: "Charts", kicker: "Tape lesen", action: "nav.charts", icon: ChartCandlestick },
  { id: "universe", href: "/universe", label: "Universum", kicker: "10 Jahre", action: "nav.universe", icon: Globe },
  { id: "demo", href: "/demo", label: "Demo", kicker: "300 $ Paper", action: "nav.demo", icon: FlaskConical },
  { id: "trade", href: "/trade", label: "Trading", kicker: "Cash und Kapital", action: "nav.trading", icon: Crosshair },
  { id: "mandate", href: "/mandate", label: "Mandat", kicker: "IB-Pläne", action: "nav.mandate", icon: ShieldCheck },
  { id: "feedback", href: "/feedback", label: "Feedback", kicker: "Self-Improve", action: "nav.feedback", icon: Repeat2 },
  { id: "research", href: "/research", label: "Overnight", kicker: "Research", action: "nav.overnight", icon: Moon },
  { id: "filings", href: "/filings", label: "Filings", kicker: "Unternehmensmeldungen", action: "nav.filings", icon: FileStack },
  { id: "sentiment", href: "/sentiment", label: "Sentiment", kicker: "Aufmerksamkeit", action: "nav.sentiment", icon: Activity },
  { id: "flows", href: "/flows", label: "Whale-Flows", kicker: "Große Positionen", action: "nav.whaleFlows", icon: Wallet },
  { id: "earnings", href: "/earnings", label: "Earnings", kicker: "Zahlen", action: "nav.earnings", icon: AudioLines },
  { id: "macro", href: "/macro", label: "Makro", kicker: "Fed und Prints", action: "nav.macro", icon: Landmark },
  { id: "ops", href: "/ops", label: "Stabschef", kicker: "Fonds-Ops", action: "nav.chiefOfStaff", icon: Briefcase },
];
