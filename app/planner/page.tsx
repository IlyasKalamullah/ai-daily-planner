import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import Planner from "@/components/Planner";

export default async function PlannerPage() {
  const session = await auth();
  if (!session?.user || session.error) redirect("/");

  return (
    <>
      <header className="topbar">
        <div className="brand">AI Daily Planner</div>
        <div className="user">
          {session.user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar" src={session.user.image} alt="" referrerPolicy="no-referrer" />
          )}
          <span className="user-email">{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="btn btn-ghost" type="submit">
              Keluar
            </button>
          </form>
        </div>
      </header>
      <Planner />
    </>
  );
}
