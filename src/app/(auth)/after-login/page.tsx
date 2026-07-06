import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AfterLogin() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  switch (session.user.role) {
    case "platform_owner":
      redirect("/platform");
    case "firm_admin":
    case "associate":
      redirect("/dashboard");
    case "client":
      redirect("/portal");
    default:
      redirect("/login");
  }
}
