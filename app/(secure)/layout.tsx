import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/session";

export default function SecureLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("uc_session")?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
