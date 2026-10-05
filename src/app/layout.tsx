import type { Metadata, Viewport } from "next";
import { InstallAppProvider } from "@/components/install-app";
import "./globals.css";
import "./planner.css";
export const metadata: Metadata = {
  title: "PP · Content Planner & Memory",
  applicationName: "น้องโจอา",
  description: "บอทตัวแทนของคุณ ความจำที่คุณเลือกแบ่งปัน",
  robots: { index: false, follow: false },
  icons: { icon: "/icons/app-192.png", apple: "/icons/app-180.png" },
  appleWebApp: { capable: true, title: "น้องโจอา", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#4f4038" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body><InstallAppProvider>{children}</InstallAppProvider></body></html>;
}
