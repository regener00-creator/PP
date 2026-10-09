import type { Metadata, Viewport } from "next";
import { InstallAppProvider } from "@/components/install-app";
import "./globals.css";
export const metadata: Metadata = {
  title: "น้องโจอา · เลขาส่วนตัว",
  applicationName: "น้องโจอา",
  description: "เลขาส่วนตัวสำหรับคุณ ครอบครัว และเพื่อน จำ ถาม เตือน นัดหมาย และคุยทั่วไป",
  robots: { index: false, follow: false },
  icons: { icon: "/icons/app-192.png", apple: "/icons/app-180.png" },
  appleWebApp: { capable: true, title: "น้องโจอา", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#4f4038" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body><InstallAppProvider>{children}</InstallAppProvider></body></html>;
}
