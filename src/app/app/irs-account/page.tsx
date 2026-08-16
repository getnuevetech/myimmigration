import { redirect } from "next/navigation";

export const metadata = { title: "USCIS account guide" };

export default async function IrsAccountPage() {
  redirect("/app/uscis-account");
}
