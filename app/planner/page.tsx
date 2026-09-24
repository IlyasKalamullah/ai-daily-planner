import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import Planner from "@/components/Planner";
import ThemeToggle from "@/components/ThemeToggle";
import { CalendarIcon, LogoutIcon } from "@/components/Icons";

export default async function PlannerPage() {
  const session = await auth();
  if (!session?.user || session.error) redirect("/");

  const name = session.user.name || session.user.email || "";
  const firstName = name.split(/[\s@]/)[0];

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="logo">
            <CalendarIcon size={18} />
          </div>
          <span>Daily Planner</span>
        </div>
        <div className="user">
          <ThemeToggle />
          <div className="user-chip">
            {session.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avatar" src={session.user.image} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="avatar avatar-fallback">{firstName.charAt(0).toUpperCase()}</span>
            )}
            <span className="user-email">{session.user.email}</span>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="btn btn-ghost btn-icon" type="submit" title="Keluar" aria-label="Keluar">
              <LogoutIcon />
            </button>
          </form>
        </div>
      </header>
      <Planner firstName={firstName} />
    </>
  );
}
